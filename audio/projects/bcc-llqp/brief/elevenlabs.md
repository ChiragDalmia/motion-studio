# ElevenLabs, for bcc/llqp

Two jobs here and nothing else: one narration take, and the six interface
sounds in `sfx-cues.json`. Forced alignment runs later from the command line,
not from the website.

## Narration

Read from `narration.txt`, exactly as written. Strip the `#` header lines; the
rest is the approved copy and a single reworded sentence makes the alignment,
the captions and the film disagree with each other.

- Model: Eleven Multilingual v2, or the current highest-quality English model.
- Voice: one settled Canadian or neutral North American voice, professional
  register. Whichever one is chosen, record its name and voice id in
  `work/bcc/llqp/NOTES.md`, because a second film in this brand has to use the
  same one.
- Stability: high enough that the read is even across 80 seconds. A lively
  setting is the wrong trade here; this voice is explaining an exam program.
- Similarity: middle.
- Style: low. Style is where a corporate read starts performing.
- Speaker boost: on.
- Output format: WAV 48 kHz. Not MP3. The mix resamples everything to 48 kHz
  anyway, and a lossy master decodes with encoder padding that shifts every
  cue by a few milliseconds.

Generate one take. Listen to the whole thing before accepting it, then save it
to `audio/projects/bcc-llqp/source/narration.wav`.

The film is 87 seconds and the script reads at roughly 80. If the take comes
back longer than 84 seconds, slow the film rather than speeding the voice.

## The six interface sounds

`sfx-cues.json` carries one prompt, one length and one destination path per
sound. Generate each with Sound Effects, at the length stated, and save it to
the path stated.

These six are the studio's whole vocabulary. They are generated once and every
later film places the same files at new times, so it is worth being fussy now
and never doing it again.

Each one must be dry, short and quiet. Anything with a reverb tail fights the
next cut, and anything with a pitch centre fights the bed.

## What this file does not cover

Forced alignment. That is one command, it is the only paid call the repo
makes, and it will not run without `--yes`:

```
npm run audio align bcc-llqp -- --yes
```

It needs `ELEVENLABS_API_KEY` in `.env`, which is gitignored. Nothing else in
this repo reads that key, and no build, check, gate or export path can reach a
provider at all.
