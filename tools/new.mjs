// Stamp a new film from lib/world.html, with the brand's resolved declaration
// written in. Never `hyperframes init`: that scaffold injects per-film
// CLAUDE.md/AGENTS.md routing which contradicts ours, and a per-film
// package.json that forks the single pinned CLI version.
//
// --revars re-stamps only the <html> declaration of an existing film, which is
// the fix when tools/build.mjs reports token drift.
import fs from 'node:fs';
import path from 'node:path';
import { declarationFor, attr } from './tokens.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

const [brand, slug, ...flags] = process.argv.slice(2);
if (!brand || !slug) {
  console.error('usage: node tools/new.mjs <brand> <slug> [--revars] [--duration=12]');
  process.exit(2);
}
const revars = flags.includes('--revars');
const duration = Number((flags.find((f) => f.startsWith('--duration=')) || '').split('=')[1] || 12);

const { pack, decl: declArray } = await declarationFor(brand);
const decl = attr(declArray);
const film = path.join(ROOT, 'work', brand, slug);
const index = path.join(film, 'index.html');

if (revars) {
  if (!fs.existsSync(index)) { console.error(`no film at work/${brand}/${slug}`); process.exit(2); }
  const src = fs.readFileSync(index, 'utf8');
  const next = src.replace(/(<html\b[^>]*?data-composition-variables\s*=\s*)'[\s\S]*?'/, `$1'${decl}'`);
  if (!/data-composition-variables/.test(src)) { console.error('the film declares no data-composition-variables on <html>'); process.exit(1); }
  if (next === src) { console.log(`  work/${brand}/${slug}/index.html already matches brands/${brand}/`); process.exit(0); }
  fs.writeFileSync(index, next);
  console.log(`  re-stamped work/${brand}/${slug}/index.html from brands/${brand}/ (${declArray.length} variables)`);
  process.exit(0);
}

if (fs.existsSync(film)) { console.error(`work/${brand}/${slug} already exists`); process.exit(2); }
if (!/^[a-z][a-z0-9-]{2,31}$/.test(slug)) { console.error(`slug "${slug}" must match /^[a-z][a-z0-9-]{2,31}$/`); process.exit(2); }

fs.mkdirSync(path.join(film, 'compositions'), { recursive: true });
const tpl = fs.readFileSync(path.join(ROOT, 'lib/world.html'), 'utf8')
  .replace(/<!--TEMPLATE[\s\S]*?-->\s*/, '')
  .replace('__VARS__', decl)
  .replace('__NAME__', `${pack.name} — ${slug}`)
  .replace('__DURATION__', String(duration));
fs.writeFileSync(index, tpl);

fs.writeFileSync(path.join(film, 'BRIEF.md'), `---
brand: ${brand}
slug: ${slug}
surface: web
---

## Intent

<!-- One sentence: what a viewer should believe after watching. Not what the
     film shows — what it changes. -->

## Assets

<!-- Every mark, face, bed and photograph, with where it came from and what
     licence it ships under. A film with an unlisted asset does not ship. -->

## Customizations

<!-- The device tuple: the three or four specific moves this film owns and no
     other film in this brand may reuse. The ledger fails a repeat. -->

## Notes
`);

fs.writeFileSync(path.join(film, 'STORYBOARD.md'), `---
format: 1920x1080
duration: ${duration}
message: ""
arc: ""
audience: ""
---

## Beats

<!-- One row per beat. \`start\` is DERIVED from the durations above it — this
     table is the single authored source, and data-start in index.html is
     copied from it. Clip references (data-start="intro + 2") are for
     deliberate overlap only. -->

| # | id | start | duration | scene | transition | voiceover |
|---|----|-------|----------|-------|------------|-----------|
| 1 | b1 | 0     |          |       |            |           |
`);

console.log(`  stamped work/${brand}/${slug}/  (index.html, BRIEF.md, STORYBOARD.md) · duration ${duration}s · ${pack.name}`);
