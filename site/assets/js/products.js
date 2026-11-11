/*
 * Catalogue DEFUSTEL (démonstration) — utilisé par la page d'accueil, la page « Nos accessoires » et le panier.
 * TODO : prix provisoires, un par devise (XOF = FCFA, EUR, USD) ; boutons nacre retirés en attendant un packshot fond sombre.
 *   id    : identifiant ; images : assets/img/shop/<id>-seul.webp (packshot fond sombre : page accessoires, panier, survol)
 *           et, pour les pièces de l'accueil, <id>-porte.webp (porté)
 *   name / meta : français ; name_en / meta_en : anglais
 *   cat   : clé de DEFUSTEL_FILTERS.cat ; color : clé de DEFUSTEL_FILTERS.color
 *   rank  : ordre « Mis en avant » ; added : ordre d'arrivée (plus grand = plus récent)
 */
window.DEFUSTEL_FILTERS = {
  cat: { label: 'Catégorie', options: { cravates: 'Cravates & nœuds', chaussettes: 'Chaussettes', pochettes: 'Pochettes', manchettes: 'Boutons de manchette', ceintures: 'Ceintures' } },
  color: { label: 'Couleur', options: { noir: 'Noir', nuit: 'Bleu nuit', bordeaux: 'Bordeaux', gris: 'Gris', ivoire: 'Ivoire', cognac: 'Cognac' } },
  // tranches de prix : bornes par devise (libellés construits par collection.js)
  price: { label: 'Prix', options: { bas: '', moyen: '', haut: '' }, bounds: { XOF: [30000, 65000], EUR: [45, 100], USD: [50, 110] } },
};

window.DEFUSTEL_PRODUCTS = [
  { id: 'cravate', name: 'La Cravate Minuit', name_en: 'The Midnight Tie', meta: 'Soie noire tissée', meta_en: 'Woven black silk',
    price: { XOF: 62000, EUR: 95, USD: 105 }, cat: 'cravates', color: 'noir', rank: 1, added: 1 },
  { id: 'chaussettes', name: 'Les Chaussettes Nuit', name_en: 'The Midnight Socks', meta: "Fil d'Écosse · bleu nuit · mi-mollet", meta_en: 'Lisle cotton · midnight navy · mid-calf',
    price: { XOF: 19000, EUR: 29, USD: 32 }, cat: 'chaussettes', color: 'nuit', rank: 2, added: 2 },
  { id: 'pochette', name: 'La Pochette Ivoire', name_en: 'The Ivory Pocket Square', meta: 'Soie ivoire · bords roulés main', meta_en: 'Ivory silk · hand-rolled edges',
    price: { XOF: 29500, EUR: 45, USD: 49 }, cat: 'pochettes', color: 'ivoire', rank: 3, added: 3 },
  { id: 'manchettes', name: 'Les Boutons Onyx', name_en: 'The Onyx Cufflinks', meta: 'Onyx et laiton vieilli', meta_en: 'Onyx and aged brass',
    price: { XOF: 78500, EUR: 120, USD: 130 }, cat: 'manchettes', color: 'noir', rank: 4, added: 4 },
  { id: 'ceinture', name: 'La Ceinture Atelier', name_en: 'The Atelier Belt', meta: 'Veau noir · boucle laiton brossé', meta_en: 'Black calfskin · brushed brass buckle',
    price: { XOF: 72000, EUR: 110, USD: 120 }, cat: 'ceintures', color: 'noir', rank: 5, added: 5 },
  { id: 'noeud', name: 'Le Nœud Soirée', name_en: 'The Evening Bow Tie', meta: 'Soie noire · à nouer', meta_en: 'Black silk · self-tie',
    price: { XOF: 49000, EUR: 75, USD: 85 }, cat: 'cravates', color: 'noir', rank: 6, added: 6 },
  { id: 'cravate-bordeaux', name: 'La Cravate Grenadine', name_en: 'The Grenadine Tie', meta: 'Grenadine de soie bordeaux', meta_en: 'Burgundy silk grenadine',
    price: { XOF: 72000, EUR: 110, USD: 120 }, cat: 'cravates', color: 'bordeaux', rank: 7, added: 12 },
  { id: 'chaussettes-bordeaux', name: 'Les Chaussettes Bordeaux', name_en: 'The Burgundy Socks', meta: "Fil d'Écosse · bordeaux · mi-mollet", meta_en: 'Lisle cotton · burgundy · mid-calf',
    price: { XOF: 19000, EUR: 29, USD: 32 }, cat: 'chaussettes', color: 'bordeaux', rank: 8, added: 11 },
  { id: 'pochette-nuit', name: 'La Pochette Nuit', name_en: 'The Midnight Pocket Square', meta: 'Soie bleu nuit · bords roulés main', meta_en: 'Midnight navy silk · hand-rolled edges',
    price: { XOF: 29500, EUR: 45, USD: 49 }, cat: 'pochettes', color: 'nuit', rank: 9, added: 10 },
  { id: 'ceinture-cognac', name: 'La Ceinture Cognac', name_en: 'The Cognac Belt', meta: 'Daim cognac · boucle laiton brossé', meta_en: 'Cognac suede · brushed brass buckle',
    price: { XOF: 78500, EUR: 120, USD: 130 }, cat: 'ceintures', color: 'cognac', rank: 11, added: 8 },
  { id: 'chaussettes-gris', name: 'Les Chaussettes Anthracite', name_en: 'The Charcoal Socks', meta: "Fil d'Écosse · gris anthracite · mi-mollet", meta_en: 'Lisle cotton · charcoal grey · mid-calf',
    price: { XOF: 19000, EUR: 29, USD: 32 }, cat: 'chaussettes', color: 'gris', rank: 12, added: 7 },
];
