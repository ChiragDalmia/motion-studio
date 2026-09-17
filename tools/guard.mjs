// Repo invariants. Cheap, node-only, runs on every commit.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { load } from './film.mjs';
import { GENERATED } from './prepare.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const read = (f) => fs.readFileSync(P(f), 'utf8');
const fails = [];
const ok = [];
const fail = (m) => fails.push(m);
const pass = (m) => ok.push(m);

// The pinned upstream contract. AGENTS.md summarises it; if a number moves the
// digest is stale and silently wrong, so a change fails the build.
const PINNED = {
  version: '0.8.27',
  ruleCount: 83,
  groups: { core: 12, media: 17, gsap: 21, captions: 7, composition: 20, adapters: 2, textures: 1, fonts: 2, slideshow: 1 },
  MAX_COMPOSITION_LINES: 300,
  MAX_TIMED_ELEMENTS_PER_TRACK: 3,
  HEAVY_OVERLAY_ELEMENT_COUNT_WARN: 25,
};

const AGENTS_MAX_BYTES = 10240;
const AUTHORED_MAX_BYTES = 128 * 1024;
const COMMENT_RATIO_MAX = 0.35;
const COMMENT_RUN_MAX = 24;
const BRAND_SLUG = /^[a-z][a-z0-9]{2,11}$/; // no hyphen: builds/<brand>-<slug> parses at the first one
const FILM_SLUG = /^[a-z][a-z0-9-]{2,31}$/;
const FILM_SOURCES = ['film.json', 'beats.html', 'NOTES.md'];
const EM_DASH = '\u2014';
// Built from the codepoint so this file never contains the literal it bans.
const EM_ENTITY = new RegExp(`&(?:mdash|#${EM_DASH.codePointAt(0)}|#x${EM_DASH.codePointAt(0).toString(16)});`, 'gi');
const BINARY = /\.(woff2?|ttf|otf|png|jpe?g|webp|gif|mp3|wav|mp4|mov|zip|ico|pdf|docx|xlsx)$/i;

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
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const gitList = (...args) => execFileSync('git', ['ls-files', '-z', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  .split('\0').filter(Boolean);

// `tracked` is what is in the index. `carried` is that plus everything not yet
// staged and not ignored, which is what a commit would pick up. Content rules
// use `carried`, so a fresh file fails guard before it is staged rather than
// after; the rules that are about tracking use `tracked`.
let tracked = null;
let carried = null;
try {
  tracked = gitList('--cached');
  carried = [...new Set([...tracked, ...gitList('--cached', '--others', '--exclude-standard')])].sort();
} catch { /* no git here; the invariants that need it say so below */ }

// ---- 1. one set of agent instructions, in one shape -------------------------
// AGENTS.md is canonical for every coding agent. Claude Code reads CLAUDE.md
// and not AGENTS.md, so CLAUDE.md imports it and holds only what is specific
// to Claude. Two files, no duplicated rules, and a cap so the canonical one
// stays readable rather than becoming the place everything is appended to.
{
  const before = fails.length;
  const agents = read('AGENTS.md');
  const claude = read('CLAUDE.md');

  const n = Buffer.byteLength(agents);
  if (n > AGENTS_MAX_BYTES) fail(`AGENTS.md is ${n} B, cap is ${AGENTS_MAX_BYTES} B. Cut, do not append`);
  if (!claude.startsWith('@AGENTS.md\n')) fail('CLAUDE.md must begin with the line @AGENTS.md, which is how Claude Code loads the canonical file');

  const need = [
    'This repo authors HyperFrames HTML directly.',
    'Do NOT invoke the hyperframes,',
    'this instruction supersedes them.',
  ];
  const missing = need.filter((x) => !claude.includes(x));
  if (missing.length) fail(`the CLAUDE.md suppression paragraph was altered; missing: ${missing.join(' | ')}`);

  // Contradiction and duplication are the two failure modes of split
  // instructions: a rule stated twice drifts, and a rule stated twice
  // differently is a coin toss about which one the agent follows.
  const body = claude.split('\n').filter((l) => !l.startsWith('@')).join('\n');
  const dup = sentences(body).filter((x) => x.length > 60 && sentences(agents).includes(x));
  if (dup.length) fail(`CLAUDE.md repeats AGENTS.md verbatim, so the two will drift:\n       ${dup.slice(0, 3).map((x) => x.slice(0, 90)).join('\n       ')}`);

  if (fs.existsSync(P('ai.md'))) fail('ai.md is back. AGENTS.md is the canonical instruction file; there is no second one');
  if (fails.length === before) pass(`AGENTS.md ${n} B / ${AGENTS_MAX_BYTES} B, imported by CLAUDE.md, no rule stated twice`);
}

// ---- 2. no skill reference outside the four-task allowlist ------------------
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

// ---- 3. the upstream contract has not drifted -------------------------------
{
  const lintDist = P('node_modules/@hyperframes/lint/dist/index.js');
  if (!fs.existsSync(lintDist)) {
    fail('@hyperframes/lint not installed, so the digest cannot be verified current');
  } else {
    const before = fails.length;
    const m = await import(pathToFileURL(lintDist).href);
    if (m.LINT_RULE_COUNT !== PINNED.ruleCount) fail(`LINT_RULE_COUNT is ${m.LINT_RULE_COUNT}, pinned ${PINNED.ruleCount}. Re-audit AGENTS.md`);
    const g = m.LINT_RULE_GROUP_COUNTS || {};
    const drift = Object.entries(PINNED.groups).filter(([k, v]) => g[k] !== v).map(([k, v]) => `${k} ${g[k]} != ${v}`);
    const extra = Object.keys(g).filter((k) => !(k in PINNED.groups)).map((k) => `new group ${k}`);
    if (drift.length || extra.length) fail(`lint rule groups drifted (${[...drift, ...extra].join(', ')}). Re-audit AGENTS.md`);
    const src = fs.readFileSync(lintDist, 'utf8');
    for (const k of ['MAX_COMPOSITION_LINES', 'MAX_TIMED_ELEMENTS_PER_TRACK', 'HEAVY_OVERLAY_ELEMENT_COUNT_WARN']) {
      const hit = src.match(new RegExp(`${k}\\s*=\\s*(\\d+)`));
      if (!hit) fail(`${k} is gone from @hyperframes/lint. Re-audit AGENTS.md`);
      else if (Number(hit[1]) !== PINNED[k]) fail(`${k} is ${hit[1]}, pinned ${PINNED[k]}. Re-audit AGENTS.md`);
    }
    if (fails.length === before) pass(`upstream contract pinned: ${PINNED.ruleCount} rules in 9 groups, 300/3/25`);
  }
}

// ---- 4. exactly one pinned hyperframes spec repo-wide -----------------------
{
  const before = fails.length;
  const pkgs = [...walk(ROOT)].filter((f) => path.basename(f) === 'package.json' && !/node_modules/.test(rel(f)));
  if (pkgs.length !== 1) fail(`expected exactly 1 package.json, found ${pkgs.length}: ${pkgs.map(rel).join(', ')}`);
  const j = JSON.parse(read('package.json'));
  const d = j.devDependencies || {};
  for (const k of ['hyperframes', '@hyperframes/core']) {
    if (d[k] !== PINNED.version) fail(`${k} is "${d[k]}", expected exact ${PINNED.version}. Runtime and CLI share a postMessage protocol and skew is silent`);
  }
  if (/[\^~*]|latest/.test(Object.values(d).join(' '))) fail('a devDependency uses a range; every pin must be exact');
  if (j.scripts?.prepare) fail('script "prepare" is an npm lifecycle hook and fires on every install. Name it "pre"');
  if (fails.length === before) pass('one package.json, four exact pins');
}

// ---- 5. no per-film routing files, no dot-directory assets ------------------
{
  const bad = [];
  for (const f of walk(P('work'), P('brands'), P('lib'), P('media'))) {
    const r = rel(f);
    if (['CLAUDE.md', 'AGENTS.md', 'meta.json', 'hyperframes.json'].includes(path.basename(f))) {
      bad.push(`${r} is a hyperframes init artifact; it re-routes the agent into the skill tree`);
    }
    if (r.split('/').slice(0, -1).some((s) => s.startsWith('.'))) {
      bad.push(`${r} is under a dot directory, so it is silently dropped from the cloud render zip`);
    }
  }
  if (bad.length) fail(`forbidden files:\n       ${bad.join('\n       ')}`);
  else pass('no per-film routing files, no dot-directory assets');
}

// ---- 6. lib/ carries no design decisions -----------------------------------
// Craft predicates take every threshold as an argument, and shared markup names
// no colour, family or duration. The player chrome is UI furniture, not film
// design, and is exempt.
{
  const bad = [];
  if (fs.existsSync(P('lib/craft.mjs'))) {
    // Strip comments, then strings: a threshold is always an argument in code,
    // never only a number inside a message.
    const src = read('lib/craft.mjs')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
      .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``')
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
    for (const m of src.matchAll(/(?<![\w.$])\d+(?:\.\d+)?/g)) {
      if (!['0', '1', '2'].includes(m[0])) bad.push(`lib/craft.mjs: numeric literal ${m[0]}. Take it from the pack`);
    }
  }
  for (const f of [...walk(P('lib/scenes')), P('lib/world.html'), P('lib/beat.html')].filter((f) => fs.existsSync(f) && /\.(html|css|mjs)$/.test(f))) {
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

// ---- 7. film identity: slugs, the three sources, no output collision -------
{
  const bad = [];
  const seen = new Map();
  for (const brand of dirs(P('work'))) {
    if (!BRAND_SLUG.test(brand)) bad.push(`brand slug "${brand}" must match ${BRAND_SLUG}, with no hyphen, so builds/<brand>-<slug> parses at the first one`);
    if (!fs.existsSync(P('brands', brand))) bad.push(`work/${brand}/ has no brands/${brand}/ pack`);
    for (const slug of dirs(P('work', brand))) {
      if (!FILM_SLUG.test(slug)) bad.push(`film slug "${brand}/${slug}" must match ${FILM_SLUG}`);
      const out = `${brand}-${slug}.html`;
      if (seen.has(out)) bad.push(`output collision: ${brand}/${slug} and ${seen.get(out)} both resolve to builds/${out}`);
      seen.set(out, `${brand}/${slug}`);
      for (const req of FILM_SOURCES) {
        if (!fs.existsSync(P('work', brand, slug, req))) bad.push(`work/${brand}/${slug}/ is missing the required ${req}`);
      }
      try { load(brand, slug); } catch (e) { bad.push(String(e.message)); }
    }
  }
  if (bad.length) fail(`film identity:\n       ${bad.join('\n       ')}`);
  else pass(`${seen.size} film(s): valid slugs, three sources each, unique output paths`);
}

// ---- 8. a film tracks its three sources and nothing generated --------------
{
  if (!carried) ok.push('film-file shape not checked: git is not available here');
  else {
    const bad = [];
    const gen = new Set(GENERATED);
    for (const f of carried) {
      const m = f.match(/^work\/([^/]+)\/([^/]+)\/(.+)$/);
      if (!m || !fs.existsSync(P(f))) continue;   // a deletion not staged yet
      const top = m[3].split('/')[0];
      if (gen.has(top)) bad.push(`${f} is generated by tools/prepare.mjs but tracked. Add it to .gitignore and git rm --cached it.`);
      else if (!FILM_SOURCES.includes(m[3])) bad.push(`${f} is not one of ${FILM_SOURCES.join(', ')}. A film tracks three files and nothing else.`);
    }
    if (bad.length) fail(`tracked film files:\n       ${bad.join('\n       ')}`);
    else pass(`every film tracks exactly ${FILM_SOURCES.join(' + ')}`);
  }
}

// ---- 9. tracked text: no em dash, no CR ----------------------------------
// The em dash is a house rule. A CR is a determinism rule: .gitattributes
// normalizes to LF in the index, so a CRLF source makes a clean checkout
// generate different bytes from the working tree it was built in.
{
  if (!carried) ok.push('text content not checked: git is not available here');
  else {
    const dash = [];
    const crlf = [];
    for (const f of carried) {
      if (BINARY.test(f)) continue;
      const p = P(f);
      if (!fs.existsSync(p)) continue;                      // staged deletion
      // Entity forms too: the bundler decodes them, so an em dash entity in a
      // source is an em dash in the shipped artifact.
      const src = fs.readFileSync(p, 'utf8').replace(EM_ENTITY, EM_DASH);
      const i = src.indexOf(EM_DASH);
      if (i >= 0) {
        const n = src.split(EM_DASH).length - 1;
        dash.push(`${f}:${src.slice(0, i).split('\n').length}${n > 1 ? ` and ${n - 1} more` : ''}`);
      }
      if (src.includes('\r')) crlf.push(f);
    }
    if (dash.length) fail(`em dash (U+2014) in a tracked text file. Use a comma, a colon or a full stop:\n       ${dash.join('\n       ')}`);
    else pass(`no em dash in any of ${carried.filter((f) => !BINARY.test(f)).length} text files a commit would carry`);
    if (crlf.length) fail(`CR in a tracked text file, so a clean checkout builds different bytes:\n       ${crlf.join('\n       ')}`);
    else pass('every tracked text file is LF');
  }
}

// ---- 10. every image a film reads is declared, and every declared one used --
{
  const bad = [];
  for (const brand of dirs(P('work'))) {
    for (const slug of dirs(P('work', brand))) {
      const beats = P('work', brand, slug, 'beats.html');
      const json = P('work', brand, slug, 'film.json');
      if (!fs.existsSync(beats) || !fs.existsSync(json)) continue;
      const declared = new Set(JSON.parse(fs.readFileSync(json, 'utf8')).images || []);
      const used = new Set([...fs.readFileSync(beats, 'utf8').matchAll(/var\(--img-([a-z0-9-]+)\)/g)].map((m) => m[1]));
      for (const u of used) if (!declared.has(u)) bad.push(`${brand}/${slug} reads var(--img-${u}) but film.json does not list it`);
      for (const d of declared) {
        if (!used.has(d)) bad.push(`${brand}/${slug} lists image "${d}" that nothing reads; every one is inlined into the artifact`);
        else if (!['webp', 'png', 'jpg', 'svg'].some((e) => fs.existsSync(P('media', brand, `${d}.${e}`)))) {
          bad.push(`${brand}/${slug} lists image "${d}", which is not in media/${brand}/`);
        }
      }
    }
  }
  if (bad.length) fail(`film images:\n       ${bad.join('\n       ')}`);
  else pass('every image a film reads is declared, present and used');
}

// ---- 11. every character a film sets is in its brand's subsetted faces -----
// The faces that ship are subset to about a hundred codepoints. A character
// outside that set does not error: it renders as tofu, in a client's marketing
// page, and no other gate sees it, because check runs against the source
// project where the full masters are still in place.
{
  const bad = [];
  for (const brand of dirs(P('work'))) {
    const cov = P('brands', brand, 'font', 'coverage.json');
    if (!fs.existsSync(cov)) { bad.push(`brands/${brand}/font/coverage.json is missing. Run: node tools/font.mjs ${brand}`); continue; }
    const set = new Set(JSON.parse(fs.readFileSync(cov, 'utf8')).codepoints);
    for (const slug of dirs(P('work', brand))) {
      const f = P('work', brand, slug, 'beats.html');
      if (!fs.existsSync(f)) continue;
      const missing = new Map();
      for (const ch of visibleText(fs.readFileSync(f, 'utf8'))) {
        const cp = ch.codePointAt(0);
        if (cp > 0x1f && !set.has(cp)) missing.set(ch, true);
      }
      for (const ch of missing.keys()) {
        bad.push(`${brand}/${slug}/beats.html sets U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} "${ch}", which no subsetted face contains, so it renders as tofu`);
      }
    }
  }
  if (bad.length) fail(`glyph coverage:\n       ${bad.join('\n       ')}`);
  else pass("every character every film sets is present in its brand's faces");
}

/** Characters that will be painted: element text plus text-bearing attributes.
 *  Errs toward including more, which can only over-report. */
function visibleText(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '');
  const decoded = body
    .replace(/&#8202;/g, ' ').replace(/&#8201;/g, ' ')
    .replace(/&middot;/g, '\u00b7').replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  const out = [...decoded];
  for (const m of html.matchAll(/\saria-label\s*=\s*"([^"]*)"/gi)) out.push(...m[1]);
  return out;
}

// ---- 12. no parent traversal in an authored asset path ---------------------
{
  const bad = [];
  const traversal = /(?:src|href|data-composition-src)\s*=\s*["']([^"']*\.\.\/[^"']*)["']/g;
  for (const f of walk(P('work'), P('lib'), P('brands'))) {
    if (!/\.html$/.test(f)) continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(traversal)) bad.push(`${rel(f)}: ${m[1]}`);
  }
  if (bad.length) fail(`../ in an asset path is a hard lint error and a runtime 404:\n       ${bad.join('\n       ')}`);
  else pass('no ../ in any authored asset path');
}

// ---- 13. nothing generated, cached or copied is tracked --------------------
// .gitignore is the declaration; this is the check that the declaration is
// true. `git ls-files -i -c` lists exactly the files that are both tracked and
// ignored, which is the state that survives a `git add -f` or a rule added
// after the file was committed.
{
  if (!tracked) ok.push('tracked-versus-ignored not checked: git is not available here');
  else {
    let ignored = [];
    try {
      ignored = execFileSync('git', ['ls-files', '-i', '-c', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' })
        .split('\0').filter(Boolean);
    } catch { /* older git without -i -c; the film-level check below still holds */ }
    const junk = tracked.filter((f) => /(^|\/)(\.DS_Store|Thumbs\.db|npm-debug\.log|\.eslintcache)$/i.test(f)
      || /^(\.vscode|\.idea|\.venv|coverage|dist|out)\//.test(f)
      || /\.(local|orig|rej|bak|tmp|swp)$/i.test(f)
      || /(^|\/)[^/]*\.local\.[^/]+$/.test(f));
    // A path still in the index but already gone from disk is a deletion this
    // change has not staged yet, not a file anyone is carrying.
    const bad = [...ignored, ...junk].filter((f) => fs.existsSync(P(f)));
    if (bad.length) fail(`tracked but ignored, generated or machine-local. git rm --cached each one:\n       ${[...new Set(bad)].join('\n       ')}`);
    else pass(`no generated, cached or machine-local file is tracked (${tracked.length} tracked)`);
  }
}

// ---- 14. no machine path, no secret, no personal configuration -------------
// A home directory in a tracked file is a path that works on exactly one
// machine. A key in a tracked file is a key that has to be rotated.
{
  const bad = [];
  const HOME_PATH = /(?:[A-Za-z]:[\\/]+Users[\\/]+|\/Users\/|\/home\/)(?!<|\$|%|\.\.\.)[A-Za-z0-9._-]+/g;
  const SECRET = [
    [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, 'an API key'],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, 'a GitHub token'],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, 'a Slack token'],
    [/\bAIza[A-Za-z0-9_-]{30,}/g, 'a Google API key'],
    [/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, 'a private key'],
    [/\b(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|ACCESS_KEY)\s*[:=]\s*["']?[A-Za-z0-9/+_-]{16,}/gi, 'a credential'],
  ];
  for (const f of carried || []) {
    if (BINARY.test(f) || !fs.existsSync(P(f))) continue;
    if (f === 'tools/guard.mjs') continue;           // it spells the patterns out
    const src = fs.readFileSync(P(f), 'utf8');
    for (const m of src.matchAll(HOME_PATH)) bad.push(`${f}: "${m[0]}" is a path that exists on one machine`);
    for (const [re, what] of SECRET) {
      for (const m of src.matchAll(re)) bad.push(`${f}: looks like ${what} (${m[0].slice(0, 12)}...). Rotate it, then take it out`);
    }
  }
  if (bad.length) fail(`machine-specific or secret material in a tracked file:\n       ${bad.slice(0, 10).join('\n       ')}`);
  else pass(`no machine path, secret or personal configuration in any of ${(carried || []).length} files`);
}

// ---- 15. comments carry reasons, not walls ---------------------------------
// The measured rationale in these files is the most valuable thing in them, so
// this is a ceiling on bulk rather than a budget on comments. Today the worst
// file is 24% comment and the longest single block is 19 lines.
{
  const bad = [];
  for (const f of (carried || []).filter((x) => /\.(mjs|js)$/.test(x) && /^(tools|lib)\//.test(x) && !x.startsWith('lib/vendor/'))) {
    if (!fs.existsSync(P(f))) continue;
    const lines = fs.readFileSync(P(f), 'utf8').split('\n');
    const isComment = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);
    const n = lines.filter(isComment).length;
    if (n / lines.length > COMMENT_RATIO_MAX) {
      bad.push(`${f} is ${Math.round(n / lines.length * 100)}% comment, over ${COMMENT_RATIO_MAX * 100}%`);
    }
    let run = 0;
    let at = 0;
    lines.forEach((l, i) => {
      if (isComment(l)) { if (!run) at = i + 1; run++; return; }
      if (run > COMMENT_RUN_MAX) bad.push(`${f}:${at} is a ${run}-line comment block, over ${COMMENT_RUN_MAX}`);
      run = 0;
    });
    if (run > COMMENT_RUN_MAX) bad.push(`${f}:${at} is a ${run}-line comment block, over ${COMMENT_RUN_MAX}`);
  }
  if (bad.length) fail(`comment wall. Keep the reason, drop the restatement:\n       ${bad.join('\n       ')}`);
  else pass(`no comment wall: every tool under ${COMMENT_RATIO_MAX * 100}% comment, no block over ${COMMENT_RUN_MAX} lines`);
}

// ---- 16. no placeholder file, no dead tool ---------------------------------
{
  const bad = [];
  for (const f of (carried || []).filter((x) => !BINARY.test(x))) {
    if (!fs.existsSync(P(f))) continue;
    const src = fs.readFileSync(P(f), 'utf8');
    if (!src.trim()) bad.push(`${f} is empty`);
    else if (/\.md$/.test(f) && /^(#[^\n]*\n+)?(TBD|TODO|Coming soon|Placeholder)\.?\s*$/i.test(src.trim())) {
      bad.push(`${f} is a placeholder. Write it or delete it`);
    }
  }
  // A tool nobody runs and nobody imports is dead code that still has to be
  // read and kept working.
  const scripts = Object.values(JSON.parse(read('package.json')).scripts || {}).join(' ');
  const imports = [...walk(P('tools'), P('lib'))].filter((f) => /\.mjs$/.test(f))
    .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  for (const f of fs.readdirSync(P('tools')).filter((n) => n.endsWith('.mjs'))) {
    const base = f.replace(/\.mjs$/, '');
    if (!scripts.includes(`tools/${f}`) && !new RegExp(`from '\\./${base}\\.mjs'`).test(imports)) {
      bad.push(`tools/${f} is neither an npm script nor imported by one. Wire it up or delete it`);
    }
  }
  if (bad.length) fail(`placeholder or dead file:\n       ${bad.join('\n       ')}`);
  else pass('no placeholder file, no unreachable tool');
}

// ---- 17. the film's own output has a ceiling -------------------------------
// Media is content and varies six-fold between films, so the per-film wire
// budget in film.json covers it. This covers the other population: the markup,
// CSS and timelines an author grows one line at a time.
{
  const bad = [];
  for (const brand of dirs(P('work'))) {
    for (const slug of dirs(P('work', brand))) {
      const f = P('work', brand, slug, 'prepared.json');
      if (!fs.existsSync(f)) continue;
      const n = JSON.parse(fs.readFileSync(f, 'utf8')).authoredBytes;
      if (n > AUTHORED_MAX_BYTES) {
        bad.push(`${brand}/${slug} generates ${kb(n)} of its own markup, CSS and timelines, over the ${kb(AUTHORED_MAX_BYTES)} ceiling. Media does not count toward this; move repeated markup into a shared scene or a brand shape`);
      }
    }
  }
  if (bad.length) fail(`authored weight:\n       ${bad.join('\n       ')}`);
  else pass(`every film is inside the ${kb(AUTHORED_MAX_BYTES)} authored ceiling`);
}

// ---- 18. a pack declares no face no film can name --------------------------
// A face whose family no token names can never be painted with, so it is pure
// weight in every artifact of the brand. Caught here for free rather than in
// gate 2, which needs a browser and a built artifact to see it.
{
  const bad = [];
  for (const brand of dirs(P('brands'))) {
    const tokensFile = P('brands', brand, 'tokens.json');
    if (!fs.existsSync(tokensFile)) continue;
    const stacks = Object.values(JSON.parse(fs.readFileSync(tokensFile, 'utf8')))
      .filter((v) => typeof v === 'string').join(',').toLowerCase();
    const src = fs.readFileSync(P('brands', brand, 'brand.ts'), 'utf8');
    for (const m of src.matchAll(/family:\s*'([^']+)'/g)) {
      if (!stacks.includes(m[1].toLowerCase())) {
        bad.push(`brands/${brand}/brand.ts declares the face "${m[1]}", which no token names, so no film can ever paint with it`);
      }
    }
  }
  if (bad.length) fail(`unreachable face:\n       ${bad.join('\n       ')}`);
  else pass('every declared face is reachable from a token');
}

// ---- 19. the gates still assert what they claim to --------------------------
// The one rule prose cannot carry: a check deleted to make a failure go away
// leaves no trace. These are the assertions that took a real defect to find,
// so their absence is itself a failure.
{
  const bad = [];
  const g2 = read('tools/gate2.mjs');
  const dojs = read('tools/do.mjs');
  const must = [
    [g2, 'getEntriesByType(\'resource\')', 'gate 2 no longer counts network requests'],
    [g2, 'chromeWired', 'gate 2 no longer checks that the player chrome wired up'],
    [g2, 'offModal', 'gate 2 no longer checks that the opening frame is not blank'],
    [g2, 'clip-path:none !important', 'gate 2 no longer re-measures layout with clips forced off'],
    [g2, 'two consecutive builds are not byte-identical', 'gate 2 no longer builds twice'],
    [g2, 'embedTest', 'gate 2 no longer measures the embed contract'],
    [dojs, "'--strict'", 'gate 1 no longer runs --strict, so every warning became advice'],
    [dojs, "'--at-transitions'", 'gate 1 no longer samples transitions'],
    [dojs, 'errorCount', 'gate 1 no longer asserts on counts, which is the only thing that separates clean from never-ran'],
  ];
  for (const [src, needle, why] of must) if (!src.includes(needle)) bad.push(why);
  const asserts = (g2.match(/\bok\(/g) || []).length;
  if (asserts < 24) bad.push(`gate 2 makes ${asserts} assertions; it made 24 when this floor was set. An assertion was deleted, not fixed`);
  if (bad.length) fail(`validation weakened:\n       ${bad.join('\n       ')}`);
  else pass(`gate 1 and gate 2 still make every assertion they were built with (${asserts} in gate 2)`);
}

/** Sentences long enough that repeating one verbatim is duplication, not
 *  coincidence. Used to keep AGENTS.md and CLAUDE.md from restating each other. */
function sentences(md) {
  return md.replace(/`[^`]*`/g, ' ').split(/(?<=[.!?])\s+|\n{2,}/)
    .map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// ---- 20. one toolchain, no second configuration ---------------------------
// Every one of these is a config file for something this repo deliberately
// does not have. One appearing means a framework, bundler, test runner or
// second package manager arrived with it.
{
  const bad = [];
  const banned = [
    [/^(yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/, 'a second package manager'],
    [/^tsconfig(\..+)?\.json$/, 'a TypeScript build. brands/*.ts is type-annotated source Node strips; nothing compiles it'],
    [/^\.?(eslintrc|eslint\.config|prettierrc|prettier\.config|babel\.config|babelrc)/, 'a formatter or linter config. tools/law.mjs is the formatting law'],
    [/^(vite|webpack|rollup|esbuild|tsup)\.config\./, 'a bundler'],
    [/^(jest|vitest|karma|playwright)\.config\./, 'a test framework'],
  ];
  for (const f of carried || []) {
    const base = path.basename(f);
    if (/^node_modules\//.test(f)) continue;
    for (const [re, what] of banned) if (re.test(base)) bad.push(`${f} is ${what}`);
  }
  const j = JSON.parse(read('package.json'));
  const runtime = Object.keys(j.dependencies || {});
  if (runtime.length) bad.push(`package.json declares runtime dependencies (${runtime.join(', ')}). A built film loads nothing; everything here is a devDependency`);
  const dev = Object.keys(j.devDependencies || {});
  if (dev.length > 6) bad.push(`${dev.length} devDependencies. Four earned their place; each new one has to protect behaviour that would otherwise break silently`);
  if (bad.length) fail(`a second toolchain arrived:\n       ${bad.join('\n       ')}`);
  else pass(`one toolchain: ${dev.length} devDependencies, no runtime dependency, no bundler, linter or test config`);
}

// ---- 21. prose that reads as generated -------------------------------------
// Not a style opinion. Each of these is a phrase that carries no information
// about this repo and appears when text was produced to fill a section rather
// than to say something.
{
  const FILLER = [
    'it is important to note', 'it is worth noting', 'please note that',
    'as mentioned above', 'as mentioned earlier', 'as we can see',
    'in conclusion', 'in summary,', 'to summarize', 'that being said',
    'delve into', 'dive deep into', "let's dive in", 'feel free to',
    'in today\u2019s', "in today's fast", 'cutting-edge', 'state-of-the-art',
    'best-in-class', 'game-changing', 'seamlessly integrate', 'robust solution',
    'leverage the power', 'unlock the potential', 'happy coding',
    'this document provides an overview', 'the following section describes',
  ];
  const bad = [];
  for (const f of (carried || []).filter((x) => /\.(md|txt)$/.test(x) && fs.existsSync(P(x)))) {
    const src = fs.readFileSync(P(f), 'utf8').toLowerCase();
    for (const phrase of FILLER) {
      const i = src.indexOf(phrase);
      if (i >= 0) bad.push(`${f}:${src.slice(0, i).split('\n').length} "${phrase}"`);
    }
  }
  if (bad.length) fail(`filler prose. Say the thing or delete the sentence:\n       ${bad.join('\n       ')}`);
  else pass(`no filler phrase in any of ${(carried || []).filter((x) => /\.md$/.test(x)).length} markdown files`);
}

for (const m of ok) console.log(`  ok   ${m}`);
for (const m of fails) console.log(`  FAIL ${m}`);
console.log(fails.length ? `\nguard: ${fails.length} failure(s)` : `\nguard: ${ok.length} invariants hold`);
process.exit(fails.length ? 1 : 0);
