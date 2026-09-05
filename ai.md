# ai.md — read this, not the skills

One film = one directory `work/<brand>/<slug>/` containing `index.html` +
`compositions/*.html`. Ship = one self-playing `builds/<brand>-<slug>.html`.

## Commands (full invocations — do NOT read any skill reference to run these)

    npm run pre    <brand> <slug>   materialize shared scenes, media, gsap
    npm run guard                   repo invariants
    npm run lint                    tier 1, all films, node only
    npm run check  <brand> <slug>   tier 2, GATE 1, boots chrome
    npm run build  <brand> <slug>   bundle -> inline -> chrome -> notice
    npm run gate2  <brand> <slug>   GATE 2, on the shipped bytes
    npm run ship   <brand> <slug>   pre + lint + check + build + gate2
    npx hyperframes preview work/<b>/<s> --background     human review
    npx hyperframes render  work/<b>/<s> --quality high   MP4, on request only
    npx hyperframes catalog --query "<effect in plain English>"

## The two gates are different programs

Gate 1 (`check`) validates the **source project**. Gate 2 validates the
**shipped bytes**. Anything the packager adds after gate 1 — gsap, fonts,
chrome, the notice — is covered only by gate 2. Never point `check` at a
`builds/*.html`: the vendored runtime trips lint, the browser never boots, and
every audit reports clean-and-zero. Assert on counts, never on `ok`.

## Composition contract

Root: `<div id="root" data-composition-id="main" data-width data-height
data-duration>`. Root duration is read once at compile time and is immune to
scripts and variables — it is the lockfield. A clip's duration is re-read live.

Timing, authored: `data-start` `data-duration` `data-track-index`.
`data-end`/`data-layer` are derived/legacy — never author them.
Media: `data-src` `data-media-start` `data-playback-rate` `data-volume`
`data-audio-group` `data-fx-chain` `data-automation`. Every `<audio>` needs an
`id` or the mixer never sees it and the render is silent.
Sub-comp host: `data-composition-src="x.html" data-composition-id="x"`
(+ optional `data-variable-values='{"ink":"#fff"}'`).
Bindings: `data-var-text` `data-var-src`. Grading: `data-color-grading`.

One `gsap.timeline({paused:true})` per composition, assigned to
`window.__timelines["<composition-id>"]`. There is no playback — every frame is
a fresh seek. Anything not on that timeline does not exist.

## Hard bans (upstream lint errors)

No `Math.random(` `Date.now(` `new Date()` `performance.now(`
`crypto.getRandomValues(` `gsap.utils.random(` or the `"random(...)"` string
form. No `requestAnimationFrame`. No `repeat:-1`. No `.from()` on a CSS
transform — use `fromTo` and set the initial state inside the tween. No
base64/data: `<audio>` or `<video>` src. No `../` in any asset path. No
template-literal selectors. Never name anything `.caption-group` (it triggers
an unconditional relative fetch). Style a sub-comp root via `#root`, never via a
class on the `data-composition-id` element. Layout reads only through
`window.__hyperframes.pretext` / `fitTextFontSize`.

## Limits that force the file shape

300 lines per composition file, 3 timed elements per `data-track-index`,
25 elements before the heavy-overlay warning. So: host + one sub-composition
per beat, from day one. Target <=250 structural lines.

## A beat states the surface it sits on. Always.

A sub-composition with no `.s-<name>` class uses the DEFAULT surface — so a
beat that visually sits on a dark host renders dark ink on dark and vanishes.
`check`'s contrast audit does NOT catch it: it resolves the background from the
sub-composition's own declared ground and never sees what the host paints
behind it. Look at a frame.

## Ours, not upstream

Four layers, fixed: `#art` camera-scaled, `#type` translate-only, `#ui` immune,
`#grade` static. Display type never scales. `filter` is a budgeted craft cost,
not a ban. Two independent builds must be byte-identical.

## Brand tokens are composition variables

Declare on `<html data-composition-variables='[{"id","type","label","default"}]'>`
— an ARRAY. Types: string|number|color|boolean|enum. Every scalar becomes
`--{id}` on the composition root; read it as `var(--ink)`. Overrides are an
OBJECT keyed by id, passed as `--variables-file brands/<slug>/tokens.json`.
Colours, lengths, font stacks and durations travel as variables. Eases, anything
GSAP interpolates, and anything the build computes with travel as JS — there is
no ease type and no way to express a curve.

## Retime recipe

Change one number in the film's duration table in `STORYBOARD.md`, re-derive
`data-start`, re-run `npm run ship`. Clip references (`data-start="intro + 2"`)
are for deliberate overlap ONLY: spaces around the operator are required
(`"intro-0.5"` silently means 0), an unresolved id resolves to 0 rather than
erroring, and a target with no resolvable duration lands the reference on its
start, not its end.

## Reading a finding

`check --json` gives every finding a `code`, `selector`, the element's `data-*`
identity, the composition source file, a bbox and the sample time. Jump from
the JSON to that file and that line. Do not re-derive it from a screenshot.
`--snapshots` writes annotated overviews plus `finding-NN-<code>.png` crops.

## The only four tasks that may load a skill

| Task | May load, and nothing else |
|---|---|
| Author a brand-new film format | `hyperframes-core/references/determinism-rules.md` |
| Install a registry block | `hyperframes-registry/SKILL.md` (never discovery.md) |
| Author new motion vocabulary | `catalog --query` first, then `motion-doctrine/SKILL.md` |
| Author or debug an audio mix | `hyperframes-audio/references/presets.md` |

Everything else is a digest violation. `npm run guard` fails the build on any
reference to a skill path outside that table.
