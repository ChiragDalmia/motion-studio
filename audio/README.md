# audio/

One folder per film's soundtrack. `docs/AUDIO.md` has the design and the
reasons; this is the order of operations.

## Once, per machine

FFmpeg on PATH, or `MS_FFMPEG` and `MS_FFPROBE` pointing at the binaries.
`npm run doctor` says whether it can find them.

For alignment, put the key in `.env` at the repo root, which is gitignored:

```
ELEVENLABS_API_KEY=your-key
```

## Per film

```
npm run audio:validate <project>
```

Run it first and run it again after every change. It checks FFmpeg, that the
manifest duration matches the film, that every source exists at 48 kHz and is
not clipped, that the narration and the music cover the film, that every cue
lands inside it, that the brief and the manifest agree on the effects, and
that the brand's LICENSES.json records a licence for what is about to ship.

Then, in order:

```
npm run audio:align <project> -- --yes
npm run audio:captions <project> -- --write
npm run pre <brand> <slug>
npm run audio:mix <project>
npm run ship <brand> <slug>
npm run export <brand> <slug>
```

`align` is the only command that costs money. Without `--yes` it prints what it
would submit and stops. It will not run a second time over an alignment it
already has unless given `--replace`.

`captions --write` rewrites `vo` and `chrome.captions` in the film's
`film.json`, so `npm run pre` has to follow it.

## Starting a new project

Copy `projects/bcc-llqp/`, rename it, and edit `manifest.json`. The project
name is free, `film.brand` and `film.slug` must point at a real film, and
`duration` must equal that film's duration to the millisecond.

Keep the effects to the six in `brief/sfx-cues.json`. They are generated once
and every later film places the same files at new times; a film that needs a
seventh sound is designing sound rather than reusing it.

## What is tracked

`brief/` and `manifest.json`. Not `source/`, not `generated/`. Audio is
entropy-coded, so a git delta against it saves nothing, and a regenerated take
is a different film rather than the same one rebuilt.

That means the audio lives on whoever made it. Back up `source/` somewhere
that is not this repository, and record the voice, the model version, the
prompt and the seed in the film's `NOTES.md`.
