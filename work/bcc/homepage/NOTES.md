# bcc/homepage

---
brand: bcc
slug: homepage
surface: web
---

## Intent

A person exploring Business Career College's securities or insurance licensing
programs should finish believing that either one shows them, on evidence they
can point at, how ready they are for their exam and what to do next, that
ReadyEngine is the shared technology under both, and that it is not a second
thing to buy.

## Assets

| asset | where it came from | licence |
|---|---|---|
| `brands/bcc/logo/reversed.svg` | the published two-colour reversed lockup, geometry unaltered. Inlined twice through `brands/bcc/gfx/mark-reversed.html` (`#mark`, `#e-lock`): all 29 paths carry the master's `d` byte for byte and a literal `#ffffff` or `#f15d2a` fill. No `currentColor`, no token binding, no mask over any part of it. | client mark, BCC |
| Inter 400/600/700, Jost 400/500 | `brands/bcc/font/`, the site's own self-hosted faces, materialized by `npm run pre` | OFL |
| `media/bcc/rating.webp`, `media/bcc/mastery.webp` | `businesscareercollege.com/images/CIRO_web_ready-rating.webp` and `CIRO_web_concept-mastery.webp`, unretouched, at their published 900x369 and 1000x429, already licensed and materialized for `work/bcc/llqp`. They carry no course name, which is what let them serve an LLQP-only film and is exactly what lets this combined film use them for both families without choosing one. | client artwork, BCC |
| the narration | `WKT_ReadyEngine_Final_Revised_Script_20260908_v4.pdf`. Scenes 1, 6 and 7 are the combined-program lines the production brief authorises, since the PDF itself has no combined CIRO-and-LLQP track; scenes 2 to 5 are the PDF's own shared learner-facing narration (page 4), verbatim, unchanged from `work/bcc/llqp` because none of it names a program. | client copy, WKT and production brief |
| the deep-dive content | reused byte for byte from `work/bcc/llqp`'s `rating`, `quiz`, `plan`, `exams`, `riley`, `again`, `update` and `focus` beats: the concept (Beneficiary designations), the practice question, the plan rows, the LLQP Life Insurance certification exam parameters and the Riley exchange. See Customizations for why the deep dive stays on this one program rather than switching to securities. | BCC's own published LLQP curriculum, already verified |
| the destinations | `businesscareercollege.com/securities/` and `businesscareercollege.com/insurance/`, BCC's own live top-level program paths, confirmed by reading the homepage itself on 2026-09-17. Not invented, and not the deep LLQP course path `work/bcc/llqp` uses, because this film's own call to action is the homepage choice between families, not one program's enrolment page. | client site |
| music, voiceover | **not sourced.** `brands/bcc/LICENSES.json` carries a `missing` entry for music, so no film in this brand ships with audio. `film.json`'s `vo` table is the manifest for a voiceover pass and the generated `captions.vtt` the sidecar. See `docs/AUDIO.md`. | none purchased |

**No new asset was licensed for this film.** Every mark, face and capture
above is already covered by `brands/bcc/LICENSES.json` at the brand level, so
that file is untouched. BCC's own site lists a fuller `CIRO_web_*` capture set
(a securities dashboard with a live Riley panel, a study-pace view, a progress
view) that is not on disk and not in that file: it would need its own
licensing review before any film could use it, the progress and study-pace
frames read like the completion-volume framing the script's production checks
warn against, and pulling in a second capture set is exactly the kind of
speculative asset work the brief asks this film to avoid. This film ships with
the two captures `work/bcc/llqp` already cleared.

## Customizations

<!-- What this film owns that work/bcc/llqp does not. Everything else, the
     five-cell scale as spine, two published cards in one world, the rating
     that never moves, the upward push current, the five-role type scale, is
     inherited unchanged and is llqp's customization ledger, not this film's. -->

1. **Two program families, at the open and the close, and nowhere else.** A
   kicker names both ("Securities · Insurance") before the headline commits to
   the generic "licensing exams," and the end card repeats the same kicker
   before two peer rows, one per family, each with its own real destination.
   Between those two moments the film follows one learner and one concept, so
   a viewer is never asked to read two programs' interfaces or two scores in
   the same breath. This is the brief's own instruction (open and close only)
   turned into the one new element this film adds to `llqp`'s markup: `#o-fam`
   and `#e-fam`.
