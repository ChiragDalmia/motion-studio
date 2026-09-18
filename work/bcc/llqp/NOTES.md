# bcc/llqp

---
brand: bcc
slug: llqp
surface: web
---

## Intent

A person choosing or already working through Business Career College's LLQP
should finish believing that the program shows them, on evidence they can point
at, how ready they are for the certification exam and what to do next, and that
ReadyEngine is the technology under that experience rather than a second thing
to buy.

## Assets

| asset | where it came from | licence |
|---|---|---|
| `brands/bcc/logo/reversed.svg` | the published two-colour reversed lockup, geometry unaltered. Inlined twice through `brands/bcc/gfx/mark-reversed.html` (`#mark`, `#e-lock`): all 29 paths carry the master's `d` byte for byte and a literal `#ffffff` or `#f15d2a` fill. The file's `.cls-1` / `.cls-2` style block and its `Layer_1` id were dropped, because generic class names and a fixed id collide once every beat is inlined into one document. No `currentColor`, no token binding, no mask over any part of it. | client mark, BCC |
| Inter 400/600/700, Jost 400/500 | `brands/bcc/font/`, the site's own self-hosted faces, materialized by `npm run pre` | OFL |
| `media/bcc/rating.webp`, `media/bcc/mastery.webp` | `businesscareercollege.com/images/CIRO_web_ready-rating.webp` and `CIRO_web_concept-mastery.webp`, unretouched, at their published 900x369 and 1000x429. These are the two ReadyEngine captures BCC itself publishes on the LLQP course page. | client artwork, BCC |
| the narration | `WKT_ReadyEngine_Final_Revised_Script_20260908_v4.pdf`: the LLQP learner replacements for scenes 1, 6 and 7, and the shared learner-facing narration for scenes 2 to 5, verbatim | client copy, WKT |
| the destination | `businesscareercollege.com/insurance/llqp`, the live LLQP learner program page, which is what the script's bracketed learner destination resolves to | client site |
| music, voiceover | **not sourced.** `brands/bcc/LICENSES.json` carries a `missing` entry for music, so no film in this brand ships with audio. `film.json`'s `vo` table is the manifest for a voiceover pass and the generated `captions.vtt` the sidecar. See `docs/AUDIO.md`. | none purchased |

**There is no approved LLQP product capture beyond those two.** The ALF lab
carries scenario packs for real estate and CPA only, and the rest of BCC's
published `CIRO_web_*` set is the securities deployment: those frames name CIRE
course titles and securities concepts, so putting one in an LLQP film would
state the wrong program. Every other product moment here is therefore editorial
in the film's own type rather than an imitation of an interface that was never
approved: the practice question, the study plan, the practice exam and Riley.
The LLQP content in them is BCC's own published curriculum and exam scope; the
learner is fictional, which `#eg` says on screen for the whole film.

## Customizations

1. **The five-cell scale as the film's spine.** The film opens on it unread,
   the product's own ReadyRating card answers it, and it returns at the close
   with one cell filled and a line drawn from it to the next activity. Same
   mark, three jobs, so the learner payoff is literally the shape the film
   opened on.
2. **Two published cards, one world.** `rating` and `mastery` sit at fixed
   offsets inside a single 1000x1129 world, so every reframe between them is
   one camera move across one surface instead of cards being loaded and
   cleared. `open`, `quiz` and `update` reuse slices of the same coordinate
   space, which is why three of the four internal cuts are invisible.
3. **A rating that never moves.** ReadyRating is level 4 in every frame of this
   film, including after the practice and the repeat checks. Nothing fills,
   nothing climbs, and the one line written under it says a rating is
   recalculated and can go either way. Readiness is not a progress bar and this
   film does not let it become one.
4. **One upward current for every seam.** The seven cuts that are not
   continuous are pushes: the outgoing stage leaves at -1080 and the incoming
   arrives from +1080, 0.5s, on mirrored eases. The handover inside `quiz` uses
   the same current, so the concept the breakdown named leaves the frame and
   the question about it arrives on one move.
5. **A type scale of five roles, and every declared face has one.** Inter 700
   for display, 600 for an annotation beside something bigger, 400 for the two
   lines where the film speaks in its own voice rather than the product's;
   Jost 500 for labels and 400 for supporting copy. The pack declares five
   faces and the packager inlines by family, so a weight with no role is bytes
   in every artifact: gate 2 measures which faces are actually painted and
   fails the ones that are not.

