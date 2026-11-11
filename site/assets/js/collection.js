/* DEFUSTEL — page « Nos accessoires » : filtres (catégorie, couleur, prix), tri, filtres actifs, tiroir mobile.
   Données : window.DEFUSTEL_PRODUCTS / DEFUSTEL_FILTERS (assets/js/products.js) ; langue et devise : DEFUSTEL_PREFS (prefs.js).
   Lien direct possible : accessoires.html?cat=chaussettes */
(function () {
  const PRODUCTS = window.DEFUSTEL_PRODUCTS || [];
  const FILTERS = window.DEFUSTEL_FILTERS || {};
  const KEYS = Object.keys(FILTERS);
  const $ = id => document.getElementById(id);
  const P = window.DEFUSTEL_PREFS;
  const { t } = P;
  // tranche de prix dans la devise affichée (bornes par devise dans products.js)
  const bounds = () => FILTERS.price.bounds[P.cur];
  const priceBand = p => { const [a, b] = bounds(), v = P.amount(p); return v <= a ? 'bas' : v <= b ? 'moyen' : 'haut'; };
  const valueOf = (p, key) => (key === 'price' ? priceBand(p) : p[key]);
  function optionLabel(key, v) {
    if (key !== 'price') return t(FILTERS[key].options[v]);
    const [a, b] = bounds();
    return { bas: `${t("Jusqu'à")} ${P.money(a)}`, moyen: `${t('De')} ${P.money(a)} ${t('à')} ${P.money(b)}`, haut: `${t('Plus de')} ${P.money(b)}` }[v];
  }

  const SORTS = {
    featured: ['Mis en avant', (a, b) => a.rank - b.rank],
    newest: ['Nouveautés', (a, b) => b.added - a.added],
    'price-asc': ['Prix croissant', (a, b) => P.amount(a) - P.amount(b) || a.rank - b.rank],
    'price-desc': ['Prix décroissant', (a, b) => P.amount(b) - P.amount(a) || a.rank - b.rank],
  };

  const state = { sort: 'featured' };
  KEYS.forEach(k => { state[k] = new Set(); });
  const params = new URLSearchParams(location.search);
  KEYS.forEach(k => (params.get(k) || '').split(',').filter(v => v in FILTERS[k].options).forEach(v => state[k].add(v)));
  if (params.get('sort') in SORTS) state.sort = params.get('sort');

  // un produit passe si, pour chaque filtre actif, sa valeur est cochée (on ignore le filtre « except » pour les compteurs)
  const matches = (p, except) => KEYS.every(k => k === except || !state[k].size || state[k].has(valueOf(p, k)));

  function syncUrl() {
    const q = new URLSearchParams(location.search);    // garde les autres paramètres (lang, devise, tournage…)
    KEYS.forEach(k => { if (state[k].size) q.set(k, [...state[k]].join(',')); else q.delete(k); });
    if (state.sort !== 'featured') q.set('sort', state.sort); else q.delete('sort');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
  }

  function renderFilters() {
    $('filters-form').innerHTML = KEYS.map(k => `
      <fieldset class="filter">
        <legend>${t(FILTERS[k].label)}</legend>
        ${Object.keys(FILTERS[k].options).map(v => {
          const n = PRODUCTS.filter(p => matches(p, k) && valueOf(p, k) === v).length;
          return `<label class="filter__opt${n ? '' : ' is-empty'}">
            <input ${state[k].has(v) ? 'checked' : ''} name="${k}" type="checkbox" value="${v}">
            <span>${optionLabel(k, v)}</span><span class="filter__n">${n}</span>
          </label>`;
        }).join('')}
      </fieldset>`).join('');
  }

  function renderChips() {
    const chips = [];
    KEYS.forEach(k => state[k].forEach(v => chips.push(
      `<button class="chip" data-key="${k}" data-value="${v}" type="button">${optionLabel(k, v)} <span aria-hidden="true">×</span><span class="sr-only">${t('(retirer)')}</span></button>`)));
    $('active-filters').hidden = !chips.length;
    $('active-filters').innerHTML = chips.join('') + (chips.length ? `<button class="chip chip--clear" data-clear type="button">${t('Tout effacer')}</button>` : '');
  }

  function cardHtml(p) {
    const name = P.productName(p), meta = P.productMeta(p);
    return `<li class="pcard" data-id="${p.id}">
      <div class="pcard__media"><img alt="${name}, ${meta}" height="1125" loading="lazy" src="assets/img/shop/${p.id}-seul.webp" width="900"></div>
      <div class="pcard__info">
        <div>
          <h2 class="pcard__name">${name}</h2>
          <p class="pcard__meta">${meta}</p>
        </div>
        <p class="pcard__price">${P.price(p)}</p>
      </div>
      <button class="product__add" type="button">${t('Ajouter au panier')}</button>
    </li>`;
  }

  function render() {
    const results = PRODUCTS.filter(p => matches(p)).sort(SORTS[state.sort][1]);
    $('product-grid').innerHTML = results.map(cardHtml).join('');
    $('empty-state').hidden = results.length > 0;
    $('collection-count').textContent = `${results.length} ${t(results.length > 1 ? 'articles' : 'article')}`;
    renderFilters();
    renderChips();
    syncUrl();
  }

  function clearAll() { KEYS.forEach(k => state[k].clear()); render(); }

  // tri
  function renderSort() {
    $('sort-select').innerHTML = Object.entries(SORTS).map(([v, [label]]) => `<option value="${v}">${t(label)}</option>`).join('');
    $('sort-select').value = state.sort;
  }
  renderSort();
  $('sort-select').addEventListener('change', e => { state.sort = e.target.value; render(); });

  // filtres
  $('filters-form').addEventListener('change', e => {
    const { name, value, checked } = e.target;
    state[name][checked ? 'add' : 'delete'](value);
    render();
  });
  $('active-filters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if ('clear' in chip.dataset) return clearAll();
    state[chip.dataset.key].delete(chip.dataset.value);
    render();
  });
  $('filters-clear').addEventListener('click', clearAll);
  $('empty-reset').addEventListener('click', clearAll);

  // tiroir des filtres (mobile)
  const backdrop = $('filters-backdrop'), openBtn = $('filters-open');
  function openFilters() {
    backdrop.hidden = false;
    document.body.classList.add('filters-open');
    openBtn.setAttribute('aria-expanded', 'true');
    $('filters-close').focus();
  }
  function closeFilters() {
    document.body.classList.remove('filters-open');
    backdrop.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.focus();
  }
  openBtn.addEventListener('click', openFilters);
  $('filters-close').addEventListener('click', closeFilters);
  $('filters-apply').addEventListener('click', closeFilters);
  backdrop.addEventListener('click', closeFilters);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('filters-open')) closeFilters(); });

  P.onChange(() => { renderSort(); render(); });   // langue ou devise changée
  render();
})();
