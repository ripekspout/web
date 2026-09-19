/* Spec configurator. Drives the recommended build sheet, reshapes the
   background pouch, and hands the result to the quote form.

   NOTE: film structures, spout diameters and closures below are standard
   flexible-packaging values used as sensible defaults. MOQ and lead time are
   bracketed placeholders. Replace the whole table with real capability data
   before this goes live. */
(function () {
  var form = document.getElementById('config-form');
  if (!form) return;

  var INDUSTRIES = {
    food: {
      label: 'Food & Beverage',
      products: {
        sauce: {
          label: 'Sauce & Condiment',
          film: 'PET / AL / PE', barrier: 'Full oxygen + light barrier',
          spout: 10, closure: 'Tamper-evident screw cap', fill: 'Hot fill to 92°C'
        },
        juice: {
          label: 'Juice & Beverage',
          film: 'PET / MET-PET / PE', barrier: 'Oxygen + UV barrier',
          spout: 8.6, closure: 'Flip-top screw cap', fill: 'Cold fill / pasteurised'
        },
        oil: {
          label: 'Oil & Dressing',
          film: 'PET / AL / PE', barrier: 'Full oxygen + light barrier',
          spout: 10, closure: 'Tamper-evident screw cap', fill: 'Cold fill'
        },
        puree: {
          label: 'Purée & Baby Food',
          film: 'PET / AL / PP', barrier: 'Retort-grade full barrier',
          spout: 8.6, closure: 'Child-safe screw cap', fill: 'Retort to 121°C'
        }
      }
    },
    beauty: {
      label: 'Fashion & Beauty',
      products: {
        lotion: {
          label: 'Lotion & Cream',
          film: 'PET / MET-PET / PE', barrier: 'Moisture + light barrier',
          spout: 10, closure: 'Flip-top cap', fill: 'Cold fill'
        },
        serum: {
          label: 'Serum & Face Oil',
          film: 'PET / AL / PE', barrier: 'Full light barrier',
          spout: 8.6, closure: 'Precision dropper cap', fill: 'Cold fill'
        },
        wash: {
          label: 'Shampoo & Body Wash',
          film: 'PET / PE', barrier: 'Moisture barrier',
          spout: 15, closure: 'Wide-neck screw cap', fill: 'Cold fill'
        },
        refill: {
          label: 'Refill Pack',
          film: 'Mono-PE (recyclable)', barrier: 'Moisture barrier',
          spout: 10, closure: 'Screw cap', fill: 'Cold fill'
        }
      }
    }
  };

  /* These scale the real model, so they are a visual hint that the build
     changed — not a dimensional simulation. Pushed further apart, the spout
     stops reading as welded to the shoulder. */
  var VOLUMES = [
    { id: '100',  label: '100 ml', w: 0.88, h: 0.90, moq: '[10,000]' },
    { id: '250',  label: '250 ml', w: 0.94, h: 0.95, moq: '[7,500]' },
    { id: '500',  label: '500 ml', w: 1.00, h: 1.00, moq: '[5,000]' },
    { id: '1000', label: '1 L',    w: 1.07, h: 1.06, moq: '[5,000]' },
    { id: '3000', label: '3 L',    w: 1.14, h: 1.12, moq: '[3,000]' }
  ];

  var SPOUT_SCALE = { 8.6: 0.92, 10: 1, 15: 1.15 };

  var productBox = document.getElementById('product-options');
  var volumeBox = document.getElementById('volume-options');
  var specList = document.getElementById('spec-list');
  var specTitle = document.getElementById('spec-title');
  var useSpec = document.getElementById('use-spec');

  var state = { industry: 'food', product: 'sauce', volume: '500' };

  function pill(name, value, label, checked) {
    var wrap = document.createElement('label');
    wrap.className = 'pill';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    if (checked) input.checked = true;
    var text = document.createElement('span');
    text.textContent = label;
    wrap.appendChild(input);
    wrap.appendChild(text);
    return wrap;
  }

  function renderProducts() {
    var products = INDUSTRIES[state.industry].products;
    var keys = Object.keys(products);
    if (keys.indexOf(state.product) === -1) state.product = keys[0];
    productBox.textContent = '';
    keys.forEach(function (key) {
      productBox.appendChild(pill('product', key, products[key].label, key === state.product));
    });
  }

  function renderVolumes() {
    volumeBox.textContent = '';
    VOLUMES.forEach(function (v) {
      volumeBox.appendChild(pill('volume', v.id, v.label, v.id === state.volume));
    });
  }

  function currentSpec() {
    var product = INDUSTRIES[state.industry].products[state.product];
    var volume = VOLUMES.filter(function (v) { return v.id === state.volume; })[0];
    return { product: product, volume: volume };
  }

  function row(term, value, accent) {
    var dt = document.createElement('dt');
    dt.textContent = term;
    var dd = document.createElement('dd');
    dd.textContent = value;
    if (accent) dd.className = 'is-accent';
    specList.appendChild(dt);
    specList.appendChild(dd);
  }

  function renderSpec() {
    var spec = currentSpec();
    specTitle.textContent = spec.product.label + ' — ' + spec.volume.label;
    specList.textContent = '';
    row('Format', 'Stand-up, bottom gusset');
    row('Film structure', spec.product.film);
    row('Barrier', spec.product.barrier);
    row('Spout diameter', spec.product.spout + ' mm', true);
    row('Closure', spec.product.closure);
    row('Fill method', spec.product.fill);
    row('Minimum order', spec.volume.moq);
    row('Lead time', '[2–3 weeks]');
  }

  function pushToRenderer() {
    var spec = currentSpec();
    document.dispatchEvent(new CustomEvent('pouch:spec', {
      detail: {
        bodyW: spec.volume.w,
        bodyH: spec.volume.h,
        spoutW: SPOUT_SCALE[spec.product.spout] || 1
      }
    }));
  }

  function update() {
    renderSpec();
    pushToRenderer();
  }

  form.addEventListener('change', function (event) {
    var input = event.target;
    if (!input.name || !state.hasOwnProperty(input.name)) return;
    state[input.name] = input.value;
    if (input.name === 'industry') renderProducts();
    update();
  });

  useSpec.addEventListener('click', function () {
    var spec = currentSpec();
    var quote = document.getElementById('quote');
    var industry = document.getElementById('q-industry');
    var product = document.getElementById('q-product');
    var volume = document.getElementById('q-volume');
    var details = document.getElementById('q-details');

    if (industry) industry.value = state.industry;
    if (product) product.value = spec.product.label;
    if (volume) volume.value = spec.volume.label;
    if (details) {
      details.value =
        'Configured build:\n' +
        '· Format: Stand-up, bottom gusset\n' +
        '· Film: ' + spec.product.film + ' (' + spec.product.barrier + ')\n' +
        '· Spout: ' + spec.product.spout + ' mm, ' + spec.product.closure + '\n' +
        '· Fill: ' + spec.product.fill;
    }
    if (quote) quote.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Browsers restore checked radios across reloads, so trust the DOM over the default.
  var restored = form.querySelector('input[name="industry"]:checked');
  if (restored && INDUSTRIES[restored.value]) state.industry = restored.value;

  renderProducts();
  renderVolumes();
  update();

  /* orbit.js is a module, so it is deferred and misses the dispatch above.
     Re-send once everything has loaded so the model matches the build sheet. */
  window.addEventListener('load', pushToRenderer);
})();
