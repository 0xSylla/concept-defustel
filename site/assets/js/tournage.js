/*
 * Mode tournage : un appareil pilote le défilement, les autres suivent (même Wi-Fi).
 * Actif avec ?tournage=pilote ou ?tournage=suit (retenu ensuite pour tout l'onglet ; ?tournage=off pour sortir),
 * et avec scripts/serve_tournage.py
 * (canal /__sync). Sans ce paramètre, ce script ne fait rien.
 *
 * La position s'échange par section (film, la maison, rendez-vous…) et en proportion de la section :
 * l'ordinateur et le téléphone n'ont pas la même hauteur de page, mais restent au même endroit du site.
 * Le suiveur change aussi de page quand le pilote change de page.
 */
(function () {
  // le rôle reste attaché à l'onglet : les liens du site (Voir plus, La boutique…) ne portent pas le paramètre
  let role = new URLSearchParams(location.search).get('tournage');
  try {
    if (role === 'off') sessionStorage.removeItem('defustel-tournage');
    else if (role) sessionStorage.setItem('defustel-tournage', role);
    else role = sessionStorage.getItem('defustel-tournage');
  } catch (e) { /* stockage indisponible : seul le paramètre compte */ }
  if (role !== 'pilote' && role !== 'suit') return;

  const SECTIONS = ['#scene', '#maison', '#rendez-vous', '#shop', '#main', '.site-footer'];
  const anchors = () => SECTIONS.map(s => document.querySelector(s)).filter(Boolean);
  const top = el => el.getBoundingClientRect().top + scrollY;
  const page = location.pathname.endsWith('accessoires.html') ? 'accessoires.html' : 'index.html';

  function position() {
    const list = anchors();
    let a = list[0];
    list.forEach(el => { if (top(el) <= scrollY + 1) a = el; });
    const f = (scrollY - top(a)) / Math.max(1, a.offsetHeight);
    return { page, at: SECTIONS.find(s => document.querySelector(s) === a), f: Math.max(0, Math.min(1, f)) };
  }

  if (role === 'pilote') {
    let timer = null;
    const send = () => { timer = null; fetch('/__sync', { method: 'POST', body: JSON.stringify(position()), keepalive: true }).catch(() => {}); };
    addEventListener('scroll', () => { if (!timer) timer = setTimeout(send, 33); }, { passive: true });
    send();
    return;
  }

  // suiveur : rejoint la cible en douceur (le film garde son propre lissage)
  let target = null;
  const source = new EventSource('/__sync');
  source.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.page !== page) { location.href = d.page + '?tournage=suit' + (location.hash || ''); return; }
    const el = document.querySelector(d.at);
    if (el) target = top(el) + d.f * el.offsetHeight;
  };
  (function follow() {
    if (target !== null) {
      const y = scrollY + (target - scrollY) * 0.35;
      scrollTo(0, Math.abs(target - y) < 1 ? target : y);
    }
    requestAnimationFrame(follow);
  })();
})();
