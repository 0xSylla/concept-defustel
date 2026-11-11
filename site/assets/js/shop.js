/* DEFUSTEL — panier de démonstration (aucun paiement ; contenu gardé dans le navigateur, commun aux pages)
   Catalogue : window.DEFUSTEL_PRODUCTS (assets/js/products.js) ; langue et devise : DEFUSTEL_PREFS (prefs.js) */
(function () {
  const KEY = 'defustel-panier';
  const $ = id => document.getElementById(id);
  const cart = $('cart'), backdrop = $('cart-backdrop'), toggle = $('cart-toggle');
  const P = window.DEFUSTEL_PREFS;
  const { t } = P;
  const products = {};
  (window.DEFUSTEL_PRODUCTS || []).forEach(p => { products[p.id] = p; });
  // écrans tactiles : un toucher sur la photo alterne porté / produit seul
  if (matchMedia('(hover: none)').matches) {
    document.querySelectorAll('.product__media').forEach(m => m.addEventListener('click', () => m.classList.toggle('is-alt')));
  }

  let items = {};
  try { items = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { items = {}; }
  for (const id in items) if (!products[id]) delete items[id];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* stockage indisponible : panier de session */ } };

  function render() {
    const ids = Object.keys(items);
    const count = ids.reduce((s, id) => s + items[id], 0);
    $('cart-count').textContent = count;
    $('cart-count').hidden = count === 0;
    toggle.setAttribute('aria-label', count ? `${t('Panier')}, ${count} ${t(count > 1 ? 'articles' : 'article')}` : t('Panier vide'));
    $('cart-empty').hidden = ids.length > 0;
    $('cart-foot').hidden = ids.length === 0;
    $('cart-total').textContent = P.money(ids.reduce((s, id) => s + items[id] * P.amount(products[id]), 0));
    $('cart-items').innerHTML = ids.map(id => {
      const p = products[id], name = P.productName(p);
      return `<li class="cart-item" data-id="${id}">
        <img alt="" height="100" src="assets/img/shop/${id}-seul.webp" width="80">
        <div class="cart-item__info">
          <p class="cart-item__name">${name}</p>
          <p class="cart-item__price">${P.price(p)}</p>
          <div class="qty">
            <button aria-label="${t('Retirer un')} ${name}" data-step="-1" type="button">−</button>
            <span aria-live="polite">${items[id]}</span>
            <button aria-label="${t('Ajouter un')} ${name}" data-step="1" type="button">+</button>
          </div>
        </div>
        <button class="cart-item__remove" data-remove type="button">${t('Retirer')}</button>
      </li>`;
    }).join('');
  }

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    $('cart-done').hidden = true;
    cart.hidden = backdrop.hidden = false;
    requestAnimationFrame(() => document.body.classList.add('cart-open'));
    toggle.setAttribute('aria-expanded', 'true');
    cart.focus();
  }
  function close() {
    document.body.classList.remove('cart-open');
    toggle.setAttribute('aria-expanded', 'false');
    setTimeout(() => { cart.hidden = backdrop.hidden = true; }, 450);
    if (lastFocus) lastFocus.focus();
  }

  // délégation : fonctionne aussi pour les cartes créées par la page « Nos accessoires »
  document.addEventListener('click', e => {
    const btn = e.target.closest('.product__add');
    if (!btn) return;
    const id = btn.closest('[data-id]').dataset.id;
    if (!products[id]) return;
    items[id] = (items[id] || 0) + 1;
    save(); render();
    btn.textContent = t('Ajouté ✓');
    setTimeout(() => { btn.textContent = t('Ajouter au panier'); }, 1400);
    const name = P.productName(products[id]);
    notify(P.lang === 'en' ? `“${name}” added to your bag` : `« ${name} » ajouté au panier`);
  });

  // message d'ajout (comme Belle Nubian) ; le panier s'ouvre depuis le sac ou depuis « Voir »
  let toast = null, toastTimer = null;
  function notify(message) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<span></span><button type="button"></button>';
      toast.querySelector('button').addEventListener('click', () => { toast.classList.remove('is-on'); open(); });
      document.body.appendChild(toast);
    }
    toast.querySelector('span').textContent = message;
    toast.querySelector('button').textContent = t('Voir le panier');
    requestAnimationFrame(() => toast.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 3200);
  }
  $('cart-items').addEventListener('click', e => {
    const li = e.target.closest('.cart-item');
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.dataset.step) items[id] += +e.target.dataset.step;
    if ('remove' in e.target.dataset || items[id] <= 0) delete items[id];
    save(); render();
  });
  $('cart-checkout').addEventListener('click', () => {
    items = {}; save(); render();
    $('cart-empty').hidden = true;
    $('cart-done').hidden = false;
  });
  toggle.addEventListener('click', open);
  $('cart-close').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !cart.hidden) close(); });

  P.onChange(render);   // langue ou devise changée
  render();
})();
