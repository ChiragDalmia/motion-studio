// film.json + beats.html -> everything the generator needs.
//
// A film tracks three files. This module is the only place that knows their
// shape, so prepare, guard, new and clean all agree on it.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LAYERS = ['art', 'type', 'ui', 'grade'];
const ID = /^[a-z][a-z0-9-]{0,23}$/;

/** Load and validate work/<brand>/<slug>/film.json, with starts derived. */
export function load(brand, slug) {
  const dir = path.join(ROOT, 'work', brand, slug);
  const file = path.join(dir, 'film.json');
  if (!fs.existsSync(file)) throw new Error(`no film at work/${brand}/${slug}/film.json`);

  let film;
  try { film = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`work/${brand}/${slug}/film.json is not valid JSON: ${e.message}`); }

  const err = [];
  if (film.brand !== brand) err.push(`brand is "${film.brand}" but the film lives under work/${brand}/`);
  if (typeof film.title !== 'string' || !film.title) err.push('title is required');
  if (!(film.duration > 0)) err.push('duration must be a positive number of seconds');
  if (!Array.isArray(film.beats) || !film.beats.length) err.push('beats[] must list at least one beat');

  // start is derived from the durations above it, so a retime is one number.
  // A beat may pin its own start for a deliberate overlap; it still advances
  // the cursor, so everything after it chains off its end.
  let cursor = 0;
  const seen = new Set();
  const beats = (film.beats || []).map((b, i) => {
    const where = `beats[${i}]${b.id ? ` "${b.id}"` : ''}`;
    if (!ID.test(b.id || '')) err.push(`${where}: id must match ${ID}`);
    if (seen.has(b.id)) err.push(`${where}: duplicate id`);
    seen.add(b.id);
    if (!(b.duration > 0)) err.push(`${where}: duration must be a positive number of seconds`);
    if (!LAYERS.includes(b.layer)) err.push(`${where}: layer must be one of ${LAYERS.join(', ')}`);
    if (typeof b.surface !== 'string') err.push(`${where}: surface is required. A beat with no surface uses the pack default, so a beat over a dark host renders dark ink on dark and no audit catches it. Say "default" to mean it.`);
    if (b.start != null && !(b.start >= 0)) err.push(`${where}: start, when pinned, must be a number of seconds`);
    const start = b.start != null ? b.start : cursor;
    cursor = Math.max(cursor, round(start + b.duration));
    if (round(start + b.duration) > film.duration + 1e-9) {
      err.push(`${where}: ends at ${round(start + b.duration)}s, past the film's ${film.duration}s`);
    }
    return { ...b, start: round(start), track: i + 1, scene: b.scene || b.id };
  });

  for (const [name, at] of Object.entries(film.labels || {})) {
    if (!ID.test(name)) err.push(`labels."${name}": must match ${ID}`);
    if (seen.has(name)) err.push(`labels."${name}": collides with the beat of that name`);
    if (!(at >= 0)) err.push(`labels."${name}": must be a number of seconds`);
  }
  for (const n of film.images || []) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(n)) err.push(`images: "${n}" must be lowercase, digits and hyphens`);
  }
  for (const [i, v] of (film.vo || []).entries()) {
    if (!(v.start >= 0) || !(v.end > v.start)) err.push(`vo[${i}]: needs start < end in seconds`);
    if (!v.text) err.push(`vo[${i}]: needs text`);
  }
  for (const k of Object.keys(film.budget || {})) {
    if (!(k in BUDGET)) err.push(`budget.${k} is not one of ${Object.keys(BUDGET).join(', ')}`);
    else if (!(film.budget[k] >= BUDGET[k])) err.push(`budget.${k} must be a number at or above the studio default ${BUDGET[k]}. A budget is only ever raised, and only by a film that has to carry the weight`);
  }
  if (err.length) throw new Error(`work/${brand}/${slug}/film.json is invalid:\n  - ${err.join('\n  - ')}`);

  return { ...film, brand, slug, dir, beats, id: `${brand}/${slug}`, budget: { ...BUDGET, ...film.budget } };
}

