/*
 * Recolore la peau (mains, cou, mâchoire) d'une séquence d'images vers une carnation cible,
 * sans IA : détection de la peau par sa couleur (espace YCbCr), masque adouci, puis
 * remplacement de la teinte en conservant les ombres et lumières d'origine.
 * Traitement identique sur chaque image → aucun scintillement.
 *
 * Usage : node scripts/recolor-skin.cjs <dossier source> <dossier sortie> <premier> <dernier> [--mask]
 *   --mask : écrit aussi le masque de peau (contrôle)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [SRC, OUT, FIRST, LAST] = process.argv.slice(2);
const WITH_MASK = process.argv.includes('--mask');
const TARGET = [81, 46, 42];       // #512E2A, carnation de l'homme en K5
const TARGET_LUMA = 0.299 * TARGET[0] + 0.587 * TARGET[1] + 0.114 * TARGET[2];
const SOURCE_SKIN_LUMA = 150;      // luminance typique d'une peau claire éclairée dans la séquence

// Probabilité « peau » (0 → 1) d'un pixel, avec des bords progressifs
function skinScore(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (y < 35 || r < g || g < b * 0.85) return 0;
  const ramp = (v, lo, hi, soft) => Math.max(0, Math.min(1, (v - lo) / soft, (hi - v) / soft));
  return ramp(cr, 136, 172, 6) * ramp(cb, 80, 124, 6) * Math.min(1, (y - 35) / 20) * Math.min(1, (r - b) / 25);
}

async function processFrame(file) {
  const img = sharp(path.join(SRC, file));
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const mask = new Float32Array(width * height);
  for (let i = 0, p = 0; p < mask.length; i += 3, p++) mask[p] = skinScore(data[i], data[i + 1], data[i + 2]);

  // adoucit le masque (flou) pour éviter des contours nets
  const maskImg = await sharp(Buffer.from(mask.map(v => Math.round(v * 255))), { raw: { width, height, channels: 1 } })
    .blur(1.5).raw().toBuffer();

  const out = Buffer.from(data);
  for (let i = 0, p = 0; p < maskImg.length; i += 3, p++) {
    const a = maskImg[p] / 255;
    if (a < 0.02) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    // garde le modelé : la luminance relative du pixel module la carnation cible
    const k = Math.min(2.2, y / SOURCE_SKIN_LUMA) * (TARGET_LUMA / TARGET_LUMA);
    for (let c = 0; c < 3; c++) {
      const v = Math.min(255, TARGET[c] * k * 1.15);
      out[i + c] = Math.round(data[i + c] * (1 - a) + v * a);
    }
  }
  const base = file.replace(/\.\w+$/, '');
  await sharp(out, { raw: { width, height, channels: 3 } }).webp({ quality: 90 }).toFile(path.join(OUT, `${base}.webp`));
  if (WITH_MASK) await sharp(maskImg, { raw: { width, height, channels: 1 } }).png().toFile(path.join(OUT, `${base}-masque.png`));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = [];
  for (let n = +FIRST; n <= +LAST; n++) files.push(`frame_${String(n).padStart(5, '0')}.webp`);
  for (const f of files) await processFrame(f);
  console.log(`${files.length} images traitées → ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
