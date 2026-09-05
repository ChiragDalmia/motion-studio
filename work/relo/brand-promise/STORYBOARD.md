---
format: 1920x1080
duration: 2
message: ""
arc: ""
audience: ""
---

## Beats

<!-- One row per beat. `start` is DERIVED from the durations above it — this
     table is the single authored source, and data-start in index.html is
     copied from it. Clip references (data-start="intro + 2") are for
     deliberate overlap only. -->

| # | id | start | duration | scene | transition | voiceover |
|---|----|-------|----------|-------|------------|-----------|
| 1 | intro | 0 | 2 | Lockup, white ground. Seam draws up the mark's diagonal, mark blooms from the corner its three primitives share, `relo` pops letter by letter, `by WKT` signs under it. Holds 0.7s. | hard cut | |

<!-- The film is the sting and nothing else right now; the beats it used to
     carry were scratched, not retimed, and the table is the record of that.
     A new beat is added by appending a row here, deriving its start, and
     copying the pair into index.html.

     The intro is the brand lockup sting and is the one beat that is not
     film-specific: brands/relo/gfx/lockup.html is the source, and any other
     RELO film opens with the same 2s by inlining it the same way.

     2s is the floor for it, not a preference: 1.3s of arrival plus the pack's
     640ms stillness minimum is 1.94s, so a shorter intro has to give up either
     a letter's bounce or the hold that whatever follows cuts away from. -->

<!-- Both gates are RED in this state, for one reason and by design: the sting
     is outlined geometry, so the film sets no type, so gate 1's contrast audit
     has zero elements to measure (upstream reports ok with checked=0, which is
     exactly the ok ai.md says never to trust) and gate 2 sees 0/3 declared
     faces painted. Nothing is broken — lint, guard, the build and the seek
     budget all hold. The first new beat that sets a word in Oswald or Poppins
     clears both. Do not answer them by deleting faces from brands/relo/brand.ts
     or by adding filler copy. -->
