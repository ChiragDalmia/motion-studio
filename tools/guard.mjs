// Repo invariants. Cheap, node-only, runs on every commit.
// These are the assertions that keep the load-bearing rules real.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const read = (f) => fs.readFileSync(P(f), 'utf8');
const fails = [];
const ok = [];
const fail = (m) => fails.push(m);
const pass = (m) => ok.push(m);

// ---- the pinned upstream contract -------------------------------------------
// ai.md summarises this. If a number moves, the digest is stale and silently
// wrong, so a change must fail the build rather than warn.
const PINNED = {
  version: '0.8.27',
  ruleCount: 83,
  groups: { core: 12, media: 17, gsap: 21, captions: 7, composition: 20, adapters: 2, textures: 1, fonts: 2, slideshow: 1 },
  MAX_COMPOSITION_LINES: 300,
  MAX_TIMED_ELEMENTS_PER_TRACK: 3,
  HEAVY_OVERLAY_ELEMENT_COUNT_WARN: 25,
};

const AI_MD_MAX_BYTES = 6656;
const BRAND_SLUG = /^[a-z][a-z0-9]{2,11}$/; // no hyphen: builds/<brand>-<slug> must parse at the first hyphen
const FILM_SLUG = /^[a-z][a-z0-9-]{2,31}$/;

const SKILL_ALLOW = [
  'hyperframes-core/references/determinism-rules.md',
  'hyperframes-registry/SKILL.md',
  'motion-doctrine/SKILL.md',
  'hyperframes-audio/references/presets.md',
];

function* walk(...roots) {
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const e of fs.readdirSync(r, { withFileTypes: true })) {
      const f = path.join(r, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        yield* walk(f);
      } else yield f;
    }
  }
}
const dirs = (d) => (fs.existsSync(d)
  ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name)
  : []);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// ---- 1. the suppression paragraph -------------------------------------------
{
  const c = read('CLAUDE.md');
  const need = [
    'This repo authors HyperFrames HTML directly.',
    'Do NOT invoke the hyperframes,',
    'this instruction supersedes them.',
    'Read ai.md first',
    'Never read lib/, tools/ or builds/.',
  ];
  const missing = need.filter((s) => !c.includes(s));
  if (missing.length) fail(`CLAUDE.md suppression paragraph altered; missing: ${missing.join(' | ')}`);
  else pass('CLAUDE.md suppression paragraph intact');
}

// ---- 2. the digest cap ------------------------------------------------------
{
  const n = fs.statSync(P('ai.md')).size;
  if (n > AI_MD_MAX_BYTES) fail(`ai.md is ${n} B, cap is ${AI_MD_MAX_BYTES} B`);
  else pass(`ai.md ${n} B / ${AI_MD_MAX_BYTES} B cap`);
}

// ---- 3. no skill reference outside the four-task allowlist ------------------
{
  const hits = [];
  const skillRef = /\b(?:hyperframes[a-z-]*|media-use|motion-doctrine)\/(?:references\/)?[A-Za-z0-9_.-]+\.md\b/g;
  for (const f of walk(ROOT)) {
    if (/(^|\/)(node_modules|builds|docs)\//.test(rel(f))) continue;
    if (!/\.(md|mjs|js|json|ts|html)$/.test(f)) continue;
    if (rel(f) === 'tools/guard.mjs') continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(skillRef)) {
      if (!SKILL_ALLOW.includes(m[0])) hits.push(`${rel(f)}: ${m[0]}`);
    }
  }
  if (hits.length) fail(`skill reference outside the allowlist:\n       ${hits.join('\n       ')}`);
  else pass('no skill reference outside the four-task allowlist');
}

// ---- 4. the upstream contract has not drifted -------------------------------
{
  const lintDist = P('node_modules/@hyperframes/lint/dist/index.js');
  if (!fs.existsSync(lintDist)) {
    fail('@hyperframes/lint not installed — cannot verify the digest is current');
  } else {
    const before = fails.length;
    const m = await import(pathToFileURL(lintDist).href);
    if (m.LINT_RULE_COUNT !== PINNED.ruleCount) {
      fail(`LINT_RULE_COUNT is ${m.LINT_RULE_COUNT}, pinned ${PINNED.ruleCount} — re-audit ai.md`);
    }
    const g = m.LINT_RULE_GROUP_COUNTS || {};
    const drift = Object.entries(PINNED.groups).filter(([k, v]) => g[k] !== v).map(([k, v]) => `${k} ${g[k]} != ${v}`);
    const extra = Object.keys(g).filter((k) => !(k in PINNED.groups)).map((k) => `new group ${k}`);
    if (drift.length || extra.length) fail(`lint rule groups drifted (${[...drift, ...extra].join(', ')}) — re-audit ai.md`);
    const src = fs.readFileSync(lintDist, 'utf8');
    for (const k of ['MAX_COMPOSITION_LINES', 'MAX_TIMED_ELEMENTS_PER_TRACK', 'HEAVY_OVERLAY_ELEMENT_COUNT_WARN']) {
      const hit = src.match(new RegExp(`${k}\\s*=\\s*(\\d+)`));
      if (!hit) fail(`${k} is gone from @hyperframes/lint — re-audit ai.md`);
      else if (Number(hit[1]) !== PINNED[k]) fail(`${k} is ${hit[1]}, pinned ${PINNED[k]} — re-audit ai.md`);
    }
    if (fails.length === before) pass(`upstream contract pinned: ${PINNED.ruleCount} rules in 9 groups, 300/3/25`);
  }
}

