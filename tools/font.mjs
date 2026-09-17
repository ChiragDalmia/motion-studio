// Pack authoring step: subset a brand's faces to the glyphs it needs.
//
// Not a build dependency. It runs when a pack's faces change, writes the
// shipped .woff2 files and a coverage record, and both are committed. Needs
// Python with fonttools + brotli, the same way MP4 needs FFmpeg: an authoring
// prerequisite, never something `build` or `gate2` reaches for.
//
// Why it exists: Google's "latin" subset is ~250 glyphs and a film sets about
// sixty. Measured on one real pack, subsetting cut 36-61% per face and 44 KB
// off the artifact: the difference between that brand fitting the wire budget
// and missing it by 13%.
//
//   brands/<slug>/font/master/*.woff2   the untouched masters, committed
//   brands/<slug>/font/*.woff2          what ships, generated, committed
//   brands/<slug>/font/coverage.json    codepoints present, for tools/guard.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execFileSync as run } from 'node:child_process';
import { load } from './tokens.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

// Printable ASCII plus the punctuation a film actually sets. A pack serving
// other locales overrides this with `subset.unicodes`.
export const DEFAULT_UNICODES = [
  'U+0020-007E',                                       // printable ASCII
  'U+00A0', 'U+2009', 'U+200A',                        // nbsp, thin, hair
  'U+00A9', 'U+00AE', 'U+2122',                        // (c) (r) (tm)
  'U+00B0', 'U+00B7', 'U+00D7', 'U+2212',              // deg middot times minus
  'U+2013', 'U+2014',                                  // en/em dash
  'U+2018', 'U+2019', 'U+201C', 'U+201D',              // curly quotes
  'U+2022', 'U+2026', 'U+2030',                        // bullet ellipsis permille
].join(',');

const PY = process.env.MS_PYTHON || 'python';

export async function subset(slug) {
  const { pack, dir } = await load(slug);
  const fontDir = path.join(dir, 'font');
  const masterDir = path.join(fontDir, 'master');
  fs.mkdirSync(masterDir, { recursive: true });
  const unicodes = pack.subset?.unicodes || DEFAULT_UNICODES;
  const rows = [];

  for (const f of pack.face) {
    const shipped = path.join(dir, f.file);
    const master = path.join(masterDir, path.basename(f.file));
    // First run: whatever is in font/ IS the master. Promote it once, so the
    // original is never subset twice and never lost.
    if (!fs.existsSync(master)) {
      if (!fs.existsSync(shipped)) throw new Error(`brands/${slug}: neither ${f.file} nor its master exists`);
      fs.copyFileSync(shipped, master);
    }
    const before = fs.statSync(master).size;
    run(PY, ['-m', 'fontTools.subset', master,
      '--flavor=woff2',
      `--unicodes=${unicodes}`,
      '--layout-features=kern,liga,calt',
      '--no-hinting',
      '--desubroutinize',
      `--output-file=${shipped}`], { stdio: 'pipe' });
    const after = fs.statSync(shipped).size;
    rows.push({ family: f.family, weight: f.weight, file: f.file, master: before, shipped: after });
  }

  // What codepoints do the shipped faces actually contain? guard.mjs compares
  // every character a film sets against this, so a glyph the subset dropped
  // fails the build instead of rendering as tofu in someone's marketing page.
  const covered = codepoints(pack.face.map((f) => path.join(dir, f.file)));
  fs.writeFileSync(
    path.join(fontDir, 'coverage.json'),
    JSON.stringify({ unicodes, faces: rows.map(({ family, weight, master, shipped }) => ({ family, weight, master, shipped })), codepoints: covered }, null, 2) + '\n',
  );
  return { rows, covered: covered.length, unicodes };
}

/** The intersection of codepoints present in every shipped face: a character is
 *  only safe if EVERY face can set it, since any of them might be asked to. */
function codepoints(files) {
  const script = [
    'import sys, json',
    'from fontTools.ttLib import TTFont',
    'sets = []',
    'for p in sys.argv[1:]:',
    '    f = TTFont(p)',
    '    sets.append(set(f.getBestCmap().keys()))',
    'common = set.intersection(*sets) if sets else set()',
    'print(json.dumps(sorted(common)))',
  ].join('\n');
  const out = execFileSync(PY, ['-c', script, ...files], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(out);
}

if (process.argv[1]?.endsWith('font.mjs')) {
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const list = slugs.length ? slugs : fs.readdirSync(path.join(ROOT, 'brands'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
  for (const s of list) {
    try {
      const r = await subset(s);
      let saved = 0;
      for (const x of r.rows) {
        saved += x.master - x.shipped;
        console.log(`  ${s}/${path.basename(x.file).padEnd(24)} ${String(x.master).padStart(7)} -> ${String(x.shipped).padStart(7)} B  (${(100 * x.shipped / x.master).toFixed(0)}%)`);
      }
      console.log(`  ${s}: ${r.rows.length} face(s), ${(saved / 1024).toFixed(1)} KB saved, ${r.covered} codepoints covered\n`);
    } catch (e) {
      console.error(`  FAIL ${s}: ${String(e.message).split('\n')[0]}`);
      if (/ENOENT|not recognized/.test(String(e.message))) {
        console.error(`         needs Python with fonttools and brotli:  pip install fonttools brotli`);
        console.error(`         set MS_PYTHON if it is not on PATH as "${PY}"`);
      }
      process.exitCode = 1;
    }
  }
}
