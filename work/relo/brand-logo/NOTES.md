# relo/brand-logo

Format 1920x1080.

## Intent

<!-- One sentence: what a viewer should believe after watching. Not what the
     film shows, what it changes. -->

## Assets

<!-- Every mark, face, bed and photograph, with where it came from and what
     licence it ships under. A film with an unlisted asset does not ship. -->

- `brands/relo/gfx/lockup.html`: the RELO lockup (mark + `relo` wordmark +
  `by WKT`), inlined verbatim into `brands/relo/scenes/sting.html`. Owned brand
  geometry, outlined from the supplied logotype; see `brands/relo/LICENSES.json`.
- Oswald 700, Poppins 500/600, OFL, subset by `tools/font.mjs`.
- No audio. See `docs/AUDIO.md`.

<!-- Reference, not an asset: the RELO dashboard's own 60s tutorial build at
     ALF-experience/alf_experience_lab/tutorial/dist/alf-dashboard-tutorial.html, the product context this film speaks about. Nothing from it ships here
     unless it is listed above with a licence. -->

## Customizations

<!-- The device tuple: the three or four specific moves this film owns and no
     other film in this brand may reuse. The ledger fails a repeat.

     Empty on purpose. The previous tuple, clipped type wipe, decaying card
     cascade, velocity-matched band wipe, went out with the beats that used
     it, so those moves are unclaimed again and this film's new tuple is
     whatever the next set of beats earns. -->

The intro is deliberately NOT on this list. The lockup sting is brand
vocabulary, not a film device: every RELO film opens with it, and the ledger
must not read a second one as a repeat.

## Notes

## Beats

<!-- Prose only. Every number a beat has, its id, duration, start, layer and
     surface, lives in film.json, and tools/prepare.mjs derives data-start
     from it. -->

| id | scene | transition | voiceover |
|---|---|---|---|
| intro | Lockup, white ground. Seam draws up the mark's diagonal, mark blooms from the corner its three primitives share, `relo` pops letter by letter, `by WKT` signs under it. Holds 0.7s. | hard cut | |

<!-- The film is the sting and nothing else right now; the beats it used to
     carry were scratched, not retimed, and the table is the record of that.
     A new beat is added by appending a row here and a beat to film.json.

     The intro is the brand lockup sting and is the one beat that is not
     film-specific: brands/relo/gfx/lockup.html is the source, and any other
     RELO film opens with the same 2s by inlining it the same way.

     2s is the floor for it, not a preference: 1.3s of arrival plus the pack's
     640ms stillness minimum is 1.94s, so a shorter intro has to give up either
     a letter's bounce or the hold that whatever follows cuts away from. -->

<!-- This film sets no type: the sting is outlined geometry. Both gates
     account for that exactly rather than approximately. Gate 1 requires the
     contrast audit to have measured zero elements here and more than zero on a
     film that does set type, so neither case can report clean without having
     run. The packager ships the faces whose family the film names, which is
     none, and gate 2 requires every face it ships to be painted. Add a beat
     that sets a word in Oswald or Poppins and all of that follows from the
     source with nothing to change here. -->
