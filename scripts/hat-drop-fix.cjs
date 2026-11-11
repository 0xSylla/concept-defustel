/*
 * Rétablit la chute du chapeau (images ~393-402) : colle sur notre version les pixels du chapeau
 * de la vidéo d'origine (pixels très sombres dans la zone de la tête), bords adoucis.
 * Usage : node scripts/hat-drop-fix.cjs <premier> <dernier>
 * Entrées : octaboot-fal/chapeau-fix/res_XXXXX.png ; sortie : octaboot-fal/chapeau-fix/fix_XXXXX.png
 */
const path = require('path');
const sharp = require('sharp');

const [FIRST, LAST] = process.argv.slice(2).map(Number);
const DIR = path.join(__dirname, '..', 'octaboot-fal', 'chapeau-fix');
const SRC = 'C:/Users/DELL02/Desktop/Personal Builds/Octaboot-reference/assets/frames';
const W = 1280, H = 720;
const BOX = { x0: 470, x1: 830, y0: 0, y1: 250 }; // zone de la tête et du chapeau
const DARK = 28;                                   // luminance max d'un pixel « chapeau »

const BEFORE_HAT = 390; // dernière image sans chapeau : ses pixels sombres = cheveux, à ne pas recoller
const LANDED = +(process.env.LANDED || 399); // à partir d'ici le chapeau couvre la tête : on le colle en entier

(async () => {
  const ref = await sharp(path.join(SRC, `frame_${String(BEFORE_HAT).padStart(5, '0')}.webp`)).removeAlpha().resize(W, H).raw().toBuffer();
  const lumAt = (b, i) => 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2];
  for (let n = FIRST; n <= LAST; n++) {
    const o = await sharp(path.join(SRC, `frame_${String(n).padStart(5, '0')}.webp`)).removeAlpha().resize(W, H).raw().toBuffer();
    const r = await sharp(path.join(DIR, `res_${String(n).padStart(5, '0')}.png`)).removeAlpha().resize(W, H).raw().toBuffer();
    // masque : pixels très sombres de l'original dans la zone de la tête
    const m = Buffer.alloc(W * H);
    if (n >= LANDED) {
      // chapeau posé : il couvre la tête, on recolle ses pixels sombres
      for (let y = BOX.y0; y < BOX.y1; y++) for (let x = BOX.x0; x < BOX.x1; x++) {
        if (lumAt(o, (y * W + x) * 3) < DARK) m[y * W + x] = 255;
      }
    } else {
      // chapeau en chute : le fond derrière est aussi sombre que lui, on ne peut pas l'isoler par la couleur.
      // On recolle donc toute la zone AU-DESSUS du crâne de notre version (où passe le chapeau).
      let headTop = BOX.y1;
      for (let y = BOX.y0; y < BOX.y1 && headTop === BOX.y1; y++) {
        let bright = 0;
        for (let x = 560; x < 720; x++) if (lumAt(r, (y * W + x) * 3) > 45) bright++;
        if (bright > 15) headTop = y;
      }
      for (let y = BOX.y0; y < Math.max(0, headTop - 4); y++) for (let x = BOX.x0; x < BOX.x1; x++) m[y * W + x] = 255;
    }
    const soft = await sharp(m, { raw: { width: W, height: H, channels: 1 } }).blur(3).extractChannel(0).raw().toBuffer();
    const out = Buffer.from(r);
    for (let p = 0, i = 0; p < soft.length; p++, i += 3) {
      const a = soft[p] / 255;
      if (a > 0) for (let c = 0; c < 3; c++) out[i + c] = Math.round(r[i + c] * (1 - a) + o[i + c] * a);
    }
    await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(DIR, `fix_${String(n).padStart(5, '0')}.png`));
  }
  console.log(`${LAST - FIRST + 1} images corrigées`);
})();
