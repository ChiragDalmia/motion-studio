---
brand: relo
slug: next-step-mobile
surface: web
---

## Intent

The 4:5 cut of `work/relo/next-step`, for phones: the same 45 seconds, script,
beats, assets and event times, re-framed for 1080x1350. Someone preparing for
the Alberta real estate exams should believe that Relo turns "am I ready?" into
one clear next step, and should be able to buy the Residential Real Estate
Bundle from the last frame.

## Assets

Identical to `work/relo/next-step/BRIEF.md`, and shipped from the same files:

- `brands/relo/gfx/lockup.html` — the RELO lockup, byte-identical in
  `compositions/intro.html`, and static (ids `e-lockup-*`) in the end frame.
- Oswald 700, Poppins 500/600 — OFL, subset by `tools/font.mjs`.
- `compositions/img/*.webp` — the same fourteen files as the desktop film: the
  three 2x lossless RELO dashboard captures (s01, s03, s05), the nine
  pixel-registered state crops, `s01-small` for the laptop screen, and Angela
  Detmold's photograph from https://relo.ca/how-it-works/office-hours/. RELO
  product UI and staff portrait, owned by WKT. Inlined once each as
  `--img-<name>` on the host root by `tmp/inline.mjs`.
- The learner, desk, textbook, notebook, calendar, mug and laptop — the same
  original SVG, stamped from `tmp/learner3.mjs`. The end frame's card crops the
  desk's left end, so that copy of the scene is stamped without the calendar and
  the textbook: a text element the card hides entirely is a layout error.
- No audio in the web build; `vo.json` and `captions.vtt` are the desktop
  film's, unchanged, because the script and its timing are the same.

## Customizations

The desktop film's tuple, unchanged, plus one mobile-only device:

5. **Reading pans** — where a 4:5 frame cannot hold a line of the real
   interface at a readable size, the camera reads along it: the quiz question
   (13.6 -> 15.6) and the explanation's first sentence (20.3 -> 22.8).

## Notes

- The intro is hosted inside a `#fit` wrapper that scales the 1920x1080 sting
  to the frame's width; the file, its timing and its camera are untouched.
- Wire budget, end frame, the three purchase links, the per-beat id prefixes and
  reduced motion: as the desktop film's notes.
