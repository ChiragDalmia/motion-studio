# wkt/readyengine



---
brand: wkt
slug: readyengine
surface: web
---

## Intent

A training lead evaluating ReadyEngine should finish believing that it makes
each learner's exam readiness visible on evidence they can point at, and that
the same evidence tells their own team where support is needed.

## Assets

| asset | where it came from | licence |
|---|---|---|
| `brands/wkt/logo/mark.svg` | the brand's own two-colour RGB master, geometry unaltered. Inlined twice in `beats.html` (`#mark`, `#e-lock`) with literal fills, the knot keeps `#ff004d` on every ground in this film and only the wordmark reverses to `#ffffff`, which is the approved dark variant. No `currentColor`, no token binding, no mask over any part of it. | client mark, WKT |
| Montserrat 700, Roboto 400/500, Roboto Mono 500 | `brands/wkt/font/`, materialized by `npm run pre` | OFL |
| `media/wkt/*.webp` (10) | the ALF Experience Lab at `localhost:8082/app/`, scenario `relo-fre-new-learner`, viewport 1600x1000 at deviceScaleFactor 2, lossless WebP at native 2x. Synthetic demo scaffolding: every learner, name, date and result in them is the lab's fictional data. The concept mastery states were reached by working the product's own practice flow and its own `POST /api/quiz-results`: nothing in any capture was retouched. | internal, synthetic demo data |
| the narration | `WKT_ReadyEngine_Final_Revised_Script_20260908_v4.pdf`, page 1, verbatim | client copy, WKT |
| music, voiceover | **not sourced.** The web build ships silent; `film.json` is the manifest for the MP4 pass and the generated `captions.vtt` the sidecar. See `docs/AUDIO.md`. | none purchased |

The lab's practice-exam screen carries a domain table recorded from the other
vertical, so its rows name accounting domains inside a real-estate course. The
`exam` crop stops above that table and the beat's mask dissolves the lower edge:
the film shows what the screen really says about this course and never puts a
wrong row on screen.

There is no Riley interface in the lab build and no organizational dashboard in
the approved deployment, so neither is drawn. Both beats are editorial.

## Customizations

1. **The readiness scale as the film's spine.** The opening lattice, the
   product's own 1–5 strip and the closing cohort distribution are the same
   mark at three scales, so the organizational payoff is literally the shape
   the film opened on.
2. **Framing-sized state overlays.** Each product state is a crop of the same
   1600x1000 viewport, sized to cover everything visible at the one framing
   that uses it, so a composite can never be caught half-updated at any zoom
   and the film carries 369 KB of capture instead of five full frames.
3. **One upward current for every seam.** The four cuts that are not
   continuous are pushes: the outgoing stage leaves at −360 and the incoming
   arrives from +1080, 0.5s, on mirrored eases.
4. **A hold that does not resolve.** ReadyRating is 1 of 5 in every frame of
   this film, including after the practice that moves five concepts up a
   level. Readiness is not a progress bar and this film does not let it become
   one.

## Notes

Retiming: change one number in the duration table in `the beat table below`, re-derive
`data-start` in `beats.html`, and move the matching cue in `beats.html` (cap),
the generated `captions.vtt` and `film.json`: those four files are the whole timing surface.

Images are inlined into the `IMG:BEGIN` / `IMG:END` block of `beats.html` as
`--img-<name>` custom properties, one per file in `media/wkt/`. The
packager inlines only the brand faces, so this has to happen before `build`.

## Verification

- **tier 1** `guard + law + lint`, every film: clean.
- **gate 1** `check --strict --at-transitions`, 12-way, 199s: lint 0/0,
  runtime 0/0, layout 0/0, motion 0/0, contrast 0/0 across 353 layout samples.
  Three findings were fixed to get there: the product pane was painting over
  the editorial type at two handovers (`text_occluded` on `#re`, `#tm`, `#d1`,
  `span.un`: the pane now sits under the type), the micro type role failed AA
  on navy at 42% white (raised to 58%, which measures 6.0:1), and the four
  push seams needed `data-layout-allow-overflow` on the stage that travels.
