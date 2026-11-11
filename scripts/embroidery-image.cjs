/*
 * Broderie « Defustel » sur la manchette de l'image finale — FLUX.1 Kontext dev (SiliconFlow).
 * Seule la zone de la manchette est reprise de l'image retouchée (bords adoucis) :
 * le reste de l'image (et l'étiquette du fournisseur) garde les pixels d'origine.
 *
 * Usage : node scripts/embroidery-image.cjs <image.png> <dossier sortie> [graines=4242,7]
 * Sortie : <dossier>/broderie-<graine>.png (+ -brut.png). Nécessite SILICONFLOW_API_KEY.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [SRC, OUT, SEEDS = '4242,7'] = process.argv.slice(2);
const KEY = process.env.SILICONFLOW_API_KEY;
if (!KEY) throw new Error('SILICONFLOW_API_KEY manquante');
const W = 1280, H = 720;
const PROMPT = 'Add a hand-embroidered monogram on the white shirt cuff: the name "Defustel" in an elegant flowing cursive script, ' +
  'stitched in dark navy blue silk thread with fine raised satin stitches catching the light, placed on the white cuff to the left of the black button, ' +
  'written along the length of the cuff and following its angle and perspective. ' +
  'Keep everything else exactly the same: the black jacket sleeve, its four buttons and stitching, the black cuff button, the fabric textures, lighting, shadows, colours, focus and framing.';
// zone de la manchette blanche (coordonnées 1280×720), un peu élargie
const CUFF = '40,720 120,640 515,395 790,535 760,720';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const png = await sharp(SRC).resize(W, H).png().toBuffer();
  const orig = await sharp(png).removeAlpha().raw().toBuffer();
  const mask = await sharp(Buffer.from(`<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/><polygon points="${CUFF}" fill="white"/></svg>`))
    .blur(10).extractChannel(0).raw().toBuffer();
  for (const seed of SEEDS.split(',').map(Number)) {
    const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-Kontext-dev', prompt: PROMPT, image: 'data:image/png;base64,' + png.toString('base64'), seed }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
    const raw = Buffer.from(await (await fetch(JSON.parse(text).images[0].url)).arrayBuffer());
    await sharp(raw).png().toFile(path.join(OUT, `broderie-${seed}-brut.png`));
    const edit = await sharp(raw).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer();
    const out = Buffer.alloc(edit.length);
    for (let p = 0, i = 0; p < mask.length; p++, i += 3) {
      const a = mask[p] / 255;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(edit[i + c] * a + orig[i + c] * (1 - a));
    }
    await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(OUT, `broderie-${seed}.png`));
    console.log('graine', seed, 'OK');
  }
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
