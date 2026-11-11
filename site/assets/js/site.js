/* DEFUSTEL — en-tête (menu mobile), formulaire de rendez-vous, année */
(function () {
  const P = window.DEFUSTEL_PREFS;
  const t = P ? P.t : s => s;
  document.getElementById('year').textContent = new Date().getFullYear();

  /* Menu mobile (≤ 900 px) : plein écran, se ferme au choix d'un lien, à Échap ou au bouton */
  const menu = document.getElementById('mobile-menu');
  const menuBtn = document.getElementById('menu-toggle');
  const menuOpen = () => document.body.classList.contains('menu-open');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', t(open ? 'Fermer le menu' : 'Ouvrir le menu'));
    if (open) { menu.hidden = false; menu.querySelector('a').focus(); }
    else setTimeout(() => { if (!menuOpen()) menu.hidden = true; }, 400);
  }
  const menuLabel = () => menuBtn.setAttribute('aria-label', t(menuOpen() ? 'Fermer le menu' : 'Ouvrir le menu'));
  menuLabel();
  if (P) P.onChange(menuLabel);
  menuBtn.addEventListener('click', () => setMenu(!menuOpen()));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen()) { setMenu(false); menuBtn.focus(); } });
  matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches && menuOpen()) setMenu(false); });

  /* En-tête : fond plein au-dessus du texte ; ne se cache que pendant le film */
  const header = document.getElementById('site-header');
  // fond plein dès que l'en-tête passe au-dessus du texte : toujours sur la boutique, après le film sur l'accueil
  const scene = document.getElementById('scene');
  const solidFrom = () => (scene ? scene.offsetTop + scene.offsetHeight - header.offsetHeight : 0);
  let lastY = window.scrollY;
  function onScroll() {
    const y = window.scrollY;
    const solid = y >= solidFrom();
    header.classList.toggle('is-solid', solid);
    // pendant le film seulement : l'en-tête s'efface en descendant ; au-dessus du texte il reste visible
    header.classList.toggle('is-hidden', !menuOpen() && !solid && y > 120 && y > lastY);
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Formulaire — TODO : envoyer vers un vrai service (Formspree, Calendly, CRM…) */
  const form = document.getElementById('rdv-form');
  const error = document.getElementById('rdv-error');
  const success = document.getElementById('rdv-success');
  if (!form) return;                                 // pages sans formulaire (accessoires)
  const places = form.querySelector('.places');
  form.addEventListener('input', e => e.target.removeAttribute('aria-invalid'));
  form.addEventListener('change', e => { if (e.target.name === 'boutique') { places.removeAttribute('aria-invalid'); error.textContent = ''; } });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const place = form.querySelector('input[name="boutique"]:checked');
    places.setAttribute('aria-invalid', place ? 'false' : 'true');
    let first = place ? null : form.querySelector('input[name="boutique"]');
    form.querySelectorAll('input[required]:not([type="radio"])').forEach(f => {
      const ok = f.checkValidity() && f.value.trim() !== '';
      f.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !first) first = f;
    });
    if (first) {
      error.textContent = t(!place ? 'Choisissez la boutique où vous souhaitez être reçu.'
        : first.type === 'email' && first.value ? 'Cette adresse e-mail ne semble pas valide.'
        : 'Merci de renseigner votre nom et votre e-mail.');
      first.focus();
      return;
    }
    error.textContent = '';
    document.getElementById('rdv-success-text').textContent = P && P.lang === 'en'
      ? `Our ${place.value} boutique will get back to you very soon to arrange your first appointment.`
      : `Notre boutique ${/^[aeiouyh]/i.test(place.value) ? "d'" : 'de '}${place.value} revient vers vous très vite pour convenir de votre premier rendez-vous.`;
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });
})();
