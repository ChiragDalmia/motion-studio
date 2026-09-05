// The repo orchestrator. HyperFrames has no cross-project anything — no batch
// lint, no batch gate, no shared-asset resolution — so enumerate, prepare, fan
// out and aggregate is ours.
//
// The three tiers exist because adopting `check` broke the old all-films-always
// gate and it cannot be recovered: 72% of every check run is Chrome boot and
// compile, there is no batch mode, and the fixed cost per film is ~8.5s.
//
//   tier 1  guard + law + lint      every commit, ALL films, node only
//   tier 2  check --strict          CHANGED films only, fanned out, hard cap 12
//   tier 3  everything              nightly, never on the commit path
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { lawOverFilm } from './law.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'node_modules/hyperframes/dist/cli.js');
// Each Chrome is 256 MB+, so this is a memory cap, not a throughput knob.
const MAX_FAN = Math.max(1, Math.min(12, os.cpus().length));

const films = () => {
  const out = [];
  for (const brand of ls(path.join(ROOT, 'work'))) {
    for (const slug of ls(path.join(ROOT, 'work', brand))) {
      if (fs.existsSync(path.join(ROOT, 'work', brand, slug, 'index.html'))) out.push({ brand, slug, dir: path.join(ROOT, 'work', brand, slug), id: `${brand}/${slug}` });
    }
  }
  return out;
};
const ls = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'compositions' && e.name !== 'media' && e.name !== 'snapshots' && e.name !== 'renders').map((e) => e.name) : []);