2. **The deep dive stays on LLQP rather than moving to securities.** BCC's
   published securities capture set is richer on paper (a real dashboard, a
   real Riley panel), but none of it is licensed or on disk, so using it would
   mean a fresh review cycle this configuration-driven film has no reason to
   trigger. LLQP's deep dive is already built, already verified against BCC's
   published curriculum, and already gate-clean in `work/bcc/llqp`; reusing it
   is the strongest complete set of approved material available today, not a
   default. Securities is named, not demonstrated, exactly as the brief allows
   for "the second program family" in an opening or closing context.
3. **Two peer destination rows, not a ranked primary and secondary.** `llqp`'s
   end card states one program and one URL. This film's `#e-url1` and
   `#e-url2` are the same weight, same style, same reveal cadence 0.6s apart,
   because the brief asks for two legible choices and a visual hierarchy
   between them would read as BCC favouring one program over the other.
4. **A longer opening, not a faster one.** Scene 1's second sentence carries
   three more words than `llqp`'s ("our securities and insurance programs
   combine" against "the program combines"), so `open`'s creep before the cut
   into `rating` runs 5.0s instead of `llqp`'s 3.9s over the same five pixels
   of travel: the extra time is spent holding still, not rushing the read.
5. **`.n` states `visibility: hidden`, which `llqp`'s identical class does
   not.** Opacity does not inherit into a child's computed style, so before a
   callout's own tween ever touches it, its `.v` span reports the browser
   default of opacity 1 to anything reading computed style, even while the
   opaque `.n` parent sits at opacity 0. `visibility` does inherit, and
   autoAlpha's own inline `visibility: inherit` overrides a class default once
   a callout's tween actually fires, so stating it hidden here costs nothing
   and closes the gap for whichever callout has not started yet. `llqp`
   carries the same latent gap in a class it never had reason to touch.
6. **`n3`'s fade-out moved from `reel+=46.1` to `reel+=45.8`.** This is the
   actual fix for gate 2's reported overlap, and the mechanism is not about
   `note` at all: `exams`'s own `#stage` pushes out by translateY(-1080) over
   0.5s starting at film 46.3, and for roughly 46.50-46.57 that push carries
   `#x-lbl` (authored at top: 390) up through `note`'s fixed (112, 104) band
   on its way off the top of the frame, while `power2.in` easing keeps `n3`
   above 5% opacity until almost the very end of its own 0.5s fade. Moving the
   trigger 0.3s earlier finishes the fade at approximately 46.29, clear of the
   push before it starts. A finer sweep than gate 2's own 0.25s sample grid
   (every 0.02s across all six seam windows) found this is the only one of
   this film's six push transitions where an active callout's topmost text and
   the outgoing beat's topmost text are both above the 5% opacity floor while
   the push's easing curve carries the outgoing text through the note band;
   the others clear it with margin, by luck of exactly when each beat's own
   push starts relative to how high its own topmost element sits. `llqp`
   carries the identical structural relationship between its own `note` layer
   and its own push seams; its gate 2 sample grid simply never landed inside
   any of its own (differently timed) danger windows, which a matching fine
   sweep would likely show are just as narrow.

## Notes

Retiming: change one number in the duration table in `film.json`, and move the
matching cue in the `cap` beat of `beats.html` and in `film.json`'s `vo`.
Those two files are the whole timing surface; `captions.vtt` is generated from
`vo`.

Images are inlined by `tools/prepare.mjs` as `--img-<name>` custom properties,
one per file in `media/bcc/`, read by a beat as `var(--img-rating)`.

The narration hook is `film.json`'s `vo`: it is the committed manifest of text
and timing, it generates `captions.vtt`, and the `cap` beat sets the same
fifteen lines in the frame. When an approved combined-program voiceover exists
and matches this script, serve the stem as a sibling file from the brand's own
origin and add `"audio": true` to `chrome`; the player then grows an unmute
affordance. Nothing is inlined and `chrome.audio` stays off until then,
because `brands/bcc/LICENSES.json` carries a `missing` entry for music and an
inlined stem forfeits gate 1 outright (`docs/AUDIO.md`).

