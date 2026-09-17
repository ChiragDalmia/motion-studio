// The formatting law. The one thing the deleted DSL was actually buying:
// one row per tween, so a retime is one number on one line and a diff of a
// re-cut is readable. Enforced as a lint over the file that runs, not as a
// grammar over a file that gets compiled. A compiler would put a translation
// layer between every upstream finding and the line an agent has to edit.
//
// Node only. Runs in tier 1, on every film, on every commit.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const METHODS = ['to', 'from', 'fromTo', 'set', 'add', 'addLabel', 'call'];
const BANNED_EASE = /ease\s*:\s*['"](?:none|linear)['"]/;

export function law(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const add = (line, msg) => out.push({ file: rel, line, msg });

  // Only the timeline scripts. A composition's <script> is the only place a
  // tween may live, so this is also where the law applies.
  const scripts = [...src.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    const offset = src.slice(0, s.index).split('\n').length;
    const lines = s[1].split('\n');

    let timelines = 0;
    lines.forEach((raw, i) => {
      const n = offset + i;
      const line = raw.replace(/\/\/.*$/, '');
      if (/gsap\.timeline\s*\(/.test(line)) {
        timelines++;
        if (!/paused\s*:\s*true/.test(line)) {
          add(n, 'gsap.timeline() must be created paused. The runtime drives it by seeking, and an unpaused timeline runs on its own clock');
        }
      }

      // One tween per line. Two tl.to(...) on one line is the thing that makes
      // a re-cut diff unreadable, which is the entire point of the rule.
      const calls = [...line.matchAll(new RegExp(`\\.\\s*(${METHODS.join('|')})\\s*\\(`, 'g'))];
      if (calls.length > 1) {
        add(n, `${calls.length} timeline calls on one line (${calls.map((c) => '.' + c[1]).join(' ')}). One per line`);
      }
      if (!calls.length) return;

      const method = calls[0][1];
      if (method === 'addLabel' || method === 'set' || method === 'add' || method === 'call') return;

      // A mandatory position parameter, and it must be a label expression.
      // A bare number here is a timestamp, and a film full of timestamps is a
      // film nobody can retime.
      const args = line.slice(line.indexOf('(', calls[0].index) + 1);
      const tail = args.replace(/\s*\)\s*;?\s*$/, '');
      const pos = lastArg(tail);
      if (pos == null || /^[{[]/.test(pos)) {
        add(n, `.${method}() has no position parameter. Every tween states where it starts, always as a label expression`);
      } else if (/^-?[\d.]+$/.test(pos)) {
        add(n, `.${method}() starts at the bare time ${pos}. Use a label expression ("b2", "b2+=0.25") so a retime is one number in the storyboard`);
      } else if (!/^["'][a-z][\w-]*(\s*\+=\s*[\d.]+|\s*-=\s*[\d.]+)?["']$/i.test(pos) && !/^</.test(pos)) {
        add(n, `.${method}() position ${pos} is not a label expression`);
      }

      if (method === 'from') {
        add(n, '.from() on a CSS transform conflicts with the runtime\'s own set. Use fromTo and state the initial value inside the tween');
      }
      if (BANNED_EASE.test(line) && !/ease:\s*['"]none['"]\s*}\s*,\s*['"]/.test(line)) {
        // linear is almost always an unfinished decision rather than a choice.
        add(n, 'ease "none" or "linear". State a real curve, or say in a comment why this one move is linear');
      }
    });

    if (timelines > 1) add(offset, `${timelines} timelines in one script. One composition, one paused timeline`);
  }

  if (!/window\.__timelines\s*\[/.test(src)) {
    add(1, 'nothing is assigned to window.__timelines["<composition-id>"]. Anything not on that timeline does not exist');
  }
  return out;
}

/** The last top-level argument of a call, respecting nesting and strings. */
function lastArg(s) {
  let depth = 0, quote = null, start = 0, last = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote && s[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { last = s.slice(start, i).trim(); start = i + 1; }
  }
  const tailArg = s.slice(start).trim();
  return last == null ? null : (tailArg || null);
}

export function lawOverFilm(dir) {
  const files = [path.join(dir, 'index.html')];
  const comps = path.join(dir, 'compositions');
  if (fs.existsSync(comps)) {
    for (const n of fs.readdirSync(comps)) if (n.endsWith('.html')) files.push(path.join(comps, n));
  }
  return files.filter((f) => fs.existsSync(f)).flatMap(law);
}

if (process.argv[1]?.endsWith('law.mjs')) {
  const dirs = process.argv.slice(2);
  let n = 0;
  for (const d of dirs) {
    for (const v of lawOverFilm(path.resolve(d))) { n++; console.log(`  ${v.file}:${v.line}  ${v.msg}`); }
  }
  console.log(n ? `\nlaw: ${n} violation(s)` : '\nlaw: clean');
  process.exit(n ? 1 : 0);
}
