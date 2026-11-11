/*
 * Change uniquement la carnation des personnages, image par image, via AIML (nano-banana-pro-edit).
 * Chaque image reçoit aussi une référence de carnation (mains de l'homme en K5).
 * Usage : node scripts/ai-skin-frames.cjs <dossier source> <dossier sortie> <premier> <dernier> [parallèle=4]
 * Les images déjà traitées sont ignorées (reprise possible).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [SRC, OUT, FIRST, LAST, PAR = '4'] = process.argv.slice(2);
const KEY = process.env.AIMLAPI_KEY;
if (!KEY) throw new Error('AIMLAPI_KEY manquante');
const ROOT = path.join(__dirname, '..');

const PROMPT = 'Image 1 is a frame from a video. Keep image 1 EXACTLY identical — same composition, framing, pose, lighting, shadows, colours, clothes, hats, background, grain and sharpness — pixel for pixel wherever there is no visible skin. Change ONLY the skin of every person (hands, wrists, neck, jaw and any visible part of the face) to a deep dark brown Black skin tone, matching the skin colour shown in image 2 (#512E2A). Keep each face exactly as hidden or shadowed as it is in image 1; do not reveal or redraw any facial feature. Do not change anything else. No text, no watermark.';

async function dataUrl(file, max = 1280) {
  const buf = await sharp(file).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + buf.toString('base64');
}

let skinRef;
async function edit(n) {
  const name = `frame_${String(n).padStart(5, '0')}`;
  const out = path.join(OUT, `${name}.webp`);
  if (fs.existsSync(out)) return 'déjà fait';
  const res = await fetch('https://api.aimlapi.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/nano-banana-pro-edit',
      prompt: PROMPT,
      image_urls: [await dataUrl(path.join(SRC, `${name}.webp`)), skinRef],
      aspect_ratio: '16:9',
      resolution: '1K',
      num_images: 1,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${text.slice(0, 200)}`);
  const url = JSON.parse(text)?.data?.[0]?.url;
  if (!url) throw new Error(`${name}: pas d'image`);
  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  // même taille que l'original (1280×720) pour remplacer les images de la séquence
  await sharp(img).resize(1280, 720, { fit: 'fill' }).webp({ quality: 88 }).toFile(out);
  return 'ok';
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const refPath = path.join(ROOT, 'keyframes', 'K5.png');
  const m = await sharp(refPath).metadata();
  const crop = await sharp(refPath).extract({ left: Math.round(m.width * 0.40), top: Math.round(m.height * 0.50), width: Math.round(m.width * 0.20), height: Math.round(m.height * 0.20) }).png().toBuffer();
  skinRef = 'data:image/png;base64,' + crop.toString('base64');

  const queue = [];
  for (let n = +FIRST; n <= +LAST; n++) queue.push(n);
  let done = 0, failed = 0;
  async function worker() {
    while (queue.length) {
      const n = queue.shift();
      try { await edit(n); done++; } catch (e) { failed++; console.log('ERREUR', e.message); if (/funds|quota/i.test(e.message)) { queue.length = 0; } }
      if ((done + failed) % 10 === 0) console.log(`${done + failed} traitées…`);
    }
  }
  await Promise.all(Array.from({ length: +PAR }, worker));
  console.log(`terminé : ${done} ok, ${failed} en erreur → ${OUT}`);
})();