The ground is `var(--dark)`, not `var(--ground)`: the runtime stamps the
pack's default variables inline on the mounted clip, so a core token would
paint every beat white under the `.s-navy` class the beat asks for.

The end card's first element, `#e-fam`, lands at `end-0.7`. `focus`'s own exit
clears 0.8s before the `end` label: its fade starts at `in+7.90`, i.e. film
75.4, and completes 1.10s later at 76.5, while `labels.end` is 77.3. That gap
is deliberate: `#e-fam` at `end-0.7` = 76.6 then starts 0.1s after the stage
is fully clear, rather than the 0.1s overlap `llqp` carries between the same
two events (its own `#e-llqp` starts 0.1s before its `focus` finishes
clearing). This film widens that gap on purpose because two program rows give
the card more to read and a firm beat between beats reads better than an
overlapping one.

## Verification

- **tier 1** `guard + law + lint`, every film: clean.
- **gate 1** `check --strict --at-transitions`, 12-way, 187.1s: lint, runtime,
  layout, motion and contrast all 0 errors and 0 warnings.
- **gate 2**, on the shipped bytes: clean, after one fix (see Customizations
  6). The artifact measures 215.8 KB brotli and 246.4 KB gzip against
  `film.json`'s declared 224 and 255, 96% of the declared ceiling, matching
  `llqp`'s own ratio. No unclipped text overlap across 355 samples, 5/5
  shipped faces painted, dcl 189 ms at 4x CPU throttle, seek p50 0.8 ms / p95
  2.0 ms / max 2.2 ms. The undriven open check shows the poster at 3.80s with
  49.46% of pixels off-modal over 216 colours: the first frame is not a flat
  card. The embed sweep runs under `default-src 'self'` with no host CSP and
  is correctly blocked once a host CSP header applies, matching the contract
  every film in this brand ships under.
- **The push-seam overlap**: gate 2 first failed on `#x-lbl` and `n3`'s span,
  317x6px at t=46.5s, one of 355 samples. A finer sweep (every 0.02s, all six
  push seams, replicated directly against the built artifact via
  `window.__player.seek` with clip-path forced off, the same method gate 2
  uses) found the true danger window is 46.50-46.57s, and confirmed all other
  five seams clear their own analogous windows with margin. Moving `n3`'s
  fade-out 0.3s earlier (Customizations 6) closes it; the same fine sweep
  across the full film after the fix found zero overlaps, and the rebuilt
  artifact's own gate 2 run confirms it independently.
- **Narrow viewport**: gate 2 does not automate this, so it was checked
  directly with Playwright against the built artifact (the same engine and
  Chrome binary `npm run doctor` reports). 375x812 renders the full frame at
  0.1953x with no horizontal clipping, letterboxed top and bottom; 780x1200
  at 0.4063x, matching `llqp`'s own documented 780x1200 to 780x439 within a
  pixel. The `end` card, this film's widest content (two full-width URL
  rows), was the frame checked at both sizes.
- **Visual review**: every beat inspected as a still frame at the built
  artifact's own resolution, forward from `open` through `end`, plus the
  three push seams either side of the `exams` fix. The BCC lockup renders
  intact at chrome size and at the 500px end-card size, in the same two fills
  `llqp`'s own pixel comparison already cleared, because the include is the
  same file, unedited. Backward and forward seeks between the opening and the
  closing hold, and between adjacent beats, land on the correct state each
  time with nothing stuck from a prior seek.
- Reduced motion and the audio-off state are unexercised code paths shared
  byte for byte with `llqp` (the `@media (prefers-reduced-motion: reduce)`
  block and the silent-build contract in `docs/AUDIO.md`); this film changes
  neither.

## Beats

---
format: 1920x1080
duration: 88.5
message: "Business Career College's securities and insurance programs both put a learner's readiness on evidence they can point at, and ReadyEngine is the technology under both."
arc: "The film opens on both BCC program families, then follows one LLQP learner and one concept, Beneficiary designations, through ReadyRating and the concept breakdown that names the gap, into a practice question, a plan built on the exam date, a practice exam and a Riley explanation, then back through repeated unaided practice until the plan itself has changed; the film closes on both program families again, each with its own path to explore."
audience: "Prospective and current learners choosing between BCC's securities and insurance licensing programs."
---

