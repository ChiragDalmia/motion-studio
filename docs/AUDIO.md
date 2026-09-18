# Audio

One film, one mixed track. Narration, music and every effect are mixed into a
single file before playback starts, and that file is the clock: the timeline
follows it. Nothing is triggered live, so a seek cannot fire a cue twice and a
scrub backwards cannot fire it again.

A film ships silent unless an audio project points at it, its mix has been
made, and its brand holds a licence for what is in it. All three are checked.

## Where the pieces live

```
audio/projects/<project>/
  brief/       narration.txt, music-prompt.txt, sfx-cues.json, elevenlabs.md
  source/      narration.wav, music.wav, sfx/*.wav        (gitignored)
  manifest.json
  generated/   alignment.json, captions.json, mix.wav, mix.mp3   (gitignored)
```

`manifest.json` is the whole contract: the exact film duration, the narration
file and its approved transcript, the music trim, loop, fades, gain and
ducking, every effect with its cue times and gain, where the captions come
from, the output filenames, and the loudness and true-peak targets.

The brief is tracked because it is what gets pasted into a provider. The audio
is not: it is entropy-coded, so git deltas achieve nothing against it, and
regenerating a take produces a different film rather than the same one.

## Commands

| | |
|---|---|
| `npm run audio list` | every project, and whether it is mixed |
| `npm run audio:validate <project>` | files, formats, duration, cues, clipping, licence, ffmpeg |
| `npm run audio:align <project> -- --yes` | ElevenLabs forced alignment. The only paid call in the repo |
| `npm run audio:captions <project>` | alignment to cues. `-- --write` copies them into `film.json` |
| `npm run audio:mix <project>` | `generated/mix.wav` and `generated/mix.mp3` |
| `npm run audio:test` | the pipeline and the transport, on synthetic fixtures |
| `npm run export <brand> <slug>` | render the picture, then mux `mix.wav` into an MP4 |

`npm run build` inlines `mix.mp3` on its own once a mix exists. There is no
separate command for it and no flag to remember.

## Three findings that still govern the design

**1. An inlined stem in the SOURCE makes the film uncheckable.**
`base64_media_prohibited` is an upstream lint error with no documented
suppression, and `hyperframes check` skips the browser entirely when lint
reports any error, so every browser audit silently does not run while the JSON
envelope still reports `runtime.ok: true`, `contrast.ok: true`, `samples: 0`,
`checked: 0`.

So the source project stays silent and the packager inlines the mix, exactly
as it already does for typefaces. Gate 1 sees the same project it always saw.
Gate 2 covers the artifact: it asserts the mix is the film's length, that it is
muted and paused until a gesture, that the unmute control exists, and that the
page still makes zero network requests.

**2. It is by far the largest byte line.** An 87-second mix at 80 kbps is
850 KB, and base64 adds a third. The wire budget is per film and declared in
`film.json` beside the content that costs it, so a film that carries audio
states its own number and no other film's allowance moves.

The ceiling a mix hits first is not the wire, though. Inlined audio decodes to
48 kHz stereo float whatever the codec, so a browser holds eight bytes per
encoded byte, and `PCM_CAP` in `tools/film.mjs` allows one encoded megabyte.
`audio:validate` projects against it and names the highest bitrate that fits.

**3. It may breach a licence.** A single inlined HTML file on a public URL
means any visitor can view-source and decode the track as a standalone file.
Stock licences forbid exactly that: Pixabay's Content License bars
distributing content on a standalone basis, and the Storyblocks EULA bars
making a stock file available in a manner that invites a third party to
extract it.

The pipeline answers that by not using stock. Music is generated locally with
ACE-Step, narration and effects come from a paid ElevenLabs plan, and both are
work the studio commissioned rather than a file it sublicenses. That is a
claim about a licence somebody holds, so it is written down and checked:
`brands/<slug>/LICENSES.json` must carry no open `missing` entry of kind
`music`, `audio`, `sfx` or `voice`, and the packager refuses to inline a mix
until it does not. A build that quietly dropped the sound would look exactly
like one that never had any.

## Providers are authoring-time only

No install, build, check, gate, preview or export path reaches a provider.
`npm run audio:align` is the only command that spends anything, it prints what
it would submit and does nothing without `--yes`, and it refuses to spend
twice on work it already has unless given `--replace`. `tools/guard.mjs` rule
22 asserts all of that, and that no automatic tool reads an API key.

`ELEVENLABS_API_KEY` lives in `.env`, which is gitignored, and is read in one
function in `tools/audio.mjs`. It never reaches a browser, a build, a log or
the artifact.

## Captions

`film.json`'s `vo` table stays the committed manifest of text and timing, and
it generates `captions.vtt`. What changes is where the numbers come from:
`audio:align` sends the approved narration and its transcript to forced
alignment, `audio:captions` groups the returned words into cues at sentence
ends and then at a length ceiling, and `-- --write` copies them into `film.json`
as both `vo` and `chrome.captions`. No timestamp is guessed.

Because the cues carry `narration.start`, they stay aligned to the mix, and
because the mix is the clock, they stay aligned after a seek or a restart.

## Playback

With a mix present the film rests on its poster until a gesture. No browser
permits unprompted sound, and starting the picture silently spends the opening
line before anyone can reach the unmute control. On that gesture the mix
starts, takes the clock, and the timeline is seeked to `audio.currentTime` once
a frame. Pause, resume, restart and seek move both together. If the browser
refuses to play, the film falls back to its own clock and runs silent.

A film with no mix behaves exactly as it did before: it autostarts when it
scrolls into view, it grows no unmute control, and nothing in the artifact
mentions audio.

During a render there is no real-time clock at all. `npm run export` renders
the picture frame by frame, then muxes the lossless `mix.wav`, so a dropped
frame cannot slide the sound.
