# ElevenLabs, for relo/dashboard-tutorial

Two jobs and nothing else: one narration take, and the two interface sounds in
`sfx-cues.json`. Forced alignment runs later from the command line, not from
the website.

**The account is on the free plan**, and `brands/relo/LICENSES.json` records
that rather than a licence nobody holds: non-commercial use, ElevenLabs
credited. Commercial rights begin at Starter, so that entry is what to revisit
before this film is used to sell anything. Nothing else in the pipeline is
blocked: the picture, the captions and the caption control are finished and in
the artifact already.

## Narration

Read from `generated/spoken.txt`, exactly as written, which `npm run audio:say
relo-dashboard-tutorial` writes. It is `narration.txt` with the header stripped
and `pronounce.json` applied, so the words a model reads wrong are already
respelled. Do not paste `narration.txt` itself and do not reword a sentence:
the approved copy is what the captions show, and alignment is given the same
spoken text the take was read from.

- Model: Eleven Multilingual v2, or the current highest-quality English model.
- Voice: one warm, calm, conversational Canadian or neutral North American
  voice. Not a presenter and not a narrator: this is somebody sitting beside a
  learner explaining their own dashboard. Record the voice name and the voice
  id in `work/relo/dashboard-tutorial/NOTES.md`.
- Pace: 145 to 155 words a minute. 598 words at that rate is 232 to 247
  seconds, and the film gives the narration 1.6s to 247.4s. The picture is cut
  to that rate, so a take that runs fast leaves state changes stranded after
  their line and a slow one runs past the closing frame.
- Stability: high enough that the read is even across four minutes. A lively
  setting is the wrong trade for a tutorial.
- Similarity: middle.
- One take. There is no alternate to choose between, and a second take makes a
  different film rather than the same one.

Save it to `source/narration.wav` as 48 kHz WAV, and do not normalise or
compress it: `audio:mix` sets the loudness and the true peak from the manifest.

Two words to listen for, because both are said several times and a model can
get either wrong: **RELO** reads as one word, "RELL-oh", never R-E-L-O and
never "Rilo". **RECA** reads as "RECK-ah". `pronounce.json` already respells
both, so confirm the take honours it rather than assuming it did.

## The two sounds

`sfx-cues.json` carries the prompt, the length and the use for each. No project
has generated them yet, so this is the studio's first pair: keep the two WAVs,
and later films copy `source/sfx/` from here rather than spending on their own,
so every film in the studio clicks the same way.

## Then

```
npm run audio:validate relo-dashboard-tutorial
npm run audio:say relo-dashboard-tutorial
npm run audio:align relo-dashboard-tutorial -- --yes
npm run audio:captions relo-dashboard-tutorial -- --write
npm run pre relo dashboard-tutorial
npm run audio:mix relo-dashboard-tutorial
npm run ship relo dashboard-tutorial
```

`align` is the only command that costs anything. `captions --write` rewrites
`vo` and `chrome.captions` in the film's `film.json` from the real word times,
which is why `pre` has to follow it. A mix at 32 kbps mono for 251 seconds is
about 1.0 MB encoded, which is the whole of `PCM_CAP`, so `budget.brotli` and
`budget.gzip` in `film.json` have to be raised by roughly that much in the same
commit; `audio:validate` prints the highest bitrate that fits before you spend
anything.
