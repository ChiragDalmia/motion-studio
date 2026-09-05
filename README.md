# motion-studio

One repo that produces every animation for any number of brands, and ships each
one as a single portable `builds/<brand>-<slug>.html` that plays by itself with
zero network requests.

Built on [HyperFrames](https://www.npmjs.com/package/hyperframes) for
composition, seeking, validation, preview and optional MP4. Designed to be
maintained by an agent — if you are an agent, read [`ai.md`](ai.md) and stop
there.

## Make a film

```bash
node tools/new.mjs relo my-film --duration=12   # stamp it from lib/world.html
npm run ship relo my-film                       # gates, build, verify
npx hyperframes preview work/relo/my-film --background   # watch it
```

`ship` runs the whole chain and stops at the first failure:

| | |
|---|---|
| `npm run lint` | tier 1 — guard, tokens, the formatting law, upstream lint. Every film, every commit. ~130 ms per film. |
| `npm run check <brand> <slug>` | tier 2 — **gate 1**: `check --strict --at-transitions`, in a real browser, against the source. ~25 s per film. With no arguments, only the films in the current diff's blast radius. |
| `npm run build <brand> <slug>` | bundle to one file, inline the faces, add the player, assert self-containment. |
| `npm run gate2 <brand> <slug>` | **gate 2** — assertions on the shipped bytes. |
| `npm run do all` | tier 3 — everything, with snapshots. Nightly, never on the commit path. |

## The two gates are different programs

Gate 1 validates the **source project**. Gate 2 validates the **shipped bytes**.
Everything the packager adds after gate 1 — the typefaces, the player, the CSP,
the attribution — is covered only by gate 2.

Never point `hyperframes check` at a file in `builds/`. The vendored runtime
trips `non_deterministic_code`, `template_literal_selector` and
`requestanimationframe_in_composition`, so lint fails, the browser never boots,
and every audit then reports clean-and-zero. HyperFrames' own lint calls the
HyperFrames runtime non-deterministic; the divergence is structural and gate 2
exists to close it.

Both gates assert on **counts**, never on `ok` flags. There are at least four
ways to get a passing verdict on a run that never happened, and every one of
them reports `ok: true` next to a zero.

One seam is worth naming, because it was measured rather than guessed. Gate 1's
`content_overlap` is blind to a headline running straight through its own body
copy when both carry a `clip-path` — it measures the clipped box, and a clipped
reveal is this studio's default entrance, so the blindness is systematic. Gate 2
re-measures the layout with every clip forced off and fails on the real
geometry. Two defects in the first two films were found this way and neither was
visible to any upstream rule.

Gate 2 also opens the artifact the way a person does — one unthrottled page,
nothing driven — and measures real pixels. It exists because everything else in
that gate talks to `window.__player` directly, which by then exists, so it
validated the *runtime* and never checked that our own player chrome wired up.
It had not: the runtime installs `window.__player` asynchronously, a chrome that
reads it once at parse time finds nothing, and **t=0 is blank by construction**
because every entrance starts from opacity 0 or a fully clipped box. The
artifact opened to a blank white screen with every other assertion green. Four
assertions now cover it, the strictest being that the opening frame must not be
a single flat colour.

## Layout

```
ai.md                   the agent's entry point. The HyperFrames contract, as a digest.
CLAUDE.md               load-bearing. Suppresses the skill tree; see ai.md §12 rationale.
lib/                    shared. Zero colours, zero families, zero thresholds.
  world.html            the film template: the four-layer world and the pan clamp
  craft.mjs             craft predicates. Every threshold arrives as an argument.
  chrome/               the player, over window.__player
brands/<slug>/
  brand.ts              the pack: 14-token core, extras, surfaces, craft, faces
  tokens.json vars.json surfaces.css font/coverage.json   all GENERATED
  font/master/          the untouched faces; font/ holds what ships
  gfx/                  token-bound shapes, inlined by hand at authoring time
work/<brand>/<slug>/    ONE HYPERFRAMES PROJECT. index.html + compositions/*.html
builds/                 the deliverables, committed. See builds/EMBED.md.
tools/                  do · new · prepare · build · gate2 · guard · tokens · law · font
```

`lib/` and `brands/` are sources; the copies inside a film are generated and
gitignored. Sharing is by **materializing, never referencing** — `../` in an
asset path is a hard upstream lint error and a runtime 404, a symlink into
`compositions/` passes `check` and is then silently dropped from the upload zip,
and no shipped asset may live under a dot directory.

## Add a brand

Copy a `brands/<slug>/` directory, edit `brand.ts`, drop the faces into
`font/`, then:

```bash
node tools/font.mjs <slug>    # subset the faces (needs python + fonttools)
npm run tokens                # resolve, validate contrast, emit
```

`brand.ts` fails to build unless it declares all fourteen core tokens, its own
tempo (there is no house default and no fallback), its craft thresholds, and at
least one face — and unless every `on-` partner and every surface clears WCAG AA
against its own ground. That check has already caught real defects in both
packs here.

## Prerequisites

Node ≥ 22 and nothing else for the normal path. Chrome is downloaded and cached
by HyperFrames on first use, and both gates find it there.

- **MP4** needs FFmpeg on `PATH`. It is not required to ship a film.
- **`tools/font.mjs`** needs Python with `fonttools` and `brotli`. It is a pack
  authoring step, run when a pack's faces change — never by `build` or a gate.

## What this deliberately does not do

No framework, no bundler config, no dev server, no test framework, no runtime
dependencies. `hyperframes init` is never run for a film: it writes per-film
routing files that contradict `CLAUDE.md` and a per-film `package.json` that
forks the one pinned CLI version. There is exactly one `package.json` and
`npm run guard` asserts it.

Audio is not shipped in the web build. [`docs/AUDIO.md`](docs/AUDIO.md) has the
three independent reasons and the licence that has to be bought first.