// ---- 5. exactly one pinned hyperframes spec repo-wide -----------------------
{
  const before = fails.length;
  const pkgs = [...walk(ROOT)].filter((f) => path.basename(f) === 'package.json' && !/node_modules/.test(rel(f)));
  if (pkgs.length !== 1) fail(`expected exactly 1 package.json, found ${pkgs.length}: ${pkgs.map(rel).join(', ')}`);
  const j = JSON.parse(read('package.json'));
  const d = j.devDependencies || {};
  for (const k of ['hyperframes', '@hyperframes/core']) {
    if (d[k] !== PINNED.version) fail(`${k} is "${d[k]}", expected exact ${PINNED.version} — runtime and CLI share a postMessage protocol and skew is silent`);
  }
  if (/[\^~*]|latest/.test(Object.values(d).join(' '))) fail('a devDependency uses a range; every pin must be exact');
  if (j.scripts?.prepare) fail('script "prepare" is an npm lifecycle hook and fires on every install — name it "pre"');
  if (fails.length === before) pass('one package.json, four exact pins');
}

// ---- 6. no per-film routing files, no dot-directory assets ------------------
{
  const bad = [];
  for (const f of walk(P('work'), P('brands'), P('lib'))) {
    const r = rel(f);
    const base = path.basename(f);
    if (['CLAUDE.md', 'AGENTS.md', 'meta.json', 'hyperframes.json'].includes(base)) {
      bad.push(`${r} — a hyperframes init artifact; it re-routes the agent into the skill tree`);
    }
    if (r.split('/').slice(0, -1).some((s) => s.startsWith('.'))) {
      bad.push(`${r} — under a dot directory, silently dropped from the cloud render zip`);
    }
  }
  if (bad.length) fail(`forbidden files:\n       ${bad.join('\n       ')}`);
  else pass('no per-film routing files, no dot-directory assets');
}

// ---- 7. lib/ carries no design decisions -----------------------------------
// Scope: craft predicates take every threshold as an argument, and shared motion
// sources name no colour, family or duration. The player chrome is UI furniture,
// not film design, and is exempt.
{
  const bad = [];
  if (fs.existsSync(P('lib/craft.mjs'))) {
    // Strip comments, then string and template literals: a threshold is always
    // an argument in code, never only a number inside a message. Percent
    // formatting in a complaint string is not a design decision.
    const src = read('lib/craft.mjs')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``')
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
    for (const m of src.matchAll(/(?<![\w.$])\d+(?:\.\d+)?/g)) {
      if (!['0', '1', '2'].includes(m[0])) bad.push(`lib/craft.mjs: numeric literal ${m[0]} — take it from the pack`);
    }
  }
  const shared = [...walk(P('lib/scenes'))].filter((f) => /\.(html|css|mjs)$/.test(f));
  if (fs.existsSync(P('lib/world.html'))) shared.push(P('lib/world.html'));
  for (const f of shared) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g)) bad.push(`${rel(f)}: colour literal ${m[0]}`);
    // Capture the value and test it. A `\s*(?!var\()` lookahead is useless
    // here: \s* backtracks to zero width and then matches " var(--text)".
    for (const m of src.matchAll(/font-family\s*:\s*([^;}\n]+)/g)) {
      if (!/^var\(/.test(m[1].trim())) bad.push(`${rel(f)}: family literal ${m[1].trim()}`);
    }
  }
  if (bad.length) fail(`lib/ contains design decisions:\n       ${bad.join('\n       ')}`);
  else pass('lib/ names no colour, family or threshold');
}

