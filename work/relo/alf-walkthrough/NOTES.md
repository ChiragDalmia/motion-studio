# relo/alf-walkthrough

Format 1920x1080.

**Message.** From wondering if you're ready to knowing your next step.

**Arc.** A learner mid-study doubts they are ready; Relo's dashboard hands them one clear step, the lesson that teaches it and the set that tests it; the plan moves with them, ReadyRating shows where they stand and a real person is within reach; the learner comes back to the desk, looks up, and the bundle is the way in.

**Audience.** Someone preparing for the Alberta (RECA) real estate licensing exams, studying alone at a desk.

## Intent

Someone preparing for the Alberta real estate exams should believe that Relo
turns "am I ready?" into one clear next step, and should be able to buy the
Residential Real Estate Bundle from the last frame.

## Assets

<!-- Every mark, face, bed and photograph, with where it came from and what
     licence it ships under. A film with an unlisted asset does not ship. -->

- `brands/relo/gfx/lockup.html`: the RELO lockup, inlined verbatim into
  `brands/relo/scenes/sting.html` (byte-identical to brand-logo's intro) and
  again, static with ids re-prefixed `e-lockup-*`, in the host's end frame.
  Owned brand geometry; see `brands/relo/LICENSES.json`.
- Oswald 700, Poppins 500/600, OFL, subset by `tools/font.mjs`.
- `media/relo/v01.webp`, `v10.webp`, `v11.webp`, `s03.webp`, `s05.webp`,
  `v06.webp`: the RELO product, captured from the running ALF Experience Lab
  (scenario `relo-fre-new-learner`, day one, viewport 1600x1000 at device scale
  2, lossless WebP) by driving it: the dashboard with its sidebar in the
  product's own collapsed state; Lessons; the lesson player; Study Navigator >
  PRACTICE; the first answer selected and submitted; and the set scored, which
  took answering all twelve questions. `d07.webp` is the one rectangle the
  finished set changes on the dashboard -- the counter 0 / 20 -> 12 / 20 and the
  row under it -- laid over `v01`, because two near-identical full pages would
  have cost 95 KB to say one number. `v01-small.webp` is v01 at 700px for the
  laptop screen in the desk beats. RELO product UI, owned by WKT.
- `media/relo/h-lessons.webp`, `h-watch.webp`, `h-play.webp`,
  `h-proceed.webp`, `h-continue.webp`, `rr-down-hover.webp`, `rr-open.webp`,
  `rr-open-hover.webp`, `opt1-hover.webp`, `opt1-sel.webp`,
  `opt1-sel-hover.webp`, `submit-on.webp`, `submit-hover.webp`: pixel-registered lossless crops from the same sessions: the genuine hover,
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
- `media/relo/angela.webp`: Angela Detmold's photograph from
  https://relo.ca/images/Relo_Experts_Angela.png (the Office Hours page,
  https://relo.ca/how-it-works/office-hours/), 330x330, flattened onto white.
  RELO's own published staff portrait; used with her name and title exactly as
  the page gives them. Her face is never animated.
- The study scene, the learner, desk, notebook, pencil, laptop, dashboard,
  calendar, mug, plant, books and the "Am I ready?" headline, is the artwork
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
  stamps it into `beats.html` (desk) and `beats.html` (return), which
  is every place the film shows it -- the end frame shrinks the return beat
  rather than holding a third copy. Supplied, not owned; not redrawn. The
  eyelids, the mouth backfill and the rest poses are the only additions; see
  Notes.
- No audio in the web build. See `docs/AUDIO.md`; `film.json` and the generated `captions.vtt`
  carry the script, timing and captions for the MP4 pass once a voice and
  music licence are in hand.

Every image ships once: the bytes live as `--img-<name>` custom properties on
the host root (written by `tools/prepare.mjs` from `media/relo/`), and beats
read `var(--img-<name>)`. The packager inlines only the faces; anything else
has to arrive already inline.

## Customizations

<!-- The device tuple: the three or four specific moves this film owns and no
     other film in this brand may reuse. The ledger fails a repeat. -->

1. **Laptop entry**: the drawn lid's aperture is a perspective quad, measured
   off the artwork; the real capture is laid into it under one skewX and clipped
   to the quad, and a 1.5s move scales the room by the aperture's own width
   while the skew flattens on the same ease -- landing on the flat product view
   to the pixel.
2. **Capture-registered interaction**: real 2x captures with the genuine
   hover / selected / expanded states as pixel-registered crops, operated by a
   pointer on bowed two-ease paths with a single 3px correction.
3. **A restrained performance**: the learner is drawn, not animated, and gets
   only the motion the story needs: a 0.22% breath about the hips (1.6px at the
   crown, 0.4px at the hand resting on the page), four short pencil strokes (the
   hand and the pencil are two groups, because the tracer paints the sweater's
   shadow between them, so they take the SAME rotation about the same wrist),
   two blinks, eyes down to the page and then up at the screen. Nothing loops:
   every cycle is a counted repeat that ends at rest. The return beat spends all
   of its performance on one moment -- he stops, looks up out of the frame at
   the viewer, and smiles.
4. **Panel-to-portrait handoff**: the expanded ReadyRating card's rectangle
   becomes the photograph's frame, which then resolves into the portrait.
5. **Desk-to-card**: the full-frame desk shrinks and slides into a 600px card
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
  /signup/?next=..., the existing registration flow, preserved. Each URL
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
  (see the beat table below). The return beat's gate runs the other way for the same
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
- Wire budget: `film.json` declares 940 KB brotli and 1200 KB gzip against the
  studio defaults of 200 and 230, and the artifact measures 894 KB brotli.
  Two populations account for the difference and neither compresses further:
  the product captures and the photograph are 562 KB of already-compressed
  bytes, measured at 0.94x to 1.40x the size they are painted at, so there are
  no pixels to give back; and the supplied artwork is 1424 KB of path data,
  already minified to one decimal place. What was tried: downscaling the
  captures never framed above 1.35x made every one two to three times LARGER,
  because lossless WebP is cheap on flat product UI and resampling invents
  thousands of intermediate colours; the after-the-set dashboard was cut from a
  second full page to the one rectangle that changed (-95 KB); and the lessons
  index's placeholder thumbnails took another 45 KB off as brand covers.
  The declared number is a ratchet, not an exemption: 5% of headroom, and the
  next thing that grows fails here.
- Known waste, not yet taken out: `media/relo/desk-scene.svg` and the
  `return-back` + `return-front` pair share 560 byte-identical paths, 589 KB,
  so the same illustration ships twice in one artifact. They are not
  interchangeable as they stand, because desk carries a hand-and-pen rig
  (`#d-hand`, `#d-pen`) that return does not, and return carries a face rig
  (`#r-mouth`, `#r-gaze`, `#r-lidL`) that desk does not. Merging them means one
  drawing with both rigs, which is new artwork and a visual review, not a
  refactor. Roughly 75 KB brotli is on the table.
- Reduced motion: `beats.html` swaps the film for a static navy poster (dashboard,
  offer, the same CTA link) in #ui via `prefers-reduced-motion`.
- Reference, not an asset: the tutorial build at
  ALF-experience/alf_experience_lab/tutorial/dist/alf-dashboard-tutorial.html and
  its DIRECTION.md, which supplied every control coordinate used here.

## Beats

<!-- Prose only. Every number a beat has lives in film.json, which derives
     each start from the durations above it. The one overlap here, portrait
     0.2s early, is a pinned start there. -->

| id | scene | transition | voiceover |
|---|---|---|---|
| intro | The RELO lockup sting, byte-identical to brand-logo: seam, bloom, letter pop, `by WKT`. Camera 1.06 -> 1.0 with the mark's diagonal. | hard cut | |
| desk | The `relo.html` artwork, inlined unaltered: an adult learner at a desk writing in an open "Fundamentals of Real Estate" notebook beside a laptop showing the RELO dashboard, with a "RECA exam" desk calendar, a Relo mug, a plant, a stack of real estate books, and the "Am I ready?" headline and its cyan rule drawn into the scene. Reveal 2.0 -> 3.5: six props settle onto the desk in depth order; the learner does not travel. Headline 2.70, rule 3.02. The figure breathes -- 0.22% about the hips, three half-cycles, 1.6px at the crown and 0.4px at the writing hand. Eyes down to the page 3.05; four pencil strokes 3.45 -> 5.6, hand and pencil locked to one rotation about the wrist; blinks at 2.95 and 5.30; one look up at the screen 5.35 -> 6.32. The question is on the wall in front of him and the face means it: the near brow rotates 1.35 degrees about a point under its own arch from 2.75 so the outer tail drops and the inner end lifts, and the lips flatten 2% narrower and 3.5% shallower from 2.85, taking out the smile the artwork is drawn with; both deepen on the look up at the screen, 5.30 -> 5.96, to 2.3 degrees and 3% / 7%, and neither resolves -- the film answers it in beat 8. Only the NEAR brow moves. The question clears 6.06. A slow 1 -> 1.045 push under all of it. 6.5 -> 8.0 the camera enters the drawn aperture on power2.inOut and the world resolves into the flat product view. The laptop shows the real dashboard throughout. | camera into laptop | 2.35 "Studying for your Alberta real estate exam? Wondering if you're ready?" |
| dash | Day-one dashboard flat and full. 8.1 -> 9.4 reframe to F1, leaving on the frame after the cut so the dive and the reframe are one push: the Study Navigator card centred and 63% of the frame width, the sidebar down to its own collapsed icon rail (57 capture px, 6% of the frame), a white band above for the editorial line. "Your next step." wipes in 9.5. Pointer 10.2 -> 11.05 to the rail's Lessons icon, hover, click 11.4; the lessons index replaces the dashboard in 20ms and the camera eases back to L1 by 12.1. Still to 12.4. | in-product click | 8.40 "With Relo, your next study step is clear." |
| lesson | Opens on L1 with the pointer where dash.html left it and nothing moving, so the cut is invisible. 12.55 -> 13.18 to WATCH LESSONS on "Professional Responsibilities · 5 concepts · 5 hrs 26 mins · 44 videos", click 13.45: the lesson player replaces the index and the camera eases to P1 -- the whole page, the twelve lessons of Licensing & Practice listed beside the video, the notes field under it. 14.3 -> 15.02 down to the transport, click 15.25: the control flips to pause and the video runs three seconds, the scrub bar filling with the product's own played pixels and the clock counting 0, 1, 2, 3. The pointer stays inside the player, which is what keeps the controls up. Held from 18.25. | hard cut | 12.90 "Watch the lesson that teaches it, right where the plan sends you." |
| quiz | Adaptive Quiz, Question 1 of 12, parcel-boundary question, at the reading frame F2. Pointer in 19.2; first answer selected 20.35 (real selected state, SUBMIT enabled); SUBMIT 21.45; the answered layout with EXPLANATION in 20ms. 21.6 -> 22.25 in to F3 so the explanation's first sentence sits on the centre line with the green answer in view; "Understand why." 22.7 -> 25.1 over the one hold in the beat. PROCEED 25.65 and the set is scored: "Results saved", 100%, 12 / 12, with the question review under it; the camera widens to R1. CONTINUE 27.5 returns to the dashboard and the camera lands on the Study Navigator at dash.html's own framing, where the counter that read 0 / 20 now reads 12 / 20. | continuous, rating opens on this frame | 19.10 "Practise the concept, with explanations that help you understand why." · 25.90 "Finish the set and your plan moves with you." |
| rating | No cut: the camera keeps moving, 30.15 -> 31.05 down the card stack from the Study Navigator to ReadyRating. Pointer 30.75 -> 31.25 to the expansion control, click 31.55; the card opens top-down: "Readiness to pass the exam", Level 1 of 5, "Not ready yet, but you'll get there!". Camera settles 35px. No headline. | navy rises over the card (portrait starts 0.2s early) | 30.40 "ReadyRating helps you see where you stand." |
| portrait | Navy. The ground covers the open card in 160ms and only then does the photograph appear (160ms), so the dashboard never ghosts through it and no frame is bare navy for longer than that. Angela Detmold's photograph in a frame that starts as the ReadyRating card's rectangle and settles as a 520px portrait; "Live Office Hours" 35.4; name and role 35.58. Hold. | hard cut | 35.20 "And live Office Hours give you space to ask an industry expert." |
| return | The same artwork again, with the headline not stamped, and the push on sine.inOut so it starts from rest -- the portrait it cuts from has been still for four seconds: the editorial layer is on "A clearer way forward." here, set two lines so it stays clear of the learner's hair. One slow 1 -> 1.03 push on the learner, from rest and ending at rest exactly at the close. One breath 40.2 -> 42.6 and one blink at 40.9; then at 42.35 he stops, and over a second looks up out of the frame at the viewer -- irises first, the head 1.6 degrees after them, a second blink on the turn, and the mouth widening 3% into a closed smile at 42.72. Still from 43.32. | desk shrinks into the end frame | 40.35 "Take your next step with Relo." |
| end | NOT a sub-composition: untimed host elements on the main timeline (see the data-film template in beats.html). 43.5 -> 44.2 the desk -- the return beat itself, held to the end of the film and holding the pose it stopped in -- moves left and down into a 600px card on power2.inOut; the navy behind it is fully up by 43.7, 0.15s before the shrink first uncovers an edge, so no frame shows the host's white ground through it. Navy end frame with the lockup, "Residential Real Estate Bundle", the two course names, "Two RECA-recognized courses.", and three purchase options: the bundle on a lifted row with the yellow CTA "Buy the bundle", then "Fundamentals of Real Estate" and "Practice of Residential Real Estate", each with its own "Buy course" link. All three are real links to their purchase routes. "relo.ca" under them. Settled by 44.5, held to 51.5; last 2.4s unnarrated. | end | 44.30 "Start with both courses. Buy the Residential Real Estate Bundle." |

<!-- Why the end frame is in the host: a sub-composition is shown for
     start <= t < end, so a beat ending at 51.5 has already gone at the film's
     last frame (t = 51.5 exactly), and the CTA has to be on screen when
     playback stops. Main-timeline tweens hold their end state at t = duration.
     The return beat's opacity gate FINISHES at 40.0 rather than starting there,
     for the same reason in reverse: a tween renders its from-state at its own
     start time, so gating exactly on the cut left t = 40.0 white. It is 4ms
     long, under one frame at any render rate, so no frame catches the desk
     half-transparent over the portrait.
     The editorial layer (the copy beat) hosts in #type from 2 to 51.5
     and carries three lines at film 9.5, 22.7 and 40.4; it runs to 51.5 so a
     timed clip reaches the end of the film. Narration is never repeated as
     type. Captions and the voiceover manifest are captions.vtt and vo.json
     beside this file; the web build ships silent (docs/AUDIO.md). -->

<!-- Camera and pointer. #cam is used once, for the intro's push, and is neutral
     from 2.0 on. Every product reframe is a world transform inside its beat, in
     capture space (1600x1000, the product's own viewport), declared with
     data-layout-allow-overflow because a screen the camera has pushed into is
     larger than the frame on purpose. Framings: F0 1.2@(0,0) landing;
     F1 2.0@(189,212) Study Navigator, the frame the film returns to after the
     set; L1 1.35@(0,200) lessons index; P1 1.2@(0,200) lesson player;
     F2 1.15@(0,204) quiz reading; F3 1.22@(2,190) explanation;
     R1 1.25@(0,150) scored set; F4 1.9@(227.5,-170) ReadyRating, settling to
     y -205 as the card opens. Seven clicks: Lessons 11.40, WATCH LESSONS 13.45,
     play 15.25, first answer 20.35, SUBMIT 21.45, PROCEED 25.65, CONTINUE
     27.50, ReadyRating 31.55. Every camera move in the film starts and ends
     at zero velocity and no two are separated by a held frame, so a handoff
     is a joint in one gesture rather than a stop and a restart. Each approach is x and y on different eases and
     lengths (a bowed, decelerating path), dwell 200-340ms on the control's real
     hover state, a press dip on the pointer in place, and the state the product
     produced. The one 3px correction is on the first answer. The pointer is 44
     frame px tall at every zoom -- its own scale is the inverse of the camera's
     and travels whenever the camera does, starting after the press dip so the
     two never fight for the same property. -->
