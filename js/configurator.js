/* The product cards in #products are the single source of truth for every bag's specifications. */
(() => {
  const form = document.getElementById('config-form');
  if (!form) return;
  const bags = [...document.querySelectorAll('.product-card[data-bag]')].map(card => ({
    id: card.dataset.bag,
    name: card.dataset.name,
    short: card.dataset.short,
    length: Number(card.dataset.length),
    width: Number(card.dataset.width),
    thickness: Number(card.dataset.thickness),
    nozzle: Number(card.dataset.nozzle),
    position: card.dataset.position,
    handle: card.dataset.handle === '1'
  }));
  if (!bags.length) return;
  const bagBox = document.getElementById('bag-options');
  const specList = document.getElementById('spec-list');
  const quoteBag = document.getElementById('q-bag');
  const state = {
    bag: bags[0].id,
    // Browsers restore checked radios on reload, so this is read from the DOM.
    sides: form.querySelector('[name=sides]:checked')?.value ?? 'curved'
  };
  const find = id => bags.find(bag => bag.id === id) ?? bags[0];
  const current = () => find(state.bag);

  function pill(name, value, label, checked) {
    const wrap = document.createElement('label'); wrap.className = 'pill';
    const input = document.createElement('input'); Object.assign(input, { type: 'radio', name, value, checked });
    const text = document.createElement('span'); text.textContent = label;
    wrap.append(input, text); return wrap;
  }
  bagBox.replaceChildren(...bags.map(bag => pill('bag', bag.id, bag.short, bag.id === state.bag)));

  quoteBag.replaceChildren(new Option('Not sure yet', ''), ...bags.map(bag => new Option(bag.name, bag.id)));

  function rows(bag) {
    return [
      ['Type', bag.name],
      ['Length', bag.length + ' mm'],
      ['Width', bag.width + ' mm'],
      ['Film thickness', bag.thickness + ' mic'],
      ['Nozzle diameter', bag.nozzle + ' mm'],
      ['Nozzle position', bag.position],
      ['Carry handle', bag.handle ? 'Yes' : 'No']
    ];
  }
  function pushToRenderer() {
    const bag = current();
    document.dispatchEvent(new CustomEvent('pouch:spec', { detail: {
      straightSides: state.sides === 'straight' ? 1 : 0,
      spout: bag.position.toLowerCase(),
      handle: bag.handle ? 'opposite' : 'none',
      bodyW: .8 + .2 * (bag.length / 140),
      bodyH: .8 + .2 * (bag.width / 230),
      spoutW: Math.min(1.3, 1 + (bag.nozzle - 10) * .03)
    } }));
  }
  function update() {
    const bag = current();
    document.getElementById('spec-title').textContent = bag.name;
    specList.replaceChildren();
    rows(bag).forEach(([term, value]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = term; dd.textContent = value;
      if (term === 'Nozzle diameter') dd.className = 'is-accent';
      specList.append(dt, dd);
    });
    pushToRenderer();
  }
  function select(id) {
    state.bag = find(id).id;
    const input = bagBox.querySelector(`[value="${state.bag}"]`);
    if (input) input.checked = true;
    update();
  }

  form.addEventListener('change', event => {
    const input = event.target;
    if (input.name === 'bag') state.bag = input.value;
    else if (input.name === 'sides') state.sides = input.value;
    else return;
    update();
  });
  document.querySelectorAll('[data-bag-link]').forEach(link => link.addEventListener('click', () => select(link.dataset.bagLink)));
  document.querySelectorAll('[data-ask]').forEach(link => link.addEventListener('click', () => {
    quoteBag.value = link.dataset.ask;
    quoteBag.dispatchEvent(new Event('change', { bubbles: true }));
  }));

  function buildText() {
    const bag = current();
    return `REPACK — ${bag.name}\n` + rows(bag).map(row => row.join(': ')).join('\n') +
      '\n\nSpecifications as listed by REPACK. Contact our team to confirm availability and quantities.\n' +
      'REPACK Packaging · rkkadm@gmail.com · +62 816-1152-204 · Mon – Sat: 8:30 AM – 4:00 PM\n';
  }
  document.getElementById('use-spec').addEventListener('click', () => {
    quoteBag.value = state.bag;
    quoteBag.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('quote').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    document.getElementById('q-product').focus({ preventScroll: true });
  });
  document.getElementById('download-build').addEventListener('click', () => window.Repack.download(`repack-${current().id}-specs.txt`, buildText()));

  update();
  window.addEventListener('load', pushToRenderer);
})();
