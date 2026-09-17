// Brand pack -> composition variables.
//
// Emits three generated files per pack, all gitignored:
//   tokens.json    the OBJECT keyed by id, for --variables-file (override shape)
//   surfaces.css   one .s-<name> class per surface, read by tools/prepare.mjs
//   gfx.catalog.md one row per token-bound shape in gfx/
//
// bundleToSingleHtml takes no variables option, so the values that SHIP are
// the defaults in the film's own <html> tag. tools/prepare.mjs writes that tag
// from this module on every run, so a film cannot drift from its pack.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

export const CORE = [
  'ground', 'onGround', 'surface', 'onSurface', 'brand', 'onBrand',
  'accent', 'onAccent', 'line', 'muted', 'display', 'text', 'beat', 'unit',
];
const PARTNERS = [['ground', 'onGround'], ['surface', 'onSurface'], ['brand', 'onBrand'], ['accent', 'onAccent']];
const AA = 4.5;

// ---- colour ---------------------------------------------------------------
const isColor = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(v);
function rgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const hex = (c) => '#' + c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
const toLin = (u) => { const s = u / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const toSrgb = (l) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
/** Mix in linear light, which is what "40% of a on b" should mean optically. */
const mix = (a, b, p) => hex(rgb(a).map((_, i) => toSrgb(toLin(rgb(a)[i]) * p + toLin(rgb(b)[i]) * (1 - p))));
const lum = (c) => { const [r, g, b] = rgb(c).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ---- resolve --------------------------------------------------------------
/** Resolve `{ref}` and `{mix a b 40%}` against the pack's own flat namespace. */
function resolve(flat) {
  const out = {};
  const seen = new Set();
  const get = (k, trail) => {
    if (isColor(k)) return k;                     // a hex literal is its own value
    if (k in out) return out[k];
    if (!(k in flat)) throw new Error(`token "${trail.join(' -> ')}" references "${k}", which the pack does not declare`);
    if (seen.has(k)) throw new Error(`token reference cycle: ${[...trail, k].join(' -> ')}`);
    seen.add(k);
    let v = flat[k];
    if (typeof v === 'string') {
      let m = v.match(/^\{mix\s+([#\w.]+)\s+([#\w.]+)\s+(\d{1,3})%\}$/);
      if (m) {
        const a = get(m[1], [...trail, k]);
        const b = get(m[2], [...trail, k]);
        if (!isColor(a) || !isColor(b)) throw new Error(`{mix} needs two colours; got ${a} and ${b} in "${k}"`);
        v = mix(a, b, Number(m[3]) / 100);
      } else if ((m = v.match(/^\{([#\w.]+)\}$/))) {
        v = get(m[1], [...trail, k]);
      }
    }
    seen.delete(k);
    out[k] = v;
    return v;
  };
  for (const k of Object.keys(flat)) get(k, [k]);
  // Nothing may survive resolution still looking like a directive. An
  // unresolved value is not a colour, so every contrast check that guards it
  // is silently SKIPPED rather than failed, the poisoned-green shape again.
  const stuck = Object.entries(out).filter(([, v]) => typeof v === 'string' && /[{}]/.test(v));
  if (stuck.length) {
    const list = stuck.map(([k, v]) => `${k} = ${v}`).join('\n  - ');
    throw new Error(`unresolved token directive (its contrast check would be skipped, not failed):\n  - ${list}`);
  }
  return out;
}

export async function load(slug) {
  const dir = path.join(ROOT, 'brands', slug);
  const file = path.join(dir, 'brand.ts');
  if (!fs.existsSync(file)) throw new Error(`no brand pack at brands/${slug}/brand.ts`);
  const pack = (await import(pathToFileURL(file).href)).default;
  const err = [];

  // A `_`-prefixed pack is a fixture: it exists to be validated, never to
  // produce an artifact, so the shipping-slug rule cannot apply to it, the
  // prefix is exactly what that rule forbids.
  const fixture = slug.startsWith('_');
  if (!fixture && pack.slug !== slug) err.push(`brand.ts declares slug "${pack.slug}" but lives in brands/${slug}/`);
  if (!fixture && !/^[a-z][a-z0-9]{2,11}$/.test(slug)) err.push(`slug "${slug}" must match /^[a-z][a-z0-9]{2,11}$/, no hyphen, so builds/<brand>-<slug> parses at the first one`);

  for (const k of CORE) {
    if (pack.token?.[k] === undefined || pack.token[k] === '') {
      err.push(`token.${k} is required, the 14-token core is what every film may assume exists`);
    }
  }
  if (typeof pack.token?.beat !== 'number' || !(pack.token.beat > 0)) {
    err.push('token.beat must be a positive number of ms. There is no house tempo and no fallback: a pack that does not declare its own tempo has not been designed.');
  }
  for (const k of ['strobeMinMs', 'stillnessMinMs', 'cascadeDecay', 'overshoot', 'minTypePx', 'minCameraScale']) {
    if (typeof pack.craft?.[k] !== 'number') err.push(`craft.${k} is required, lib/craft.mjs holds the predicate and no numbers`);
  }
  for (const k of Object.keys(pack.extra || {})) {
    if (CORE.includes(k)) err.push(`extra.${k} shadows the core token "${k}", rename it; both are emitted as --${k}`);
    if (!/^[a-z][A-Za-z0-9]*$/.test(k)) err.push(`extra.${k} must be a lowerCamelCase identifier: it becomes the CSS custom property --${k}`);
  }
  if (!Array.isArray(pack.face) || !pack.face.length) err.push('face[] must list at least one face to inline');
  for (const f of pack.face || []) {
    if (!f.file?.startsWith('font/')) err.push(`face ${f.family} ${f.weight}: file must be pack-relative under font/`);
    else if (!fs.existsSync(path.join(dir, f.file))) err.push(`face ${f.family} ${f.weight}: missing file ${f.file}`);
  }
  if (err.length) throw new Error(`brands/${slug} is invalid:\n  - ${err.join('\n  - ')}`);

  // flat namespace: bare core names, plus extra.* and surface refs
  const flat = { ...pack.token };
  for (const [k, v] of Object.entries(pack.extra || {})) flat['extra.' + k] = v;
  const R = resolve(flat);

  // partner contrast is a pack failure, not a film failure
  const bad = [];
  for (const [base, on] of PARTNERS) {
    if (!isColor(R[base]) || !isColor(R[on])) continue;
    const c = contrast(R[base], R[on]);
    if (c < AA) bad.push(`${on} on ${base} is ${c.toFixed(2)}:1, needs ${AA}:1 (${R[on]} on ${R[base]})`);
  }
  if (isColor(R.ground) && isColor(R.muted)) {
    const c = contrast(R.ground, R.muted);
    if (c < AA) bad.push(`muted on ground is ${c.toFixed(2)}:1, needs ${AA}:1 (${R.muted} on ${R.ground})`);
  }
  if (isColor(R.ground) && isColor(R.line)) {
    const c = contrast(R.ground, R.line);
    if (c >= AA) bad.push(`line on ground is ${c.toFixed(2)}:1, that is ink, not a hairline; use it as a token, not as line`);
  }
  for (const [name, ov] of Object.entries(pack.surface || {})) {
    const S = resolve({ ...flat, ...ov });
    for (const [base, on] of PARTNERS) {
      if (!(base in ov) && !(on in ov)) continue;
      if (!isColor(S[base]) || !isColor(S[on])) continue;
      const c = contrast(S[base], S[on]);
      if (c < AA) bad.push(`surface "${name}": ${on} on ${base} is ${c.toFixed(2)}:1, needs ${AA}:1`);
    }
    if (isColor(S.ground) && isColor(S.muted)) {
      const c = contrast(S.ground, S.muted);
      if (c < AA) bad.push(`surface "${name}": muted on ground is ${c.toFixed(2)}:1, needs ${AA}:1 (${S.muted} on ${S.ground})`);
    }
  }
  if (bad.length) throw new Error(`brands/${slug} fails its own contrast contract:\n  - ${bad.join('\n  - ')}`);

  return { pack, dir, values: R };
}

/**
 * The ARRAY that goes on <html data-composition-variables>. Order is stable.
 *
 * The 14-token core comes first and is what EVERY film may assume exists. The
 * pack's own `extra` vocabulary follows, because a brand legitimately owns
 * chips the core does not name, the case that forced this was a brand whose
 * body copy needs a mono family for clause numbers, which no 14-slot schema can
 * hold without making every other brand declare a mono it does not have. A
 * film may only reach for an extra where it is being deliberately brand-locked.
 */
export function declaration(values, extraKeys = []) {
  return [...CORE, ...extraKeys].map((id) => {
    const v = values[id];
    const type = isColor(v) ? 'color' : typeof v === 'number' ? 'number' : 'string';
    const d = { id, type, label: id.replace(/^on([A-Z])/, 'On $1').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(), default: v };
    if (id === 'beat') d.unit = 'ms';
    if (id === 'unit') d.unit = 'px';
    return d;
  });
}

/** What declaration a film of this brand carries. One source, because the
 *  callers that each rebuilt it silently disagreed once extras were added. */
export async function declarationFor(slug) {
  const { pack, values } = await load(slug);
  const extraKeys = Object.keys(pack.extra || {});
  const flat = { ...values, ...Object.fromEntries(extraKeys.map((k) => [k, values['extra.' + k]])) };
  return { pack, values: flat, decl: declaration(flat, extraKeys), extraKeys };
}

export function surfacesCss(pack, flat) {
  const out = [];
  for (const [name, ov] of Object.entries(pack.surface || {})) {
    const S = resolve({ ...flat, ...ov });
    const decls = Object.keys(ov).map((k) => `  --${k}: ${S[k]}`).join(';\n');
    out.push(`.s-${name} {\n${decls};\n  background: var(--ground);\n  color: var(--onGround);\n}`);
  }
  return out.join('\n\n') + (out.length ? '\n' : '');
}

export async function emit(slug) {
  const dir = path.join(ROOT, 'brands', slug);
  const { pack, values: flatValues, decl, extraKeys } = await declarationFor(slug);
  const flat = { ...pack.token };
  for (const [k, v] of Object.entries(pack.extra || {})) flat['extra.' + k] = v;

  const tokens = {};
  for (const id of [...CORE, ...extraKeys]) tokens[id] = flatValues[id];
  const values = flatValues;
  const css = surfacesCss(pack, flat);

  // One line per shape, so an agent can find one without opening any of them.
  // Shapes are inlined by hand at authoring time, an SVG loaded through src
  // cannot read the document's custom properties, so a token-bound shape has
  // to be markup in the film.
  const gfx = path.join(dir, 'gfx');
  if (fs.existsSync(gfx)) {
    const rows = fs.readdirSync(gfx).filter((n) => n.endsWith('.html')).sort().map((n) => {
      const src = fs.readFileSync(path.join(gfx, n), 'utf8');
      const first = (src.match(/<!--\s*([\s\S]*?)(?:\.|-->)/) || [, ''])[1].replace(/\s+/g, ' ').trim();
      const toks = [...new Set([...src.matchAll(/var\(--([A-Za-z0-9]+)/g)].map((m) => m[1]))].sort();
      const lines = src.split('\n').length;
      return `| \`gfx/${n}\` | ${lines} | ${toks.map((t) => '`--' + t + '`').join(' ') || ','} | ${first} |`;
    });
    write(path.join(dir, 'gfx.catalog.md'),
      `<!-- GENERATED by tools/tokens.mjs. Do not edit. -->\n# ${pack.name} shapes\n\n`
      + `Inline the markup into a film. Each is bound to tokens, so it adapts to a surface.\n\n`
      + `| file | lines | tokens | what it is |\n|---|---|---|---|\n${rows.join('\n')}\n`);
  }

  write(path.join(dir, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n');
  write(path.join(dir, 'surfaces.css'), css || '/* no surfaces declared */\n');
  return { pack, values, decl, tokens };
}

function write(f, s) {
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8') === s) return;
  fs.writeFileSync(f, s);
}

if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith('tokens.mjs')) {
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  // `_`-prefixed packs are fixtures: _null is designed to be invalid. They are
  // exercised by tools/fixtures.mjs, never by a normal run.
  const list = slugs.length ? slugs : fs.readdirSync(path.join(ROOT, 'brands'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
  let bad = 0;
  for (const s of list) {
    try {
      const { pack, values } = await emit(s);
      console.log(`  ok   ${s.padEnd(10)} ${pack.name} · ${pack.face.length} face(s) · beat ${values.beat}ms · unit ${values.unit}px · ${Object.keys(pack.surface || {}).length} surface(s)`);
    } catch (e) { bad++; console.log(`  FAIL ${s}\n${String(e.message).split('\n').map((l) => '       ' + l).join('\n')}`); }
  }
  process.exit(bad ? 1 : 0);
}
