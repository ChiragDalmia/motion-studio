// The audio pipeline: one mixed track per film, built outside the browser.
//
// Everything a viewer hears is baked into one file before playback starts.
// Nothing is triggered live from the timeline, because a seek would fire a cue
// twice and a scrub backwards would fire it again; a single track has one
// position and cannot disagree with itself.
//
// Providers are authoring-time only and never free. `align` is the one command
// that spends money, it refuses to run without --yes, and nothing else in this
// repo imports it. tools/guard.mjs asserts that.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PCM_CAP, PCM_PER_ENCODED_BYTE } from './film.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const SR = 48000;
const ALIGN_URL = 'https://api.elevenlabs.io/v1/forced-alignment';
const DEFAULTS = { loudness: { target: -16, truePeak: -1, range: 11 }, mp3: { bitrate: '80k', channels: 2 } };
// A WAV master is uncompressed and seekable, so every filter reads the same
// samples on every machine. An MP3 source would decode with encoder padding
// and shift every cue by a few milliseconds.
const WAV = /\.wav$/i;

export const P = (...a) => path.join(ROOT, ...a);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const round = (n) => Math.round(n * 1000) / 1000;
const dbToLinear = (db) => Math.pow(10, db / 20);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

// ---- the manifest ----------------------------------------------------------

/** Load audio/projects/<name>/manifest.json with every default filled in. */
export function manifest(project) {
  const dir = P('audio', 'projects', project);
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) throw new Error(`no manifest at ${rel(file)}. Copy audio/projects/bcc-llqp/ and edit it`);
  let m;
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`${rel(file)} is not valid JSON: ${e.message}`); }

  const err = [];
  if (m.project !== project) err.push(`project is "${m.project}" but the manifest lives in audio/projects/${project}/`);
  if (!m.film?.brand || !m.film?.slug) err.push('film.brand and film.slug are required; the mix is cut to that film\'s exact duration');
  if (!(m.duration > 0)) err.push('duration must be a positive number of seconds');
  if (m.sampleRate != null && m.sampleRate !== SR) err.push(`sampleRate must be ${SR}; every source is resampled to it`);

  const loud = { ...DEFAULTS.loudness, ...(m.loudness || {}) };
  if (!(loud.target < 0)) err.push('loudness.target is an integrated LUFS value and must be negative');
  if (!(loud.truePeak <= 0)) err.push('loudness.truePeak is a dBTP ceiling and must be at or below 0');

  const stems = [];
  if (m.narration) {
    const n = { gain: 0, start: 0, ...m.narration };
    if (!n.file) err.push('narration.file is required when narration is present');
    if (!(n.start >= 0)) err.push('narration.start must be a number of seconds');
    if (!n.transcript) err.push('narration.transcript must name the approved script, which is also what forced alignment is given');
    stems.push(['narration', n.file]);
    m = { ...m, narration: n };
  }
  if (m.music) {
    const mu = { gain: -18, loop: false, fadeIn: 0, fadeOut: 0, trim: { start: 0, end: null }, ...m.music };
    // The threshold is read against the key's RMS, not its peak, so it sits
    // far below the level a voice shows on a meter. Measured against a -8 dBFS
    // key: -32 dB moves the bed 2 dB, -40 dB moves it 9 dB. Tune it by the
    // number the mix reports, not by the one that looks right.
    mu.duck = mu.duck === null ? null : { thresholdDb: -40, ratio: 8, attackMs: 20, releaseMs: 400, ...(mu.duck || {}) };
    if (!mu.file) err.push('music.file is required when music is present');
    if (!(mu.gain <= 0)) err.push('music.gain is a trim in dB and must be at or below 0; a bed never needs boosting into the voice');
    if (!(mu.fadeIn >= 0) || !(mu.fadeOut >= 0)) err.push('music.fadeIn and music.fadeOut are lengths in seconds');
    if (mu.duck && !(mu.duck.ratio >= 1)) err.push('music.duck.ratio must be at least 1');
    stems.push(['music', mu.file]);
    m = { ...m, music: mu };
  }
  const sfx = (m.sfx || []).map((s, i) => {
    const e = { gain: -18, ...s };
    if (!e.id) err.push(`sfx[${i}]: id is required`);
    if (!e.file) err.push(`sfx[${i}] "${e.id}": file is required`);
    if (!Array.isArray(e.at) || !e.at.length) err.push(`sfx[${i}] "${e.id}": at[] must list at least one cue time in seconds`);
    for (const t of e.at || []) {
      if (!(t >= 0)) err.push(`sfx[${i}] "${e.id}": cue ${t} is not a number of seconds`);
      else if (t >= m.duration) err.push(`sfx[${i}] "${e.id}": cue ${t}s starts at or past the ${m.duration}s end of the film`);
    }
    stems.push([`sfx.${e.id}`, e.file]);
    return e;
  });
  const ids = sfx.map((s) => s.id);
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) err.push(`sfx id "${id}" is used twice; one entry carries every cue time for one sound`);
  if (sfx.length > 8) err.push(`${sfx.length} sfx entries. The house set is six to eight reusable sounds; a film that needs more is designing sound rather than reusing it`);

  for (const [what, f] of stems) {
    if (!f) continue;
    if (path.isAbsolute(f) || f.includes('..')) err.push(`${what}: "${f}" must be a path inside the project`);
    if (!WAV.test(f)) err.push(`${what}: "${f}" must be a 48 kHz WAV master, not a lossy file`);
  }

  const out = { wav: 'generated/mix.wav', mp3: 'generated/mix.mp3', ...(m.output || {}) };
  const mp3 = { ...DEFAULTS.mp3, ...(m.mp3 || {}) };
  if (err.length) throw new Error(`${rel(file)} is invalid:\n  - ${err.join('\n  - ')}`);

  const at = (f) => path.join(dir, f);
  return {
    ...m, dir, file, sfx, loudness: loud, output: out, mp3, at,
    captions: { maxChars: 90, maxSeconds: 7, ...(m.captions || {}) },
    embed: m.embed !== false,
  };
}

