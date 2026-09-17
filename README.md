# motion-studio

One repository that produces every animation for any number of brands, and
ships each one as a single file you can drop on a website. The file plays by
itself, makes no network requests, and needs no library on the page.

Built on [HyperFrames](https://www.npmjs.com/package/hyperframes).

If you are a coding agent, read [AGENTS.md](AGENTS.md) instead. It is the full
contract and it is shorter than this.

## Set up

You need [Node.js](https://nodejs.org) 22 or newer. Nothing else.

```bash
npm ci
```

```bash
npm run doctor
```

`doctor` tells you whether your machine can run everything, and names the fix
for anything it cannot. Run it first whenever something misbehaves. The first
command that needs a browser downloads one by itself.

## Make a film

```bash
npm run new relo my-film --duration=12
```

That creates `work/relo/my-film/` with three files and nothing else:

| file | what goes in it |
|---|---|
| `film.json` | how long it is, and the list of beats in order |
| `beats.html` | the shapes and the movement, one block per beat |
| `NOTES.md` | what the film is for, and where its assets came from |

`relo` is the brand. The brands that exist are the directories in `brands/`.

## Watch it

```bash
npx hyperframes preview work/relo/my-film --background
```

A browser window opens and plays the film. Leave it open: edit `beats.html`,
save, and it reloads.

## Check it

```bash
npm run ship relo my-film
```

This runs everything in order and stops at the first problem: it generates the
project, checks the repository rules, runs the linter, opens a real browser and
audits the film frame by frame, builds the single file, then re-checks the
built file. Green means every gate passed.

A failure names the exact line of `beats.html` to look at. Paste the whole
message somewhere rather than summarising it.

The finished film is `builds/relo-my-film.html`. Open it by double-clicking.

## Start over

```bash
npm run clean
```

Most of the files in a film's directory are generated and can be thrown away.
`clean` removes all of them; the next command puts them back exactly as they
were. Your three files are never touched.

## Put it on a website

Every file in `builds/` is one complete animation.

```html
<iframe src="/motion/relo-brand-logo.html"
        title="RELO brand logo"
        loading="lazy"
        allow="autoplay"
        style="width:100%; aspect-ratio:16/9; border:0"></iframe>
```

The film starts when it scrolls into view, pauses when it scrolls out, and
holds a still frame for visitors who have asked for reduced motion.

Three things the host page has to get right. All three fail silently, and each
was measured rather than assumed.

1. **Serve it as its own file. Never `srcdoc`, never a `data:` URL.** A
   `srcdoc` frame inherits the host page's Content-Security-Policy, and those
   policies only ever intersect, so the film's own policy can never grant back
   what the host denied. The embed becomes a frame containing a black
   rectangle.
2. **Do not apply a restrictive CSP header to the film's own path.** Same
   failure by another route. Either exclude that path from the site policy, or
   make sure the policy it receives allows `script-src 'unsafe-inline'`,
   `style-src 'unsafe-inline'`, `font-src data:`, `img-src data:`,
   `media-src data:` and `connect-src data:`. Miss only `font-src data:` and
   the worst case happens: the film runs and every letter renders in the wrong
   typeface.
3. **`frame-src` must permit the path.** `frame-src 'none'` stops the frame
   being created at all.

Serve it compressed. gzip or brotli on `.html` for that path makes the biggest
single difference to how the film loads.

The film posts `play`, `pause`, `progress` and `complete` to the parent window
and talks to no third party.

```js
addEventListener('message', (e) => {
  if (e.data?.source !== 'motion-studio') return;
  // e.data = { film, event, t, d }
});
```

Drive it with `frame.contentWindow.postMessage({motionStudio:'play'}, '*')`,
also `'pause'` or `{motionStudio:{seek:4.5}}`. With the frame focused: space or
`k` play and pause, arrows step a frame (hold shift for a second), `Home` and
`End` jump, `f` fullscreen.

## Add a brand

Copy a `brands/<slug>/` directory, edit `brand.ts`, drop the typefaces into
`font/`, then:

```bash
npm run font <slug>
```

```bash
npm run tokens
```

`brand.ts` refuses to build unless it declares all fourteen core colours, its
own tempo, its craft thresholds and at least one typeface, and unless every
text colour clears WCAG AA against the background it sits on. That check has
already caught real defects in both packs here.

`npm run font` is the one step that needs Python with `fonttools` and
`brotli`. Nothing else does, and no check does.

## What is where

```
AGENTS.md               the contract, for people and for coding agents
CLAUDE.md               imports AGENTS.md, plus what is specific to Claude Code
brands/<slug>/          the brand: colours, typefaces, shapes, shared scenes
media/<brand>/          screenshots and illustrations, shared across films
work/<brand>/<slug>/    a film: film.json, beats.html, NOTES.md
builds/                 the finished films, one file each
lib/                    shared templates and the player
tools/                  every command
docs/AUDIO.md           why sound is not in the web build
```

`lib/`, `brands/` and `media/` are sources. The copies that appear inside a
film are generated and ignored by git.

## Why two checks and not one

`npm run check` validates the project before it is packaged. `npm run gate2`
validates the finished file. Everything the packager adds after the first check
(the typefaces, the player, the security policy, the attribution) is covered
only by the second one.

Both assert on counts rather than on pass flags. There are at least four ways
to get a green verdict on a check that never actually ran, and every one of
them reports success next to a zero.

Never point `npx hyperframes check` at a file in `builds/`. It reports clean
and zero for a run that never happened.

## What this deliberately does not do

No framework, no bundler configuration, no dev server, no test framework, no
runtime dependencies. There is exactly one `package.json` and `npm run guard`
asserts it. `hyperframes init` is never run for a film: it writes per-film
routing files and a per-film `package.json` that forks the one pinned CLI
version.

Sound is not in the web build. [docs/AUDIO.md](docs/AUDIO.md) has the three
independent reasons and the licence that would have to be bought first.

## Contributing and reporting problems

[CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Licence

This repository has no licence file, so it is all rights reserved by default
and nobody outside the project may copy, modify or redistribute it. The
typefaces and media inside it are separately licensed: every one is listed in
`brands/<slug>/LICENSES.json` with its source and terms.
