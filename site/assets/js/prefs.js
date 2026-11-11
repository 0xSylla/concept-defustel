/*
 * DEFUSTEL — langue (français / anglais) et devise (FCFA / euro / dollar), communes à toutes les pages.
 *
 * - Choix gardés dans le navigateur ; lien direct possible : ?lang=en&devise=EUR
 * - Textes de la page : chaque texte français (nœud de texte, alt, aria-label, placeholder, meta, titre)
 *   est remplacé par sa version de DEFUSTEL_EN ; le français d'origine est conservé pour revenir en arrière.
 *   Les zones construites par les scripts (data-i18n-skip) se traduisent elles-mêmes avec t().
 * - Prix : éléments [data-price-for="<id produit>"] ; money() / price() pour les scripts.
 * - Les scripts s'abonnent avec onChange() pour se redessiner.
 */
window.DEFUSTEL_PREFS = (function () {
  const KEY = 'defustel-prefs';
  const LANGS = ['fr', 'en'];
  const CURRENCIES = { XOF: 'FCFA', EUR: '€', USD: '$' };
  const EN = Object.assign({}, window.DEFUSTEL_EN || {});
  const PRODUCTS = window.DEFUSTEL_PRODUCTS || [];
  PRODUCTS.forEach(p => { EN[p.name] = p.name_en; EN[p.meta] = p.meta_en; });

  const norm = s => s.replace(/\s+/g, ' ').trim();
  let state = { lang: 'fr', cur: 'XOF' };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* stockage indisponible */ }
  const q = new URLSearchParams(location.search);
  if (LANGS.includes(q.get('lang'))) state.lang = q.get('lang');
  if ((q.get('devise') || '').toUpperCase() in CURRENCIES) state.cur = q.get('devise').toUpperCase();
  if (!LANGS.includes(state.lang)) state.lang = 'fr';
  if (!(state.cur in CURRENCIES)) state.cur = 'XOF';

  const t = fr => (state.lang === 'en' ? (EN[norm(fr)] ?? fr) : fr);
  const locale = () => (state.lang === 'en' ? 'en-US' : 'fr-FR');

  function money(value, cur = state.cur) {
    if (cur === 'XOF') return value.toLocaleString(locale()) + ' FCFA';
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(value);
  }
  const amount = p => p.price[state.cur];
  const price = p => money(amount(p));
  const productName = p => (state.lang === 'en' ? p.name_en : p.name);
  const productMeta = p => (state.lang === 'en' ? p.meta_en : p.meta);

  /* ---------- textes de la page ---------- */
  const ATTRS = ['alt', 'aria-label', 'placeholder'];
  const textNodes = [];   // [nœud, texte français d'origine]
  const attrs = [];       // [élément, attribut, valeur française]
  function collect() {
    const skip = el => el.closest('script, style, [data-i18n-skip], [data-price-for]');
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => (skip(n.parentElement) || !norm(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n;
    while ((n = w.nextNode())) if (EN[norm(n.nodeValue)] !== undefined) textNodes.push([n, n.nodeValue]);
    document.querySelectorAll(ATTRS.map(a => `[${a}]`).join(',')).forEach(el => {
      if (skip(el)) return;
      ATTRS.forEach(a => { const v = el.getAttribute(a); if (v && EN[norm(v)] !== undefined) attrs.push([el, a, v]); });
    });
    document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"]').forEach(el => attrs.push([el, 'content', el.getAttribute('content')]));
  }
  const frTitle = document.title;

  function apply() {
    document.documentElement.lang = state.lang;
    textNodes.forEach(([node, fr]) => {
      const lead = fr.match(/^\s*/)[0], trail = fr.match(/\s*$/)[0];
      node.nodeValue = state.lang === 'en' ? lead + t(fr) + trail : fr;
    });
    attrs.forEach(([el, a, fr]) => el.setAttribute(a, t(fr)));
    document.title = t(frTitle);
    document.querySelectorAll('[data-price-for]').forEach(el => {
      const p = PRODUCTS.find(x => x.id === el.dataset.priceFor);
      if (p) el.textContent = price(p);
    });
    renderSwitcher();
  }

  /* ---------- sélecteur (panneau de l'en-tête ; menu mobile sous 900 px) ---------- */
  const toggle = document.getElementById('prefs-toggle');
  const panel = document.getElementById('prefs-panel');
  const header = document.getElementById('site-header');
  function renderSwitcher() {
    if (!toggle) return;
    document.getElementById('prefs-label').textContent = `${state.lang.toUpperCase()} · ${CURRENCIES[state.cur]}`;
    toggle.setAttribute('aria-label', `${t('Langue et devise')} : ${state.lang.toUpperCase()}, ${CURRENCIES[state.cur]}`);
    // boutons du panneau de l'en-tête et du menu mobile
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    document.querySelectorAll('[data-cur]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cur === state.cur)));
  }
  function openPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    header.classList.toggle('prefs-open', open);
  }
  if (toggle) {
    toggle.addEventListener('click', e => { e.stopPropagation(); openPanel(panel.hidden); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { openPanel(false); toggle.focus(); } });
  }
  // choix depuis l'en-tête (panneau) ou depuis le menu mobile ; un clic ailleurs ferme le panneau
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lang], [data-cur]');
    if (b) {
      if (b.dataset.lang) set('lang', b.dataset.lang);
      if (b.dataset.cur) set('cur', b.dataset.cur);
    } else if (panel && !panel.hidden && !panel.contains(e.target)) openPanel(false);
  });

  /* ---------- changements ---------- */
  const listeners = [];
  function set(key, value) {
    if (state[key] === value) return;
    state[key] = value;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* stockage indisponible */ }
    apply();
    listeners.forEach(fn => fn(state));
  }

  collect();
  apply();
  return {
    get lang() { return state.lang; },
    get cur() { return state.cur; },
    t, money, amount, price, productName, productMeta, set,
    onChange(fn) { listeners.push(fn); },
  };
})();