// ---- 8. film identity: slugs, required files, no output collision -----------
{
  const bad = [];
  const seen = new Map();
  for (const brand of dirs(P('work'))) {
    if (!BRAND_SLUG.test(brand)) bad.push(`brand slug "${brand}" must match ${BRAND_SLUG} — no hyphen, so builds/<brand>-<slug> parses at the first one`);
    if (!fs.existsSync(P('brands', brand))) bad.push(`work/${brand}/ has no brands/${brand}/ pack`);
    for (const slug of dirs(P('work', brand))) {
      if (!FILM_SLUG.test(slug)) bad.push(`film slug "${brand}/${slug}" must match ${FILM_SLUG}`);
      const out = `${brand}-${slug}.html`;
      if (seen.has(out)) bad.push(`output collision: ${brand}/${slug} and ${seen.get(out)} both resolve to builds/${out}`);
      seen.set(out, `${brand}/${slug}`);
      const d = P('work', brand, slug);
      if (!fs.existsSync(path.join(d, 'index.html'))) bad.push(`work/${brand}/${slug}/ has no index.html — check has no --composition flag, so a film must be its own project`);
      for (const req of ['BRIEF.md', 'STORYBOARD.md']) {
        if (!fs.existsSync(path.join(d, req))) bad.push(`work/${brand}/${slug}/ is missing the required ${req}`);
      }
    }
  }
  if (bad.length) fail(`film identity:\n       ${bad.join('\n       ')}`);
  else pass(`${seen.size} film(s): valid slugs, required briefs, unique output paths`);
}

// ---- 9. every character a film sets is in its brand's subsetted faces ------
// The faces that ship are subset to about a hundred codepoints. A character
// outside that set does not error: it renders as tofu, in a client's marketing
// page, and no other gate sees it — `check` runs against the source project
// where the full masters are still in place. This is cheap, needs no Python,
// and compares against what tools/font.mjs recorded as actually surviving.
{
  const bad = [];
  for (const brand of dirs(P('work'))) {
    const cov = P('brands', brand, 'font', 'coverage.json');
    if (!fs.existsSync(cov)) {
      bad.push(`brands/${brand}/font/coverage.json is missing — run: node tools/font.mjs ${brand}`);
      continue;
    }
    const set = new Set(JSON.parse(fs.readFileSync(cov, 'utf8')).codepoints);
    for (const slug of dirs(P('work', brand))) {
      const missing = new Map();
      for (const f of walk(P('work', brand, slug))) {
        if (!/\.html$/.test(f)) continue;
        for (const [ch, where] of visibleText(fs.readFileSync(f, 'utf8'))) {
          const cp = ch.codePointAt(0);
          if (cp > 0x1f && !set.has(cp)) {
            missing.set(ch, `${rel(f)} (${where})`);
          }
        }
      }
      for (const [ch, where] of missing) {
        bad.push(`${brand}/${slug} sets U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} "${ch}" which no subsetted face contains — it will render as tofu. ${where}`);
      }
    }
  }
  if (bad.length) fail(`glyph coverage:\n       ${bad.join('\n       ')}`);
  else pass('every character every film sets is present in its brand\'s faces');
}

/** Characters that will be painted: element text plus a few text-bearing
 *  attributes. Errs toward including more, which can only over-report. */
function visibleText(html) {
  const out = [];
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<html\b[^>]*>/i, ' ')                       // the variables blob is not painted
    .replace(/<[^>]+>/g, '');
  const decoded = body
    .replace(/&#8202;/g, ' ').replace(/&#8201;/g, ' ')
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  for (const ch of decoded) if (ch !== '') out.push([ch, 'text']);
  for (const m of html.matchAll(/\saria-label\s*=\s*"([^"]*)"/gi)) for (const ch of m[1]) out.push([ch, 'aria-label']);
  return out;
}

// ---- 10. no parent traversal in an authored asset path ---------------------
{
  const bad = [];
  const traversal = /(?:src|href|data-composition-src)\s*=\s*["']([^"']*\.\.\/[^"']*)["']/g;
  for (const f of walk(P('work'), P('lib'), P('brands'))) {
    if (!/\.html$/.test(f)) continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(traversal)) bad.push(`${rel(f)}: ${m[1]}`);
  }
  if (bad.length) fail(`../ in an asset path — a hard lint error and a runtime 404:\n       ${bad.join('\n       ')}`);
  else pass('no ../ in any authored asset path');
}

for (const m of ok) console.log(`  ok   ${m}`);
for (const m of fails) console.log(`  FAIL ${m}`);
console.log(fails.length ? `\nguard: ${fails.length} failure(s)` : `\nguard: ${ok.length} invariants hold`);
process.exit(fails.length ? 1 : 0);
