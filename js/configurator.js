/* Illustrative planning data. Replace with approved capabilities before launch. */
(() => {
  const form = document.getElementById('config-form');
  if (!form) return;
  const industries = {
    food: { products: {
      sauce: { label: 'Sauce & Condiment', film: 'PET / AL / PE', barrier: 'Oxygen + light', spout: 10, closure: 'Screw cap', fill: 'Hot fill — validate' },
      juice: { label: 'Juice & Beverage', film: 'PET / MET-PET / PE', barrier: 'Oxygen + light', spout: 8.6, closure: 'Screw cap', fill: 'Cold fill — validate' },
      oil: { label: 'Oil & Dressing', film: 'PET / AL / PE', barrier: 'Oxygen + light', spout: 10, closure: 'Screw cap', fill: 'Cold fill — validate' },
      puree: { label: 'Purée & Baby Food', film: 'PET / AL / PP', barrier: 'Product-specific review', spout: 8.6, closure: 'Safety review required', fill: 'Retort — validate' }
    } },
    beauty: { products: {
      lotion: { label: 'Lotion & Cream', film: 'PET / MET-PET / PE', barrier: 'Moisture + light', spout: 10, closure: 'Screw cap', fill: 'Cold fill — validate' },
      serum: { label: 'Serum & Face Oil', film: 'PET / AL / PE', barrier: 'Light protection', spout: 8.6, closure: 'Screw cap', fill: 'Cold fill — validate' },
      wash: { label: 'Shampoo & Body Wash', film: 'PET / PE', barrier: 'Moisture', spout: 15, closure: 'Wide-neck screw cap', fill: 'Cold fill — validate' },
      refill: { label: 'Refill Pack', film: 'PE-based', barrier: 'Product-specific review', spout: 10, closure: 'Screw cap', fill: 'Cold fill — validate' }
    } }
  };
  const volumes = [
    { id: '100', label: '100 ml', w: .88, h: .90 },
    { id: '250', label: '250 ml', w: .94, h: .95 },
    { id: '500', label: '500 ml', w: 1, h: 1 },
    { id: '1000', label: '1 L', w: 1.07, h: 1.06 },
    { id: '3000', label: '3 L', w: 1.14, h: 1.12 }
  ];
  // Browsers restore checked radios on reload, so the static choices are read from the DOM.
  const state = {
    industry: form.querySelector('[name=industry]:checked').value,
    product: 'sauce',
    volume: '500',
    sides: form.querySelector('[name=sides]:checked')?.value ?? 'curved',
    handle: form.querySelector('[name=handle]:checked')?.value ?? 'none'
  };
  const productBox = document.getElementById('product-options');
  const volumeBox = document.getElementById('volume-options');
  const specList = document.getElementById('spec-list');
  function pill(name, value, label, checked) {
    const wrap = document.createElement('label'); wrap.className = 'pill';
    const input = document.createElement('input'); Object.assign(input, { type: 'radio', name, value, checked });
    const text = document.createElement('span'); text.textContent = label;
    wrap.append(input, text); return wrap;
  }
  function renderProducts() {
    const products = industries[state.industry].products;
    if (!products[state.product]) state.product = Object.keys(products)[0];
    productBox.replaceChildren(...Object.entries(products).map(([id, product]) => pill('product', id, product.label, state.product === id)));
  }
  function current() { return { product: industries[state.industry].products[state.product], volume: volumes.find(volume => volume.id === state.volume) }; }
  function rows() {
    const { product } = current();
    return [['Format', 'Stand-up pouch, bottom gusset'], ['Side profile', state.sides === 'straight' ? 'Straight side seals' : 'Natural fill curve'], ['Carry handle', state.handle === 'opposite' ? 'Opposite the spout' : 'None'], ['Example film', product.film], ['Barrier focus', product.barrier], ['Spout diameter', product.spout + ' mm'], ['Closure', product.closure], ['Fill process', product.fill], ['Example MOQ', '5,000 units'], ['Production example', '3–5 weeks']];
  }
  function pushToRenderer() {
    const { product, volume } = current();
    document.dispatchEvent(new CustomEvent('pouch:spec', { detail: { industry: state.industry, straightSides: state.sides === 'straight' ? 1 : 0, handle: state.handle, bodyW: volume.w, bodyH: volume.h, spoutW: { 8.6: .92, 10: 1, 15: 1.15 }[product.spout] } }));
  }
  function update() {
    const { product, volume } = current();
    document.getElementById('spec-title').textContent = `${product.label} — ${volume.label}`;
    specList.replaceChildren();
    rows().forEach(([term, value]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = term; dd.textContent = value;
      if (term === 'Spout diameter') dd.className = 'is-accent';
      specList.append(dt, dd);
    });
    pushToRenderer();
  }
  form.addEventListener('change', event => {
    const input = event.target;
    if (!Object.hasOwn(state, input.name)) return;
    state[input.name] = input.value;
    if (input.name === 'industry') renderProducts();
    update();
  });
  document.querySelectorAll('[data-industry]').forEach(link => link.addEventListener('click', () => {
    if (!industries[link.dataset.industry]) return;
    state.industry = link.dataset.industry;
    state.product = link.dataset.product;
    state.volume = state.product === 'refill' ? '1000' : state.industry === 'beauty' ? '250' : '500';
    state.handle = state.product === 'refill' ? 'opposite' : 'none';
    form.querySelector(`[name=industry][value=${state.industry}]`).checked = true;
    form.querySelector(`[name=handle][value=${state.handle}]`).checked = true;
    renderProducts(); renderVolumes(); update();
  }));
  function buildText() {
    const { product, volume } = current();
    return `SAMPLE BUILD — ${product.label} / ${volume.label}\n` + rows().map(row => row.join(': ')).join('\n') + '\nIllustrative only. Requires technical validation. Freight is separate.';
  }
  let previousBuild = '';
  document.getElementById('use-spec').addEventListener('click', () => {
    const { product, volume } = current();
    document.getElementById('q-industry').value = state.industry;
    document.getElementById('q-product').value = product.label;
    document.getElementById('q-volume').value = volume.label;
    const details = document.getElementById('q-details');
    const existing = previousBuild ? details.value.replace(previousBuild, '').trim() : details.value.trim();
    previousBuild = buildText();
    details.value = existing ? `${existing}\n\n${previousBuild}` : previousBuild;
    details.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('quote').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    document.getElementById('q-quantity').focus({ preventScroll: true });
  });
  document.getElementById('download-build').addEventListener('click', () => window.Repack.download('repack-sample-build.txt', buildText()));
  function renderVolumes() { volumeBox.replaceChildren(...volumes.map(volume => pill('volume', volume.id, volume.label, state.volume === volume.id))); }
  renderProducts(); renderVolumes(); update();
  window.addEventListener('load', pushToRenderer);
})();
