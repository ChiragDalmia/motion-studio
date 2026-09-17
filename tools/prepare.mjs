// Materialize the HyperFrames workspace a film's three tracked files describe.
//
// Sharing cannot work by reference: ../ in an asset path is a hard upstream
// lint error and a runtime 404, a symlink into compositions/ passes check and
// is then dropped from the cloud render zip, and no shipped asset may live
// under a dot directory. So everything a film needs is copied or generated
// into the film, deterministically, before any CLI command runs. Every path
// this writes is gitignored and tools/clean.mjs removes exactly them.
import fs from 'node:fs';
import path from 'node:path';
import { emit } from './tokens.mjs';
import { load, parseBeats, LAYERS } from './film.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMG_EXT = ['webp', 'png', 'jpg', 'svg'];
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' };

/** Every path prepare owns, relative to the film. clean.mjs removes these. */
export const GENERATED = ['index.html', 'compositions', 'media', 'brand.css', 'gsap.min.js', 'captions.vtt', 'index.motion.json', 'prepared.json', 'snapshots', 'renders'];

export async function prepare(brand, slug, opts = {}) {
  const film = load(brand, slug);
  const beats = parseBeats(path.join(film.dir, 'beats.html'));
  const { pack, decl, values } = await emit(brand);
  const packDir = path.join(ROOT, 'brands', brand);
  const { width, height } = pack.defaults;

  // A stale tree is worse than none: a beat deleted upstream would keep
  // resolving from a leftover copy and the film would still pass.
  for (const p of GENERATED) fs.rmSync(path.join(film.dir, p), { recursive: true, force: true });
  fs.mkdirSync(path.join(film.dir, 'compositions'), { recursive: true });
  fs.mkdirSync(path.join(film.dir, 'media'), { recursive: true });

  const wrote = [];
  const maps = {};
  const put = (rel, text) => { fs.writeFileSync(path.join(film.dir, rel), text); wrote.push(rel); };
  const copy = (from, rel) => { fs.copyFileSync(from, path.join(film.dir, rel)); wrote.push(rel); };

  // 1. GSAP. The blank HyperFrames scaffold loads it from a CDN, which breaks
  //    the zero-request invariant upstream of packaging.
  copy(path.join(ROOT, 'lib/vendor/gsap.min.js'), 'gsap.min.js');

  // 2. Brand logos, as files. Shapes in gfx/ are not copied: an SVG loaded
  //    through src cannot read the document's custom properties, so a
  //    token-bound shape has to be inlined as markup at authoring time.
  for (const [name, r] of Object.entries(pack.logo || {})) {
    const from = path.join(packDir, r);
    if (!fs.existsSync(from)) throw new Error(`brands/${brand}/brand.ts declares logo.${name} = ${r}, which does not exist`);
    copy(from, 'media/' + path.basename(r));
  }

  // 3. One composition per beat, from beats.html or a shared scene. The
  //    packager's self-containment guard rejects any url() that is not a data
  //    URI, so images travel as --img-* custom properties on the host root
  //    (step 4) and a beat reads var(--img-name). Each capture then ships
  //    once however many beats show it.
  const docs = [];
  let included = 0;
  const beatTpl = read(path.join(ROOT, 'lib/beat.html'));
  for (const b of film.beats) {
    if (b.surface !== 'default' && !(pack.surface || {})[b.surface]) {
      throw new Error(`work/${film.id}: beat "${b.id}" sits on surface "${b.surface}", which brands/${brand}/brand.ts does not declare`);
    }
    const part = beats.beats.get(b.id) || sharedScene(brand, b.scene, b.id);
    const markup = expand(part.markup, brand);
    included += markup.included;
    const out = fill(beatTpl, {
      SOURCE: part.source || 'beats.html', ID: b.id,
      CLASS: b.surface === 'default' ? '' : ` class="s-${b.surface}"`,
      WIDTH: width, HEIGHT: height, DURATION: b.duration,
      CSS: part.style.text, MARKUP: markup.text, SCRIPT: part.script.text,
    });
    const rel = `compositions/${b.id}.html`;
    put(rel, out);
    docs.push(out);
    maps[rel] = mapOf(out, [part.style, markup, part.script], part.source || 'beats.html');
  }

  // 4. index.html: the world, the hosts derived from the beat table, and the
  //    film's own CSS, markup and master timeline.
  const hosts = Object.fromEntries(LAYERS.map((l) => [l, []]));
  for (const b of film.beats) {
    const vars = b.vars ? ` data-variable-values='${JSON.stringify(b.vars).replace(/'/g, '&#39;')}'` : '';
    hosts[b.layer].push(
      `    <div id="${b.id}host" class="clip" data-start="${b.start}" data-duration="${b.duration}" data-track-index="${b.track}"\n`
      + `         data-composition-src="compositions/${b.id}.html" data-composition-id="${b.id}"${vars}></div>`,
    );
  }
  // Paint order inside a layer is the author's. Hosts go last unless the
  // layer template says <!--hosts--> somewhere else, which is the difference
  // between an end frame sitting under its beat and a caption band covering
  // the mark it is supposed to sit beside.
  const layerMarkup = Object.fromEntries(LAYERS.map((l) => {
    const layer = beats.layers[l] && expand(beats.layers[l].markup, brand);
    if (layer) included += layer.included;
    const own = layer && indent(layer.text, 4);
    const rows = hosts[l].join('\n');
    if (own && /^\s*<!--\s*hosts\s*-->\s*$/m.test(own)) {
      return [l, own.replace(/^[ \t]*<!--\s*hosts\s*-->[ \t]*$/m, rows).replace(/\n\s*\n/g, '\n')];
    }
    return [l, [own, rows].filter(Boolean).join('\n')];
  }));
  const labels = [...film.beats.map((b) => [b.id, b.start]), ...Object.entries(film.labels || {})]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([n, t]) => `  tl.addLabel('${n}', ${t});`).join('\n');

  const index = fill(read(path.join(ROOT, 'lib/world.html')), {
    VARS: attr(decl), TITLE: film.title,
    WIDTH: width, HEIGHT: height, DURATION: film.duration,
    FILMCSS: beats.film.style.text, IMAGES: images(brand, film.images || []),
    ART: layerMarkup.art, TYPE: layerMarkup.type, UI: layerMarkup.ui, GRADE: layerMarkup.grade,
    LABELS: labels, FILMJS: beats.film.script.text,
  });
  put('index.html', index);
  docs.push(index);
  maps['index.html'] = mapOf(index, [beats.film.style, beats.film.script], 'beats.html');

  // 5. Brand CSS at the FILM ROOT, so every font url is media/x.woff2 with no
  //    ../ in it. Relative, never base64: base64 media in the source is an
  //    upstream lint error and only the packager may inline a face. Written
  //    last because which faces ship depends on the documents above.
  const faces = facesFor(pack, values, docs);
  const faceCss = faces.map((f) => {
    copy(path.join(packDir, f.file), 'media/' + path.basename(f.file));
    return `@font-face {\n  font-family: '${f.family}';\n  font-weight: ${f.weight};\n  font-style: ${f.style || 'normal'};\n  font-display: block;\n  src: url('media/${path.basename(f.file)}') format('woff2');\n}`;
  });
  put('brand.css', `/* GENERATED by tools/prepare.mjs from brands/${brand}/. Do not edit. */\n${faceCss.join('\n') || '/* this film sets no type, so no face ships */'}\n\n${read(path.join(packDir, 'surfaces.css'))}`);

  // 6. Captions, from the one narration table in film.json.
  if (film.vo?.length) put('captions.vtt', vtt(film));

  // 7. The motion sidecar, only when asked for. check auto-discovers any
  //    *.motion.json and the audit it triggers samples ~240 frames, roughly
  //    doubling a run, so only tier 3 materializes it.
  if (opts.motion && film.motion) {
    put('index.motion.json', JSON.stringify({ version: 1, duration: film.duration, ...film.motion }, null, 2) + '\n');
  }

  put('prepared.json', JSON.stringify({
    film: film.id,
    paintsType: docs.some(paints),
    faces: faces.map((f) => f.file),
    authoredBytes: authoredBytes(docs, included),
    wrote: wrote.slice().sort(),
    maps,
  }, null, 2) + '\n');
  return { film, pack, wrote, faces: faces.length };
}