const node = (script, args) => exec(process.execPath, [path.join(ROOT, 'tools', script), ...args], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
const cli = (args) => exec(process.execPath, [CLI, ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });

/** Run `fn` over `items` with at most `n` in flight. */
async function fan(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

/** Films whose own files changed against the given ref, plus every film when a
 *  shared source moved. A shared-scene change has a blast radius; pretending it
 *  does not is how a broken scene ships in twenty-four other films. */
async function changed(ref = 'HEAD') {
  let names = [];
  try {
    const { stdout } = await exec('git', ['diff', '--name-only', ref], { cwd: ROOT });
    const { stdout: un } = await exec('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT });
    names = [...stdout.split('\n'), ...un.split('\n')].map((s) => s.trim()).filter(Boolean);
  } catch {
    return { list: films(), why: 'no git history to diff against — treating every film as changed' };
  }
  if (!names.length) return { list: [], why: 'nothing changed' };
  const shared = names.some((f) => /^(lib|tools)\//.test(f));
  if (shared) return { list: films(), why: 'a file under lib/ or tools/ changed, so every film is in the blast radius' };
  const touchedBrands = new Set(names.map((f) => f.match(/^brands\/([^/]+)\//)?.[1]).filter(Boolean));
  const list = films().filter((f) => names.some((n) => n.startsWith(`work/${f.brand}/${f.slug}/`)) || touchedBrands.has(f.brand));
  return { list, why: `${list.length} film(s) touched` };
}

// ---- tier 1 ----------------------------------------------------------------
async function tier1(list) {
  const t = Date.now();
  const problems = [];

  try { await node('guard.mjs', []); } catch (e) { problems.push(indent(e.stdout || e.message)); }
  try { await node('tokens.mjs', []); } catch (e) { problems.push(indent(e.stdout || e.message)); }

  // lintProject IN-PROCESS, not `hyperframes lint` per film. Verified to
  // produce byte-identical findings to the CLI on the same broken fixture, and
  // it removes a node boot per film: 830ms/film via the CLI against 58ms/film
  // here. At 200 films that is the difference between a 2.8-minute commit gate
  // and a 12-second one, and tier 1 is the tier that runs on ALL films.
  //
  // Imported BEFORE the fixed-cost mark: loading it is a one-time ~150ms, and
  // charging that to the per-film budget made a single-film run look like a
  // budget breach at 547ms/film.
  const lint = await import(pathToFileURL(path.join(ROOT, 'node_modules/@hyperframes/lint/dist/index.js')).href);
  const fixedMs = Date.now() - t;

  await fan(list, MAX_FAN, async (f) => {
    const v = lawOverFilm(f.dir);
    if (v.length) problems.push(v.map((x) => `  ${x.file}:${x.line}  ${x.msg}`).join('\n'));
    try {
      const r = await lint.lintProject(f.dir);
      const bad = [];
      for (const { file, result } of r.results || []) {
        for (const x of result.findings || []) {
          // --strict is mandatory: overlapping_gsap_tweens and the density,
          // caption and file-size rules are all WARNINGS upstream, so anything
          // less than this treats them as advice.
          if (x.severity === 'error' || x.severity === 'warning') {
            bad.push(`    ${f.id}/${file}  ${x.severity}  ${x.code}${x.selector ? ' @' + x.selector : ''}: ${(x.message || '').slice(0, 140)}`);
          }
        }
      }
      if (bad.length) problems.push(bad.join('\n'));
    } catch (e) {
      problems.push(`  ${f.id}: lint threw — ${String(e.message).slice(0, 200)}`);
    }
  });

  // Fixed and marginal are reported apart because only the marginal number
  // scales. The budget is 350ms per film; guard + tokens are two node boots
  // that cost the same whether the repo holds two films or two hundred.
  const ms = Date.now() - t;
  const perFilm = (ms - fixedMs) / Math.max(1, list.length);
  console.log(`tier 1  guard + tokens + law + lint · ${list.length} film(s) · ${(ms / 1000).toFixed(1)}s total = ${fixedMs}ms fixed + ${perFilm.toFixed(0)}ms per film (budget 350)`);
  if (perFilm > 350) problems.push(`  tier 1 marginal cost is ${perFilm.toFixed(0)}ms per film, over the 350ms budget — this tier runs on every film on every commit`);
  for (const p of problems) console.log(p);
  return problems.length;
}

// ---- tier 2 ----------------------------------------------------------------
async function tier2(list, { transitions = true, snapshots = false, motion = false } = {}) {
  const t = Date.now();
  const problems = [];

  // prepare is sequential: it writes into each film and the packs it reads are
  // shared, so a race would be a real one.
  for (const f of list) {
    try { await node('prepare.mjs', [f.brand, f.slug, ...(motion ? ['--motion'] : [])]); }
    catch (e) { problems.push(`  ${f.id}: prepare failed\n${indent(e.stdout || e.stderr || e.message)}`); }
  }

  await fan(list, MAX_FAN, async (f) => {
    // Filenames under snapshots/ are timestamp-derived and the command has no
    // output flag, so they accumulate across retimes forever.
    if (snapshots) fs.rmSync(path.join(f.dir, 'snapshots'), { recursive: true, force: true });
    const args = ['check', f.dir, '--strict', '--json'];
    if (transitions) args.push('--at-transitions');
    if (snapshots) args.push('--snapshots');
    let j;
    try { j = JSON.parse((await cli(args)).stdout); }
    catch (e) {
      try { j = JSON.parse(e.stdout); }
      catch { problems.push(`  ${f.id}: check did not return JSON\n${indent((e.stderr || e.message).slice(0, 600))}`); return; }
    }
    // Assert on COUNTS, never on the ok flags. A lint error skips the browser
    // while the envelope still reports runtime.ok true, contrast.ok true,
    // samples 0 and checked 0 — a green verdict on a run that never happened.
    const why = [];
    if (j.lint?.errorCount) why.push(`${j.lint.errorCount} lint error(s): ${(j.lint.findings || []).filter((x) => x.severity === 'error').map((x) => x.code).join(', ')}`);
    if (!(j.layout?.samples?.length > 0)) why.push('layout sampled 0 frames — the browser never ran');
    if (!(j.contrast?.checked > 0)) why.push('contrast checked 0 elements — the audit never ran');
    if (motion && !(j.motion?.enabled > 0 || j.motion?.samples > 0)) why.push('the motion audit did not run — index.motion.json was never materialized, so its assertions passed by not existing');
    for (const k of ['lint', 'runtime', 'layout', 'motion', 'contrast']) {
      const e = j[k]?.errorCount || 0;
      const w = j[k]?.warningCount || 0;
      if (e || w) why.push(`${k}: ${e} error(s), ${w} warning(s) — ${(j[k].findings || []).slice(0, 4).map((x) => `${x.code}${x.selector ? ' @' + x.selector : ''}`).join('; ')}`);
    }
    if (why.length) problems.push(`  ${f.id}\n${why.map((x) => '    ' + x).join('\n')}`);
  });

  const ms = Date.now() - t;
  console.log(`tier 2  check --strict${transitions ? ' --at-transitions' : ''}${motion ? ' + motion' : ''} · ${list.length} film(s) · ${MAX_FAN}-way · ${(ms / 1000).toFixed(1)}s`);
  for (const p of problems) console.log(p);
  return problems.length;
}

// ---- ship ------------------------------------------------------------------
async function ship(list) {
  let bad = 0;
  if (await tier1(list)) return 1;
  if (await tier2(list)) return 1;
  for (const f of list) {
    try {
      const b = await node('build.mjs', [f.brand, f.slug]);
      process.stdout.write(b.stdout);
      const g = await node('gate2.mjs', [f.brand, f.slug]);
      process.stdout.write(g.stdout);
    } catch (e) {
      bad++;
      console.log(`  ${f.id} FAILED\n${indent(e.stdout || e.stderr || e.message)}`);
    }
  }
  return bad;
}

/** One assertion nothing else makes: a dropped shared scene and a dropped audio
 *  bed both pass check and both die in the upload zip. Compare what the film
 *  prepared against what the cloud would actually receive. */
async function zipcheck(list) {
  let bad = 0;
  for (const f of list) {
    let j;
    try { j = JSON.parse((await cli(['cloud', 'render', f.dir, '--dry-run', '--json'])).stdout); }
    catch (e) {
      const t = (e.stdout || '') + (e.stderr || '');
      if (/auth|login|credential|unauthor/i.test(t)) { console.log(`  ${f.id}: skipped, cloud render needs auth (npx hyperframes auth)`); continue; }
      console.log(`  ${f.id}: cloud render --dry-run failed\n${indent(t.slice(0, 400))}`); bad++; continue;
    }
    const expect = countShippable(f.dir);
    const got = j.file_count ?? j.fileCount ?? j.files?.length;
    if (got != null && got !== expect) { console.log(`  ${f.id}: the zip would carry ${got} file(s), the prepared film has ${expect}`); bad++; }
    else console.log(`  ${f.id}: ${got ?? '?'} file(s) in the zip`);
  }
  return bad;
}
function countShippable(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || ['snapshots', 'renders'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (!/\.(md|json)$/.test(e.name)) n++;
    }
  };
  walk(dir);
  return n;
}

const indent = (s) => String(s).split('\n').filter(Boolean).map((l) => '    ' + l).join('\n');

// ---- cli -------------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const pick = () => {
  if (rest.length >= 2) {
    const f = films().find((x) => x.brand === rest[0] && x.slug === rest[1]);
    if (!f) { console.error(`no film at work/${rest[0]}/${rest[1]}`); process.exit(2); }
    return [f];
  }
  if (rest.length === 1) return films().filter((x) => x.brand === rest[0]);
  return films();
};

let code = 0;
switch (cmd) {
  case 'list':
    for (const f of films()) console.log(`  ${f.id}`);
    break;
  case 'lint':
    code = await tier1(pick());
    break;
  case 'check': {
    if (rest.length) { code = await tier2(pick()); break; }
    const c = await changed();
    console.log(`tier 2 selection: ${c.why}`);
    code = c.list.length ? await tier2(c.list) : 0;
    break;
  }
  case 'all':
    // Tier 3 is the only tier that materializes the motion sidecars: the audit
    // they trigger samples ~280 frames and roughly doubles a check run.
    code = (await tier1(films())) + (await tier2(films(), { transitions: true, snapshots: true, motion: true }));
    break;
  case 'ship':
    code = await ship(pick());
    break;
  case 'zipcheck':
    code = await zipcheck(pick());
    break;
  default:
    console.log(`usage: npm run do <command>

  list                       every film in the repo
  lint  [brand] [slug]       tier 1: guard, tokens, the formatting law, hyperframes lint
  check [brand] [slug]       tier 2: check --strict --at-transitions. With no
                             arguments, only films in the blast radius of the
                             current diff — and every film if lib/ or tools/ moved.
  ship  <brand> <slug>       tier 1 + tier 2 + build + gate 2
  all                        tier 3: everything, with snapshots. Nightly, never on commit.
  zipcheck [brand] [slug]    what a cloud render would actually upload vs what the film has`);
    code = 2;
}
process.exit(code ? 1 : 0);
