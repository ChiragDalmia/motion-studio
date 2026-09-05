# Embedding a motion-studio film

Every file in this directory is one complete animation. It plays by itself, makes
**zero network requests**, and needs no build step, no script tag and no library
on your page.

```html
<iframe src="/motion/relo-brand-promise.html"
        title="RELO — brand promise"
        loading="lazy"
        allow="autoplay"
        style="width:100%; aspect-ratio:16/9; border:0"></iframe>
```

That is the whole integration. The film starts when it scrolls into view, pauses
when it scrolls out, and holds a still frame instead of animating for visitors
who have asked for reduced motion.

## Three things the host page must get right

"Needs nothing from the consuming website" is not quite true, and each of these
was measured rather than assumed. All three fail *silently* — no console error a
deploy would catch.

**1. Serve it as its own document. Never `srcdoc`, never a `data:` URL.**
A `srcdoc` frame inherits the host page's Content-Security-Policy, and CSP
policies only ever intersect — so the film's own policy can never grant back
what the host denied. Under `default-src 'self'`, the most common marketing-site
policy, its inline script and style are both blocked and the embed becomes a
live frame containing a black rectangle.

**2. Do not apply a restrictive CSP *header* to the film's own path.**
This is the same failure by another route. The film carries its own `<meta>`
policy, which is strict (`default-src 'none'`). If your server also sends the
site-wide CSP header for `/motion/*.html`, the two intersect and the film dies.
Either exclude that path from the site policy, or make sure the policy it
receives allows all of:

```
script-src 'unsafe-inline'   style-src 'unsafe-inline'
font-src data:   img-src data:   media-src data:   connect-src data:
```

Miss only `font-src data:` and the worst case happens: the film runs, and every
letter of it renders in a fallback face. It looks wrong and reports nothing.

**3. `frame-src` must permit the path.**
`frame-src 'none'` stops the frame being created at all.

## Optional

- **Analytics.** The film posts `play`, `pause`, `progress` and `complete` to the
  parent window. Nothing is measured inside the artifact, and it talks to no
  third party.

  ```js
  addEventListener('message', (e) => {
    if (e.data?.source !== 'motion-studio') return;
    // e.data = { film, event, t, d }
  });
  ```

- **Driving it from the page.** `frame.contentWindow.postMessage({motionStudio:'play'}, '*')`
  — also `'pause'`, or `{motionStudio:{seek:4.5}}`.

- **Keyboard, when the frame has focus.** Space or `k` play/pause, arrows step a
  frame (hold shift for a second), `Home`/`End` jump, `f` fullscreen.

## Serve it compressed

The raw file is around 570 KB, almost all of it the animation runtime and the
inlined typefaces, and it compresses to roughly 150–170 KB over the wire. Make
sure gzip or brotli is on for `.html` on that path; it is the single biggest
difference to how the film loads.
