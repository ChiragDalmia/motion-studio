---
brand: relo
slug: next-step
surface: web
---

## Intent

Someone preparing for the Alberta real estate exams should believe that Relo
turns "am I ready?" into one clear next step — and should be able to buy the
Residential Real Estate Bundle from the last frame.

## Assets

<!-- Every mark, face, bed and photograph, with where it came from and what
     licence it ships under. A film with an unlisted asset does not ship. -->

- `brands/relo/gfx/lockup.html` — the RELO lockup, inlined verbatim into
  `compositions/intro.html` (byte-identical to brand-promise's intro) and
  again, static with ids re-prefixed `e-lockup-*`, in the host's end frame.
  Owned brand geometry; see `brands/relo/LICENSES.json`.
- Oswald 700, Poppins 500/600 — OFL, subset by `tools/font.mjs`.
- `compositions/img/v01.webp`, `v10.webp`, `v11.webp`, `s03.webp`, `s05.webp`,
  `v06.webp` — the RELO product, captured from the running ALF Experience Lab
  (scenario `relo-fre-new-learner`, day one, viewport 1600x1000 at device scale
  2, lossless WebP) by driving it: the dashboard with its sidebar in the
  product's own collapsed state; Lessons; the lesson player; Study Navigator >
  PRACTICE; the first answer selected and submitted; and the set scored, which
  took answering all twelve questions. `d07.webp` is the one rectangle the
  finished set changes on the dashboard -- the counter 0 / 20 -> 12 / 20 and the
  row under it -- laid over `v01`, because two near-identical full pages would
  have cost 95 KB to say one number. `v01-small.webp` is v01 at 700px for the
  laptop screen in the desk beats. RELO product UI, owned by WKT.
- `compositions/img/h-lessons.webp`, `h-watch.webp`, `h-play.webp`,
  `h-proceed.webp`, `h-continue.webp`, `rr-down-hover.webp`, `rr-open.webp`,
  `rr-open-hover.webp`, `opt1-hover.webp`, `opt1-sel.webp`,
  `opt1-sel-hover.webp`, `submit-on.webp`, `submit-hover.webp` —
  pixel-registered lossless crops from the same sessions: the genuine hover,
  selected and expanded states of every control the film operates.
  `p-t0..p-t3.webp` are the player's transport at 0, 1, 2 and 3 seconds of real
  playback, and `p-bar.webp` is its scrub bar at the end of the video, revealed
  left to right as the film plays it. Same ownership.
- Substituted inside those captures, and the only pixels in this film that sit
  in the product's frame without being the product's: the lab's lesson videos
  are placeholder CPA accounting footage from another vertical (ExamPrep.ai
  slides on income statements), and shipping them in a RELO film would be wrong.
  The player's video area carries a RELO lesson title card built from the
  brand's own lockup and colours, put into ArtPlayer's own layer stack so the
  transport, the scrub bar and the clock over it are all still the product's;
  the lessons index carries the same card without its title as each course
  cover. The lab's collapsed rail asks for `/icons/favicon-32x32.png`, which
  404s there and renders a broken-image glyph, so the capture serves
  `media/mark.svg` in its place -- the mark the real product shows.
- `compositions/img/angela.webp` — Angela Detmold's photograph from
  https://relo.ca/images/Relo_Experts_Angela.png (the Office Hours page,
  https://relo.ca/how-it-works/office-hours/), 330x330, flattened onto white.
  RELO's own published staff portrait; used with her name and title exactly as
  the page gives them. Her face is never animated.
- The study scene — the learner, desk, notebook, pencil, laptop, dashboard,
  calendar, mug, plant, books and the "Am I ready?" headline — is the artwork
  supplied as `relo.html`, inlined unaltered. It is a posterised trace: 136 flat
  colour layers, each one `<path>` whose contours are scattered over the whole
  canvas, so no path is an object. `tmp/pathsplit.py` splits the layers into
  13,095 contours and puts them back losslessly (bodies sliced from the source
  verbatim, only movetos rewritten); `tmp/seg.py` claims each contour for the
  object whose region holds it, re-homes fill-rule holes to their host group so
  they stay holes, and orders the groups by a measured front/behind relation --
  per pixel, which group the tracer's own paint order leaves visible. The
  regrouped scene is verified against a render of `relo.html` itself: 339
  pixels of 1,573,352 differ by more than a quarter tone, all of them hairline
  antialiasing where one object's silhouette meets the next. `tmp/build_scene.py`
  stamps it into `compositions/desk.html` and `compositions/return.html`, which
  is every place the film shows it -- the end frame shrinks the return beat
  rather than holding a third copy. Supplied, not owned; not redrawn. The
  eyelids, the mouth backfill and the rest poses are the only additions; see
  Notes.
- No audio in the web build. See `docs/AUDIO.md`; `vo.json` and `captions.vtt`
  carry the script, timing and captions for the MP4 pass once a voice and
  music licence are in hand.

Every image ships once: the bytes live as `--img-<name>` custom properties on
the host root (written by `tmp/inline.mjs` from `compositions/img/`), and beats
read `var(--img-<name>)`. The packager inlines only the faces; anything else
has to arrive already inline.

## Customizations

<!-- The device tuple: the three or four specific moves this film owns and no
     other film in this brand may reuse. The ledger fails a repeat. -->

1. **Laptop entry** — the drawn lid's aperture is a perspective quad, measured
   off the artwork; the real capture is laid into it under one skewX and clipped
   to the quad, and a 1.5s move scales the room by the aperture's own width
   while the skew flattens on the same ease -- landing on the flat product view
   to the pixel.
2. **Capture-registered interaction** — real 2x captures with the genuine
   hover / selected / expanded states as pixel-registered crops, operated by a
   pointer on bowed two-ease paths with a single 3px correction.
3. **A restrained performance** — the learner is drawn, not animated, and gets
   only the motion the story needs: a 0.22% breath about the hips (1.6px at the
   crown, 0.4px at the hand resting on the page), four short pencil strokes (the
   hand and the pencil are two groups, because the tracer paints the sweater's
   shadow between them, so they take the SAME rotation about the same wrist),
   two blinks, eyes down to the page and then up at the screen. Nothing loops:
   every cycle is a counted repeat that ends at rest. The return beat spends all
   of its performance on one moment -- he stops, looks up out of the frame at
   the viewer, and smiles.
4. **Panel-to-portrait handoff** — the expanded ReadyRating card's rectangle
   becomes the photograph's frame, which then resolves into the portrait.
5. **Desk-to-card** — the full-frame desk shrinks and slides into a 600px card
   inside the navy end frame while the offer arrives.

The intro is deliberately NOT on this list. The lockup sting is brand
vocabulary, not a film device.

## Notes

- Everything in the product is the tutorial's day-one state. ReadyRating is
  Level 1; the quiz shows one answered question of twelve and nothing more; no
  progress, result, statistic or testimonial is invented.
- The end frame carries three real purchase links, the bundle emphasised: the
  accent CTA goes to /billing/buy/residential-real-estate-bundle/, and the two
  quiet rows under it to /billing/buy/fundamentals-of-real-estate/ and
  /billing/buy/practice-of-residential-real-estate/. Unsigned-in, each 302s to
  /signup/?next=... — the existing registration flow, preserved. Each URL
  travels as `data-go` and is put on its anchor at load, because the build's
  self-containment guard rejects any absolute href in markup and cannot tell
  navigation from a fetch.
- Ids are unique per copy because the packager inlines every beat into ONE
  document: a second `url(#a)` resolves to the first copy's gradient and
  silently repaints it. `tmp/build_scene.py` prefixes every id and every
  reference -- `d-` desk, `r-` return. The end frame holds no third copy: the return beat runs to the end of the film and the host shrinks it.
- The reveal moves objects but never fades one. A trace only draws what is
  visible, so the notebook does not exist under the arms and the plant pot does
  not exist behind the mug: fading a single group would show the hole it
  occupies in the group behind it. Opacity is carried by the SVG root, which
  flattens first, and the sequence is carried by travel -- six props settle down
  onto the desk, each exposing nothing but desk. The learner does not travel for
  the same reason.
- The traced dashboard is not stamped in any copy: the laptop carries the real
  capture from frame one, as it did before this artwork arrived. Crossfading
  from the drawn screen to the capture was tried and abandoned -- they are two
  different renderings of the same dashboard, roughly a viewport apart in
  layout, and dissolving between them doubled every heading. The artwork's own
  screen is the one thing in it the film replaces, and it says so here rather
  than pretending otherwise.
- The return beat also drops the headline: the editorial layer is on a
  different line by then. Its capture sits BETWEEN two halves of the
  scene -- everything behind the laptop, the capture, then the laptop -- so the
  lid's bezel masks it. The desk beat cannot use that trick, because at the end
  of its push the bezel would cut a wedge out of the bottom-right of the frame;
  there the capture is on top, clipped to the aperture quad expressed before the
  skew, and the clip flattens with the skew until it is wider than the frame.
- The capture keeps its own 1.6 aspect inside a drawn screen that is 1.34, and
  the lid's page grey fills the sixth of the screen below it. Stretching the
  product to fit, or cropping it, would both have shown.
- The editorial fade-outs render at construction. Every other tween in the film
  is immediateRender:false, but a fromTo that has never written its start value
  does not restore it on a backward seek: once a line had faded, seeking back to
  before the fade left it at opacity 0 and it never returned. Forward playback
  never showed it; a scrub did.
- The end frame is host-level, not a beat, so it is still there at t = 51.5
  (see STORYBOARD.md). The return beat's gate runs the other way for the same
  reason: its opacity switch FINISHES at 40.0 rather than starting there,
  because a tween renders its from-state at its own start time, and gating
  exactly on the cut left t = 40.0 -- a frame the render asks for -- white.
- Four things on the learner are not the tracer's, and they are the minimum the
  performance needs. The eyelids: an open eye has no lid drawn behind it, so a
  blink cannot be recovered from the artwork -- each lid is that eye's own
  opening as a rounded box in the upper-lid skin the artwork already uses, with
  the lash line under it, scaled from the eye's top edge. The mouth backfill:
  the lips are a HOLE in the face layer, so a mouth that moves uncovers the
  page; the same geometry, filled with the face's own skin and left where the
  tracer put it, sits behind the lips and is what the smile slides over. And the
  rest poses are written into the markup, because GSAP's attr plugin has to read
  a transform off an element before it can interpolate one, and on an element
  carrying none it writes every component as zero -- identity for a rotate, and
  the whole figure gone for a scale. And the brow backfill, for the same reason
  as the mouth's: the near brow is a hole in the face too, so the worry in the
  opening beat would have shown the wall through the gap the brow left. Only the
  near brow is recoverable as a group -- the far one's body is drawn in the same
  contour as the hair falling between the brows, and no box separates them, so
  the far brow does not move. Pulling the near brow out of `head` costs 209
  pixels of the frame: a one-pixel antialias rim along its own 82px edge, where
  a later head layer used to paint over it and now does not. Nothing else in the
  scene changes, and the return beat's copy is emitted byte for byte as before,
  because its brow stays inside `head`.
- The head turns 1.6 degrees and no further. Past about two the collar reads as
  a seam: the neck rotates with the head and the sweater does not, and a drawn
  three-quarter head cannot turn to the front however far you push it. The look
  is carried by the irises, which move first; the head only follows.
- Tier 1 speed: the artwork is roughly 746 KB of path data in the desk beat and
  673 KB in the return beat, and tier 1 reads all of it on every commit. With
  the traced screen stamped as well this cost 400ms per film against a 350ms
  budget; without it the film lints at 185ms, inside the budget.
- Wire budget: gate 2 caps the artifact at 200 KB brotli / 230 KB gzip, a
  budget set for type-and-vector films. This film is 892 KB brotli. Two things
  blow it and neither can be encoded away: the six real 2x product captures,
  their state crops and the photograph are 566 KB of already-compressed bytes,
  and the supplied artwork is 956 KB of path data the film shows twice. What was
  tried: downscaling the captures that are never framed above 1.35x to 1.5x made
  every one of them two to three times LARGER, because lossless WebP is cheap on
  flat product UI and resampling invents thousands of intermediate colours; the
  after-the-set dashboard was cut from a second full page to the one rectangle
  that changed (-95 KB); and the lessons index's placeholder thumbnails, which
  had to be replaced anyway, took another 45 KB off as brand covers. Raising the
  budget for capture- and artwork-carrying films is a studio decision, not a
  film decision, so it is left failing and reported, not worked around.
- Reduced motion: `index.html` swaps the film for a static navy poster (dashboard,
  offer, the same CTA link) in #ui via `prefers-reduced-motion`.
- Reference, not an asset: the tutorial build at
  ALF-experience/alf_experience_lab/tutorial/dist/alf-dashboard-tutorial.html and
  its DIRECTION.md, which supplied every control coordinate used here.
