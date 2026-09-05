// GATE 2 — assertions on the SHIPPED BYTES.
//
// Never `hyperframes check` here. Pointed at a built artifact it produces the
// poisoned green in its purest form: the vendored runtime and GSAP trip
// non_deterministic_code, template_literal_selector and
// requestanimationframe_in_composition, so lint fails, the browser never boots,
// and every audit then reports clean-and-zero. HyperFrames' own lint calls the
// HyperFrames runtime non-deterministic. The divergence is structural.
//
// Everything below is something no upstream gate can see, because base64 media
// is an upstream lint error and our deliverable is one file full of it.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { load } from './tokens.mjs';
import { build } from './build.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

const BUDGET = { brotli: 200 * 1024, gzip: 230 * 1024 };
const THROTTLE = 4;          // CDP CPU throttling rate
const SEEK_P95_MS = 25;      // best of three rounds; see the note where it is measured
const DCL_MS = 1500;         // measured 328 at 4x
const PCM_CAP = 8 * 1024 * 1024;

function chrome() {
  const cands = [
    process.env.MS_CHROME,
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const hit = cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  if (!hit) throw new Error(`no Chrome found. Set MS_CHROME, or run any hyperframes command once to populate its cache. Tried:\n  ${cands.join('\n  ')}`);
  return hit;
}

export async function gate2(brand, slug) {
  const file = path.join(ROOT, 'builds', `${brand}-${slug}.html`);
  if (!fs.existsSync(file)) throw new Error(`no artifact at builds/${brand}-${slug}.html — run npm run build first`);
  const html = fs.readFileSync(file, 'utf8');
  const buf = Buffer.from(html);
  const film = path.join(ROOT, 'work', brand, slug);
  const { pack, values } = await load(brand);
  const fail = [];
  const note = [];
  const ok = (cond, msg) => { if (!cond) fail.push(msg); };

  // ---- static, on the bytes -----------------------------------------------
  const sizes = {
    raw: buf.length,
    gzip: zlib.gzipSync(buf, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
  ok(sizes.brotli <= BUDGET.brotli, `brotli ${kb(sizes.brotli)} exceeds the ${kb(BUDGET.brotli)} wire budget`);
  ok(sizes.gzip <= BUDGET.gzip, `gzip ${kb(sizes.gzip)} exceeds the ${kb(BUDGET.gzip)} wire budget`);
  note.push(`raw ${kb(sizes.raw)} (uncapped, reported only) · gzip ${kb(sizes.gzip)} · brotli ${kb(sizes.brotli)} = ${(sizes.brotli / BUDGET.brotli * 100).toFixed(0)}% of budget`);

  ok(!/<script[^>]*\ssrc\s*=/i.test(html), 'a <script src=> survived into the artifact');
  ok(!/jsdelivr|cdn\./i.test(html), 'a cdn hostname appears in the artifact');
  ok(/http-equiv="Content-Security-Policy"/i.test(html), 'the artifact carries no <meta> CSP');
  for (const req of ['connect-src data:', 'script-src \'unsafe-inline\' data:', 'media-src data:', 'font-src data:']) {
    ok(html.includes(req), `CSP is missing "${req}" — omitting it fails SILENTLY (LUT grading dies, or AudioWorklet FX are blocked and misreported as a secure-context problem)`);
  }

  // ---- two independent builds must be byte-identical ----------------------
  // The only thing that catches build-time nondeterminism, and it now covers
  // the packager as well as the composition.
  //
  // Two DIFFERENT failures hide behind one hash comparison, and conflating them
  // sends you hunting for nondeterminism when the artifact was merely stale.
  // So: build twice and compare those to each other, then compare the file that
  // was already on disk against a fresh build separately.
  const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
  const onDisk = sha(buf);
  await build(brand, slug);
  const first = sha(fs.readFileSync(file));
  await build(brand, slug);
  const second = sha(fs.readFileSync(file));
  ok(first === second, `two consecutive builds are not byte-identical: ${first.slice(0, 12)} then ${second.slice(0, 12)}. Something in the packager depends on the run rather than the input.`);
  ok(onDisk === first, `builds/${brand}-${slug}.html was STALE — it did not match a fresh build of the current source (${onDisk.slice(0, 12)} on disk, ${first.slice(0, 12)} fresh). This is not nondeterminism: the source changed after the last build. It has been rebuilt, so re-run gate2.`);

  // ---- what the authored source claims, for the browser to be held to -----
  const src = fs.readFileSync(path.join(film, 'index.html'), 'utf8');
  const authoredDuration = Number(src.match(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/)?.[1]
    ?? src.match(/data-duration="([\d.]+)"[^>]*data-composition-id="main"/)?.[1]);
  ok(Number.isFinite(authoredDuration), 'could not read the authored root data-duration from the source');
  const expectIds = new Set(['main']);
  for (const f of fs.readdirSync(path.join(film, 'compositions')).filter((n) => n.endsWith('.html'))) {
    const m = fs.readFileSync(path.join(film, 'compositions', f), 'utf8').match(/data-composition-id="([^"]+)"/);
    if (m) expectIds.add(m[1]);
  }

  // ---- live, in the composition document itself ---------------------------
  const browser = await chromium.launch({ executablePath: chrome() });
  let probe;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

    // Wall-clock around page.goto includes CDP round-trips and Playwright's own
    // overhead, which on a loaded machine swamped the number being measured
    // (988-1595ms for one unchanged file). The page's own navigation timing is
    // the real cost, and best-of-two rejects a noisy neighbour.
    const url = 'file://' + file.replace(/\\/g, '/');
    const dclOf = async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        return n ? Math.round(n.domContentLoadedEventEnd - n.startTime) : null;
      });
    };
    const dclRuns = [await dclOf(), await dclOf()].filter((n) => n != null);
    const dcl = dclRuns.length ? Math.min(...dclRuns) : null;
    await page.waitForFunction('window.__player && document.fonts.status === "loaded"', null, { timeout: 20000 })
      .catch(() => {});

    probe = await page.evaluate(async ({ expectIds, authoredDuration, tokens, faceSpecs }) => {
      const out = { fail: [], info: {} };
      const root = document.querySelector('[data-composition-id]');

      // The document matters. Measured on the rejected srcdoc architecture, an
      // outer shell reported an empty resource list while the artifact made a
      // live network call. This runs in the composition document because the
      // artifact IS the document — that is the whole point of not shipping the
      // player web component.
      const res = performance.getEntriesByType('resource');
      if (res.length) out.fail.push(`${res.length} network request(s): ${res.map((r) => r.name.slice(0, 70)).join(', ')}`);
      out.info.resources = res.length;

      if (!window.__player) { out.fail.push('window.__player is absent — the artifact has no transport'); return out; }
      const d = window.__player.getDuration();
      out.info.duration = d;
      if (Math.abs(d - authoredDuration) > 0.001) out.fail.push(`getDuration() is ${d}, the authored root data-duration is ${authoredDuration}`);

      // Catches a vanished sub-composition: a missing scene reports ready:true
      // and a correct duration while an entire beat is simply gone.
      const got = Object.keys(window.__timelines || {}).sort();
      out.info.timelines = got;
      const want = [...expectIds].sort();
      const missing = want.filter((k) => !got.includes(k));
      const extra = got.filter((k) => !want.includes(k));
      if (missing.length) out.fail.push(`timeline(s) missing: ${missing.join(', ')} — that beat is gone and every other gate is green`);
      if (extra.length) out.info.extraTimelines = extra;

      out.info.fonts = document.fonts.size;
      out.info.fontStatus = document.fonts.status;
      // fonts.size counts DECLARED faces and stays at 5 even when every one of
      // them failed. Per-face status is the real answer, and it separates the
      // two cases that matter: a face the film paints with resolves to
      // "loaded", and a face nothing references stays "unloaded" — which is
      // not a failure, it is dead weight the author should delete.
      const faces = [...document.fonts].map((f) => ({ family: f.family.replace(/^['"]|['"]$/g, ''), weight: String(f.weight), status: f.status }));
      out.info.facesLoaded = faces.filter((f) => f.status === 'loaded').length;
      out.info.facesUnused = faces.filter((f) => f.status === 'unloaded').map((f) => `${f.family} ${f.weight}`);
      const broken = faces.filter((f) => f.status === 'error' || f.status === 'loading');
      if (broken.length) out.fail.push(`face(s) failed to load: ${broken.map((f) => `${f.family} ${f.weight} (${f.status})`).join(', ')}`);
      if (!out.info.facesLoaded) out.fail.push('no declared face loaded at all — the film is rendering entirely in fallback type');
      if (document.fonts.status !== 'loaded') out.fail.push(`document.fonts.status is "${document.fonts.status}"`);

      // A missing aspect-ratio gives a zero-height film that is invisible with
      // every other gate green.
      out.info.offsetHeight = root.offsetHeight;
      out.info.offsetWidth = root.offsetWidth;
      if (!(root.offsetHeight > 0) || !(root.offsetWidth > 0)) out.fail.push(`the composition root measures ${root.offsetWidth}x${root.offsetHeight}`);

      // Brand tokens must survive packaging as computed values.
      const cs = getComputedStyle(root);
      out.info.tokenDrift = [];
      for (const [k, v] of Object.entries(tokens)) {
        const got2 = cs.getPropertyValue('--' + k).trim();
        if (!got2) out.fail.push(`token --${k} is not defined on the composition root`);
        else if (got2.replace(/\s+/g, '') !== String(v).replace(/\s+/g, '')) out.info.tokenDrift.push(`--${k}: ${got2} != ${v}`);
      }
      if (out.info.tokenDrift.length) out.fail.push(`brand token drift: ${out.info.tokenDrift.join('; ')}`);

      // Media, if the film has any.
      const media = [...document.querySelectorAll('audio,video')];
      out.info.media = media.length;
      for (const m of media) {
        if (!m.id) out.fail.push('a media element has no id — the mixer never sees it and the render is silent');
        if (m.readyState !== 4) out.fail.push(`${m.tagName.toLowerCase()}#${m.id} readyState is ${m.readyState}, expected 4`);
      }

      // Seek cost, out of order so nothing benefits from a warm forward path.
      // Three rounds, and the BEST p95 is the verdict: the same artifact
      // measured 13.4ms and 33.3ms on one machine minutes apart, so a single
      // round tests the load average, not the film. The minimum is still a
      // real upper bound on how cheap the artifact can possibly be.
      const grid = [];
      for (let i = 0; i < 40; i++) grid.push(((i * 7919) % 1000) / 1000 * d);
      const round = () => {
        const times = [];
        for (const t of grid) {
          const a = performance.now();
          window.__player.seek(t);
          times.push(performance.now() - a);
        }
        times.sort((a, b) => a - b);
        return { p50: times[Math.floor(times.length * 0.5)], p95: times[Math.floor(times.length * 0.95)], max: times[times.length - 1] };
      };
      round(); // warm-up, discarded
      const rounds = [round(), round(), round()];
      const best = rounds.reduce((a, b) => (a.p95 <= b.p95 ? a : b));
      out.info.seekP50 = +best.p50.toFixed(2);
      out.info.seekP95 = +best.p95.toFixed(2);
      out.info.seekMax = +best.max.toFixed(2);
      out.info.seekRounds = rounds.map((r) => +r.p95.toFixed(1));
      window.__player.seek(0);
      return out;
    }, { expectIds: [...expectIds], authoredDuration, faceSpecs: faceSpecs(pack), tokens: pick(values, ['ground', 'onGround', 'brand', 'onBrand', 'accent', 'line', 'muted']) });

    probe.info.dcl = dcl;
    probe.info.dclRuns = dclRuns;
    fail.push(...probe.fail);
    ok(dcl != null && dcl <= DCL_MS, `domContentLoaded ${dcl}ms at ${THROTTLE}x CPU throttle exceeds ${DCL_MS}ms`);
    ok(probe.info.seekP95 <= SEEK_P95_MS, `seek p95 ${probe.info.seekP95}ms at ${THROTTLE}x exceeds ${SEEK_P95_MS}ms`);
    ok(probe.info.fonts === pack.face.length, `document.fonts.size is ${probe.info.fonts}, the pack declares ${pack.face.length} face(s)`);
    if (probe.info.facesUnused?.length) {
      const bytes = pack.face
        .filter((f) => probe.info.facesUnused.includes(`${f.family} ${f.weight}`))
        .reduce((a, f) => a + fs.statSync(path.join(ROOT, 'brands', brand, f.file)).size, 0);
      note.push(`${probe.info.facesUnused.length} inlined face(s) are never painted with — ${kb(bytes)} of dead weight in every artifact: ${probe.info.facesUnused.join(', ')}. Delete them from brands/${brand}/brand.ts or use them.`);
    }
    ok(errors.length === 0, `console error(s): ${errors.slice(0, 3).join(' | ')}`);

    // Decoded PCM: what the browser actually holds in memory, not the encoded size.
    const pcm = decodedPcmBytes(html);
    ok(pcm <= PCM_CAP, `decoded PCM would be ${kb(pcm)}, cap is ${kb(PCM_CAP)}`);
    if (pcm) note.push(`decoded PCM ${kb(pcm)}`);

    // ---- unclipped text overlap ------------------------------------------
    // Upstream's content_overlap is BLIND to this studio's primary verb.
    // Measured: a 116px headline visibly running through its own body copy
    // reported `layout: 0 errors` under check --strict --at-transitions,
    // because both elements carried a clip-path and the audit sees the clipped
    // box. Since "clipped reveals as the primary verb" is a house rule, that
    // blindness is systematic rather than incidental — so measure the layout
    // the type actually occupies, with every clip forced off.
    const overlaps = await page.evaluate((times) => {
      const off = document.createElement('style');
      off.textContent = '*{clip-path:none !important;-webkit-clip-path:none !important}';
      document.head.appendChild(off);
      const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/)[0] : ''));
      const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      const seen = new Map();
      for (const t of times) {
        window.__player.seek(t);
        const els = [...document.querySelectorAll('[data-composition-id] *')].filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
          // Block-level only. An <em> inside a headline is not an independent
          // text block, and with line-height below 1 its inline box genuinely
          // does overlap the previous line's box while no glyph does — which
          // reported a 172x27px collision between a line and the emphasis on
          // the line after it. The question is whether two text BLOCKS collide.
          if (/^inline/.test(cs.display) || cs.display === 'contents') return false;
          const r = el.getBoundingClientRect();
          return r.width > 1 && r.height > 1 && ownText(el);
        });
        for (let i = 0; i < els.length; i++) {
          for (let j = i + 1; j < els.length; j++) {
            const A = els[i], B = els[j];
            if (A.contains(B) || B.contains(A)) continue;
            const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            // 4px of slack: adjacent baselines legitimately touch.
            if (ox > 4 && oy > 4) {
              const key = [name(A), name(B)].sort().join(' x ');
              const area = Math.round(ox * oy);
              if (!seen.has(key) || seen.get(key).area < area) seen.set(key, { key, t, area, ox: Math.round(ox), oy: Math.round(oy) });
            }
          }
        }
      }
      off.remove();
      window.__player.seek(0);
      return [...seen.values()].sort((x, y) => y.area - x.area);
    }, sampleTimes(probe.info.duration));
    for (const o of overlaps) {
      fail.push(`text overlap ${o.key} — ${o.ox}x${o.oy}px at t=${o.t}s with clips off. Upstream's content_overlap does not see this: it measures the clipped box, and a clipped reveal is this studio's default entrance.`);
    }
    if (!overlaps.length) note.push(`no unclipped text overlap across ${sampleTimes(probe.info.duration).length} samples`);

    // ---- the film as a person actually opens it ---------------------------
    // A separate, unthrottled, UNDRIVEN page. Everything above talks to
    // window.__player directly, which exists by then — so it validated the
    // RUNTIME and never once checked that our own chrome wired up. It did not,
    // and the artifact opened to a blank white screen with every assertion
    // above passing. This is the assertion that would have caught it.
    const opened = await (async () => {
      const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errs = [];
      pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
      pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
      try {
        await pg.goto(url, { waitUntil: 'load' });
        await pg.waitForTimeout(1500);
        const state = await pg.evaluate(() => ({
          chromeWired: !!(window.__ms && window.__ms.player),
          transport: !!document.getElementById('ms-seek'),
          t: window.__player ? +window.__player.getTime().toFixed(2) : null,
          playing: window.__ms && window.__ms.player ? window.__ms.player.isPlaying() : null,
          poster: window.__ms && window.__ms.player ? window.__ms.player.poster : null,
          body: document.body.className,
        }));
        // Real pixels. Nothing short of this distinguishes "a complete frame"
        // from "the frame before every entrance has started", which is blank.
        const png = (await pg.screenshot()).toString('base64');
        state.ink = await pg.evaluate(async (d) => {
          const im = new Image();
          await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = 'data:image/png;base64,' + d; });
          const c = document.createElement('canvas');
          c.width = im.width; c.height = im.height;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(im, 0, 0);
          const px = g.getImageData(0, 0, c.width, c.height).data;
          const hist = new Map();
          let n = 0;
          for (let i = 0; i < px.length; i += 4 * 7) {           // every 7th pixel is plenty
            const k = (px[i] >> 3) << 10 | (px[i + 1] >> 3) << 5 | (px[i + 2] >> 3);
            hist.set(k, (hist.get(k) || 0) + 1);
            n++;
          }
          let modal = 0;
          for (const v of hist.values()) if (v > modal) modal = v;
          return { distinct: hist.size, offModal: +((1 - modal / n) * 100).toFixed(2) };
        }, png);
        state.errors = errs;
        return state;
      } catch (e) { return { error: String(e.message).slice(0, 160), errors: errs }; }
      finally { await pg.close(); }
    })();

    ok(opened.chromeWired, 'the player chrome never initialised — window.__ms.player is absent. The runtime installs window.__player ASYNCHRONOUSLY and sets window.__playerReady beside it; a chrome that reads it once at parse time finds nothing. Every assertion that talks to window.__player directly still passes, and the film ships blank.');
    ok(opened.transport, 'the transport DOM is absent — #ms-seek was never appended');
    ok(opened.ink && opened.ink.offModal >= 0.5,
      `the frame a person opens to is effectively blank: ${opened.ink ? opened.ink.offModal : '?'}% of pixels differ from the modal colour, across ${opened.ink ? opened.ink.distinct : '?'} distinct colours. t=0 is blank BY CONSTRUCTION — every entrance starts from opacity 0 or a fully clipped box — so a film that has not started, or that rests on t=0, shows nothing at all.`);
    ok(opened.t > 0 || /ms-poster/.test(opened.body || ''),
      `1.5s after a plain open the film is at t=${opened.t} and body is "${opened.body}" — neither running nor deliberately showing its poster`);
    ok(!opened.errors?.length, `console error(s) on a plain open: ${(opened.errors || []).slice(0, 2).join(' | ')}`);
    if (opened.ink) note.push(`opened undriven: t=${opened.t}s playing=${opened.playing} poster=${opened.poster?.toFixed?.(2)}s · ${opened.ink.offModal}% of pixels off-modal over ${opened.ink.distinct} colours`);

    // ---- the embed contract, measured, not assumed ------------------------
    // "Needs nothing from the consuming website" is false. A srcdoc embed
    // inherits the host CSP, and under default-src 'self' — the most common
    // marketing-site policy — its inline scripts and styles are both blocked,
    // so the embed is a live frame containing a black rectangle. CSP policies
    // only intersect, so the artifact's own <meta> can never grant them back.
    // Embedded as its own document it carries its own policy. Prove it.
    const e = await embedTest(browser, file, faceSpecs(pack));
    ok(e.ownDoc.ok, `embedded as <iframe src> under a host default-src 'self' with no CSP header on the artifact's own path, it did not run: ${e.ownDoc.why || 'height ' + e.ownDoc.h}`);
    ok(e.ownDoc.faces > 0, 'embedded as its own document, not one declared face loaded — the film is entirely in fallback type');
    note.push(`embed, host default-src 'self': own document ${verdict(e.ownDoc)} · host CSP header on the artifact path ${verdict(e.hostHeader)} · inline-allowed but no font data: ${verdict(e.fontsOnly, pack.face.length)} · srcdoc ${verdict(e.srcdoc)}`);
    if (e.hostHeader.ok) note.push('NOTE: the host CSP header did not block the artifact here — do not weaken host requirement 2 on one measurement');
    if (e.srcdoc.ok) note.push('NOTE: srcdoc ran here; it is still banned, because it inherits the host policy and breaks on any stricter host');
    if (e.fontsOnly.ok && e.fontsOnly.faces < pack.face.length) {
      note.push(`the fontless-CSP case is the dangerous one: the film RAN with ${e.fontsOnly.faces}/${pack.face.length} faces — it looks wrong and reports nothing`);
    }
  } finally {
    await browser.close();
  }

  return { fail, note, sizes, info: probe?.info ?? {} };
}

