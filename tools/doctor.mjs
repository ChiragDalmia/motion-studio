// Is this machine able to run the documented workflow? Answers before you
// spend fifteen minutes finding out from a gate.
//
// Also the one place that knows how to find a Chrome, because gate 2 needs it
// and every machine keeps it somewhere else.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const HOME = os.homedir();

/**
 * A Chrome gate 2 can drive. Searched rather than pinned: the HyperFrames
 * cache path carries a version and a platform triple, so a hard-coded one is
 * a machine-specific path that works on exactly the machine it was written on.
 */
export function chrome() {
  if (process.env.MS_CHROME) return fs.existsSync(process.env.MS_CHROME) ? process.env.MS_CHROME : null;
  const cached = [
    path.join(HOME, '.cache/hyperframes/chrome'),
    path.join(HOME, '.cache/ms-playwright'),
    path.join(process.env.LOCALAPPDATA || HOME, 'ms-playwright'),
    path.join(HOME, 'Library/Caches/ms-playwright'),
  ].flatMap((d) => find(d, /^(?:chrome-headless-shell|chrome|headless_shell|chrome\.exe|chrome-headless-shell\.exe)$/, 6));
  const system = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
  return [...cached, ...system].find(exists) ?? null;
}

/** Executable files matching `name` under `dir`, at most `depth` levels down. */
function find(dir, name, depth) {
  if (depth < 0 || !exists(dir)) return [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries.sort((a, b) => b.name.localeCompare(a.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...find(p, name, depth - 1));
    else if (name.test(e.name)) out.push(p);
  }
  return out;
}
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

const checks = [];
const need = (label, fn) => checks.push({ label, fn, hard: true });
const want = (label, fn) => checks.push({ label, fn, hard: false });

need('node', () => {
  const want = Number(fs.readFileSync(P('.nvmrc'), 'utf8').trim());
  const have = Number(process.versions.node.split('.')[0]);
  if (have < want) throw new Error(`node ${process.versions.node}, this repo is pinned to ${want} in .nvmrc. Install it, or run "nvm use"`);
  return `v${process.versions.node}${have > want ? ` (.nvmrc says ${want}; newer is fine)` : ''}`;
});

need('dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(P('package.json'), 'utf8'));
  const missing = [];
  const wrong = [];
  for (const [name, want] of Object.entries(pkg.devDependencies)) {
    const f = P('node_modules', name, 'package.json');
    if (!exists(f)) { missing.push(name); continue; }
    const have = JSON.parse(fs.readFileSync(f, 'utf8')).version;
    if (have !== want) wrong.push(`${name} ${have}, lockfile pins ${want}`);
  }
  if (missing.length) throw new Error(`not installed: ${missing.join(', ')}. Run: npm ci`);
  if (wrong.length) throw new Error(`${wrong.join('; ')}. Run: npm ci`);
  return `${Object.keys(pkg.devDependencies).length} pinned, all at their locked versions`;
});

need('lockfile', () => {
  if (!exists(P('package-lock.json'))) throw new Error('package-lock.json is missing. It is the authority on what installs; restore it from git');
  const lock = JSON.parse(fs.readFileSync(P('package-lock.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(P('package.json'), 'utf8'));
  const root = lock.packages?.[''] || {};
  const drift = Object.entries(pkg.devDependencies).filter(([k, v]) => (root.devDependencies || {})[k] !== v);
  if (drift.length) throw new Error(`package.json and the lockfile disagree on ${drift.map(([k]) => k).join(', ')}. Run: npm install --package-lock-only`);
  return `lockfileVersion ${lock.lockfileVersion}, in step with package.json`;
});

need('git', () => {
  const v = execFileSync('git', ['--version'], { encoding: 'utf8' }).trim();
  // `git config --get` exits 1 on an unset key, and unset is the answer on
  // every machine that is not Windows. .gitattributes pins eol=lf regardless,
  // so this line is informational and must never be the thing that blocks.
  let eol = '';
  try { eol = execFileSync('git', ['config', '--get', 'core.autocrlf'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch {}
  return `${v}${eol ? `, core.autocrlf=${eol} (.gitattributes overrides it for this repo)` : ''}`;
});

need('films', async () => {
  const { load } = await import('./film.mjs');
  const out = [];
  for (const brand of dirs(P('work'))) {
    for (const slug of dirs(P('work', brand))) {
      if (!exists(P('work', brand, slug, 'film.json'))) continue;
      load(brand, slug);
      out.push(`${brand}/${slug}`);
    }
  }
  if (!out.length) throw new Error('no film found under work/<brand>/<slug>/film.json');
  return `${out.length} valid: ${out.join(', ')}`;
});

need('chrome', () => {
  const p = chrome();
  if (!p) {
    throw new Error('no Chrome found. HyperFrames downloads one on first use: run "npx hyperframes doctor". '
      + 'Or point MS_CHROME at an existing Chrome, Chromium or Edge binary');
  }
  return short(p);
});

want('ffmpeg', () => { const p = which('ffmpeg'); return p ? short(p) : 'not installed. Only MP4 render needs it; no gate does'; });
want('python', () => {
  const py = which('python3') ?? which('python');
  if (!py) return 'not installed. Only tools/font.mjs needs it, when a pack\'s faces change';
  try {
    execFileSync(py, ['-c', 'import fontTools, brotli'], { stdio: 'pipe' });
    return `${short(py)} with fonttools and brotli`;
  } catch { return `${short(py)}, but fonttools or brotli is missing. Run: pip install fonttools brotli`; }
});

function which(cmd) {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext.toLowerCase());
      if (exists(p)) return p;
    }
  }
  return null;
}

const dirs = (d) => (exists(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const short = (p) => p.replace(HOME, '~').split(path.sep).join('/');

if (process.argv[1]?.endsWith('doctor.mjs')) {
  let bad = 0;
  for (const c of checks) {
    try {
      console.log(`  ok   ${c.label.padEnd(13)} ${await c.fn()}`);
    } catch (e) {
      if (c.hard) bad++;
      console.log(`  ${c.hard ? 'FAIL' : 'warn'} ${c.label.padEnd(13)} ${e.message}`);
    }
  }
  console.log(bad ? `\ndoctor: ${bad} blocker(s)` : '\ndoctor: this machine can run the whole workflow');
  process.exit(bad ? 1 : 0);
}
