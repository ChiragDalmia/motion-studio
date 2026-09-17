# Audio

**The web build ships silent. Audio is an MP4 feature unless explicitly
waived.** Three independent lines of evidence arrive at the same place.

**1. Inlining a stem makes the film uncheckable.** `base64_media_prohibited` is
an upstream lint error with no documented suppression, and `hyperframes check`
skips the browser entirely when lint reports any error. So an inlined audio
stem means every browser audit, runtime, layout, motion and contrast, silently
does not run while the JSON envelope still reports `runtime.ok: true`,
`contrast.ok: true`, `samples: 0`, `checked: 0`. The rule matches `audio` and
`video` `src` only, which is why fonts, images and CSS `url(data:)` inline
freely and the silent film is entirely self-contained.

**2. It is by far the largest byte line.** One 8-second 22 kHz mono WAV stem
measures 470,482 B as a data URI, more than the entire animation runtime and
more than twice the whole wire budget.

**3. It may breach the music licence.** A single inlined HTML file on a public
URL means any visitor can view-source and decode the original track as a
standalone file. Both plausible upstream licences forbid exactly that:
Pixabay's Content License bars distributing content on a standalone basis, and
the Storyblocks EULA bars making a stock file available in a manner that
invites a third party to extract or access it as a standalone file, audio
included.

## The licence, which has to be bought

The bundled providers' free tiers do not solve this. HeyGen's Terms restrict
Free Plan output to personal, non-commercial and internal evaluation use, which
rules out client work; that covers BGM, SFX, images, icons, TTS, avatars and
translation alike, because the Terms distinguish plans, not asset classes.
Worse for music specifically, the Terms say nothing at all about the stock
catalogue while the help centre names Pixabay and Storyblocks upstream and puts
the burden on the user. A subscriber licence is not sublicensable, which is the
likely reason for the silence.

So **buy a music licence before any audio work**, source from a purchased
subscription, and ingest it without touching a provider credential. For a
studio whose brands are clients the tier matters: Epidemic Sound Pro
sublicenses to clients under $50M revenue, with agencies above $5M pushed to
Enterprise. Treat any local generated-BGM fallback as non-commercial until
proven otherwise; it fires silently when no credential is present, and
MusicGen's original weights are CC-BY-NC.

Until a licence is in hand, every brand's `LICENSES.json` carries a `missing`
entry for music, and that is what a film with audio should be checked against.

## When a film must have web audio

Serve the stem as a sibling file from the brand's own origin, which is also
what those licence clauses require. Set `chrome.audio` in the film's
`film.json` and the player grows an unmute affordance; browsers do not permit
unprompted sound, so the film must work silent regardless. A `data:audio` build
is a deliberate, flagged exception with a purchased licence behind it, and it
forfeits gate 1, so it needs its own written sign-off.

## Providers are authoring-time only

Neither `build` nor `gate2` nor `check` ever calls a provider. A cache miss is
a build failure, not a fetch: text-to-speech is nondeterministic and seeded
reproducibility is best-effort, so regenerating produces a *different film*.

`film.json`'s `vo` table stays the committed manifest of text and timing, and
it generates `captions.vtt`. Generated blobs live content-addressed outside the
tree, because MP3 is entropy-coded and git deltas achieve nothing against it.
