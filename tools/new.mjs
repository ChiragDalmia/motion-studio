// Stamp the three tracked files a film is made of. Never `hyperframes init`:
// that scaffold writes per-film CLAUDE.md/AGENTS.md routing which contradicts
// ours, and a per-film package.json that forks the single pinned CLI version.
import fs from 'node:fs';
import path from 'node:path';
import { load } from './tokens.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

const [brand, slug, ...flags] = process.argv.slice(2);
if (!brand || !slug) {
  console.error('usage: node tools/new.mjs <brand> <slug> [--duration=12]');
  process.exit(2);
}
// npm swallows --duration=12 into its own config rather than forwarding it,
// so `npm run new` and `node tools/new.mjs` would otherwise disagree silently.
const flagged = (flags.find((f) => f.startsWith('--duration=')) || '').split('=')[1]
  || flags[flags.indexOf('--duration') + 1]
  || process.env.npm_config_duration;
const duration = Number(flagged || 12);
if (!(duration > 0)) { console.error(`--duration ${flagged} must be a positive number of seconds`); process.exit(2); }

const { pack } = await load(brand);
const film = path.join(ROOT, 'work', brand, slug);
if (fs.existsSync(film)) { console.error(`work/${brand}/${slug} already exists`); process.exit(2); }
if (!/^[a-z][a-z0-9-]{2,31}$/.test(slug)) { console.error(`slug "${slug}" must match /^[a-z][a-z0-9-]{2,31}$/`); process.exit(2); }
fs.mkdirSync(film, { recursive: true });

const write = (name, text) => fs.writeFileSync(path.join(film, name), text);

write('film.json', JSON.stringify({
  brand,
  title: `${pack.name} ${slug}`,
  duration,
  beats: [{ id: 'b1', layer: 'art', duration, surface: 'default' }],
  labels: {},
  images: [],
  vo: [],
  motion: { assertions: [] },
}, null, 2) + '\n');

write('beats.html', `<!-- work/${brand}/${slug}. Every generated file is gitignored; npm run pre writes them.

     One <template data-beat="id"> per beat in film.json, plus one
     <template data-film> for the master timeline. Beat ids, starts, track
     indexes and labels all come from film.json, so a retime is one number
     there and nothing here moves. -->

<template data-film>
<style>
</style>
<script>
</script>
</template>

<template data-beat="b1">
<style>
</style>
  <div id="stage" class="clip" data-start="0" data-duration="${duration}" data-track-index="1"></div>
<script>
  var t = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  t.addLabel('in', 0);
</script>
</template>
`);

write('NOTES.md', `# ${pack.name} ${slug}

## Intent

One sentence: what a viewer should believe after watching. Not what the film
shows, what it changes.

## Assets

Every mark, face, bed and photograph, with where it came from and what licence
it ships under. A film with an unlisted asset does not ship.

## Customizations

The three or four specific moves this film owns and no other film in this
brand may reuse.

## Beats

Per-beat direction goes in beats.html, next to the markup it describes.
`);

console.log(`  stamped work/${brand}/${slug}/  film.json beats.html NOTES.md  ${duration}s  ${pack.name}`);
console.log(`  next:   npm run ship ${brand} ${slug}`);