## Beats

<!-- Prose only. Every number a beat has lives in film.json. The four seams
     that are not continuous overlap by 0.5s, written there as a pinned
     start, never as a clip reference. -->

| id | scene | transition | voiceover |
|---|---|---|---|
| open | Navy. The readiness scale as five outlined cells, numbered, unread, drawn at rest in the markup so the film's first frame is never one flat colour. A kicker, "Securities · Insurance," names both program families 0.10 to 4.05, before any other text commits to either. The scale lifts to full as a decaying cascade 0.30 to 1.18, 0.76 per step. Headline "Prepare for your" 0.95, "licensing exams." 1.20, "Know where you stand." 1.80 in brand; kicker and all three headline lines clear 4.05 to 4.31. 4.55 the scale clears, and 4.75 to 6.55 the product rises on the same current into the wide framing W and stops dead. "Powered by ReadyEngine" lands 6.90 UNDER the card, which is where the script puts the endorsement: while the product is visible, not as a second brand reveal. A creep 7.00 to 12.00 ends on W2, three seconds longer than llqp's because this beat's narration carries three more words. Camera 1.03 to 1.00 over 7.4s, arriving at rest with the card. | continuous, rating opens on this exact frame | 0.90 "Prepare for your licensing exams with Business Career College." / 4.60 "Powered by ReadyEngine, our securities and insurance programs combine personalized preparation with a clear view of exam readiness." |
| rating | Opens on W2 with nothing moving, so the cut is invisible. Push to R, the ReadyRating card at reading size; a brand frame lands on the level and its track and leaves. A creep to R2, the film's one long look at the rating and the only place the scale is stated. Down to G, the Concept Mastery card whole, then a creep to G2 and across to L, the grid beside the key that reads it. A marker lands on one intermediate square, a leader draws out to the left, and the concept the rest of the film follows is named. Still from the last quarter-second. Identical in every number to `work/bcc/llqp`'s own rating beat: this scene's narration is the PDF's shared learner-facing track, unchanged. | continuous, quiz opens on this exact frame | 12.10 "Your ReadyRating shows exam readiness on a scale of one to five, based on your demonstrated understanding of the concepts your exam requires." / 21.30 "The breakdown shows which concepts need more practice." |
| quiz | Opens on L with the marker and its annotation exactly where rating left them. The annotation clears, the card leaves upward, and the practice question arrives on the same current: label, question, the three options as a decaying cascade. The answer is selected and NOTHING else happens, because one response does not move a readiness level. The line that says what an answer is actually for. Editorial: no approved LLQP practice capture exists, so nothing here imitates one. Identical to llqp; this is the concept the deep dive follows. | push up (plan starts 0.5s early) | 25.20 "Here's how it works." / 27.40 "As you answer practice questions, ReadyEngine identifies where you need more support." |
| plan | Arrives from below over the outgoing quiz. Two columns: the exam the plan is built around, with the date at 92px; and what the plan puts next, with a brand bar landing beside the first row, which is the concept the film has been following. Fictional learner data. Identical to llqp. | push up (exams starts 0.5s early) | 33.00 "It builds a plan around your needs and exam date, with lessons and practice to guide what you work on next." |
| exams | Arrives from below. A brand rule draws down the left edge, then the label, the two display lines and, under a drawn divider, the certification exam this practice is aligned to and its published scope. Every parameter on screen is one BCC publishes for the LLQP Life Insurance certification exam. Identical to llqp. | push up (riley starts 0.5s early) | 41.70 "Practice exams are aligned to the concepts covered on your exam." |
| riley | Editorial, and deliberately not a chat surface. Label "Riley - 24/7 study assistant" with a brand rule drawing beside it, the learner's question, a divider, and the answer as three lines on the same short rise. The question is the same concept the practice question turned on, and it is a study question with an explanation, never help inside an assessed check. Identical to llqp. | push up (again starts 0.5s early) | 47.00 "You can ask questions and get explanations through Riley, your 24/7 study assistant." |
| again | Arrives from below. One concept on a time axis: three separated sessions, Day 1, Day 8, Day 21. The middle one is drawn hollow and tagged "with help," so what the axis states is repetition WITHOUT assistance and not a score climbing. Identical to llqp. | push up (update starts 0.5s early) | 53.40 "ReadyEngine keeps checking. It looks for understanding you can demonstrate more than once, without help." |
| update | Arrives from below. The published ReadyRating card rises, at the same level it has held all film, with one line under it saying a rating is recalculated after every session and can move either way. The card and the line clear upward and the plan behind them is a different plan: a concept that needs attention is back at the top of it, the followed concept has dropped to a retention check. Identical to llqp. | push up (focus starts 0.5s early) | 59.80 "As you practise, your study plan and ReadyRating update." / 63.90 "Concepts that need more attention return to your plan." |
| focus | Arrives from below. The scale the film opened on returns and this time it is read: five cells, the fourth already filled in the markup because nothing here may fill. A brand line draws from it to what the learner works on next. That line is the whole personal benefit, stated once. Still, then the stage fades and lifts, clear exactly as the end card's kicker begins. Identical markup to llqp; the voiceover drops "LLQP" since the benefit is stated for either program. | the stage clears, then the end card | 68.40 "With Business Career College, you can see where you stand and what to work on next, with focused preparation for your exams." |
| end | NOT a sub-composition: untimed host elements on the main timeline, in the `data-film` template. Navy. The kicker "Securities · Insurance" returns 76.60, "Know when you're ready." lands 77.65, its rule draws 78.25. "Explore securities and insurance training." 81.40. "Powered by ReadyEngine" 82.20 and the BCC lockup 82.30, `brands/bcc/logo/reversed.svg` unaltered at 500px. Two peer rows, "Securities" and its live URL 83.10, "Insurance" and its live URL 83.70, same weight and cadence, neither ranked above the other. Settled 84.40, held to 88.5; narration ends 84.90, so the last 3.6s are an unnarrated hold on the finished card. | end | 77.65 "Know when you're ready." / 81.30 "Explore securities and insurance training with Business Career College." |

