// The repo orchestrator. HyperFrames has no cross-project anything, so
// enumerate, prepare, fan out and aggregate is ours.
//
//   prepare   every command starts here: the workspace is generated
//   tier 1    guard + tokens + law + lint    every commit, ALL films, node only
//   tier 2    check --strict                 CHANGED films only, fanned out
//   tier 3    everything, with snapshots     nightly, never on the commit path
//
// The tiers are split because 72% of a check run is Chrome boot and compile,
// there is no batch mode, and the fixed cost per film is about 8.5s.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { lawOverFilm } from './law.mjs';
import { prepare, source } from './prepare.mjs';
import { build } from './build.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'node_modules/hyperframes/dist/cli.js');
// Each Chrome is 256 MB+, so this is a memory cap, not a throughput knob.
const MAX_FAN = Math.max(1, Math.min(12, os.cpus().length));
const dirs = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const films = () => {
  const out = [];
  for (const brand of dirs(path.join(ROOT, 'work'))) {
    for (const slug of dirs(path.join(ROOT, 'work', brand))) {
      const dir = path.join(ROOT, 'work', brand, slug);
      if (fs.existsSync(path.join(dir, 'film.json'))) out.push({ brand, slug, dir, id: `${brand}/${slug}` });
    }
  }
  return out;
};

const cli = (args) => exec(process.execPath, [CLI, ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });

