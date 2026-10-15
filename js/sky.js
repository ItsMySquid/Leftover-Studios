/* ============================================================
   sky.js — shared sky/motion engine for the Leftover Studio site
   ------------------------------------------------------------
   Dependency-free. Loaded with `defer` on every page.
   Every feature is guarded: missing elements or missing browser
   APIs must never throw — the page simply stays static.

   Features:
     1. Ambient drifting clouds (.drift-cloud, appended to body)
     2. Mouse parallax on .hero-scene .float-obj (lerped, rAF)
     3. Scroll parallax on the same objects (composes with mouse)
     4. Scroll reveal for [data-reveal] -> adds .revealed
     5. Gentle extra sway for .float-obj.ship
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = false;
  var finePointer = false;

  try {
    reduceMotion = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    finePointer = !!(window.matchMedia &&
      window.matchMedia('(pointer: fine)').matches);
  } catch (e) {
    reduceMotion = false;
    finePointer = false;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ----------------------------------------------------------
     1. Ambient drifting clouds
     Creates ~7 absolutely-positioned cloud divs on <body>.
     The CSS provides the drift keyframes; we only randomise
     position, size, opacity, duration and start offset.
     ---------------------------------------------------------- */
  function initDriftClouds() {
    if (!document.body) return;
    if (reduceMotion) return;
    if (document.querySelector('.drift-cloud')) return; // already spawned

    var COUNT = 7;
    var frag = document.createDocumentFragment();

    for (var i = 0; i < COUNT; i++) {
      var cloud = document.createElement('div');
      cloud.className = 'drift-cloud';
      cloud.setAttribute('aria-hidden', 'true');

      var dur = rand(60, 140);            // seconds per crossing — slow
      cloud.style.position = 'absolute';
      cloud.style.top = rand(0, 70) + 'vh';
      // left stays 0 — the cloud-drift keyframes already sweep the
      // full screen (-25vw → 115vw), so a random left would cause a
      // visible teleport back to mid-sky every loop.
      cloud.style.width = rand(80, 260) + 'px';
      cloud.style.opacity = rand(0.15, 0.45).toFixed(2);
      cloud.style.pointerEvents = 'none';
      cloud.style.animationDuration = dur + 's';
      // Negative delay drops each cloud mid-drift instead of
      // having them all start from the same edge at once.
      cloud.style.animationDelay = (-rand(0, dur)) + 's';

      frag.appendChild(cloud);
    }

    document.body.appendChild(frag);
  }

  /* ----------------------------------------------------------
     2 + 3 + 5. Parallax & ship sway on .hero-scene .float-obj
     One shared rAF loop composes:
       - mouse offset * depth * ~30px   (fine pointers only)
       - scrollY * depth * -0.15        (scroll parallax)
       - sin(t) sway for ships          (gentle horizontal drift)
     Transforms are written to el.style.transform; CSS bob should
     live on the `translate` property or a child/pseudo element.
     ---------------------------------------------------------- */
  function initParallax() {
    var scene = document.querySelector('.hero-scene');
    if (!scene) return;

    var nodes = scene.querySelectorAll('.float-obj');
    if (!nodes || !nodes.length) return;

    var items = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var depth = parseFloat(el.style.getPropertyValue('--depth'));
      if (isNaN(depth)) depth = 0.4;
      items.push({
        el: el,
        depth: depth,
        isShip: el.classList.contains('ship'),
        phase: rand(0, Math.PI * 2)
      });
    }

    if (reduceMotion) return; // static scene, CSS still applies

    var targetX = 0;
    var targetY = 0;
    var curX = 0;
    var curY = 0;
    var lastScroll = -1;
    var mouseActive = false;
    var rafId = null;

    if (finePointer) {
      window.addEventListener('mousemove', function (e) {
        // Normalise pointer to -1..1 around the viewport centre.
        var nx = (e.clientX / window.innerWidth - 0.5) * 2;
        var ny = (e.clientY / window.innerHeight - 0.5) * 2;
        targetX = nx * 30;
        targetY = ny * 30;
        mouseActive = true;
        start();
      }, { passive: true });
    }

    var scrollPending = false;
    function onScroll() {
      if (scrollPending) return;
      scrollPending = true;
      requestAnimationFrame(function () {
        scrollPending = false;
        start();
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    function frame(now) {
      rafId = null;

      // Lerp mouse offsets for a smooth, floaty feel.
      curX += (targetX - curX) * 0.07;
      curY += (targetY - curY) * 0.07;

      var scrollY = window.scrollY || window.pageYOffset || 0;
      var t = now || 0;

      var settled = Math.abs(targetX - curX) < 0.05 &&
                    Math.abs(targetY - curY) < 0.05;
      var scrolled = scrollY !== lastScroll;
      lastScroll = scrollY;

      var anyShip = false;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var mx = mouseActive ? curX * it.depth : 0;
        var my = mouseActive ? curY * it.depth * 0.6 : 0;
        var sy = -scrollY * it.depth * 0.15;
        var swayX = 0;
        var swayR = 0;
        if (it.isShip) {
          anyShip = true;
          // Extra slow horizontal sway + a hint of roll.
          swayX = Math.sin(t / 3200 + it.phase) * 8;
          swayR = Math.sin(t / 4200 + it.phase) * 1.4;
        }
        it.el.style.transform =
          'translate3d(' + (mx + swayX).toFixed(2) + 'px,' +
          (my + sy).toFixed(2) + 'px,0)' +
          (swayR ? ' rotate(' + swayR.toFixed(2) + 'deg)' : '');
      }

      // Keep animating while the pointer is still settling or a
      // ship needs its continuous sway; otherwise sleep until the
      // next scroll/mouse event.
      if (!settled || scrolled || anyShip) {
        start();
      }
    }

    function start() {
      if (rafId === null) {
        rafId = requestAnimationFrame(frame);
      }
    }

    start(); // paint initial positions (applies current scrollY)
  }

  /* ----------------------------------------------------------
     4. Scroll reveal — [data-reveal] gains .revealed when it
     enters the viewport. data-reveal-delay="150" staggers via
     transition-delay. Unobserved after first reveal.
     ---------------------------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els || !els.length) return;

    function show(el) {
      var delay = parseInt(el.getAttribute('data-reveal-delay'), 10);
      if (!isNaN(delay) && delay > 0) {
        el.style.transitionDelay = delay + 'ms';
      }
      el.classList.add('revealed');
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      // No IO support or reduced motion: show everything at once.
      for (var i = 0; i < els.length; i++) {
        els[i].classList.add('revealed');
      }
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        show(entry.target);
      }
    }, { threshold: 0.15 });

    for (var j = 0; j < els.length; j++) {
      io.observe(els[j]);
    }
  }

  /* ----------------------------------------------------------
     Boot — defer guarantees the DOM is parsed, but guard anyway.
     ---------------------------------------------------------- */
  function init() {
    try { initDriftClouds(); } catch (e) { /* never break the page */ }
    try { initParallax(); } catch (e) { /* never break the page */ }
    try { initReveal(); } catch (e) { /* never break the page */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
