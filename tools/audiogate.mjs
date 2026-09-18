// What the audio pipeline claims, measured. Synthetic fixtures only: the mix
// is tested on tones nobody will ever hear, and the transport is tested on a
// stub player, so this costs no provider credit and needs no approved take.
//
// It exists because every failure here is silent. A mix one frame short, a cue
// that fires twice after a scrub, a second rAF loop running the film at double
// speed: all of them look exactly like a working film until someone watches
// eighty seconds of one.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
import { chrome } from './doctor.mjs';
import { mix, probe, measure, cues, captionsFrom, duckDepth } from './audio.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const TMP = path.join(ROOT, 'tmp', 'audiogate');
const ffmpeg = () => process.env.MS_FFMPEG || 'ffmpeg';
const D = 10;

const fails = [];
const ok = [];
const is = (what, cond, got) => (cond ? ok.push(what) : fails.push(`${what}\n       got: ${got}`));
const near = (what, got, want, slack) => is(`${what} is ${want} (+-${slack})`, Math.abs(got - want) <= slack, got);

/** A fixture stem: `lead` seconds of silence, then `dur` seconds of tone. */
async function tone(file, { freq = 440, dur = 1, lead = 0, gain = -6 }) {
  const silence = lead ? `volume=enable='lt(t,${lead})':volume=0,` : '';
  await exec(ffmpeg(), ['-hide_banner', '-nostats', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${dur + lead}:sample_rate=48000`,
    '-af', `${silence}volume=${gain}dB,aformat=sample_fmts=s16:channel_layouts=stereo`,
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', file]);
}

/** Mean level over one window, optionally in one narrow band. The band is how
 *  the bed is measured while a voice is playing over it: the two fixtures sit
 *  at frequencies that are not multiples of each other, so a filter tuned to
 *  one hears nothing of the other. Cascaded three times, because one biquad
 *  leaves the voice only 25 dB down, which is louder than a ducked bed and
 *  hid two thirds of the duck it was supposed to be measuring. */
async function level(file, start, end, band) {
  const pass = band ? `,${[1, 2, 3].map(() => `bandpass=f=${band}:width_type=h:width=${band / 8}`).join(',')}` : '';
  const chain = `atrim=${start}:${end}${pass},volumedetect`;
  const { stderr } = await exec(ffmpeg(), ['-hide_banner', '-nostats', '-i', file,
    '-af', chain, '-f', 'null', '-'], { maxBuffer: 32 * 1024 * 1024 });
  const m = /mean_volume:\s*(-?[\d.]+|-inf)/.exec(stderr);
  return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : null;
}

// ---- 1. the mix ------------------------------------------------------------
async function mixTests() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'source', 'sfx'), { recursive: true });
  await tone(path.join(TMP, 'source', 'narration.wav'), { freq: 230, dur: 4, lead: 2, gain: -8 });
  await tone(path.join(TMP, 'source', 'music.wav'), { freq: 1100, dur: 4, gain: -10 });
  await tone(path.join(TMP, 'source', 'sfx', 'tap.wav'), { freq: 1500, dur: 0.2, gain: -8 });

  const base = {
    project: 'audiogate', film: { brand: 'x', slug: 'y' }, duration: D,
    loudness: { target: -16, truePeak: -1, range: 11 },
    captions: { maxChars: 90, maxSeconds: 7 },
    mp3: { bitrate: '96k', channels: 2 },
    at: (f) => path.join(TMP, f),
    sfx: [], output: { wav: 'generated/mix.wav', mp3: 'generated/mix.mp3' },
  };

  const full = {
    ...base,
    narration: { file: 'source/narration.wav', start: 0, gain: 0, transcript: 'x' },
    music: { file: 'source/music.wav', gain: -12, loop: true, fadeIn: 0.5, fadeOut: 1, trim: { start: 0, end: null }, duck: { thresholdDb: -40, ratio: 8, attackMs: 20, releaseMs: 300 } },
  };
  await mix(full);
  const info = await probe(base.at('generated/mix.wav'));
  const lvl = await measure(base.at('generated/mix.wav'));
  near('the mix is cut to the film duration', info.duration, D, 0.01);
  is('the mix is 48 kHz stereo', info.sampleRate === 48000 && info.channels === 2, `${info.sampleRate} Hz ${info.channels}ch`);
  near('the mix lands on the loudness target', lvl.lufs, -16, 1);
  is('the mix stays under the true-peak ceiling', lvl.truePeak <= -1 + 0.1, `${lvl.truePeak} dBTP`);
  is('the mp3 was written', fs.existsSync(base.at('generated/mix.mp3')), 'missing');
  const mp3 = await probe(base.at('generated/mix.mp3'));
  near('the mp3 carries the same duration', mp3.duration, D, 0.1);

  const bedOnly = await level(base.at('generated/mix.wav'), 0.8, 1.8);
  const underVoice = await level(base.at('generated/mix.wav'), 3, 5.5);
  is(`the voice is present and dominant (${bedOnly?.toFixed(1)} dB bed alone, ${underVoice?.toFixed(1)} dB with the voice)`,
    underVoice > bedOnly + 6, `${underVoice} against ${bedOnly}`);
  const tail = await level(base.at('generated/mix.wav'), 9.2, 9.9);
  is('the bed fades out before the last frame', tail < bedOnly, `${tail?.toFixed(1)} dB at the tail against ${bedOnly?.toFixed(1)} dB mid-film`);

  // The same mix with ducking switched off. Comparing the two is the only way
  // to see the bed move: in one file the voice and the bed are one signal.
  const flat = { ...full, music: { ...full.music, duck: null }, output: { wav: 'generated/flat.wav', mp3: 'generated/flat.mp3' } };
  await mix(flat);
  // Each file is loudness-normalised to its own gain, so the bed measured in
  // a voice-free window is the reference the ducked window is read against.
  const depth = async (f) => (await level(base.at(f), 0.8, 1.8, 1100)) - (await level(base.at(f), 3, 5.5, 1100));
  const ducked = await depth('generated/mix.wav');
  const flatDepth = await depth('generated/flat.wav');
  is(`the bed ducks ${ducked.toFixed(1)} dB under the voice, against ${flatDepth.toFixed(1)} dB with ducking off`,
    ducked - flatDepth > 4, `${(ducked - flatDepth).toFixed(2)} dB of duck, which is none`);
  const reported = await duckDepth(full);
  is(`the mixer reports the duck it applied (${reported} dB averaged over the whole film)`,
    reported > 1 && reported < ducked - flatDepth + 1, `${reported} against ${(ducked - flatDepth).toFixed(1)} dB measured under the voice`);
  is('a mix with ducking off reports no duck at all', (await duckDepth(flat)) === null, 'it reported a depth for a mix with ducking off');

  // Cues alone, so a click can be found rather than inferred under a bed.
  const only = { ...base, sfx: [{ id: 'tap', file: 'source/sfx/tap.wav', at: [1, 8], gain: 0 }], output: { wav: 'generated/sfx.wav', mp3: 'generated/sfx.mp3' } };
  await mix(only);
  const sfxInfo = await probe(base.at('generated/sfx.wav'));
  near('a cue-only mix is still padded to the exact duration', sfxInfo.duration, D, 0.01);
  const atCue = await level(base.at('generated/sfx.wav'), 1, 1.2);
  const atCue2 = await level(base.at('generated/sfx.wav'), 8, 8.2);
  const between = await level(base.at('generated/sfx.wav'), 3, 7);
  is(`both cues land where the manifest puts them (${atCue?.toFixed(1)} dB at 1s, ${atCue2?.toFixed(1)} dB at 8s)`,
    atCue > -40 && atCue2 > -40, `${atCue} / ${atCue2}`);
  is(`nothing sounds between the cues (${between === -Infinity ? 'silent' : between?.toFixed(1) + ' dB'})`,
    between < -60, `${between} dB between 3s and 7s`);
}

// ---- 2. captions from an alignment ----------------------------------------
function captionTests() {
  const words = [];
  let t = 0;
  for (const w of 'Prepare for your exams. Powered by ReadyEngine, the program combines preparation with a clear view of readiness. It keeps checking.'.split(' ')) {
    words.push({ text: w, start: t, end: t + 0.3 });
    t += 0.35;
  }
  const m = { duration: 60, captions: { maxChars: 90, maxSeconds: 7 }, narration: { start: 2 } };
  const caps = captionsFrom({ words }, m);
  is('a sentence end breaks a cue', caps.vo.length >= 3, `${caps.vo.length} cue(s)`);
  is('every cue is inside the length ceiling', caps.vo.every((c) => c.text.length <= 90), caps.vo.map((c) => c.text.length).join(', '));
  is('cues carry the narration offset', Math.abs(caps.vo[0].start - 2) < 0.01, caps.vo[0].start);
  is('cues are ordered and never overlap', caps.vo.every((c, i) => i === 0 || c.start >= caps.vo[i - 1].end - 0.001), 'a cue starts before the one before it ends');
  is('the chrome shape carries a duration, not an end', caps.chrome.every((c) => c.d > 0 && c.t >= 0), JSON.stringify(caps.chrome[0]));
  is('the exact approved words survive', caps.vo.map((c) => c.text).join(' ').replace(/\s+/g, ' ').startsWith('Prepare for your exams.'), caps.vo[0].text);
  const empty = cues([], { maxChars: 90, maxSeconds: 7 });
  is('an empty alignment produces no cues rather than one blank', empty.length === 0, `${empty.length}`);
}

// ---- 3. the transport, in a real browser from file:// ----------------------
/** A self-contained page: the shipped chrome, the shipped markup shape, a stub
 *  runtime. Same bytes of lib/chrome as the packager inlines. */
function harness(withMix, mp3) {
  const css = fs.readFileSync(path.join(ROOT, 'lib/chrome/chrome.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'lib/chrome/chrome.js'), 'utf8');
  const ms = { film: 'audiogate', width: 640, height: 360, poster: 2, ...(withMix ? { mix: { duration: D, lufs: -16, truePeak: -1 } } : {}) };
  // Anchored to a wall clock, never integrated from frame deltas: under the
  // frame storm a driven browser produces, a delta-summing stub ran the film
  // at twenty times speed and reported it as a transport bug.
  const stub = `
    var base = 0, since = 0, running = false;
    function at() { return running ? Math.min(${D}, base + (performance.now() - since) / 1000) : base; }
    window.__timelines = {};
    window.__player = {
      getDuration: function () { return ${D}; },
      getTime: at,
      seek: function (x) { base = Math.max(0, Math.min(${D}, x)); since = performance.now(); window.__seeks = (window.__seeks || 0) + 1; },
      play: function () { base = at(); since = performance.now(); running = true; window.__plays = (window.__plays || 0) + 1; },
      pause: function () { base = at(); running = false; },
    };
    window.__playerReady = true;`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>audiogate</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; media-src data:; img-src data:">
<style>${css}</style><style>#root{background:#123;color:#fff}</style></head><body>
<div id="root" data-composition-id="main" data-width="640" data-height="360" data-duration="${D}"><p>frame</p></div>
${withMix ? `<audio id="ms-mix" preload="auto" src="data:audio/mpeg;base64,${mp3}"></audio>\n` : ''}<script>${stub}</script>
<script>window.__ms=${JSON.stringify(ms)}</script>
<script>${js}</script></body></html>`;
}

async function transportTests() {
  const mp3 = fs.readFileSync(path.join(TMP, 'generated/mix.mp3')).toString('base64');
  fs.writeFileSync(path.join(TMP, 'with-mix.html'), harness(true, mp3));
  fs.writeFileSync(path.join(TMP, 'silent.html'), harness(false, ''));
  const browser = await chromium.launch({ executablePath: chrome() });
  try {
    await withMixTests(browser);
    await silentTests(browser);
  } finally { await browser.close(); }
}

const state = () => ({
  playing: window.__ms.player.isPlaying(),
  driving: window.__ms.player.driving(),
  drift: window.__ms.player.drift(),
  t: +window.__ms.player.time().toFixed(3),
  visual: +window.__player.getTime().toFixed(3),
  muted: document.getElementById('ms-mix') ? document.getElementById('ms-mix').muted : null,
  paused: document.getElementById('ms-mix') ? document.getElementById('ms-mix').paused : null,
  audios: document.querySelectorAll('audio').length,
  body: document.body.className,
  resources: performance.getEntriesByType('resource').length,
});

async function withMixTests(browser) {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await page.goto('file://' + path.join(TMP, 'with-mix.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  // A function, not a string: a string predicate runs through eval(), which
  // the page's own CSP forbids, exactly as the shipped artifact's does.
  await page.waitForFunction(() => window.__ms && window.__ms.player, null, { timeout: 15000 });
  await page.waitForFunction(() => document.getElementById('ms-mix').readyState === 4, null, { timeout: 15000 });

  let s = await page.evaluate(state);
  is('a film with a mix opens on its poster rather than playing', !s.playing && /ms-poster/.test(s.body), s.body);
  is('the mix is muted and paused before any gesture', s.muted && s.paused, `muted=${s.muted} paused=${s.paused}`);
  is('the runtime clock is still the one driving at rest', s.driving === 'visual', s.driving);
  is('opening the page makes no network request', s.resources === 0, `${s.resources} request(s)`);
  is('the unmute control is present', await page.locator('#ms-mute').count() === 1, 'no #ms-mute');

  // play
  await page.click('#ms-poster');
  await page.waitForTimeout(700);
  s = await page.evaluate(state);
  is('a gesture starts the film', s.playing, `playing=${s.playing}`);
  is('the mix takes the clock on that gesture', s.driving === 'audio' && !s.paused, `driving=${s.driving} paused=${s.paused}`);
  is('the sound is audible once engaged', s.muted === false, `muted=${s.muted}`);
  is(`the picture follows the sound (drift ${s.drift}s)`, Math.abs(s.drift) < 0.08, `${s.drift}s`);
  is('still exactly one audio element', s.audios === 1, `${s.audios}`);

  // One clock, not two: a second loop would run the film at roughly double
  // speed. Measured over a long window and with real slack, because the
  // failure being looked for is 2x and the noise on a loaded machine is 0.2x.
  const t0 = (await page.evaluate(state)).t;
  const wall = Date.now();
  await page.waitForTimeout(2000);
  const rate = ((await page.evaluate(state)).t - t0) / ((Date.now() - wall) / 1000);
  near('the film advances at one times real time', rate, 1, 0.35);

  // pause and resume
  await page.click('#ms-play');
  await page.waitForTimeout(400);
  const p1 = await page.evaluate(state);
  await page.waitForTimeout(600);
  const p2 = await page.evaluate(state);
  is('pause stops both clocks', !p1.playing && p1.paused, `playing=${p1.playing} paused=${p1.paused}`);
  is('a paused film does not creep forward', Math.abs(p2.t - p1.t) < 0.02, `${p1.t} then ${p2.t}`);
  await page.click('#ms-play');
  await page.waitForTimeout(600);
  const r = await page.evaluate(state);
  is('resume carries on from where it paused', r.playing && r.t > p2.t, `${p2.t} then ${r.t}`);
  is('resume does not hand the clock back', r.driving === 'audio', r.driving);

  // seeking, forward and backward, on a running film and a paused one
  await page.evaluate(() => { const s = document.getElementById('ms-seek'); s.value = '7.5'; s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(250);
  const fwd = await page.evaluate(state);
  near('a forward seek moves the sound with the picture', fwd.t, 7.5, 0.4);
  is(`both clocks agree after a forward seek (drift ${fwd.drift}s)`, Math.abs(fwd.drift) < 0.15, `${fwd.drift}s`);
  is('a running film is still running after a scrub', fwd.playing, `playing=${fwd.playing}`);

  await page.click('#ms-play');
  await page.evaluate(() => { const s = document.getElementById('ms-seek'); s.value = '2.0'; s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(250);
  const back = await page.evaluate(state);
  near('a backward seek moves the sound with the picture', back.t, 2, 0.4);
  is('a paused film stays paused through a scrub', !back.playing && back.paused, `playing=${back.playing} paused=${back.paused}`);
  is('no cue is left marked as fired after a scrub back', Object.keys(await page.evaluate(() => window.__ms.player.fired)).length === 0, 'the fired map is not empty');

  // mute
  await page.click('#ms-play');
  await page.waitForTimeout(200);
  await page.click('#ms-mute');
  await page.waitForTimeout(500);
  const m1 = await page.evaluate(state);
  is('mute silences the mix without dropping the clock', m1.muted && m1.driving === 'audio' && m1.playing, `muted=${m1.muted} driving=${m1.driving}`);
  await page.waitForTimeout(500);
  const m2 = await page.evaluate(state);
  is('a muted film keeps running', m2.t > m1.t, `${m1.t} then ${m2.t}`);
  await page.click('#ms-mute');
  is('unmute is the same control back', !(await page.evaluate(state)).muted, 'still muted');

  // the end, then a restart, then repeated playback
  await page.evaluate(() => { const s = document.getElementById('ms-seek'); s.value = String(9.6); s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(1400);
  const end = await page.evaluate(state);
  is('the film stops itself at the end', !end.playing, `playing=${end.playing} t=${end.t}`);
  await page.click('#ms-play');
  await page.waitForTimeout(500);
  const again = await page.evaluate(state);
  is('play after the end restarts from the top', again.playing && again.t < 1.2, `t=${again.t}`);
  is('a restart does not add a second audio element', again.audios === 1, `${again.audios}`);

  for (let i = 0; i < 4; i++) {
    await page.click('#ms-play');
    await page.waitForTimeout(120);
    await page.click('#ms-play');
    await page.waitForTimeout(120);
  }
  const a0 = await page.evaluate(state);
  const wall2 = Date.now();
  await page.waitForTimeout(2000);
  const a1 = await page.evaluate(state);
  near('four play/pause cycles leave exactly one clock running', (a1.t - a0.t) / ((Date.now() - wall2) / 1000), 1, 0.35);
  is('repeated playback adds no audio element', a1.audios === 1, `${a1.audios}`);
  is('no network request was ever made', a1.resources === 0, `${a1.resources}`);
  is('the transport logged no console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();
}

async function silentTests(browser) {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto('file://' + path.join(TMP, 'silent.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ms && window.__ms.player, null, { timeout: 15000 });
  await page.waitForTimeout(900);
  const s = await page.evaluate(state);
  is('a film with no mix still plays', s.playing, `playing=${s.playing}`);
  // The transport is pointer-events:none until the page is hovered, which is
  // deliberate: it hides during playback. A click with the pointer still
  // outside the page retries until the film has run out, and then reports the
  // restart it caused as a broken pause button.
  await page.mouse.move(450, 300);
  is('a film with no mix drives itself', s.driving === 'visual', s.driving);
  is('a film with no mix grows no unmute control', await page.locator('#ms-mute').count() === 0, 'an unmute control appeared');
  is('a film with no mix carries no audio element', s.audios === 0, `${s.audios}`);
  await page.click('#ms-play');
  await page.waitForTimeout(200);
  is('the transport still works without a mix', !(await page.evaluate(state)).playing, 'pause did nothing');
  is('the silent path logged no console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();
}

// ---- run -------------------------------------------------------------------
try {
  await mixTests();
  captionTests();
  await transportTests();
} catch (e) {
  fails.push(`the suite threw before it finished: ${String(e.message).split('\n').slice(0, 6).join('\n            ')}`);
}

for (const m of ok) console.log(`  ok   ${m}`);
for (const m of fails) console.log(`  FAIL ${m}`);
console.log(fails.length ? `\naudiogate: ${fails.length} failure(s) of ${ok.length + fails.length}` : `\naudiogate: ${ok.length} assertions hold`);
process.exit(fails.length ? 1 : 0);