<!-- Why the end frame is in the host: a sub-composition is shown for
     start <= t < end, so a beat ending at 88.5 has already gone at the film's
     last frame. Main-timeline tweens hold their end state at t = duration.
     The cap beat runs 0 to 88.5, so a timed clip still reaches the root
     duration and lint does not warn subcomposition_blanks_before_host. -->

<!-- Copy lives in two beats and nowhere else. cap carries the fifteen
     narration captions: scenes 1, 6 and 7 are the combined-program lines
     this brief authorises, scenes 2 to 5 are the PDF's shared learner-facing
     narration verbatim; note carries the five editorial callouts, one at a
     time, never repeating narration, unchanged from llqp because none of
     them names a program. captions.vtt beside this file is the same table
     again for an external player and for the voiceover pass; the web build
     ships silent. -->

<!-- Framings. Every product reframe is a world transform inside its beat, in
     the published capture's own pixels, declared with
     data-layout-allow-overflow because a card the camera has pushed into is
     larger than the frame on purpose. World space puts rating at (0, 0) and
     mastery at (0, 700), and each framing is written as
     scale @ (translate x, translate y) about the world's top left, identical
     to work/bcc/llqp because the deep dive is the same pixels at the same
     zoom:

       W  1.280 @ (434, 270)        the rating card, the film's wide shot
       W2 1.292 @ (428.6, 265.5)    the same point, crept in
       R  1.450 @ (488, 261.75)     the level and its track
       R2 1.468 @ (481.5, 258.4)
       G  1.300 @ (410, -648.85)    Concept Mastery, whole
       G2 1.318 @ (401, -665.3)
       L  1.360 @ (600, -769.4)     the grid beside its key
       K  1.120 @ (506, 300)        the rating card, returning
       K2 1.134 @ (499.7, 294)

     Nothing exceeds 1.47 on a 900px source or 1.36 on a 1000px one: these are
     lossy published captures and a harder push would show it. -->

<!-- Seek symmetry. A fromTo fade-out whose start value no earlier tween
     established does not write it again on a backward seek: seek past one and
     back and the element is still gone. Three are in that position and carry
     immediateRender: true, #mark in the host, #q-lead in quiz and #stage in
     focus, and none anywhere else, because the flag writes the from-state at
     CONSTRUCTION and putting it on the fifteen captions would open the film
     with all of them stacked up. -->
