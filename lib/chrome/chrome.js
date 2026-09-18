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
      file that opened to a blank white screen and passed every gate.

   When a film ships a mix, #ms-mix is the clock and the timeline follows it.
   Nothing is triggered live: every effect is already in that one track, so a
   seek cannot fire a cue twice and a scrub backwards cannot fire it again. */
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
    if (M.player) { return; }            // one boot, so no listener is doubled
    var D = P.getDuration() || 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A frame late enough that the first beat has fully arrived. Never 0.
    var poster = M.poster != null ? M.poster : Math.min(D, D * 0.22);
    var raf = 0, playing = false, seenComplete = false, started = false;
    var fired = Object.create(null); // an SFX must not re-fire on a scrub back
    function unfire() { for (var k in fired) { delete fired[k]; } }

    // The mix, if the packager inlined one. `sound` is that element once it is
    // driving the film, and null whenever the runtime's own clock is.
    var mix = document.getElementById('ms-mix');
    var sound = null, engaging = false;
    function now() { return sound ? sound.currentTime : P.getTime(); }

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
    var mute = null;
    if (mix || M.audio) {
      mute = el('button', 'ms-mute'); mute.type = 'button'; mute.textContent = '🔈';
      mute.setAttribute('aria-label', 'Unmute');
      mute.onclick = function () {
        if (mix && !sound) { engage(); return; }
        soundOn(!document.body.classList.contains('ms-sound'));
      };
      each('audio,video', function (m) { m.muted = true; });
      bar.appendChild(mute);
    }
    function soundOn(on) {
      document.body.classList.toggle('ms-sound', !!on);
      if (mute) {
        mute.textContent = on ? '🔊' : '🔈';
        mute.setAttribute('aria-label', on ? 'Mute' : 'Unmute');
      }
      each('audio,video', function (m) { m.muted = !on; });
    }

    /**
     * Hand the clock to the mix. Browsers refuse sound without a gesture, so
     * this only ever runs from one, and `then` fires either way: a refusal
     * leaves the film playing silently rather than not playing at all.
     */
    function engage(then) {
      if (!mix || sound || engaging) { if (then) { then(); } return; }
      engaging = true;
      var done = function (took) {
        engaging = false;
        sound = took ? mix : null;
        soundOn(took);
        // Two clocks for one frame is the whole risk here: if the film is
        // already running, stop the runtime's before handing over, and start
        // the mix from where the picture actually is.
        if (took) {
          if (playing) { P.pause(); try { mix.currentTime = P.getTime(); } catch (e) {} mix.play(); }
          else { mix.pause(); }
        }
        if (then) { then(); }
      };
      try {
        mix.muted = false;
        var p = mix.play();
        if (p && p.then) { p.then(function () { done(true); }, function () { done(false); }); }
        else { done(true); }
      } catch (e) { done(false); }
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
      var t = now();
      // The picture follows the sound, never the other way round. One seek per
      // frame is what keeps them from drifting apart over eighty seconds.
      if (sound) { P.seek(Math.min(D, t)); }
      paint(t);
      if (t >= D - 0.001) { pause(); post('complete', D); seenComplete = true; }
    }
    /** Move both clocks together. Either alone is how they come apart. */
    function goTo(t) {
      t = Math.max(0, Math.min(D, t));
      P.seek(t);
      if (sound) { try { sound.currentTime = t; } catch (e) {} }
      return t;
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
      if (fromTop || (seenComplete && now() >= D - 0.001)) { goTo(0); unfire(); seenComplete = false; }
      playing = true;
      document.body.classList.remove('ms-paused', 'ms-poster');
      btn.textContent = '⏸'; btn.setAttribute('aria-label', 'Pause');
      if (sound) { sound.play(); } else { P.play(); }
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); post('play', now());
    }
    function pause() {
      if (!playing) { return; }
      playing = false;
      document.body.classList.add('ms-paused');
      btn.textContent = '▶'; btn.setAttribute('aria-label', 'Play');
      if (sound) { sound.pause(); } else { P.pause(); }
      cancelAnimationFrame(raf); post('pause', now());
    }
    /** Every path a person can start the film from. The gesture that reaches
     *  here is the only moment a browser will let the sound begin. */
    function start(fromTop) { engage(function () { play(fromTop); }); }
    if (mix) { mix.addEventListener('ended', function () { pause(); paint(D); post('complete', D); seenComplete = true; }); }

    btn.onclick = function () { if (playing) { pause(); } else { start(atRest()); } };
    poster$.onclick = function () { start(true); };
    full.onclick = function () {
      if (document.fullscreenElement) { document.exitFullscreen(); }
      else if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen(); }
    };
    seek.oninput = function () {
      var was = playing;
      if (was) { pause(); }
      unfire();
      paint(goTo(Number(seek.value)));
      // A scrub on a paused film leaves it paused; that is how a person reads
      // a frame. Resuming one that was running is the other half of the same.
      if (was) { play(); }
    };
    /** True while the film is still showing its poster, never having run. */
    function atRest() { return !started || document.body.classList.contains('ms-poster'); }

    addEventListener('keydown', function (e) {
      if (e.target === seek && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { return; }
      var k = e.key, t = now(), step = e.shiftKey ? 1 : 1 / 24;
      if (k === ' ' || k === 'k') { e.preventDefault(); if (playing) { pause(); } else { start(atRest()); } }
      else if (k === 'ArrowRight') { e.preventDefault(); paint(goTo(t + step)); }
      else if (k === 'ArrowLeft') { e.preventDefault(); paint(goTo(t - step)); }
      else if (k === 'Home') { paint(goTo(0)); }
      else if (k === 'End') { pause(); paint(goTo(D)); }
      else if (k === 'm' && mute) { mute.onclick(); }
      else if (k === 'f') { full.onclick(); }
      else if (k === 'Escape') { document.body.classList.remove('ms-tx'); }
    });

    // ---- visibility gate: never animate off-screen -------------------------
    // It decides whether to PLAY, never whether the film is visible. If it
    // never fires, the poster frame is already on screen.
    // A film that carries narration never starts on its own. No browser will
    // let the sound begin without a gesture, and starting the picture without
    // it loses the opening line with no way back but a restart.
    function autostart() {
      if (started) { return; }
      started = true;
      if (!reduced && !mix) { play(true); }
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) { autostart(); if (!reduced && !mix && !seenComplete) { play(atRest()); } }
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
      if (c === 'play') { start(atRest()); } else if (c === 'pause') { pause(); }
      else if (typeof c === 'object' && c.seek != null) { paint(goTo(c.seek)); }
    });
    var progress = setInterval(function () { if (playing) { post('progress', now()); } }, 250);
    // pause(), not just cancelAnimationFrame: a bfcached page with only its
    // loop stopped keeps playing sound over whatever the viewer went to next.
    addEventListener('pagehide', function () { clearInterval(progress); pause(); cancelAnimationFrame(raf); });

    // The handle gate2 asserts on. Its absence means the chrome never wired up,
    // which is exactly the failure that shipped a blank film.
    M.player = {
      play: start, pause: pause, poster: poster,
      seek: function (t) { paint(goTo(t)); },
      isPlaying: function () { return playing; },
      time: now,
      // What gate 2 and the audio tests read. `driving` is the only honest
      // answer to which clock the film is on.
      mix: mix,
      driving: function () { return sound ? 'audio' : 'visual'; },
      drift: function () { return sound ? +(sound.currentTime - P.getTime()).toFixed(3) : 0; },
      engage: engage,
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