## Notes

Retiming: change one number in the duration table in `film.json`, and move the
matching cue in the `cap` beat of `beats.html` and in `film.json`'s `vo`. Those
two files are the whole timing surface; `captions.vtt` is generated from `vo`.

Images are inlined by `tools/prepare.mjs` as `--img-<name>` custom properties,
one per file in `media/bcc/`, read by a beat as `var(--img-rating)`.

The narration hook is `film.json`'s `vo`: it is the committed manifest of text
and timing, it generates `captions.vtt`, and the `cap` beat sets the same
fifteen lines in the frame. When an approved LLQP voiceover exists, serve the
stem as a sibling file from the brand's own origin and add `"audio": true` to
`chrome`; the player then grows an unmute affordance. Nothing is inlined and
`chrome.audio` stays off until then, because `brands/bcc/LICENSES.json` carries
a `missing` entry for music and an inlined stem forfeits gate 1 outright
(`docs/AUDIO.md`).

The ground is `var(--dark)`, not `var(--ground)`: the runtime stamps the pack's
default variables inline on a mounted clip, so a core token would paint every
beat white under the `.s-navy` class the beat asks for.

## Verification

- **tier 1** `guard + law + lint`, every film: clean.
- **gate 1** `check --strict --at-transitions`, 12-way, 202s: lint, runtime,
  layout, motion and contrast all 0 errors and 0 warnings.
- **gate 2**, on the shipped bytes: clean. The artifact measures 215.3 KB
  brotli and 245.6 KB gzip against `film.json`'s declared 224 and 255, which is
  96% of the declared ceiling, so the next thing that grows fails here. 105 KB
  of it is the vendored runtime, identical in every artifact; 46 KB is five
  subset faces; 29 KB is the two captures, shipped at the size they are
  painted at. No unclipped text overlap across 349 samples, 0 external
  resources, 5/5 shipped faces painted, dcl 204 ms at 4x CPU throttle, seek
  p50 0.8 ms / p95 2.4 ms.
- Two gate-2 findings were fixed to get there. Inter 400 and 600 shipped
  without ever being painted, 22 KB of dead weight, because the packager
  inlines by family: both now carry a role in the type scale. And the
  demonstration note's box reached the caption column and then, moved clear of
  it, was swept through by a pushed line of type; it is now on only while the
  stage is still.
- **Seek symmetry**: 39 times captured forward and the same 39 captured in
  reverse order, compared as decoded pixels rather than PNG bytes: 0 of 39
  frames differ by a single pixel. A full play to the end and back to 0 is
  pixel-identical to the cold first frame, and a pause, resume and re-seek to
  28.4s is pixel-identical to the frame before it. No frame in the film is one
  flat colour: the least varied carries 137 colours and the most uniform is
  61% one colour, which is the navy ground.
- **60 fps**: 225 seeks walked at 1/60 across all nine seams, p50 0.1 ms,
  p95 0.7 ms, max 4.3 ms, 0 steps over the 16.67 ms frame budget.
- **The lockup**: both inlined copies compared path by path against
  `brands/bcc/logo/reversed.svg`: 29 of 29 paths byte-identical, fills literal
  `#ffffff` and `#f15d2a` only, and no `currentColor`, `var()`, class, style
  block, mask, clip-path, filter, opacity or id anywhere inside either. Then
  rendered against the master drawn at the same size on the same navy: the
  chrome copy at 268 px differs in 5 of 31,356 pixels (0.02%) and the end-card
  copy at 500 px in 241 of 109,500 (0.22%), both antialiasing, with ink area
  within 0.28% in each case.
- **Viewport**: 1920x1080 renders 1:1; 1280x720 fills; 780x1200 scales to
  780x439 and 420x780 to 420x236, both letterboxed with no clipping and no
  scrollbar. With `prefers-reduced-motion: reduce` the camera transform
  computes to `none` and the grain to `display: none`, and every beat still
  plays. Zero console errors across every run.

## Beats