- **gate 2**, on the shipped bytes: clean. `film.json` declares 562 KB brotli
  and 594 KB gzip against the studio defaults of 200 and 230, and the artifact
  measures 535 KB. 368 KB of that is ten lossless WebP captures, measured at
  0.98x to 1.57x the size they are painted at, so the pixels are not spare;
  103 KB is the vendored runtime, which is identical in every artifact. The
  declared number carries 5% of headroom, so the next thing that grows fails
  here. No unclipped text overlap across 353 samples, the undriven opening
  frame is 41% off-modal over 112 colours, 3/3 shipped faces painted, dcl
  794 ms, seek p50 2.5 ms / p95 5.5 ms.
- `Roboto Mono 500` no longer ships. The pack declares it for the `mono` role
  and this film never names `var(--mono)`, so the packager leaves it out. It is
  still one line in `brands/wkt/brand.ts` for the film that does want it.
- **Seek symmetry**: 55 times captured forward and the same 55 captured in
  reverse order, diffed pairwise, 0 frames differ. No frame in the film is a
  single flat colour, and the only pair of consecutive samples that is
  identical is 83s → 85s, the closing hold.
- **The lockup**: both inlined copies were compared path-by-path against
  `brands/wkt/logo/mark.svg`: all 15 paths identical, knot `#ff004d`,
  wordmark `#ffffff`, and no `currentColor`, `var()`, mask, clip-path,
  opacity or filter anywhere inside the mark. Then rendered: the master at
  170 px and 420 px against crops taken at 3s, 20s, 43s, 60s, 70s, 84s and
  87.9s, the end-card copy differs from the master by 0.36% of its ink
  (antialiasing), and the 170 px chrome copy by 11% at a size where the whole
  mark is 45 px tall and the edge is most of it, with ink area within 2.4%.
- **Viewport**: 1920x1080 renders 1:1; 780x1200 scales to 780x439 and
  420x780 to 420x236, both letterboxed with no clipping and no scrollbar.
  With `prefers-reduced-motion: reduce` the camera transform computes to
  `none` and the grain to `display: none`.

## Beats

---
format: 1920x1080
duration: 88
message: "ReadyEngine makes each learner's exam readiness visible, and gives the organization evidence of where support is needed."
arc: "One learner and one concept, Scope & Responsibilities, travel from an unknown readiness, through ReadyRating and its concept breakdown, into practice, a plan built on an exam date, a practice exam and Riley's explanation, then back through repeated independent practice until the plan itself has moved; the film ends on the organization's view and one WKT next step."
audience: "Organizations and institutional partners evaluating ReadyEngine for their programs."
---

## Beats

<!-- Prose only. Every number a beat has lives in film.json. The four seams
     that are not continuous overlap by 0.5s, written there as a pinned
     start, never as a clip reference. -->

