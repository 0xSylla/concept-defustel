/*
 * Remet les pixels de l'image d'origine dans le coin bas-droit des images retouchées
 * (zone sans peau, où le fournisseur ajoute son étiquette), avec un bord adouci.
 * Usage : node scripts/restore-corner.cjs <dossier originaux> <dossier retouchées> <dossier sortie>
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [ORIG, EDITED, OUT] = process.argv.slice(2);
const W = 1280, H = 720;
const BOX = { left: 1080, top: 620, width: 200, height: 100 }; // coin bas-droit
const FEATHER = 16;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // masque : blanc dans la zone (bords adoucis vers l'intérieur de l'image), noir ailleurs
  const maskSvg = Buffer.from(
    `<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/>` +
    `<rect x="${BOX.left + FEATHER}" y="${BOX.top + FEATHER}" width="${BOX.width + FEATHER}" height="${BOX.height + FEATHER}" fill="white"/></svg>`);
  const mask = await sharp(maskSvg).blur(FEATHER / 2).extractChannel(0).raw().toBuffer();

  const files = fs.readdirSync(EDITED).filter(f => /^frame_\d+\.webp$/.test(f)).sort();
  for (const f of files) {
    const orig = await sharp(path.join(ORIG, f)).removeAlpha().resize(W, H).raw().toBuffer();
    const edit = await sharp(path.join(EDITED, f)).removeAlpha().resize(W, H).raw().toBuffer();
    const out = Buffer.alloc(edit.length);
    for (let p = 0, i = 0; p < mask.length; p++, i += 3) {
      const a = mask[p] / 255;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(edit[i + c] * (1 - a) + orig[i + c] * a);
    }
    await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 90 }).toFile(path.join(OUT, f));
  }
  console.log(`${files.length} images → ${OUT}`);
})();