---
format: 1920x1080
duration: 87
message: "Business Career College's LLQP shows a learner where they stand and what to work on next, on evidence, and ReadyEngine is the technology under it."
arc: "One LLQP learner and one concept, Beneficiary designations, travel from an unread readiness scale, through ReadyRating and the concept breakdown that names the gap, into a practice question, a plan built on the exam date, a practice exam and a Riley explanation, then back through repeated unaided practice until the plan itself has changed; the film ends on the learner's own view and one BCC next step."
audience: "Individual learners choosing or working through BCC's LLQP program."
---

## Beats

<!-- Prose only. Every number a beat has lives in film.json. The four seams
     that are not continuous overlap by 0.5s, written there as a pinned
     start, never as a clip reference. -->

| id | scene | transition | voiceover |
|---|---|---|---|
| open | Navy. The readiness scale as five outlined cells, numbered, unread, drawn at rest in the markup so the film's first frame is never one flat colour. It lifts to full as a decaying cascade 0.30 to 1.18, 0.76 per step. Headline "Prepare for your" 0.95, "LLQP exams." 1.20, "Know where you stand." 1.80 in brand; all three clear 4.15. 4.55 the scale clears, and 4.75 to 6.55 the product rises on the same current into the wide framing W and stops dead. "Powered by ReadyEngine" lands 6.90 UNDER the card, which is where the script puts the endorsement: while the product is visible, not as a second brand reveal. A creep 7.00 to 10.90 ends on W2. Camera 1.03 to 1.00 over 7.4s, arriving at rest with the card. | continuous, rating opens on this exact frame | 0.90 "Prepare for your LLQP exams with Business Career College." / 4.60 "Powered by ReadyEngine, the program combines personalized preparation with a clear view of exam readiness." |
| rating | Opens on W2 with nothing moving, so the cut is invisible. 11.45 to 12.85 push to R, the ReadyRating card at reading size; a brand frame lands on the level and its track 13.05 and leaves 15.30. 13.20 to 16.00 a creep to R2, the film's one long look at the rating and the only place the scale is stated. 16.00 to 17.80 down to G, the Concept Mastery card whole, then a creep to G2 and 19.50 to 20.60 across to L, the grid beside the key that reads it. 20.80 a marker lands on one intermediate square, 21.15 a leader draws out to the left, and 21.50 the concept the rest of the film follows is named. Still from 22.25. | continuous, quiz opens on this exact frame | 11.00 "Your ReadyRating shows exam readiness on a scale of one to five, based on your demonstrated understanding of the concepts your exam requires." / 20.20 "The breakdown shows which concepts need more practice." |
| quiz | Opens on L with the marker and its annotation exactly where rating left them. 24.45 the annotation clears, 24.70 the card leaves upward, and the practice question arrives on the same current: label 25.10, question 25.35, the three options as a decaying cascade 26.10 / 26.40 / 26.70. 27.90 the answer is selected and NOTHING else happens, because one response does not move a readiness level. 28.70 the line that says what an answer is actually for. Still from 29.50. Editorial: no approved LLQP practice capture exists, so nothing here imitates one. | push up (plan starts 0.5s early) | 24.10 "Here's how it works." / 26.30 "As you answer practice questions, ReadyEngine identifies where you need more support." |
| plan | Arrives from below over the outgoing quiz, landing 32.00. Two columns: the exam the plan is built around, 32.20 to 33.30, with the date at 92px; and what the plan puts next, 33.90 to 35.35, with a brand bar landing beside the first row 35.20, which is the concept the film has been following. Fictional learner data. Still from 35.95; lifts out 39.60 to 40.10. | push up (exams starts 0.5s early) | 31.90 "It builds a plan around your needs and exam date, with lessons and practice to guide what you work on next." |
| exams | Arrives from below, landing 40.10. A brand rule draws down the left edge 40.30, then the label, the two display lines and, under a drawn divider, the certification exam this practice is aligned to and its published scope. Every parameter on screen is one BCC publishes for the LLQP Life Insurance certification exam. Still from 43.15; lifts out 45.20 to 45.70. | push up (riley starts 0.5s early) | 40.60 "Practice exams are aligned to the concepts covered on your exam." |
| riley | Editorial, and deliberately not a chat surface. Label "Riley - 24/7 study assistant" 46.10 with a brand rule drawing beside it, the learner's question 46.50, a divider 47.10, and the answer as three lines on the same short rise, 47.70 / 48.50 / 49.30. Still from 50.00. The question is the same concept the practice question turned on, and it is a study question with an explanation, never help inside an assessed check. Lifts out 51.90 to 52.40. | push up (again starts 0.5s early) | 45.90 "You can ask questions and get explanations through Riley, your 24/7 study assistant." |
| again | Arrives from below, landing 52.40. One concept on a time axis: three separated sessions, Day 1, Day 8, Day 21, the marks arriving 53.20 / 54.00 / 54.80. The middle one is drawn hollow and tagged "with help", so what the axis states is repetition WITHOUT assistance and not a score climbing. Still from 55.50; lifts out 58.80 to 59.30. | push up (update starts 0.5s early) | 52.30 "ReadyEngine keeps checking. It looks for understanding you can demonstrate more than once, without help." |
| update | Arrives from below, landing 59.30. The published ReadyRating card rises 59.50 to 60.70, at the same level it has held all film, with one line under it 60.90 saying a rating is recalculated after every session and can move either way. 62.90 the card and the line clear upward and the plan behind them is a different plan: a concept that needs attention is back at the top of it 63.55, the followed concept has dropped to a retention check 64.25. Still from 64.85; lifts out 66.40 to 66.90. | push up (focus starts 0.5s early) | 58.70 "As you practise, your study plan and ReadyRating update." / 62.80 "Concepts that need more attention return to your plan." |
| focus | Arrives from below, landing 66.90. The scale the film opened on returns and this time it is read: five cells 67.40 to 68.00, the fourth already filled in the markup because nothing here may fill. A brand line draws from it 68.80 to what the learner works on next, which arrives 69.40 and 69.90. That line is the whole personal benefit, stated once. Still 71.00 to 74.30, then the stage fades and lifts, clear by 75.40. | the stage clears, then the end card | 67.30 "With Business Career College, you can see where you stand and what to work on next, with focused preparation for your LLQP exams." |
| end | NOT a sub-composition: untimed host elements on the main timeline, in the `data-film` template. Navy. "LLQP" 75.60, its rule draws 76.10, and "Know when you're ready." lands 76.55. "Powered by ReadyEngine" 79.30 and the BCC lockup 79.40, `brands/bcc/logo/reversed.svg` unaltered at 560px. "Explore the program." 80.10 and the destination 80.80. Each element is on screen just ahead of the line that names it. Settled 81.50, held to 87; narration ends 83.40, so the last 3.6s are an unnarrated hold on the finished card. | end | 76.90 "Know when you're ready." / 80.20 "Explore LLQP with Business Career College." |

