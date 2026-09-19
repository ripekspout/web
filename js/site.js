(() => {
  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  window.Repack = { download };
  const toggle = document.querySelector('.menu-toggle'), nav = document.getElementById('primary-nav');
  function closeMenu(returnFocus = false) {
    toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open');
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open);
    if (open) nav.querySelector('a').focus();
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });
  document.addEventListener('click', event => { if (!event.target.closest('.nav')) closeMenu(); });
  window.matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  const form = document.getElementById('quote-form');
  const result = document.getElementById('quote-result');
  const status = document.getElementById('quote-status');
  let prepared = '';
  form.addEventListener('input', () => {
    result.hidden = true; prepared = '';
    form.querySelectorAll('input').forEach(input => input.setCustomValidity(''));
  });
  form.addEventListener('change', () => { result.hidden = true; prepared = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    for (const id of ['q-product', 'q-name']) {
      const field = document.getElementById(id);
      field.setCustomValidity(field.value.trim() ? '' : 'Please enter this information.');
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const industry = data.get('industry') === 'food' ? 'Food & beverage' : 'Beauty & personal care';
    prepared = 'REPACK — PROJECT BRIEF\nDesign preview. This brief has not been sent.\n\n' +
      [['Name', data.get('name')], ['Email', data.get('email')], ['Industry', industry], ['Product', data.get('product')], ['Fill volume', data.get('volume')], ['Quantity', data.get('quantity')], ['Project details', data.get('details')]].map(([label, value]) => `${label}: ${String(value || '').trim() || 'To confirm'}`).join('\n') +
      '\n\nAll sample specifications and figures require confirmation before production.\n';
    result.hidden = false;
    status.textContent = 'Your preview brief is ready. Download a copy below. Nothing has been sent.';
    document.getElementById('download-brief').focus({ preventScroll: true });
    result.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  });
  document.getElementById('download-brief').addEventListener('click', () => { if (prepared) download('repack-project-brief.txt', prepared); });
  // Without JavaScript the disabled submit control prevents a native form submission.
  document.getElementById('quote-submit').disabled = false;
})();