// ---- ffmpeg ----------------------------------------------------------------

const bin = (name) => process.env[`MS_${name.toUpperCase()}`] || name;

async function ff(name, args, opts = {}) {
  try { return await exec(bin(name), args, { maxBuffer: 64 * 1024 * 1024, ...opts }); }
  catch (e) {
    if (e.code === 'ENOENT') throw new Error(`${name} is not on PATH. Install FFmpeg, or point MS_${name.toUpperCase()} at the binary`);
    throw new Error(`${name} failed:\n${String(e.stderr || e.message).split('\n').slice(-14).join('\n')}`);
  }
}

/** What a source file actually is, rather than what the manifest claims. */
export async function probe(file) {
  const { stdout } = await ff('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels,codec_name,bits_per_raw_sample:format=duration', '-of', 'json', file]);
  const j = JSON.parse(stdout);
  const s = (j.streams || [])[0] || {};
  return {
    duration: Number(j.format?.duration) || 0,
    sampleRate: Number(s.sample_rate) || 0,
    channels: Number(s.channels) || 0,
    codec: s.codec_name || '?',
    bits: Number(s.bits_per_raw_sample) || 0,
  };
}

/** Integrated loudness and true peak, measured by ffmpeg rather than assumed. */
export async function measure(file) {
  const { stderr } = await ff('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const tail = stderr.slice(stderr.lastIndexOf('Summary'));
  const num = (label) => {
    const m = new RegExp(`${label}:\\s*(-?[\\d.]+|-inf)`).exec(tail);
    return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : null;
  };
  return { lufs: num('I'), truePeak: num('Peak'), range: num('LRA') };
}

/** The filter graph, and the input list it indexes into. */
function graph(m) {
  const inputs = [];
  const parts = [];
  const mixIn = [];
  const fmt = `aresample=${SR}:resampler=soxr,aformat=sample_fmts=fltp:channel_layouts=stereo`;
  const cut = (label) => `apad,atrim=0:${m.duration},asetpts=N/SR/TB${label}`;

  let narSide = null;
  if (m.narration) {
    const i = inputs.push({ file: m.at(m.narration.file) }) - 1;
    const delay = Math.round(m.narration.start * 1000);
    // Split before the delay so the ducking key and the audible voice are the
    // same signal at the same moment; keying off an undelayed copy ducks the
    // bed before a word arrives.
    parts.push(`[${i}:a]${fmt},volume=${m.narration.gain}dB${delay ? `,adelay=delays=${delay}:all=1` : ''},${cut('[nar0]')}`);
    if (m.music?.duck) { parts.push('[nar0]asplit=2[nar][narkey]'); narSide = '[narkey]'; }
    else parts.push('[nar0]anull[nar]');
    mixIn.push('[nar]');
  }

  if (m.music) {
    const t = m.music.trim || {};
    const i = inputs.push({ file: m.at(m.music.file), pre: m.music.loop ? ['-stream_loop', '-1'] : [] }) - 1;
    const trim = t.end != null ? `atrim=${t.start || 0}:${t.end}` : `atrim=start=${t.start || 0}`;
    const fades = [
      m.music.fadeIn ? `afade=t=in:st=0:d=${m.music.fadeIn}:curve=ipar` : '',
      m.music.fadeOut ? `afade=t=out:st=${round(m.duration - m.music.fadeOut)}:d=${m.music.fadeOut}:curve=ipar` : '',
    ].filter(Boolean).join(',');
    parts.push(`[${i}:a]${fmt},${trim},asetpts=N/SR/TB,volume=${m.music.gain}dB,${cut(fades ? `,${fades}[mus0]` : '[mus0]')}`);
    if (narSide) {
      const d = m.music.duck;
      parts.push(`[mus0]${narSide}sidechaincompress=threshold=${round(dbToLinear(d.thresholdDb))}:ratio=${d.ratio}`
        + `:attack=${d.attackMs}:release=${d.releaseMs}:makeup=1:level_sc=1:detection=rms[mus]`);
    } else parts.push('[mus0]anull[mus]');
    mixIn.push('[mus]');
  }

  for (const s of m.sfx) {
    const i = inputs.push({ file: m.at(s.file) }) - 1;
    parts.push(`[${i}:a]${fmt},volume=${s.gain}dB[sfx${i}]`);
    // One copy per cue. The same sound at two moments is two streams, so a
    // later cue can never truncate an earlier one that is still ringing.
    if (s.at.length > 1) parts.push(`[sfx${i}]asplit=${s.at.length}${s.at.map((_, k) => `[sfx${i}c${k}]`).join('')}`);
    s.at.forEach((t, k) => {
      const src = s.at.length > 1 ? `[sfx${i}c${k}]` : `[sfx${i}]`;
      const ms = Math.round(t * 1000);
      parts.push(`${src}${ms ? `adelay=delays=${ms}:all=1,` : ''}${cut(`[c${i}_${k}]`)}`);
      mixIn.push(`[c${i}_${k}]`);
    });
  }

  if (!mixIn.length) throw new Error('the manifest names no narration, music or sfx, so there is nothing to mix');
  // normalize=0 or amix divides every input by the number of inputs, which
  // silently drops the voice by 9 dB the moment a third cue is added.
  const sum = [
    mixIn.length === 1 ? `${mixIn[0]}anull[pre]` : `${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:dropout_transition=0[pre]`,
    `[pre]${cut('[body]')}`,
  ];
  return { inputs, parts, sum, all: [...parts, ...sum], mixIn };
}

const args = (inputs) => inputs.flatMap((i) => [...(i.pre || []), '-i', i.file]);

/**
 * Mix to WAV then MP3, in two passes: measure, then apply one gain.
 *
 * loudnorm is used ONLY to measure. Asked to normalise, it falls back to its
 * dynamic mode whenever a linear gain would clip, and dynamic mode is a slow
 * compressor across the whole film: measured here, it pulled the loud passages
 * down and the quiet ones up until four of the eight dB of ducking had been
 * undone. One measured gain and a peak limiter leave the mix as it was cut.
 */
export async function mix(m, { verbose = false } = {}) {
  const g = graph(m);
  const wav = m.at(m.output.wav);
  const mp3 = m.at(m.output.mp3);
  fs.mkdirSync(path.dirname(wav), { recursive: true });

  const pass1 = [...g.all, `[body]loudnorm=I=${m.loudness.target}:TP=${m.loudness.truePeak}:LRA=${m.loudness.range}:print_format=json[out]`].join(';');
  const { stderr } = await ff('ffmpeg', ['-hide_banner', '-nostats', ...args(g.inputs), '-filter_complex', pass1, '-map', '[out]', '-f', 'null', '-']);
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  let meas;
  try { meas = JSON.parse(json); }
  catch { throw new Error(`loudnorm did not report a measurement. ffmpeg said:\n${stderr.split('\n').slice(-12).join('\n')}`); }
  const gain = round(m.loudness.target - Number(meas.input_i));
  if (verbose) console.log(`  measured  ${meas.input_i} LUFS, true peak ${meas.input_tp} dBTP, range ${meas.input_lra} LU, so ${gain > 0 ? '+' : ''}${gain} dB`);

  // alimiter works on sample peaks and an inter-sample peak can sit up to
  // about a decibel above them, so the ceiling is verified after the fact and
  // the limiter is brought down by whatever it actually overshot.
  let headroom = 0;
  let level;
  for (let attempt = 0; attempt < 3; attempt++) {
    const chain = `[body]volume=${gain}dB,alimiter=limit=${round(dbToLinear(m.loudness.truePeak - headroom))}:level=disabled`
      + `,aresample=${SR},apad,atrim=0:${m.duration},asetpts=N/SR/TB[out]`;
    await ff('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args(g.inputs), '-filter_complex', [...g.all, chain].join(';'),
      '-map', '[out]', '-c:a', 'pcm_s24le', '-ar', String(SR), '-ac', '2', wav]);
    level = await measure(wav);
    if (level.truePeak <= m.loudness.truePeak) break;
    headroom = round(headroom + (level.truePeak - m.loudness.truePeak) + 0.1);
    if (verbose) console.log(`  true peak came back at ${level.truePeak} dBTP, so the limiter drops another ${headroom} dB`);
  }

  await ff('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', wav,
    '-c:a', 'libmp3lame', '-b:a', m.mp3.bitrate, '-ar', String(SR), '-ac', String(m.mp3.channels), mp3]);
  return { wav, mp3, level };
}