/**
 * The faces this film ships. Every inlined face is bytes in every artifact of
 * the brand, so the pack is a menu and this is the order: none at all when the
 * film paints no type, otherwise the ones whose family the project names,
 * directly or through a token. A pack may declare a mono for the one film that
 * needs it without charging the others for it.
 */
export function facesFor(pack, values, docs) {
  if (!docs.some(paints)) return [];
  const named = new Set();
  for (const doc of docs) {
    for (const m of doc.matchAll(/font(?:-family)?\s*:\s*([^;}"'\n]+)/gi)) {
      let text = m[1];
      for (const v of m[1].matchAll(/var\(\s*--([A-Za-z0-9-]+)/g)) text += ',' + (values[v[1]] ?? '');
      for (const part of text.split(',')) named.add(part.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
    }
  }
  return pack.face.filter((f) => named.has(f.family.toLowerCase()));
}

/** Whether a generated document paints any type at all. <head> is excluded:
 *  the <title> is metadata and is never drawn into the frame. */
function paints(doc) {
  return strip(doc.replace(/<head\b[\s\S]*?<\/head>/i, ' ')).length > 0;
}

/** The bytes this film's own markup, CSS and timelines cost. Media is taken
 *  out twice over, as data URIs and as included artwork, because media is
 *  content and varies six-fold between films. What is left is the population
 *  an author grows a line at a time, so it is the one worth a cap. */
function authoredBytes(docs, included) {
  return docs.reduce((n, d) => n + Buffer.byteLength(d.replace(/;base64,[A-Za-z0-9+/=]+/g, ';base64,')), 0) - included;
}

/** Text a document will paint: elements and text-bearing attributes. */
function strip(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return body.replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, 'x').replace(/\s+/g, '');
}

/** A shared scene: brand-owned first, then the brand-neutral library. */
function sharedScene(brand, name, beatId) {
  const cands = [path.join(ROOT, 'brands', brand, 'scenes', name + '.html'), path.join(ROOT, 'lib/scenes', name + '.html')];
  const hit = cands.find((f) => fs.existsSync(f));
  if (!hit) {
    throw new Error(`beat "${beatId}" has no <template data-beat="${beatId}"> in beats.html and no shared scene "${name}" at:\n  ${cands.map(rel).join('\n  ')}`);
  }
  return { ...parseBeats(hit).film, source: rel(hit) };
}

/**
 * Expand `<!--include name-->` into the fragment it names, at that line's
 * indent. This is how machine-traced artwork and brand shapes reach a beat:
 * an SVG loaded through src cannot read the document's custom properties, so
 * a token-bound shape has to be markup, and 700 KB of traced path data has no
 * business in a file a person edits.
 */
function expand(part, brand) {
  const out = [];
  const runs = [];
  let run = null;
  let included = 0;
  part.text.split('\n').forEach((line, i) => {
    const m = /^(\s*)<!--\s*include\s+([a-z0-9-]+)\s*-->\s*$/.exec(line);
    if (!m) {
      if (!run) { run = [out.length, part.line + i, 0]; runs.push(run); }
      run[2]++;
      out.push(line);
      return;
    }
    run = null;
    const frag = fragment(brand, m[2]);
    included += Buffer.byteLength(frag);
    for (const l of frag.split('\n')) out.push(l ? m[1] + l : l);
  });
  return { text: out.join('\n'), line: part.line, runs, included };
}

/** A markup fragment: film artwork first, then the brand's own shapes. */
function fragment(brand, name) {
  const cands = [path.join(ROOT, 'media', brand, name + '.svg'), path.join(ROOT, 'brands', brand, 'gfx', name + '.html')];
  const hit = cands.find((f) => fs.existsSync(f));
  if (!hit) throw new Error(`<!--include ${name}--> resolves to nothing. Looked in:\n  ${cands.map(rel).join('\n  ')}`);
  return fs.readFileSync(hit, 'utf8').replace(/\s+$/, '');
}

/** Runs of [generated line, source line, count] so a finding maps back. */
function mapOf(out, parts, source) {
  const runs = [];
  for (const p of parts) {
    if (!p.text) continue;
    const at = lineOfText(out, p.text);
    if (!at) continue;
    // A part that expanded includes reports its own runs, relative to itself.
    for (const [o, src, n] of p.runs || [[0, p.line, p.text.split('\n').length]]) runs.push([at + o, src, n]);
  }
  return { source, runs: runs.sort((a, b) => a[0] - b[0]) };
}
function lineOfText(hay, needle) {
  const i = hay.indexOf(needle.split('\n')[0]);
  return i < 0 ? 0 : hay.slice(0, i).split('\n').length;
}

/** A generated file and line as "beats.html:NN", which is what an author edits. */
export function source(filmDir, file, line) {
  const f = path.join(filmDir, 'prepared.json');
  if (!fs.existsSync(f)) return `${file}:${line}`;
  const m = JSON.parse(fs.readFileSync(f, 'utf8')).maps?.[file];
  if (!m) return `${file}:${line}`;
  for (const [out, src, n] of m.runs) {
    if (line >= out && line < out + n) return `${m.source}:${src + (line - out)}`;
  }
  return `${m.source} (via ${file}:${line})`;
}

/** One data URI per declared image, as a custom property on the host root. */
function images(brand, names) {
  if (!names.length) return '';
  const rows = [...names].sort().map((n) => {
    const ext = IMG_EXT.find((e) => fs.existsSync(path.join(ROOT, 'media', brand, `${n}.${e}`)));
    if (!ext) throw new Error(`film.json lists image "${n}", which is not at media/${brand}/${n}.{${IMG_EXT.join(',')}}`);
    const b64 = fs.readFileSync(path.join(ROOT, 'media', brand, `${n}.${ext}`)).toString('base64');
    return `  #root { --img-${n}: url(data:${MIME[ext]};base64,${b64}) }`;
  });
  return `  /* Images, from media/${brand}/. A beat reads var(--img-<name>). */\n${rows.join('\n')}`;
}

/** The declaration attribute, one token per line. composition_file_too_large
 *  is an error at 300 lines and a 20-token pack pretty-printed is 157 of them. */
const attr = (decl) => '[\n' + decl.map((d) => JSON.stringify(d)).join(',\n').replace(/'/g, '&#39;') + '\n]';

function vtt(film) {
  const at = (t) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`;
  const body = film.vo.map((v, i) => `${i + 1}\n${at(v.start)} --> ${at(v.end)} ${v.cue || 'line:-2 align:center'}\n${v.text}\n`).join('\n');
  return `WEBVTT\nKind: captions\nLanguage: ${film.language || 'en-CA'}\n\nNOTE\nGENERATED by tools/prepare.mjs from film.json. Do not edit.\n\n${body}`;
}

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const indent = (s, n) => s.split('\n').map((l) => (l.trim() ? ' '.repeat(n) + l : l)).join('\n');
const fill = (tpl, vals) => tpl.replace(/__([A-Z]+)__/g, (m, k) => (k in vals ? String(vals[k]) : m));

if (process.argv[1]?.endsWith('prepare.mjs')) {
  const [brand, slug, ...flags] = process.argv.slice(2);
  if (!brand || !slug) { console.error('usage: npm run pre <brand> <slug> [--motion]'); process.exit(2); }
  const r = await prepare(brand, slug, { motion: flags.includes('--motion') });
  console.log(`  prepared work/${brand}/${slug}: ${r.film.beats.length} beat(s), ${r.faces} face(s), ${r.wrote.length} file(s)`);
}