| id | scene | transition | voiceover |
|---|---|---|---|
| open | Navy. A readiness field, twenty-eight learners as twenty-eight marks, all unread, drawn at rest in the markup so the film's first frame is never one flat colour. It lifts to full as a decaying cascade 0.30 → 1.84, 0.74 per step. Headline "Know where" 0.95, "your learners stand." 1.20, "Before exam day." 1.75; all three clear 4.15. "ReadyEngine™" lands 4.65 with its rule drawing under it 4.95. 5.55 the field clears, 5.95 the wordmark lifts upward, and 6.05 → 7.85 the product itself rises on the same current into the wide framing W and stops dead. Camera 1.03 → 1.00 over 7.2s, arriving at rest with it. | continuous, rating opens on this exact frame | 0.90 "Know where your learners stand before exam day." · 4.70 "ReadyEngine is an online platform that personalizes exam preparation and makes each learner's readiness visible." |
| rating | Opens on W with nothing moving, so the cut is invisible. 10.45 → 11.85 push to R, the ReadyRating card. Pointer in from below 11.5, click 12.85: the card opens to "Not ready yet, but you'll get there!" and the 1 – 5 strip with 1 filled. Held 13.0 → 15.9 on a creep to R2, the film's one long look at the rating, and the only frame in it that states the scale. 15.9 → 17.5 across to G, the Concept Mastery grid, the pointer leaving after the camera and arriving before it stops. Click LIST 19.6; the breakdown replaces the grid in 20ms and the camera eases to L by 20.5. A marker draws under SCOPE & RESPONSIBILITIES 21.2, the concept the rest of the film follows. Still from 22.0. | continuous, plan opens on this exact frame | 10.90 "ReadyRating shows readiness on a scale of one to five, based on each learner's demonstrated understanding of the concepts their exam requires." · 19.55 "The breakdown shows which concepts need more practice." |
| plan | Opens on L with the pointer where rating left it. 23.7 → 24.5 the pointer crosses to that row's QUIZ control and clicks 24.9; the adaptive quiz replaces the dashboard and the camera lands on Q, the question at reading size. First answer selected 26.6 (the product's own selected row and enabled SUBMIT), SUBMIT 28.05; the answered layout with EXPLANATION in 20ms and the camera eases to E so the explanation's first sentence sits on the centre line. Held 29.4 → 32.6. 32.9 the dashboard returns at S, the Study Navigator beside the exam date, and two markers land: the exam date 34.3, the recommended practice block 35.4. 36.6 → 37.6 the camera crosses back to the breakdown at L, where WATCH and QUIZ sit against the concept. Still from 38.4; 39.6 → 40.1 the whole stage lifts out. | push up (exams starts 0.5s early) | 23.60 "Here's how it works." · 25.85 "As learners answer practice questions, ReadyEngine identifies where they need more support." · 31.50 "That shapes a study plan around their needs and exam date, with lessons and practice focused on what to work on next." |
| exams | Arrives from below over the outgoing plan, landing 40.1. The practice-exam screen, "Fundamentals of Real Estate Practice Exam", 34 questions in 1 hour, against the FRE exam, lands whole at X0, then 40.6 → 42.0 pushes to X1 on the line that says what the exam is. A brand rule draws down the card's left edge 41.5. 42.2 → 44.8 a creep to X2. Both edges of the crop dissolve into the navy rather than cutting, which is what stops a detail reading as a floating card. Callout "Practice aligned to exam content." 41.0. Lifts out 45.0 → 45.5. | push up (riley starts 0.5s early) | 40.30 "Practice exams are aligned to the concepts covered on the exam." |
| riley | Editorial, not product UI: the lab build carries no Riley interface, so nothing here imitates one. Label "RILEY · 24/7 STUDY ASSISTANT" 45.9, a red hairline drawing down beside it. The learner's question wipes in 46.3; the answer arrives as three lines, 47.5 / 48.3 / 49.1, each on the same short rise. Held from 50.2. Same concept as the practice question, the land titles record. Lifts out 51.6 → 52.1. | push up (checks starts 0.5s early) | 45.70 "Learners can ask questions and get explanations through Riley, their 24/7 study assistant." |
| checks | Arrives from below, landing 52.1. Part A, editorial: one concept on a time axis, three separated sessions, Day 1, Day 6, Day 15, the marks arriving 52.9 / 53.7 / 54.5. The middle one is drawn hollow and tagged "answered with help", so what the axis states is repetition WITHOUT assistance, not a score climbing. Callout "Understanding checked over time." 53.2. Part B, product: 57.0 the axis clears upward and the Concept Mastery card rises into G; 58.9 → 59.3 the same card cross-dissolves from the state five concepts ago to the state after them, five squares move from Basic to Intermediate. Both frames are states the product actually produced and the camera only holds still over them; the dissolve is time passing, which is why it is not a step. Part C: 62.3 the card turns to the breakdown at L and the list is a different list; a marker lands on CLIENT & PROPERTY INFO 63.6. Still from 64.6; lifts out 66.2 → 66.7. | push up (value starts 0.5s early) | 52.30 "ReadyEngine keeps checking. It looks for understanding demonstrated more than once, without help." · 58.35 "As learners practise, their study plan and ReadyRating update." · 62.45 "Concepts that need more attention return to the plan." |
| value | The scale the film opened on returns, arriving 66.7, and this time it is read: twenty-eight learners distributed across ReadyRating 1 to 5, the columns growing off the baseline 67.2 → 68.0. Only then, 69.4 → 70.0, do the two lowest take the brand colour, with a bracket under them at 70.0, the whole organizational claim, stated once and with no number attached to it. One mark is ringed at 71.4: the learner the film followed, at 2. Callout "Evidence to guide support." 68.2. Editorial throughout, there is no organizational dashboard in the approved deployment and the film does not draw one. Still 72.4 → 73.4, then the field lifts and is clear by 74.5. | the field clears, then the end card | 66.90 "Help learners focus their preparation, and give your team a clearer view of where support is needed before exam day." |
| end | NOT a sub-composition: untimed host elements on the main timeline (see the data-film template in beats.html). Navy. "ReadyEngine™" rises 74.6, 0.1s after the field is clear so the two never share a frame; its rule draws 75.0 and "Know when you're ready." lands 75.6. "POWERED BY" 78.8 and the WKT lockup 78.9, brands/wkt/logo/mark.svg unaltered, the wordmark reversed to white and the knot left on its own #ff004d. The call to action 81.4 and wkt.ca 82.0. Each element is on screen just ahead of the line that names it. Settled 82.7, held to 88; narration ends 85.1, so the last 2.9s are an unnarrated hold on the finished card. | end | 75.90 "ReadyEngine. Know when you're ready." · 79.00 "Powered by We Know Training." · 81.70 "Talk to WKT about ReadyEngine for your program." |

