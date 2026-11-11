/*
 * MASSIRI — prépare les visuels du site à partir des plans générés (shots/*.png).
 *   assets/img/plan-XX.webp     1920 px de large (écrans paysage)
 *   assets/img/plan-XX-m.webp   découpe verticale 9:16 centrée sur le point d'intérêt (mobile)
 *   assets/img/affiche-*.webp   affiches 4:5 de la section Collection
 * Usage : node scripts/build-images.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img');
fs.mkdirSync(OUT, { recursive: true });

// focus = position horizontale (0 → 1) du sujet, pour la découpe verticale mobile
const PLANS = {
  '01': { focus: 0.5 },
  '02': { focus: 0.62 },
  '03': { focus: 0.56 },
  '04': { focus: 0.48 },
  '05': { focus: 0.6 },
  '06a': { focus: 0.5 },
  '06b': { focus: 0.5 },
  '06c': { focus: 0.5 },
  '06d': { focus: 0.5 },
  '06e': { focus: 0.5 },
  '07': { focus: 0.3 }, // le miroir : les deux visages
  '08': { focus: 0.5, night: true },
};

// Affiches de la collection : plan source, centre horizontal, centre vertical de la découpe 4:5
const POSTERS = {
  'trois-pieces': { src: '08', fx: 0.5, fy: 0.5 },
  'veste': { src: '06e', fx: 0.5, fy: 0.5 },
  'essayage': { src: '07', fx: 0.3, fy: 0.5 },
};

// Étalonnage « nuit » du plan 08 : ombres vers le bleu nuit, lumières dorées préservées
function nightGrade(img) {
  return img.recomb([
    [0.86, 0.04, 0.0],
    [0.0, 0.94, 0.04],
    [0.04, 0.08, 1.1],
  ]).modulate({ saturation: 0.95 });
}

// Calques de l'assemblage (fusion « screen ») : le fond doit être d'un noir absolu,
// sinon ses gris très sombres éclaircissent l'image et révèlent le cadre du calque.
const LAYERS = ['06a', '06b', '06c', '06d', '06e'];
const BLACK_POINT = 26; // valeurs ≤ 26 ramenées à 0

// La manche (06b) touche le haut du cadre d'origine : fondu plus serré pour elle
const FEATHER = { default: { r: 62, solid: 62 }, '06b': { r: 50, solid: 55 } };

async function crushToBlack(img, id) {
  const gain = 255 / (255 - BLACK_POINT);
  const buf = await img.linear(gain, -BLACK_POINT * gain).png().toBuffer();
  const { width, height } = await sharp(buf).metadata();
  const f = FEATHER[id] || FEATHER.default;
  // fondu radial vers le noir sur les bords du cadre
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><defs><radialGradient id="g" cx="50%" cy="50%" r="${f.r}%">` +
    `<stop offset="${f.solid}%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></radialGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  return sharp(buf).composite([{ input: await sharp(mask).png().toBuffer(), blend: 'multiply' }]);
}

async function load(id) {
  let img = sharp(path.join(ROOT, 'shots', `${id}.png`));
  if (PLANS[id]?.night) img = nightGrade(img);
  if (LAYERS.includes(id)) img = await crushToBlack(img, id);
  return sharp(await img.png().toBuffer());
}

function cropBox(meta, ratio, fx, fy = 0.5) {
  // plus grande découpe au ratio voulu, centrée sur (fx, fy), sans sortir de l'image
  let h = meta.height, w = Math.round(h * ratio);
  if (w > meta.width) { w = meta.width; h = Math.round(w / ratio); }
  const left = Math.min(Math.max(Math.round(fx * meta.width - w / 2), 0), meta.width - w);
  const top = Math.min(Math.max(Math.round(fy * meta.height - h / 2), 0), meta.height - h);
  return { left, top, width: w, height: h };
}

(async () => {
  for (const [id, { focus }] of Object.entries(PLANS)) {
    const img = await load(id);
    const meta = await img.metadata();
    await img.clone().resize({ width: 1920 }).webp({ quality: 80 }).toFile(path.join(OUT, `plan-${id}.webp`));
    await img.clone().extract(cropBox(meta, 9 / 16, focus)).resize({ width: 864 }).webp({ quality: 80 }).toFile(path.join(OUT, `plan-${id}-m.webp`));
  }
  for (const [name, { src, fx, fy }] of Object.entries(POSTERS)) {
    const img = await load(src);
    const meta = await img.metadata();
    await img.extract(cropBox(meta, 4 / 5, fx, fy)).resize({ width: 1000 }).webp({ quality: 82 }).toFile(path.join(OUT, `affiche-${name}.webp`));
  }
  const files = fs.readdirSync(OUT);
  const total = files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`${files.length} fichiers, ${Math.round(total / 1024)} Ko au total`);
})();
