// Remove the generated workspace. Only paths tools/prepare.mjs owns, so the
// three tracked files of every film survive and `npm run pre` restores the
// rest byte for byte.
import fs from 'node:fs';
import path from 'node:path';
import { GENERATED } from './prepare.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BRAND_GENERATED = ['tokens.json', 'surfaces.css', 'gfx.catalog.md'];
const dirs = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);

let n = 0;
const drop = (p) => {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
  n++;
  console.log('  rm ' + path.relative(ROOT, p).split(path.sep).join('/'));
};

for (const brand of dirs(path.join(ROOT, 'work'))) {
  for (const slug of dirs(path.join(ROOT, 'work', brand))) {
    for (const g of GENERATED) drop(path.join(ROOT, 'work', brand, slug, g));
  }
}
for (const brand of dirs(path.join(ROOT, 'brands'))) {
  for (const g of BRAND_GENERATED) drop(path.join(ROOT, 'brands', brand, g));
}
if (process.argv.includes('--builds')) drop(path.join(ROOT, 'builds'));

console.log(`\nclean: ${n} path(s) removed. npm run pre <brand> <slug> restores a film.`);