<!-- Why the end frame is in the host: a sub-composition is shown for
     start <= t < end, so a beat ending at 88 has already gone at the film's
     last frame (t = 88 exactly), and the call to action has to be on screen
     when playback stops. Main-timeline tweens hold their end state at
     t = duration, and #root carries visibility: visible !important so the
     runtime's own hide at the last frame cannot take the end card with it.
     the cap beat runs 0 → 88, so a timed clip still reaches the root
     duration and lint does not warn subcomposition_blanks_before_host. -->

<!-- Copy lives in two files and nowhere else. cap.html carries the sixteen
     narration captions, verbatim from page 1 of
     WKT_ReadyEngine_Final_Revised_Script_20260908_v4.pdf; note.html carries
     the six editorial callouts, one at a time, never repeating narration.
     captions.vtt and vo.json beside this file are the same table again for an
     external player and for the voiceover pass; the web build ships silent
     (docs/AUDIO.md). -->

<!-- Framings. Every product reframe is a world transform inside its beat, in
     capture space (1600x1000, the product's own viewport for the dashboard;
     1570x560 for the quiz crop and 1400x260 for the practice exam), declared
     with data-layout-allow-overflow because a screen the camera has pushed
     into is larger than the frame on purpose. Each one is written as
     scale @ (translate x, translate y) about the world's top left:

       W  0.86  @ (272, 52)         the whole dashboard, the film's wide shot
       R  2.00  @ (190, -545)       the ReadyRating card, centred
       R2 2.045 @ (172.7, -568.6)   the same point, crept in over the hold
       G  1.90  @ (-1088.2, -600.6) Concept Mastery, grid
       G2 1.925 @ (-1106.2, -612.4)
       L  1.82  @ (-966.8, -712.7)  the same card, breakdown
       Q0 1.22  @ (2.5, 178)        the quiz, arriving
       Q  1.16  @ (49.5, 196)       the question at reading size
       E  1.247 @ (-19, 160)        the answered layout with the explanation
       E2 1.272 @ (-38.6, 152.5)
       S0 1.26  @ (-22.5, 204)      the dashboard, returning
       S  1.30  @ (-50.5, 196)      the Study Navigator beside the exam date
       X0 1.36  @ (8, 343)          the practice exam, whole
       X1 1.52  @ (0, 322)          the line that states what the exam is
       X2 1.545 @ (-15.5, 318.4)

     Every one of them is chosen so that the screen's own edge is either well
     inside the frame or off it, never cutting a word. Five clicks: ReadyRating
     12.85, LIST 19.60, QUIZ 24.90, the first answer 26.60, SUBMIT 28.05, and
     the pointer leaves after it. The pointer is 44 frame px tall at every
     zoom -- its own scale is the inverse of the world's and travels whenever
     the world does. -->

<!-- Seek symmetry. A fromTo fade-out whose start value no earlier tween
     established does not write it again on a backward seek: seek past one and
     back and the element is still gone. Five of them are in that position and
     carry immediateRender: true -- #mark in the host, #rerule in open,
     #wd and #cd in plan, #ax in checks, #stage in value -- and none anywhere
     else, because the flag writes the from-state at CONSTRUCTION and putting
     it on the sixteen captions opened the film with all of them stacked up.
     The dashboard's transform chain in plan.html starts with a steps(1) from L
     to S0 for the same reason: a chain whose first from-state is not the
     markup walks to the wrong framing on the way back.
     Verified by capturing thirty times forward and the same thirty in reverse
     order and diffing: 0 of 30 frames differ. -->