/**
 * How far the bed actually sits under the voice, in dB, averaged over the
 * film. Rendering the music path twice, once with the sidechain and once
 * without, is the only way to read it: in the finished mix the bed and the
 * voice are one signal and no meter can separate them.
 */
export async function duckDepth(m) {
  if (!m.music?.duck || !m.narration) return null;
  const mean = async (ducked) => {
    const g = graph({ ...m, sfx: [], music: { ...m.music, duck: ducked ? m.music.duck : null } });
    // Everything up to the stems, then [mus] alone: the bed after its gain,
    // its fades and the sidechain, with the voice sunk rather than summed.
    const chain = [...g.parts, '[nar]anullsink', '[mus]volumedetect[out]'].join(';');
    const { stderr } = await ff('ffmpeg', ['-hide_banner', '-nostats', ...args(g.inputs),
      '-filter_complex', chain, '-map', '[out]', '-f', 'null', '-']);
    const hit = /mean_volume:\s*(-?[\d.]+)/.exec(stderr);
    return hit ? Number(hit[1]) : null;
  };
  const [on, off] = [await mean(true), await mean(false)];
  return on == null || off == null ? null : round(off - on);
}

// ---- captions --------------------------------------------------------------

/**
 * Words to cues: whole sentences first, then evenly split when one is too long
 * to read at once.
 *
 * Splitting greedily at the word that crosses the ceiling is what produces a
 * two-word orphan cue after a full line, which reads as a mistake on screen.
 * A sentence that needs n cues is cut into n roughly equal pieces, preferring
 * a comma or a clause boundary near each cut.
 */