/**
 * The embed contract, measured rather than assumed. "Needs nothing from the
 * consuming website" is false, and each case below is one of the three host
 * requirements the README has to state:
 *
 *   ownDoc     the recommended deployment. Host page under default-src 'self',
 *              artifact served from the same origin with NO CSP header of its
 *              own. It carries its own <meta> policy and runs. THIS is the pass
 *              criterion; the others are diagnostics for the README.
 *   hostHeader the same, except the site's CSP header is also applied to the
 *              artifact's path. CSP policies only ever intersect, so the
 *              artifact's <meta> can never grant unsafe-inline back: the inline
 *              script and style are both blocked and the embed is a live frame
 *              containing a black rectangle.
 *   fontsOnly  a host CSP that does allow inline script and style but not
 *              `data:` fonts. The film RUNS and looks wrong — every face falls
 *              back silently, with nothing the host would ever notice.
 *   srcdoc     inherits the host policy entirely. Always banned.
 */
async function embedTest(browser, file, specs) {
  const artifact = fs.readFileSync(file);
  const HOST = "default-src 'self'; frame-src 'self'";
  const HEADERS = {
    '/plain.html': {},
    '/hostcsp.html': { 'content-security-policy': HOST },
    '/fontless.html': { 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" },
  };
  // The host page carries NO inline style or script of its own: otherwise its
  // own CSP violations land in the console and read as the artifact's.
  const host = (target) => `<!doctype html><meta charset="utf-8"><title>host</title>`
    + `<iframe id="f" src="${target}" width="960" height="540" frameborder="0" allow="autoplay"></iframe>`;
  const srcdocHost = () => `<!doctype html><meta charset="utf-8"><title>host</title>`
    + `<iframe id="f" width="960" height="540" frameborder="0" srcdoc="`
    + artifact.toString('utf8').replace(/&/g, '&amp;').replace(/"/g, '&quot;') + `"></iframe>`;

  const server = http.createServer((req, res) => {
    const h = { 'content-type': 'text/html; charset=utf-8' };
    if (HEADERS[req.url]) return res.writeHead(200, { ...h, ...HEADERS[req.url] }), res.end(artifact);
    if (req.url === '/host-plain') return res.writeHead(200, { ...h, 'content-security-policy': HOST }), res.end(host('/plain.html'));
    if (req.url === '/host-hostcsp') return res.writeHead(200, { ...h, 'content-security-policy': HOST }), res.end(host('/hostcsp.html'));
    if (req.url === '/host-fontless') return res.writeHead(200, { ...h, 'content-security-policy': HOST }), res.end(host('/fontless.html'));
    if (req.url === '/host-srcdoc') return res.writeHead(200, { ...h, 'content-security-policy': HOST }), res.end(srcdocHost());
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const run = async (route) => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    try {
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'load' });
      const frame = await page.waitForFunction(
        () => { const f = document.getElementById('f'); try { return !!(f && f.contentWindow && f.contentWindow.__player); } catch { return 'xorigin'; } },
        null, { timeout: 8000 },
      ).then(() => true).catch(() => false);
      if (!frame) return { ok: false, why: 'no window.__player after 8s' };
      return await page.evaluate(async (specs) => {
        const w = document.getElementById('f').contentWindow;
        const root = w.document.querySelector('[data-composition-id]');
        try { await w.document.fonts.ready; } catch (e) {}
        // Whether the real faces can actually be painted with, not whether the
        // script ran and not whether they were merely declared.
        const faces = [...w.document.fonts].filter((f) => f.status === 'loaded').length;
        return { ok: root.offsetHeight > 0, h: root.offsetHeight, d: w.__player.getDuration(), faces, fontStatus: w.document.fonts.status };
      }, specs);
    } catch (e) { return { ok: false, why: String(e.message).slice(0, 110) }; }
    finally { await page.close(); }
  };

  try {
    const ownDoc = await run('/host-plain');
    const hostHeader = await run('/host-hostcsp');
    const fontsOnly = await run('/host-fontless');
    const srcdoc = await run('/host-srcdoc');
    return { ownDoc, hostHeader, fontsOnly, srcdoc };
  } finally { server.close(); }
}

/** Bytes a browser holds decoded, from the artifact's inlined audio data URIs. */
function decodedPcmBytes(html) {
  let total = 0;
  for (const m of html.matchAll(/<(?:audio|video)\b[^>]*\ssrc="data:[^;]*;base64,([^"]*)"/gi)) {
    const bytes = Math.floor(m[1].length * 3 / 4);
    // 48 kHz stereo float32 is what a decode costs regardless of the codec.
    total += bytes * 8;
  }
  return total;
}

/** Times to probe layout at. Dense enough to land inside every beat of a film
 *  of this length, and cheap because each sample is one seek plus a read. */
function sampleTimes(duration) {
  const d = duration || 0;
  const step = 0.25;
  const out = [];
  for (let t = 0; t <= d + 1e-9; t += step) out.push(Math.round(t * 100) / 100);
  return out;
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const verdict = (r, faces) => (r.ok ? (faces != null ? `runs, ${r.faces} face(s) painted` : 'runs') : 'blocked');
/** A CSS font shorthand per declared face, for document.fonts.check(). */
const faceSpecs = (pack) => pack.face.map((f) => `${f.style || 'normal'} ${f.weight} 100px "${f.family}"`);
const pick = (o, ks) => Object.fromEntries(ks.filter((k) => k in o).map((k) => [k, o[k]]));

if (process.argv[1]?.endsWith('gate2.mjs')) {
  const [brand, slug] = process.argv.slice(2);
  if (!brand || !slug) { console.error('usage: npm run gate2 <brand> <slug>'); process.exit(2); }
  const r = await gate2(brand, slug);
  for (const n of r.note) console.log(`  ..   ${n}`);
  const i = r.info;
  console.log(`  ..   resources ${i.resources} · duration ${i.duration}s · timelines [${(i.timelines || []).join(' ')}] · fonts ${i.facesLoaded}/${i.fonts} painted (${i.fontStatus}) · root ${i.offsetWidth}x${i.offsetHeight} · dcl ${i.dcl}ms (${(i.dclRuns||[]).join('/')}) · seek p50 ${i.seekP50}ms p95 ${i.seekP95}ms max ${i.seekMax}ms (rounds ${(i.seekRounds||[]).join('/')})`);
  for (const f of r.fail) console.log(`  FAIL ${f}`);
  console.log(r.fail.length ? `\ngate2: ${r.fail.length} failure(s)` : '\ngate2: the artifact holds');
  process.exit(r.fail.length ? 1 : 0);
}
