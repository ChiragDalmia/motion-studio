/* Player chrome over window.__player. The HyperFrames runtime owns the paused
   timeline, clip windowing, seeking, media scheduling and text measurement; this
   file owns only what lives downstream of the frame: a real-time clock, a
   transport, visibility gating, reduced motion, captions and the host bridge.
   Everything it needs is injected by tools/build.mjs as window.__ms.

   Two things here are load-bearing and both were learned the hard way:

   1. window.__player DOES NOT EXIST when this script runs. The runtime installs
      it asynchronously and sets window.__playerReady alongside it. An earlier
      version read it once and returned when it was absent, silently, with no
      error, which left the film sitting at t=0 forever.

   2. At t=0 a film is legitimately BLANK: every entrance starts from opacity 0
      or a fully-clipped box, so t=0 is the frame before anything has arrived.
      Nothing may depend on autoplay to make the film visible. The poster frame
      is seeked synchronously the moment the player exists, so the first thing
      painted is always a complete frame. Combined, those two bugs produced a
      file that opened to a blank white screen and passed every gate. */
(function () {
  'use strict';
  var M = window.__ms || (window.__ms = {});
  var root = document.querySelector('[data-composition-id]');
  var W = M.width || 1920;
  var H = M.height || 1080;

  // Reveal first and unconditionally: a later throw must not leave a black box.
  function fit() {
    var s = Math.min(innerWidth / W, innerHeight / H);
    root.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    root.classList.add('ms-fit');
  }
  try { fit(); addEventListener('resize', fit); } catch (e) { if (root) { root.classList.add('ms-fit'); } }

  // Wait for the runtime. Poll rather than listen: hf-timelines-built fires
  // before the player object is assigned, so the flag is the only honest signal.
  var waited = 0;
  function ready() { return window.__player && window.__playerReady; }
  if (ready()) { boot(window.__player); } else {
    var iv = setInterval(function () {
      if (ready()) { clearInterval(iv); boot(window.__player); return; }
      if ((waited += 50) > 20000) {
        clearInterval(iv);
        // Loud, because the symptom is a blank frame and nothing else says why.
        console.error('[motion-studio] window.__player never appeared; the film cannot be driven and t=0 is blank by construction.');
      }
    }, 50);
  }

  function boot(P) {
    var D = P.getDuration() || 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A frame late enough that the first beat has fully arrived. Never 0.
    var poster = M.poster != null ? M.poster : Math.min(D, D * 0.22);
    var raf = 0, playing = false, seenComplete = false, started = false;
    var fired = Object.create(null); // an SFX must not re-fire on a scrub back
    function unfire() { for (var k in fired) { delete fired[k]; } }

    // ---- DOM ----------------------------------------------------------------
    var bar = el('div', 'ms-bar');
    var btn = el('button', 'ms-play'); btn.type = 'button'; btn.textContent = '▶';
    btn.setAttribute('aria-label', 'Play');
    var seek = document.createElement('input');
    seek.id = 'ms-seek'; seek.type = 'range'; seek.min = '0'; seek.max = String(D); seek.step = '0.01'; seek.value = '0';
    seek.setAttribute('aria-label', 'Seek');
    var time = el('span', 'ms-time');
    bar.appendChild(btn); bar.appendChild(seek); bar.appendChild(time);

    var caps = M.captions || [];
    var cap = el('p', 'ms-cap');
    cap.setAttribute('aria-live', 'polite');

    var poster$ = el('button', 'ms-poster'); poster$.type = 'button';
    poster$.setAttribute('aria-label', 'Play animation');
    poster$.appendChild(document.createElement('span')).textContent = '▶';

    var full = el('button', 'ms-full'); full.type = 'button'; full.textContent = '⛶';
    full.setAttribute('aria-label', 'Fullscreen');
    bar.appendChild(full);

    if (caps.length) {
      var tx = el('ol', 'ms-tx');
      caps.forEach(function (c) {
        var li = document.createElement('li');
        li.appendChild(document.createElement('b')).textContent = clock(c.t);
        li.appendChild(document.createTextNode(c.text));
        tx.appendChild(li);
      });
      var txBtn = el('button', 'ms-txb'); txBtn.type = 'button'; txBtn.textContent = 'T';
      txBtn.setAttribute('aria-label', 'Transcript');
      txBtn.onclick = function () { document.body.classList.toggle('ms-tx'); };
      bar.appendChild(txBtn);
      document.body.appendChild(tx);
    }
    if (M.audio) {
      var mute = el('button', 'ms-mute'); mute.type = 'button'; mute.textContent = '🔈';
      mute.setAttribute('aria-label', 'Unmute');
      mute.onclick = function () {
        var on = document.body.classList.toggle('ms-sound');
        mute.textContent = on ? '🔊' : '🔈';
        mute.setAttribute('aria-label', on ? 'Mute' : 'Unmute');
        each('audio,video', function (m) { m.muted = !on; });
      };
      each('audio,video', function (m) { m.muted = true; });
      bar.appendChild(mute);
    }
    document.body.appendChild(cap);
    document.body.appendChild(bar);
    document.body.appendChild(poster$);

    // ---- the poster frame, immediately -------------------------------------
    // This is what stops the film ever resting on nothing. It runs before the
    // visibility gate is even created, so first paint is a complete frame
    // whether or not anything later decides to play.
    P.seek(poster);
    paint(poster);
    document.body.classList.add('ms-paused', 'ms-poster');

    // ---- the real-time clock (the one thing HyperFrames does not have) -----
    function tick() {
      raf = requestAnimationFrame(tick);
      var t = P.getTime();
      paint(t);
      if (t >= D - 0.001) { pause(); post('complete', D); seenComplete = true; }
    }
    function paint(t) {
      seek.value = String(t);
      time.textContent = clock(t) + ' / ' + clock(D);
      var line = '';
      for (var i = 0; i < caps.length; i++) if (t >= caps[i].t && t < caps[i].t + caps[i].d) line = caps[i].text;
      if (cap.textContent !== line) cap.textContent = line;
    }
    function play(fromTop) {
      if (playing) { return; }
      if (fromTop || (seenComplete && P.getTime() >= D - 0.001)) { P.seek(0); unfire(); seenComplete = false; }
      playing = true;
      document.body.classList.remove('ms-paused', 'ms-poster');
      btn.textContent = '⏸'; btn.setAttribute('aria-label', 'Pause');
      P.play(); raf = requestAnimationFrame(tick); post('play', P.getTime());
    }
    function pause() {
      if (!playing) { return; }
      playing = false;
      document.body.classList.add('ms-paused');
      btn.textContent = '▶'; btn.setAttribute('aria-label', 'Play');
      P.pause(); cancelAnimationFrame(raf); post('pause', P.getTime());
    }
    btn.onclick = function () { if (playing) { pause(); } else { play(atRest()); } };
    poster$.onclick = function () { play(true); };
    full.onclick = function () {
      if (document.fullscreenElement) { document.exitFullscreen(); }
      else if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen(); }
    };
    seek.oninput = function () {
      var was = playing;
      if (was) { pause(); }
      P.seek(Number(seek.value));
      unfire();
      paint(Number(seek.value));
      if (was) { play(); }
    };
    /** True while the film is still showing its poster, never having run. */
    function atRest() { return !started || document.body.classList.contains('ms-poster'); }

    addEventListener('keydown', function (e) {
      if (e.target === seek && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { return; }
      var k = e.key, t = P.getTime(), step = e.shiftKey ? 1 : 1 / 24;
      if (k === ' ' || k === 'k') { e.preventDefault(); if (playing) { pause(); } else { play(atRest()); } }
      else if (k === 'ArrowRight') { e.preventDefault(); P.seek(Math.min(D, t + step)); paint(P.getTime()); }
      else if (k === 'ArrowLeft') { e.preventDefault(); P.seek(Math.max(0, t - step)); paint(P.getTime()); }
      else if (k === 'Home') { P.seek(0); paint(0); }
      else if (k === 'End') { pause(); P.seek(D); paint(D); }
      else if (k === 'f') { full.onclick(); }
      else if (k === 'Escape') { document.body.classList.remove('ms-tx'); }
    });

    // ---- visibility gate: never animate off-screen -------------------------
    // It decides whether to PLAY, never whether the film is visible. If it
    // never fires, the poster frame is already on screen.
    function autostart() {
      if (started) { return; }
      started = true;
      if (!reduced) { play(true); }
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) { autostart(); if (!reduced && !seenComplete) { play(atRest()); } }
          else if (playing) { pause(); }
        });
      }, { threshold: 0.5 }).observe(root);
    } else { autostart(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden && playing) { pause(); } });

    // ---- host bridge: analytics live in the HOST, never in the artifact ----
    var last = -1;
    function post(ev, t) {
      if (ev === 'progress') { var q = Math.floor(t / D * 4); if (q === last) { return; } last = q; }
      try { parent.postMessage({ source: 'motion-studio', film: M.film, event: ev, t: Math.round(t * 1000) / 1000, d: D }, '*'); } catch (e) {}
    }
    addEventListener('message', function (e) {
      var c = e.data && e.data.motionStudio;
      if (!c) { return; }
      if (c === 'play') { play(atRest()); } else if (c === 'pause') { pause(); }
      else if (typeof c === 'object' && c.seek != null) { P.seek(Math.max(0, Math.min(D, c.seek))); paint(P.getTime()); }
    });
    var progress = setInterval(function () { if (playing) { post('progress', P.getTime()); } }, 250);
    addEventListener('pagehide', function () { clearInterval(progress); cancelAnimationFrame(raf); });

    // The handle gate2 asserts on. Its absence means the chrome never wired up,
    // which is exactly the failure that shipped a blank film.
    M.player = {
      play: play, pause: pause, poster: poster,
      seek: function (t) { P.seek(t); paint(t); },
      isPlaying: function () { return playing; },
      fired: fired,
    };
  }

  function el(tag, id) { var n = document.createElement(tag); n.id = id; return n; }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function clock(t) {
    var x = Math.max(0, Math.round(t * 10) / 10);
    var m = Math.floor(x / 60), s = (x - m * 60).toFixed(1);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
})();
