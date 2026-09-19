/* Reveal system.

   Everything is authored visible. This script adds `.motion` to <html>, which
   is what switches on the pre-reveal state in CSS — so with JS blocked, or
   under prefers-reduced-motion, the page simply renders at rest.

   Reveals run off a rAF loop rather than IntersectionObserver or scroll
   events: both proved skippable here (the observer missed elements when
   webfont loading reflowed the page beneath them), and a heading stuck at
   clip-path 105% is an entirely blank section. The loop tests a shrinking
   list and stops once everything has been revealed. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var root = document.documentElement;
  root.classList.add('motion');

  var pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (!pending.length) return;

  // Items sharing a [data-reveal-group] parent come in one after another.
  var STAGGER = 70;
  pending.forEach(function (el) {
    var group = el.closest('[data-reveal-group]');
    if (!group) return;
    var siblings = group.querySelectorAll('[data-reveal]');
    var index = Array.prototype.indexOf.call(siblings, el);
    if (index > 0) el.style.transitionDelay = (index * STAGGER) + 'ms';
  });

  var headline = document.querySelector('.hero h1');
  var hero = document.querySelector('.hero');
  var lastWeight = 0;

  function sweep() {
    var limit = window.innerHeight * 0.92;
    for (var i = pending.length - 1; i >= 0; i--) {
      var rect = pending[i].getBoundingClientRect();
      if (rect.top < limit && rect.bottom > 0) {
        pending[i].classList.add('is-revealed');
        pending.splice(i, 1);
      }
    }
  }

  /* The hero headline is the one scroll-scrubbed moment on the page: Manrope
     is a variable font, so the weight axis eases off as the hero leaves. */
  function trackWeight() {
    if (!headline || !hero) return;
    var travel = hero.offsetHeight || window.innerHeight;
    var progress = Math.min(1, Math.max(0, window.pageYOffset / travel));
    var weight = Math.round(800 - progress * 180);
    if (weight === lastWeight) return;
    lastWeight = weight;
    headline.style.fontVariationSettings = "'wght' " + weight;
  }

  function frame() {
    if (pending.length) sweep();
    trackWeight();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
