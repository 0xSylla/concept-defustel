# MASSIRI — Maison de tailleur

Site vitrine en une page : le film « Du fil à l'homme » piloté par le défilement,
puis La maison, La collection et Prendre rendez-vous.

## Structure
- `index.html` : la page
- `assets/css/massiri.css` : styles (noir encre, ivoire, or vieilli)
- `assets/js/film.js` : le montage du film (GSAP + ScrollTrigger) — découpage dans `PLANS` / `ACTS`
- `assets/js/site.js` : header, formulaire de rendez-vous, année
- `assets/vendor/` : GSAP 3.12.5 (local)
- `assets/img/` : visuels web générés par `scripts/build-images.cjs` (ne pas éditer à la main)
- `shots/` : plans originaux 2752×1536 générés par IA (les `.vN` sont des versions écartées)
- `references/tailleur.png` : photo de référence du tailleur

## Scripts
```bash
npm install
node scripts/generate-shots.cjs 03      # régénère un plan via AIML API (AIMLAPI_KEY requis)
node scripts/build-images.cjs           # reconstruit assets/img/ (découpes mobile, étalonnage, calques)
python -m http.server 8090              # aperçu local : http://127.0.0.1:8090
```

## Comportements
- Sans JavaScript ou avec « réduire les animations », le film s'affiche en plans légendés empilés.
- Mobile : chaque plan utilise une découpe 9:16 centrée sur son sujet (`focus` dans `build-images.cjs`).

## À faire avant mise en ligne
- Relier le formulaire de rendez-vous (Formspree, Calendly, CRM…) — voir TODO dans `index.html` / `site.js`.
- Faire valider les affirmations de savoir-faire (entoilage cousu, patron conservé…).
- `og:image` en URL absolue une fois le domaine connu.
