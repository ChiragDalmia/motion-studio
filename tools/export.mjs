// MP4 export: render the picture deterministically, then mux the mix onto it.
//
// The render is frame by frame and there is no real-time clock in it, so the
// browser's own audio is never involved and could not be trusted if it were:
// a dropped frame would slide every cue after it. The lossless mix.wav is
// married to the finished video by ffmpeg, where the offset is exact.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { load } from './film.mjs';
import { manifest, mixFor, probe } from './audio.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'node_modules/hyperframes/dist/cli.js');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const ffmpeg = () => process.env.MS_FFMPEG || 'ffmpeg';

export async function exportFilm(brand, slug, { fps = 30, quality = 'high', keepSilent = false } = {}) {
  const film = load(brand, slug);
  if (!fs.existsSync(path.join(film.dir, 'index.html'))) {
    throw new Error(`work/${brand}/${slug} is not prepared. Run: npm run pre ${brand} ${slug}`);
  }
  const out = path.join(film.dir, 'renders');
  fs.mkdirSync(out, { recursive: true });
  const silent = path.join(out, `${brand}-${slug}-silent.mp4`);
  const final = path.join(out, `${brand}-${slug}.mp4`);

  console.log(`  rendering ${film.duration}s at ${fps} fps, quality ${quality}`);
  await exec(process.execPath, [CLI, 'render', film.dir, '--format', 'mp4', '--fps', String(fps),
    '--quality', quality, '--output', silent, '--quiet'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  if (!fs.existsSync(silent)) throw new Error(`the render reported success but wrote no file at ${rel(silent)}`);

  const mix = mixFor(brand, slug);
  if (!mix) {
    fs.copyFileSync(silent, final);
    fs.rmSync(silent, { force: true });
    console.log(`  no mix for ${brand}/${slug}, so ${rel(final)} is silent`);
    return { out: final, audio: false };
  }
  // The WAV, never the MP3. The MP4's own AAC encode is the only lossy step a
  // viewer should ever hear, and encoding an encode is two of them.
  const wav = manifest(mix.project).at(manifest(mix.project).output.wav);
  if (!fs.existsSync(wav)) throw new Error(`${rel(wav)} does not exist. Run: npm run audio mix ${mix.project}`);

  await exec(ffmpeg(), ['-hide_banner', '-nostats', '-y', '-i', silent, '-i', wav,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', '-shortest', final], { maxBuffer: 32 * 1024 * 1024 });

  const v = await probe(silent);
  const a = await probe(final);
  const bad = [];
  const { stdout } = await exec(process.env.MS_FFPROBE || 'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'json', final]);
  const streams = JSON.parse(stdout).streams || [];
  if (!streams.some((s) => s.codec_type === 'audio')) bad.push('the muxed file carries no audio stream');
  if (!streams.some((s) => s.codec_type === 'video')) bad.push('the muxed file carries no video stream');
  if (Math.abs(a.duration - film.duration) > 0.2) bad.push(`the export is ${a.duration.toFixed(3)}s and the film is ${film.duration}s`);
  if (bad.length) throw new Error(`the export is wrong:\n  - ${bad.join('\n  - ')}`);
  if (!keepSilent) fs.rmSync(silent, { force: true });

  console.log(`  ${rel(final)}  ${a.duration.toFixed(2)}s · picture ${v.duration.toFixed(2)}s · ${streams.map((s) => s.codec_name).join(' + ')} · ${(fs.statSync(final).size / 1048576).toFixed(1)} MB`);
  return { out: final, audio: true };
}

if (process.argv[1]?.endsWith('export.mjs')) {
  const [brand, slug, ...flags] = process.argv.slice(2);
  if (!brand || !slug) { console.error('usage: npm run export <brand> <slug> [--fps=30] [--quality=high] [--keep-silent]'); process.exit(2); }
  const flag = (name, dflt) => (flags.find((f) => f.startsWith(`--${name}=`)) || '').split('=')[1] || dflt;
  try {
    await exportFilm(brand, slug, {
      fps: Number(flag('fps', 30)),
      quality: flag('quality', 'high'),
      keepSilent: flags.includes('--keep-silent'),
    });
  } catch (e) { console.error(`  FAIL ${e.message}`); process.exit(1); }
}
