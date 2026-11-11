/*
 * Change uniquement la carnation des personnages, image par image, via SiliconFlow
 * (FLUX.1 Kontext dev par défaut). Graine fixe pour limiter les variations d'une image à l'autre.
 * Usage : node scripts/sf-skin-frames.cjs <source> <sortie> <premier> <dernier> [parallèle=3] [modèle]
 * Nécessite SILICONFLOW_API_KEY. Les images déjà traitées sont ignorées (reprise possible).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [SRC, OUT, FIRST, LAST, PAR = '3', MODEL = 'black-forest-labs/FLUX.1-Kontext-dev'] = process.argv.slice(2);
const KEY = process.env.SILICONFLOW_API_KEY;
if (!KEY) throw new Error('SILICONFLOW_API_KEY manquante');
const SEED = 4242;

const PROMPT = 'Change the skin color of every person to deep dark brown Black skin (hands, wrists, neck, jaw). Keep everything else exactly the same: same pose, same hands shape, same suit, same lighting and shadows, same background, same colors, same framing. Keep faces hidden in shadow exactly as they are.';

async function edit(n) {
  const name = `frame_${String(n).padStart(5, '0')}`;
  const out = path.join(OUT, `${name}.webp`);
  if (fs.existsSync(out)) return;
  const png = await sharp(path.join(SRC, `${name}.webp`)).png().toBuffer();
  const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: PROMPT, image: 'data:image/png;base64,' + png.toString('base64'), seed: SEED }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${text.slice(0, 250)}`);
  const url = JSON.parse(text)?.images?.[0]?.url;
  if (!url) throw new Error(`${name}: pas d'image ${text.slice(0, 200)}`);
  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  await sharp(img).resize(1280, 720, { fit: 'fill' }).webp({ quality: 88 }).toFile(out);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const queue = [];
  for (let n = +FIRST; n <= +LAST; n++) queue.push(n);
  const total = queue.length;
  let done = 0, failed = 0;
  async function worker() {
    while (queue.length) {
      const n = queue.shift();
      try { await edit(n); done++; }
      catch (e) {
        failed++; console.log('ERREUR', e.message);
        if (/balance|insufficient|quota|401|403/i.test(e.message)) queue.length = 0;
      }
      if ((done + failed) % 20 === 0) console.log(`${done + failed}/${total}…`);
    }
  }
  await Promise.all(Array.from({ length: +PAR }, worker));
  console.log(`terminé : ${done} ok, ${failed} en erreur → ${OUT}`);
})();