<!-- Why the end frame is in the host: a sub-composition is shown for
     start <= t < end, so a beat ending at 87 has already gone at the film's
     last frame, and the call to action has to be on screen when playback
     stops. Main-timeline tweens hold their end state at t = duration. The
     cap beat runs 0 to 87, so a timed clip still reaches the root duration
     and lint does not warn subcomposition_blanks_before_host. -->

<!-- Copy lives in two beats and nowhere else. cap carries the fifteen
     narration captions, verbatim from the LLQP learner edit of
     WKT_ReadyEngine_Final_Revised_Script_20260908_v4.pdf; note carries the
     five editorial callouts, one at a time, never repeating narration.
     captions.vtt beside this file is the same table again for an external
     player and for the voiceover pass; the web build ships silent. -->

<!-- Framings. Every product reframe is a world transform inside its beat, in
     the published capture's own pixels, declared with
     data-layout-allow-overflow because a card the camera has pushed into is
     larger than the frame on purpose. World space puts rating at (0, 0) and
     mastery at (0, 700), and each framing is written as
     scale @ (translate x, translate y) about the world's top left:

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
     lossy published captures and a harder push would show it. The marked
     square is the card's own (96, 248) 23x24, an intermediate one between two
     proficient ones, which is what "needs more practice" means in the key the
     same frame is showing. -->

<!-- Seek symmetry. A fromTo fade-out whose start value no earlier tween
     established does not write it again on a backward seek: seek past one and
     back and the element is still gone. Three are in that position and carry
     immediateRender: true, #mark in the host, #q-lead in quiz and #stage in
     focus, and none anywhere else, because the flag writes the from-state at
     CONSTRUCTION and putting it on the fifteen captions would open the film
     with all of them stacked up. -->