export function cues(words, { maxChars, maxSeconds }, offset = 0) {
  const clean = words
    .map((w) => ({ text: String(w.text ?? w.word ?? '').trim(), start: w.start, end: w.end }))
    .filter((w) => w.text);
  const out = [];
  let sentence = [];
  const flush = () => {
    if (!sentence.length) return;
    for (const chunk of split(sentence, maxChars, maxSeconds)) {
      out.push({
        start: round(chunk[0].start + offset),
        end: round(chunk[chunk.length - 1].end + offset),
        text: join(chunk),
      });
    }
    sentence = [];
  };
  for (const w of clean) {
    sentence.push(w);
    if (/[.!?]["')\]]?$/.test(w.text)) flush();
  }
  flush();
  return out;
}

const join = (ws) => ws.map((w) => w.text).join(' ').replace(/\s+([,.!?;:])/g, '$1');

/** One sentence into as few even pieces as the two ceilings allow. */
function split(ws, maxChars, maxSeconds) {
  const text = join(ws);
  const span = ws[ws.length - 1].end - ws[0].start;
  const n = Math.max(Math.ceil(text.length / maxChars), Math.ceil(span / maxSeconds), 1);
  if (n < 2) return [ws];
  const per = text.length / n;
  const parts = [];
  let cur = [];
  let used = 0;
  for (let i = 0; i < ws.length; i++) {
    cur.push(ws[i]);
    const left = ws.length - i - 1;
    if (parts.length === n - 1 || left <= n - parts.length - 2) continue;
    const grown = join(cur).length;
    // Cut once this piece has its share, and one word early when that word
    // ends a clause: a break after a comma reads as a break, not as a stall.
    const target = per * (parts.length + 1) - used;
    const atClause = /[,;:]$/.test(ws[i].text);
    if (grown >= target || (atClause && grown >= target * 0.7)) {
      parts.push(cur);
      used += grown + 1;
      cur = [];
    }
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/** The two shapes this studio already reads: film.json's vo table, and the
 *  {t, d, text} rows the player chrome paints. */
export function captionsFrom(alignment, m) {
  const rows = cues(approved(alignment.words || [], m), m.captions, m.narration?.start || 0)
    .map((c) => ({ ...c, end: Math.min(c.end, m.duration) }))
    .filter((c) => c.text && c.end > c.start);
  return {
    source: 'elevenlabs-forced-alignment',
    duration: m.duration,
    vo: rows.map((c) => ({ start: c.start, end: c.end, text: c.text })),
    chrome: rows.map((c) => ({ t: c.start, d: round(c.end - c.start), text: c.text })),
  };
}

// ---- commands --------------------------------------------------------------

async function cmdValidate(project, flags) {
  const m = manifest(project);
  const bad = [];
  const note = [];
  const warn = [];

  for (const name of ['ffmpeg', 'ffprobe']) {
    try {
      const { stdout } = await ff(name, ['-version']);
      note.push(`${name} ${stdout.split('\n')[0].split(' ')[2]}`);
    } catch (e) { bad.push(e.message); }
  }
  if (bad.length) return report(project, bad, warn, note);

  const filmFile = P('work', m.film.brand, m.film.slug, 'film.json');
  if (!fs.existsSync(filmFile)) bad.push(`the manifest points at work/${m.film.brand}/${m.film.slug}, which has no film.json`);
  else {
    const film = JSON.parse(fs.readFileSync(filmFile, 'utf8'));
    if (Math.abs(film.duration - m.duration) > 1e-9) {
      bad.push(`the film is ${film.duration}s and the manifest says ${m.duration}s. The mix is cut to the film, so these are one number`);
    } else note.push(`cut to ${m.duration}s, the exact duration of ${m.film.brand}/${m.film.slug}`);
  }

  for (const f of ['narration.txt', 'music-prompt.txt', 'sfx-cues.json'].map((n) => `brief/${n}`)) {
    if (!fs.existsSync(m.at(f))) bad.push(`${f} is missing. The brief is what gets pasted into a provider, so it ships with the project`);
  }
  if (m.narration && fs.existsSync(m.at(m.narration.transcript))) {
    const words = script(m.at(m.narration.transcript)).split(/\s+/).filter(Boolean).length;
    if (!words) bad.push(`${m.narration.transcript} has no narration in it once the header is stripped`);
    // Around 150 words a minute read aloud. Well outside that and either the
    // script or the film's duration is the wrong one.
    else {
      note.push(`transcript: ${words} words, about ${Math.round(words / 2.5)}s read aloud against a ${m.duration}s film`);
      if (words / 2.5 > m.duration) warn.push(`the script reads longer than the film; either cut it or retime ${m.film.brand}/${m.film.slug}`);
    }
    const pf = m.narration.pronounce;
    if (pf && !fs.existsSync(m.at(pf))) bad.push(`narration.pronounce names ${pf}, which does not exist`);
    else if (pf) {
      const say = pronounce(m.at(pf));
      const text = script(m.at(m.narration.transcript));
      const spans = spokenSpans(text, say);
      const hit = new Set(spans.flatMap((s) => Object.keys(say).filter((k) => new RegExp(bounded(k)).test(s.original))));
      for (const k of Object.keys(say)) {
        if (!hit.has(k)) warn.push(`${pf} respells "${k}", which never appears in ${m.narration.transcript}`);
      }
      note.push(`${pf}: ${hit.size} of ${Object.keys(say).length} substitution(s) used, ${spans.filter((s) => s.original !== s.said).length} token(s) respelled for the provider`);
    }
  }
  if (fs.existsSync(m.at('brief/sfx-cues.json'))) {
    const brief = JSON.parse(fs.readFileSync(m.at('brief/sfx-cues.json'), 'utf8'));
    const briefed = new Set((brief.sounds || []).map((s) => s.id));
    for (const s of m.sfx) if (!briefed.has(s.id)) bad.push(`the manifest mixes sfx "${s.id}" that brief/sfx-cues.json does not describe, so nobody knows what to generate`);
    for (const id of briefed) if (!m.sfx.some((s) => s.id === id)) warn.push(`brief/sfx-cues.json describes "${id}" that the manifest never places`);
  }

  const sources = [
    ...(m.narration ? [['narration', m.narration.file]] : []),
    ...(m.music ? [['music', m.music.file]] : []),
    ...m.sfx.map((s) => [`sfx ${s.id}`, s.file]),
  ];
  let ready = 0;
  for (const [what, f] of sources) {
    const p = m.at(f);
    if (!fs.existsSync(p)) { warn.push(`${what}: ${f} has not been generated yet`); continue; }
    ready++;
    const info = await probe(p);
    if (!info.duration) { bad.push(`${what}: ${f} carries no decodable audio`); continue; }
    if (info.sampleRate !== SR) warn.push(`${what}: ${f} is ${info.sampleRate} Hz and will be resampled to ${SR}`);
    const peak = await measure(p);
    if (peak.truePeak > -0.1) bad.push(`${what}: ${f} peaks at ${peak.truePeak} dBTP, which is clipped at the source. Regenerate it quieter`);
    if (what === 'narration' && m.narration.start + info.duration > m.duration + 1e-6) {
      bad.push(`narration is ${round(info.duration)}s from ${m.narration.start}s, which runs ${round(m.narration.start + info.duration - m.duration)}s past the end of the film`);
    }
    if (what === 'music' && !m.music.loop && info.duration < m.duration) {
      bad.push(`music is ${round(info.duration)}s for a ${m.duration}s film and music.loop is false, so the last ${round(m.duration - info.duration)}s would be silent`);
    }
    for (const s of m.sfx) {
      if (what !== `sfx ${s.id}`) continue;
      for (const t of s.at) if (t + info.duration > m.duration + 1e-6) warn.push(`sfx ${s.id} at ${t}s is ${round(info.duration)}s long and is cut off by the end of the film`);
    }
    note.push(`${what}: ${round(info.duration)}s ${info.sampleRate} Hz ${info.channels}ch ${info.codec}, peak ${peak.truePeak} dBTP`);
  }

  const lic = P('brands', m.film.brand, 'LICENSES.json');
  if (!fs.existsSync(lic)) bad.push(`brands/${m.film.brand}/LICENSES.json is missing; nothing records what this film is allowed to ship`);
  else {
    const j = JSON.parse(fs.readFileSync(lic, 'utf8'));
    const open = (j.missing || []).filter((x) => ['music', 'audio', 'sfx', 'voice'].includes(x.kind));
    if (open.length) {
      bad.push(`brands/${m.film.brand}/LICENSES.json still lists ${open.map((x) => x.kind).join(', ')} under "missing": ${open[0].why}\n`
        + `    Move each one into "assets" with the licence you now hold, or this film may not ship with audio.`);
    } else note.push(`brands/${m.film.brand}/LICENSES.json records a licence for every audio kind`);
  }

  const out = m.at(m.output.wav);
  if (fs.existsSync(out)) {
    const info = await probe(out);
    const lvl = await measure(out);
    if (Math.abs(info.duration - m.duration) > 0.01) bad.push(`${m.output.wav} is ${round(info.duration)}s, the film is ${m.duration}s. Re-run the mix`);
    if (lvl.truePeak > m.loudness.truePeak + 0.1) bad.push(`${m.output.wav} peaks at ${lvl.truePeak} dBTP, over the ${m.loudness.truePeak} dBTP ceiling`);
    if (Math.abs(lvl.lufs - m.loudness.target) > 1) bad.push(`${m.output.wav} is ${lvl.lufs} LUFS, off the ${m.loudness.target} LUFS target by more than 1 LU`);
    note.push(`${m.output.wav}: ${round(info.duration)}s, ${lvl.lufs} LUFS, ${lvl.truePeak} dBTP`);
    const duck = await duckDepth(m);
    if (duck != null) note.push(`ducking takes ${duck} dB off the bed across the film`);
  } else warn.push(`${m.output.wav} has not been mixed yet`);
  if (fs.existsSync(m.at(m.output.mp3))) {
    const bytes = fs.statSync(m.at(m.output.mp3)).size;
    const inline = Math.ceil(bytes / 3) * 4;
    note.push(`${m.output.mp3}: ${kb(bytes)}, ${kb(inline)} once inlined as base64`);
    // The ceiling a mix hits first. Gate 2 fails on it, but only after a build
    // and a browser, so the same arithmetic runs here where it is one second.
    const pcm = bytes * PCM_PER_ENCODED_BYTE;
    if (pcm > PCM_CAP) {
      bad.push(`decoded, this mix would hold ${kb(pcm)} of PCM in the browser, over gate 2's ${kb(PCM_CAP)} cap.
`
        + `    At ${m.duration}s the highest mp3.bitrate that fits is about ${Math.floor(PCM_CAP / PCM_PER_ENCODED_BYTE * 8 / m.duration / 1000)}k.`);
    } else note.push(`decoded PCM ${kb(pcm)} of gate 2's ${kb(PCM_CAP)} cap`);
    if (m.embed && fs.existsSync(filmFile)) {
      const film = JSON.parse(fs.readFileSync(filmFile, 'utf8'));
      const budget = (film.budget || {}).brotli || 200 * 1024;
      if (inline * 0.99 > budget) {
        warn.push(`inlining it adds about ${kb(inline)} to an artifact budgeted at ${kb(budget)}. Raise "budget" in ${rel(filmFile)}, or drop mp3.bitrate`);
      }
    }
  }

  if (ready === sources.length && sources.length) note.push(`every source present: ${ready} file(s)`);
  return report(project, bad, warn, note, flags);
}

function report(project, bad, warn, note, flags = []) {
  for (const n of note) console.log(`  ok   ${n}`);
  for (const w of warn) console.log(`  warn ${w}`);
  for (const b of bad) console.log(`  FAIL ${b}`);
  const strict = flags.includes('--strict') && warn.length;
  console.log(bad.length || strict
    ? `\naudio validate ${project}: ${bad.length} failure(s), ${warn.length} warning(s)`
    : `\naudio validate ${project}: ready, ${warn.length} warning(s)`);
  return bad.length || strict ? 1 : 0;
}

function cmdSay(project) {
  const m = manifest(project);
  if (!m.narration) throw new Error('this project declares no narration, so there is nothing to speak');
  const approvedText = script(m.at(m.narration.transcript));
  const say = m.narration.pronounce ? pronounce(m.at(m.narration.pronounce)) : {};
  const text = spoken(approvedText, say);
  const out = m.at('generated/spoken.txt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text + '\n');

  const spans = spokenSpans(approvedText, say);
  const changed = [...new Map(spans.filter((s) => s.original !== s.said).map((s) => [s.original, s])).values()];
  console.log(`  wrote ${rel(out)}: ${text.length} characters, ${spans.reduce((n, s) => n + s.count, 0)} words`);
  for (const c of changed) console.log(`    ${c.original}  ->  ${c.said}`);
  if (!changed.length) console.log(`    no substitutions; this is ${m.narration.transcript} with its header stripped`);
  console.log(`\n  Paste that file into the provider. The captions are still built from ${m.narration.transcript},`);
  console.log(`  so the phonetic spellings never reach the screen.`);
  return 0;
}

async function cmdAlign(project, flags) {
  const m = manifest(project);
  if (!m.narration) throw new Error('this project declares no narration, so there is nothing to align');
  const wav = m.at(m.narration.file);
  const txt = m.at(m.narration.transcript);
  for (const f of [wav, txt]) if (!fs.existsSync(f)) throw new Error(`${rel(f)} does not exist. Generate and approve it first`);
  const out = m.at('generated/alignment.json');
  if (fs.existsSync(out) && !flags.includes('--replace')) {
    throw new Error(`generated/alignment.json already exists. Alignment is a paid call, so it is never repeated silently. Pass --replace to spend it again`);
  }

  const approvedText = script(txt);
  if (!approvedText) throw new Error(`${rel(txt)} has no narration in it once the header is stripped`);
  // Alignment is given what the take actually says, not what the captions
  // will read, or every substituted word would land on the wrong timestamp.
  const say = m.narration.pronounce ? pronounce(m.at(m.narration.pronounce)) : {};
  const text = spoken(approvedText, say);
  const bytes = fs.statSync(wav).size;
  console.log(`  submitting to ${ALIGN_URL}`);
  console.log(`    audio       ${rel(wav)}  ${kb(bytes)}`);
  console.log(`    transcript  ${rel(txt)}  ${text.length} characters, ${text.split(/\s+/).length} words`);
  if (Object.keys(say).length) console.log(`    spoken as   ${m.narration.pronounce}, ${Object.keys(say).length} substitution(s); captions still read ${rel(txt)}`);
  console.log(`    first line  ${text.split('\n')[0].slice(0, 96)}`);
  if (!flags.includes('--yes')) {
    console.log('\n  Nothing was sent. This is the only command in the repo that spends provider credit.');
    console.log(`  Re-run with --yes to submit:  npm run audio align ${project} -- --yes`);
    return 0;
  }

  loadEnv();
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Put it in .env, which is gitignored, and never anywhere a build can read');

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), path.basename(wav));
  form.append('text', text);
  const res = await fetch(ALIGN_URL, { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!res.ok) throw new Error(`forced alignment returned ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  if (!Array.isArray(j.words) || !j.words.length) throw new Error(`forced alignment returned no words: ${JSON.stringify(j).slice(0, 300)}`);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ source: ALIGN_URL, words: j.words, loss: j.loss ?? null }, null, 2) + '\n');
  console.log(`\n  wrote ${rel(out)}: ${j.words.length} words, loss ${j.loss ?? 'n/a'}`);
  console.log(`  next:  npm run audio captions ${project}`);
  return 0;
}

function cmdCaptions(project, flags) {
  const m = manifest(project);
  const src = m.at('generated/alignment.json');
  if (!fs.existsSync(src)) throw new Error(`no generated/alignment.json. Run: npm run audio align ${project} -- --yes`);
  const caps = captionsFrom(JSON.parse(fs.readFileSync(src, 'utf8')), m);
  const out = m.at(m.captions.file || 'generated/captions.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(caps, null, 2) + '\n');
  console.log(`  wrote ${rel(out)}: ${caps.vo.length} cue(s) from ${JSON.parse(fs.readFileSync(src, 'utf8')).words.length} aligned words`);

  const filmFile = P('work', m.film.brand, m.film.slug, 'film.json');
  if (!flags.includes('--write')) {
    console.log(`\n  ${rel(filmFile)} was not touched. To copy these timings into the film:`);
    console.log(`    npm run audio captions ${project} -- --write`);
    return 0;
  }
  const film = JSON.parse(fs.readFileSync(filmFile, 'utf8'));
  film.vo = caps.vo;
  film.chrome = { ...(film.chrome || {}), captions: caps.chrome };
  fs.writeFileSync(filmFile, JSON.stringify(film, null, 2) + '\n');
  console.log(`\n  wrote ${caps.vo.length} cue(s) into ${rel(filmFile)}. Re-run: npm run pre ${m.film.brand} ${m.film.slug}`);
  return 0;
}

async function cmdMix(project, flags) {
  const m = manifest(project);
  const out = m.at(m.output.wav);
  if (fs.existsSync(out) && !flags.includes('--replace') && !flags.includes('--force')) {
    console.log(`  ${m.output.wav} already exists; rebuilding it from the same sources is free and deterministic`);
  }
  const r = await mix(m, { verbose: true });
  const info = await probe(r.wav);
  const lvl = r.level || await measure(r.wav);
  const duck = await duckDepth(m);
  const bad = [];
  if (Math.abs(info.duration - m.duration) > 0.01) bad.push(`the mix is ${round(info.duration)}s, the film is ${m.duration}s`);
  if (lvl.truePeak > m.loudness.truePeak + 0.1) bad.push(`the mix peaks at ${lvl.truePeak} dBTP, over the ${m.loudness.truePeak} dBTP ceiling`);
  if (Math.abs(lvl.lufs - m.loudness.target) > 1) bad.push(`the mix is ${lvl.lufs} LUFS, off the ${m.loudness.target} LUFS target by more than 1 LU`);
  console.log(`  ${m.output.wav}  ${round(info.duration)}s ${info.sampleRate} Hz ${info.channels}ch · ${lvl.lufs} LUFS · ${lvl.truePeak} dBTP · ${kb(fs.statSync(r.wav).size)}`);
  console.log(`  ${m.output.mp3}  ${m.mp3.bitrate} ${m.mp3.channels}ch · ${kb(fs.statSync(r.mp3).size)} · ${kb(Math.ceil(fs.statSync(r.mp3).size / 3) * 4)} inlined`);
  if (duck != null) console.log(`  the bed sits ${duck} dB lower across the film than it would unducked; raise music.duck.thresholdDb to duck less`);
  if (bad.length) { for (const b of bad) console.log(`  FAIL ${b}`); return 1; }
  console.log(`\n  next:  npm run ship ${m.film.brand} ${m.film.slug}`);
  return 0;
}

function cmdList() {
  const dir = P('audio', 'projects');
  const names = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  for (const n of names) {
    try {
      const m = manifest(n);
      const built = fs.existsSync(m.at(m.output.mp3));
      console.log(`  ${n.padEnd(20)} ${m.film.brand}/${m.film.slug}  ${m.duration}s  ${built ? 'mixed' : 'not mixed'}`);
    } catch (e) { console.log(`  ${n.padEnd(20)} INVALID: ${String(e.message).split('\n')[0]}`); }
  }
  if (!names.length) console.log('  no audio project yet. Copy audio/projects/bcc-llqp/ and edit manifest.json');
  return 0;
}

/** The words that are read aloud. The file carries a `#` header saying what it
 *  is; that header is not narration and must never reach a provider. */
export function script(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// A model that says the product's own name wrong is wrong four times in this
// film, and the lever every provider actually honours is spelling rather than
// a phoneme tag. So the approved copy stays correct and a map respells it for
// the provider only. Substitution is per token, which keeps the two texts
// word-for-word alignable: the timings come off the phonetic read and the
// caption text off the approved copy, so neither has to compromise.
export function pronounce(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const say = j.say || {};
  for (const [k, v] of Object.entries(say)) {
    if (!String(k).trim() || !String(v).trim()) throw new Error(`${rel(file)}: "${k}" maps to nothing`);
    if (/\s/.test(k)) throw new Error(`${rel(file)}: "${k}" spans a space; a key is one approved token`);
  }
  return say;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// \b only asserts against a word character, so a key that begins or ends in
// punctuation ("study;") can never match with one on that side.
const bounded = (s) => `${/^\w/.test(s) ? '\\b' : ''}${escRe(s)}${/\w$/.test(s) ? '\\b' : ''}`;
const sayWord = (w, say) => Object.entries(say).reduce((out, [from, to]) => out.replace(new RegExp(bounded(from), 'g'), to), w);

/** Each approved token beside the tokens a provider is asked to read for it. */
export function spokenSpans(text, say) {
  return text.split(/\s+/).filter(Boolean).map((original) => {
    const said = sayWord(original, say);
    return { original, said, count: said.split(/\s+/).filter(Boolean).length };
  });
}

/** The approved script as a provider should be given it, line breaks intact. */
export function spoken(text, say) {
  return text.split('\n')
    .map((line) => line.split(/\s+/).filter(Boolean).map((w) => sayWord(w, say)).join(' '))
    .join('\n');
}

/** Aligned words carry phonetic spellings; the captions must not. Regroup them
 *  onto the approved tokens, taking each one's start from the first spoken
 *  word it became and its end from the last. */
function approved(words, m) {
  const f = m.narration?.pronounce;
  if (!f || typeof m.at !== 'function') return words;
  const say = pronounce(m.at(f));
  if (!Object.keys(say).length) return words;
  const spans = spokenSpans(script(m.at(m.narration.transcript)), say);
  const total = spans.reduce((n, s) => n + s.count, 0);
  if (total !== words.length) {
    throw new Error(`forced alignment returned ${words.length} words but ${f} now produces ${total} from `
      + `${m.narration.transcript}. The alignment was made from a different script than the map produces today.\n`
      + `  Re-run align after changing either, or the captions would land on the wrong words.`);
  }
  let i = 0;
  return spans.map((s) => {
    const g = words.slice(i, i + s.count);
    i += s.count;
    return { text: s.original, start: g[0].start, end: g[g.length - 1].end };
  });
}

/** .env, read here and nowhere else. Never imported by build, check or gate2. */
function loadEnv() {
  const f = P('.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const kv = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (kv && !process.env[kv[1]]) process.env[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
}

/**
 * The mix a film ships, if it has one. Read by the packager and the exporter.
 *
 * It THROWS rather than returning null when a mix exists but may not ship: a
 * silent build is what a dropped licence check looks like, and nobody notices
 * a film going quiet until a client does.
 */
export function mixFor(brand, slug) {
  const dir = P('audio', 'projects');
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    const f = path.join(dir, name, 'manifest.json');
    if (!fs.existsSync(f)) continue;
    let m;
    try { m = manifest(name); } catch { continue; }
    if (m.film.brand !== brand || m.film.slug !== slug || !m.embed) continue;
    const mp3 = m.at(m.output.mp3);
    if (!fs.existsSync(mp3)) return null;
    licensed(brand, name);
    return { project: name, mp3, duration: m.duration, loudness: m.loudness };
  }
  return null;
}

/** A brand may ship audio only once its LICENSES.json says what it holds. */
export function licensed(brand, project) {
  const f = P('brands', brand, 'LICENSES.json');
  if (!fs.existsSync(f)) throw new Error(`brands/${brand}/LICENSES.json does not exist, so nothing records what ${project} is allowed to ship`);
  const open = (JSON.parse(fs.readFileSync(f, 'utf8')).missing || []).filter((x) => ['music', 'audio', 'sfx', 'voice'].includes(x.kind));
  if (!open.length) return true;
  throw new Error(`audio project "${project}" is mixed, but brands/${brand}/LICENSES.json still lists `
    + `${open.map((x) => `"${x.kind}"`).join(', ')} under "missing": ${open[0].why}\n`
    + `  Move each one into "assets" with the licence actually held, naming the provider, the plan and the terms.\n`
    + `  Until then this film ships silent, and a build that quietly dropped the sound would look exactly like one that never had any.`);
}

if (process.argv[1]?.endsWith('audio.mjs')) {
  const [cmd, project, ...flags] = process.argv.slice(2);
  const need = () => { if (!project) { console.error(`usage: npm run audio ${cmd} <project>`); process.exit(2); } return project; };
  let code = 0;
  try {
    if (cmd === 'validate') code = await cmdValidate(need(), flags);
    else if (cmd === 'say') code = cmdSay(need());
    else if (cmd === 'align') code = await cmdAlign(need(), flags);
    else if (cmd === 'captions') code = cmdCaptions(need(), flags);
    else if (cmd === 'mix') code = await cmdMix(need(), flags);
    else if (cmd === 'list') code = cmdList();
    else {
      console.log(`usage: npm run audio <command> [project]

  list                       every audio project, and whether it is mixed
  validate <project>         files, formats, duration, cues, clipping, licence, ffmpeg
  say      <project>         generated/spoken.txt: the script as a provider should be given it
  align    <project> --yes   ElevenLabs forced alignment. The ONLY paid call here
  captions <project>         alignment -> cues. --write copies them into film.json
  mix      <project>         generated/mix.wav and generated/mix.mp3

Nothing but "align --yes" reaches a provider, and no build, check, gate or
export path calls any of them.`);
      code = 2;
    }
  } catch (e) { console.error(`  FAIL ${e.message}`); code = 1; }
  process.exit(code ? 1 : 0);
}