/** Run `fn` over `items` with at most `n` in flight. */
async function fan(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/** Materialize every film's workspace. Sequential: the packs it reads are
 *  shared, so a race would be a real one. */
async function ensure(list, opts = {}) {
  const t = Date.now();
  const problems = [];
  for (const f of list) {
    try { await prepare(f.brand, f.slug, opts); }
    catch (e) { problems.push(`  ${f.id}: prepare failed\n${indent(e.message)}`); }
  }
  return { problems, ms: Date.now() - t };
}

/** Films whose own files changed against the given ref, plus every film when a
 *  shared source moved. A shared change has a blast radius; pretending it does
 *  not is how a broken scene ships in twenty-four other films. */
async function changed(ref = 'HEAD') {
  let names = [];
  try {
    const { stdout } = await exec('git', ['diff', '--name-only', ref], { cwd: ROOT });
    const { stdout: un } = await exec('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT });
    names = [...stdout.split('\n'), ...un.split('\n')].map((s) => s.trim()).filter(Boolean);
  } catch {
    return { list: films(), why: 'no git history to diff against, so every film is treated as changed' };
  }
  if (!names.length) return { list: [], why: 'nothing changed' };
  if (names.some((f) => /^(lib|tools)\//.test(f))) {
    return { list: films(), why: 'a file under lib/ or tools/ changed, so every film is in the blast radius' };
  }
  const touched = new Set(names.map((f) => f.match(/^(?:brands|media)\/([^/]+)\//)?.[1]).filter(Boolean));
  const list = films().filter((f) => names.some((n) => n.startsWith(`work/${f.brand}/${f.slug}/`)) || touched.has(f.brand));
  return { list, why: `${list.length} film(s) touched` };
}

// ---- tier 1 ----------------------------------------------------------------
async function tier1(list, prep) {
  const t = Date.now();
  const cpu0 = process.cpuUsage();
  const problems = [...prep.problems];

  try { await exec(process.execPath, [path.join(ROOT, 'tools/guard.mjs')], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }); }
  catch (e) { problems.push(indent(e.stdout || e.message)); }

  // lintProject IN-PROCESS, not `hyperframes lint` per film. Verified to
  // produce byte-identical findings to the CLI on the same broken fixture, and
  // it removes a node boot per film: 830ms/film via the CLI against 58ms here.
  // Imported before the fixed-cost mark; loading it is a one-time ~150ms.
  const lint = await import(pathToFileURL(path.join(ROOT, 'node_modules/@hyperframes/lint/dist/index.js')).href);
  const fixedMs = Date.now() - t;
  const fixedCpu = cpuMs(cpu0);

  await fan(list, MAX_FAN, async (f) => {
    const bad = lawOverFilm(f.dir).map((x) => `    ${where(f, x.file, x.line)}  ${x.msg}`);
    try {
      const r = await lint.lintProject(f.dir);
      for (const { file, result } of r.results || []) {
        for (const x of result.findings || []) {
          // --strict is mandatory: overlapping_gsap_tweens and the density,
          // caption and file-size rules are all WARNINGS upstream, so anything
          // less than this treats them as advice.
          if (x.severity !== 'error' && x.severity !== 'warning') continue;
          bad.push(`    ${f.id} ${where(f, file, x.line)}  ${x.severity}  ${x.code}${x.selector ? ' @' + x.selector : ''}: ${(x.message || '').slice(0, 140)}`);
        }
      }
    } catch (e) { bad.push(`    ${f.id}: lint threw, ${String(e.message).slice(0, 200)}`); }
    if (bad.length) problems.push(bad.join('\n'));
  });

  // Fixed and marginal are reported apart because only the marginal number
  // scales. guard and tokens cost the same at two films or two hundred.
  const ms = Date.now() - t;
  // CPU time, not wall clock: wall measured 221ms per film on a quiet machine
  // and 357ms on the same machine with a 12-way gate 1 running beside it, so
  // it reported the neighbours as often as the films. Reported, never gated:
  // the number tracks the machine as much as the code, so a ceiling set on one
  // desk fails a slower runner on code that did not change.
  const perFilm = (cpuMs(cpu0) - fixedCpu) / Math.max(1, list.length);
  console.log(`tier 1  prepare + guard + law + lint · ${list.length} film(s) · ${(prep.ms / 1000).toFixed(1)}s prepare + ${(ms / 1000).toFixed(1)}s wall · ${fixedCpu}ms fixed + ${perFilm.toFixed(0)}ms per film of CPU`);
  for (const p of problems) console.log(p);
  return problems.length;
}

/** What tools/prepare.mjs recorded about this film on its last run. */
function prepared(f) {
  const p = path.join(f.dir, 'prepared.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

/** A finding in a generated file, as the line of beats.html an author edits. */
function where(f, file, line) {
  const rel = String(file).replace(/\\/g, '/').replace(/^.*?work\/[^/]+\/[^/]+\//, '');
  return line ? source(f.dir, rel, Number(line)) : rel;
}

// ---- tier 2 ----------------------------------------------------------------
async function tier2(list, { transitions = true, snapshots = false, motion = false } = {}) {
  const t = Date.now();
  const problems = [];

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
    // samples 0 and checked 0: a green verdict on a run that never happened.
    const why = [];
    if (j.lint?.errorCount) why.push(`${j.lint.errorCount} lint error(s): ${(j.lint.findings || []).filter((x) => x.severity === 'error').map((x) => x.code).join(', ')}`);
    if (!(j.layout?.samples?.length > 0)) why.push('layout sampled 0 frames, so the browser never ran');
    // Exact, not "more than zero". A film of geometry alone has nothing for the
    // contrast audit to read, and demanding an element it cannot have made the
    // gate permanently red. Demanding zero from a film that does set type is
    // the same assertion pointed the other way, and it still catches a run
    // where the audit silently found nothing to look at.
    const typed = prepared(f).paintsType;
    if (typed && !(j.contrast?.checked > 0)) why.push('contrast checked 0 elements on a film that sets type, so the audit never ran');
    if (!typed && j.contrast?.checked > 0) why.push(`contrast checked ${j.contrast.checked} element(s) on a film prepare says sets no type; one of the two is wrong`);
    if (motion && !(j.motion?.enabled > 0 || j.motion?.samples > 0)) why.push('the motion audit did not run: index.motion.json was never materialized, so its assertions passed by not existing');
    for (const k of ['lint', 'runtime', 'layout', 'motion', 'contrast']) {
      const e = j[k]?.errorCount || 0;
      const w = j[k]?.warningCount || 0;
      if (e || w) why.push(`${k}: ${e} error(s), ${w} warning(s) · ${(j[k].findings || []).slice(0, 4).map((x) => `${x.code}${x.selector ? ' @' + x.selector : ''}${x.file ? ' ' + where(f, x.file, x.line) : ''}`).join('; ')}`);
    }
    if (why.length) problems.push(`  ${f.id}\n${why.map((x) => '    ' + x).join('\n')}`);
  });

  console.log(`tier 2  check --strict${transitions ? ' --at-transitions' : ''}${motion ? ' + motion' : ''} · ${list.length} film(s) · ${MAX_FAN}-way · ${((Date.now() - t) / 1000).toFixed(1)}s`);
  for (const p of problems) console.log(p);
  return problems.length;
}

// ---- ship ------------------------------------------------------------------
async function ship(list) {
  let bad = 0;
  if (await tier1(list, await ensure(list))) return 1;
  if (await tier2(list)) return 1;
  for (const f of list) {
    try {
      for (const script of ['build.mjs', 'gate2.mjs']) {
        const r = await exec(process.execPath, [path.join(ROOT, 'tools', script), f.brand, f.slug], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
        process.stdout.write(r.stdout);
      }
    } catch (e) {
      bad++;
      console.log(`  ${f.id} FAILED\n${indent(e.stdout || e.stderr || e.message)}`);
    }
  }
  return bad;
}

/**
 * Build, wipe the whole generated workspace, regenerate it from the three
 * tracked files, build again, compare. gate 2 builds twice from one prepared
 * tree, which cannot see a generator that depends on what was already on disk.
 * This can, and it is the assertion a clean clone has to satisfy.
 */
async function repro(list) {
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const out = (f) => path.join(ROOT, 'builds', `${f.brand}-${f.slug}.html`);
  let bad = 0;
  // Generate first. A workspace left over from an older run is a stale-tree
  // problem, which gate 2 already reports as one; this command is about
  // whether the same sources produce the same bytes twice.
  const first = await ensure(list);
  for (const x of first.problems) console.log(x);
  if (first.problems.length) return first.problems.length;
  for (const f of list) await build(f.brand, f.slug);
  const before = Object.fromEntries(list.map((f) => [f.id, sha(out(f))]));

  await exec(process.execPath, [path.join(ROOT, 'tools/clean.mjs')], { cwd: ROOT });
  const p = await ensure(list);
  for (const x of p.problems) console.log(x);
  if (p.problems.length) return p.problems.length;
  for (const f of list) await build(f.brand, f.slug);

  for (const f of list) {
    const after = sha(out(f));
    if (after === before[f.id]) console.log(`  ${f.id}  ${after.slice(0, 12)}`);
    else { bad++; console.log(`  ${f.id} NOT REPRODUCIBLE: ${before[f.id].slice(0, 12)} then ${after.slice(0, 12)}`); }
  }
  console.log(bad ? `\nrepro: ${bad} film(s) do not rebuild to the same bytes` : `\nrepro: ${list.length} film(s) rebuild byte for byte from a wiped workspace`);
  return bad;
}

/** A dropped shared scene and a dropped audio bed both pass check and both die
 *  in the upload zip. Compare what the film has against what cloud would get. */
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
/** What a render actually needs. The three tracked sources sit in the same
 *  directory and are not part of the project: lint follows the composition
 *  graph from index.html and never sees them, and neither should a render. */
const SOURCES = ['film.json', 'beats.html', 'NOTES.md'];
function countShippable(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || ['snapshots', 'renders'].includes(e.name)) continue;
      if (d === dir && SOURCES.includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (!/\.(md|json)$/.test(e.name)) n++;
    }
  };
  walk(dir);
  return n;
}

const indent = (s) => String(s).split('\n').filter(Boolean).map((l) => '    ' + l).join('\n');
/** CPU milliseconds since `since`, user plus system. */
const cpuMs = (since) => { const u = process.cpuUsage(since); return Math.round((u.user + u.system) / 1000); };

// ---- cli -------------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const pick = () => {
  if (rest.length >= 2) {
    const f = films().find((x) => x.brand === rest[0] && x.slug === rest[1]);
    if (!f) { console.error(`no film at work/${rest[0]}/${rest[1]}/film.json`); process.exit(2); }
    return [f];
  }
  if (rest.length === 1) return films().filter((x) => x.brand === rest[0]);
  return films();
};

let code = 0;
switch (cmd) {
  // --since <ref> narrows the list to what that ref changed, for a CI job that
  // should not gate every film on every commit. The reason goes to stderr so
  // stdout stays nothing but ids for a shell loop to read.
  case 'list': {
    const i = rest.indexOf('--since');
    if (i < 0) { for (const f of films()) console.log(`  ${f.id}`); break; }
    const ref = rest[i + 1];
    // Without this, changed() would fall back to its HEAD default and select
    // nothing on a clean checkout, which reads as a pass over zero films.
    if (!ref) { console.error('list --since needs a ref'); process.exit(2); }
    const c = await changed(ref);
    console.error(`  selection: ${c.why}`);
    for (const f of c.list) console.log(`  ${f.id}`);
    break;
  }
  case 'pre': {
    const list = pick();
    const p = await ensure(list, { motion: rest.includes('--motion') });
    for (const x of p.problems) console.log(x);
    if (!p.problems.length) for (const f of list) console.log(`  prepared ${f.id}`);
    code = p.problems.length;
    break;
  }
  case 'lint': {
    const list = pick();
    code = await tier1(list, await ensure(list));
    break;
  }
  case 'check': {
    let list = pick();
    if (!rest.length) {
      const c = await changed();
      console.log(`tier 2 selection: ${c.why}`);
      list = c.list;
    }
    if (!list.length) break;
    const p = await ensure(list);
    for (const x of p.problems) console.log(x);
    code = p.problems.length || await tier2(list, {});
    break;
  }
  case 'all': {
    const list = films();
    // Tier 3 is the only tier that materializes the motion sidecars: the audit
    // they trigger samples ~280 frames and roughly doubles a check run.
    code = (await tier1(list, await ensure(list, { motion: true })))
      + (await tier2(list, { transitions: true, snapshots: true, motion: true }));
    break;
  }
  case 'ship':
    code = await ship(pick());
    break;
  case 'build':
    for (const f of pick()) console.log(`  built builds/${f.brand}-${f.slug}.html`, (await build(f.brand, f.slug)).sizes.brotli, 'B brotli');
    break;
  case 'repro':
    code = await repro(pick());
    break;
  case 'zipcheck':
    code = await zipcheck(pick());
    break;
  default:
    console.log(`usage: npm run do <command>

  list                       every film in the repo
  pre   [brand] [slug]       materialize the generated workspace
  lint  [brand] [slug]       tier 1: prepare, guard, tokens, the formatting law, hyperframes lint
  check [brand] [slug]       tier 2: check --strict --at-transitions. With no
                             arguments, only films in the blast radius of the
                             current diff, and every film if lib/ or tools/ moved.
  build [brand] [slug]       bundle each one to builds/<brand>-<slug>.html
  repro [brand] [slug]       build, wipe the workspace, regenerate, build again, compare
  ship  <brand> <slug>       tier 1 + tier 2 + build + gate 2
  all                        tier 3: everything, with snapshots. Nightly, never on commit.
  zipcheck [brand] [slug]    what a cloud render would upload against what the film has`);
    code = 2;
}
process.exit(code ? 1 : 0);
