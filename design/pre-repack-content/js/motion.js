/* One-time reveals: no perpetual animation loop and no hidden content without JS. */
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('reveal-pending');
      if (entry.target.classList.contains('layers-motion')) entry.target.classList.add('layers-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px 30px 0px' });
  document.querySelectorAll('[data-reveal]').forEach(element => {
    // Above-the-fold content appears immediately and never waits for an observer.
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.classList.add('reveal-pending'); observer.observe(element);
  });
  const materialLayers = document.querySelector('.material-diagram');
  if (materialLayers && materialLayers.getBoundingClientRect().top >= window.innerHeight) {
    materialLayers.classList.add('layers-motion');
    observer.observe(materialLayers);
  }
  function revealAll() {
    document.querySelectorAll('.reveal-pending').forEach(el => el.classList.remove('reveal-pending'));
    materialLayers?.classList.add('layers-visible');
    observer.disconnect();
  }
  preference.addEventListener('change', event => { if (event.matches) revealAll(); });
  window.addEventListener('beforeprint', revealAll);
})();