/**
 * What a film may weigh on the wire, and how long it may take to parse on a
 * throttled CPU. These are the studio defaults; a film that carries real
 * photography or traced illustration states its own higher number in
 * film.json, where it is one reviewed line beside the content that costs it.
 *
 * This is deliberately NOT one global number. Roughly 105 KB brotli of every
 * artifact is the vendored runtime, and media is already shipped at the size
 * it is painted at, so a single total measured mostly the vendor and the
 * content and hardly at all the author. A per-film ceiling is a ratchet: one
 * film's weight can never raise another film's allowance, and a heavy film
 * still fails the moment it grows past what it declared.
 */
export const BUDGET = { brotli: 200 * 1024, gzip: 230 * 1024, dclMs: 1500 };

/**
 * Parse beats.html. Three top-level forms, all <template>:
 *   <template data-film>            film-level <style> and the master <script>
 *   <template data-layer="type">    markup into that layer, beside its hosts
 *   <template data-beat="quiz">     one beat: <style>, markup, <script>
 * Line numbers travel with every part so a finding maps back to this file.
 */
export function parseBeats(file) {
  if (!fs.existsSync(file)) throw new Error(`no ${path.relative(ROOT, file).split(path.sep).join('/')}`);
  const src = fs.readFileSync(file, 'utf8');
  const out = { film: null, layers: {}, beats: new Map(), file };
  // Scan a copy with comments blanked to the same length, so a <template> tag
  // written inside a comment cannot open a template, and slice bodies out of
  // the original so comments inside one survive and every offset still lines
  // up with the file an author edits.
  const scan = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const re = /<template\b([^>]*)>([\s\S]*?)<\/template>/g;
  for (const m of scan.matchAll(re)) {
    const attrs = m[1];
    const at = lineOf(src, m.index + m[0].indexOf('>') + 1);
    const part = split(src.slice(m.index + m[0].indexOf('>') + 1, m.index + m[0].length - '</template>'.length), at);
    const beat = /\bdata-beat\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    const layer = /\bdata-layer\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    if (beat) out.beats.set(beat, part);
    else if (layer) out.layers[layer] = part;
    else if (/\bdata-film\b/.test(attrs)) out.film = part;
    else throw new Error(`${rel(file)}:${at}: <template> needs data-film, data-layer="<layer>" or data-beat="<id>"`);
  }
  if (!out.film) throw new Error(`${rel(file)}: no <template data-film>`);
  return out;
}

/** A template body -> its style, markup and script, each with a first line. */
function split(body, firstLine) {
  const take = (re) => {
    const m = re.exec(body);
    if (!m) return null;
    const open = m[0].slice(0, m[0].indexOf('>') + 1);
    return { text: trimEnds(m[1]), line: firstLine + countLines(body.slice(0, m.index) + open) + 1 };
  };
  // Blank the two blocks out rather than deleting them, so what is left keeps
  // its line numbers and a finding in the markup still points at the source.
  const blank = (m) => '\n'.repeat(countLines(m));
  const lines = body
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, blank)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, blank)
    .split('\n');
  let a = 0;
  let b = lines.length - 1;
  while (a <= b && !lines[a].trim()) a++;
  while (b >= a && !lines[b].trim()) b--;
  return {
    style: take(/<style\b[^>]*>([\s\S]*?)<\/style>/) || { text: '', line: firstLine },
    script: take(/<script\b[^>]*>([\s\S]*?)<\/script>/) || { text: '', line: firstLine },
    markup: { text: a > b ? '' : lines.slice(a, b + 1).join('\n'), line: firstLine + a },
  };
}

const countLines = (s) => s.split('\n').length - 1;
const lineOf = (src, i) => countLines(src.slice(0, i)) + 1;
const trimEnds = (s) => s.replace(/^\n+/, '').replace(/\s+$/, '');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
/** Seconds, to the millisecond, so derived starts never drift in float noise. */
const round = (n) => Math.round(n * 1000) / 1000;
export { LAYERS };
