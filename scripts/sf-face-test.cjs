/*
 * Test : traits du visage africains, deux méthodes (SiliconFlow, FLUX.1 Kontext dev).
 *   A : prompt seul, plus précis
 *   B : image + référence K5 collées côte à côte dans un même fichier, puis recoupe
 * Usage : node scripts/sf-face-test.cjs <dossier sortie> <n> [<n> …]   (SILICONFLOW_API_KEY requis)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [OUT, ...NUMS] = process.argv.slice(2);
const KEY = process.env.SILICONFLOW_API_KEY;
const SRC = 'C:/Users/DELL02/Desktop/Personal Builds/Octaboot-reference/assets/frames';
const REF = path.join(__dirname, '..', 'keyframes', 'K5.png');
const SEED = 4242;

// v2 : apparence fixée (identique sur toutes les images) — cheveux ras, barbe courte, comme l'homme de K5
const PROMPT_A = 'Turn every man into a Black West African man with deep dark brown skin on his hands, neck and face, African facial features (fuller lips, broader nose, strong jaw), very short close-cropped tightly coiled black hair (no wavy or styled hair), and a short neat trimmed black beard. Keep everything else exactly the same: same pose, same suit, same hats, same lighting and shadows, same background, same colors, same framing. Keep faces as shadowed as they are.';
const ONLY_A = process.env.ONLY_A === '1';
const PROMPT_B = 'The image has two parts. On the left: a frame to edit. On the right: a reference man. Edit ONLY the left part: make every man look like the Black man on the right — same deep dark brown skin, same African facial features, same short black hair — while keeping the left part exactly the same otherwise: same pose, same suit, same hats, same lighting and shadows, same background, same framing. Keep faces as shadowed as they are. Keep the right part unchanged.';

async function call(prompt, png) {
  const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-Kontext-dev', prompt, image: 'data:image/png;base64,' + png.toString('base64'), seed: SEED }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  return Buffer.from(await (await fetch(JSON.parse(text).images[0].url)).arrayBuffer());
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // référence : l'homme de K5 recadré (buste) à la hauteur de l'image source
  const m = await sharp(REF).metadata();
  const ref = await sharp(REF).extract({ left: Math.round(m.width * 0.25), top: 0, width: Math.round(m.width * 0.5), height: m.height }).resize({ height: 720 }).png().toBuffer();
  const refW = (await sharp(ref).metadata()).width;

  for (const n of NUMS) {
    const name = `frame_${String(n).padStart(5, '0')}`;
    const frame = await sharp(path.join(SRC, `${name}.webp`)).png().toBuffer();
    // A
    const a = await call(PROMPT_A, frame);
    await sharp(a).resize(1280, 720, { fit: 'fill' }).webp({ quality: 90 }).toFile(path.join(OUT, `${name}-A.webp`));
    if (ONLY_A) { console.log(name, 'ok (A)'); continue; }
    // B : côte à côte puis recoupe de la partie gauche
    const combo = await sharp({ create: { width: 1280 + refW, height: 720, channels: 3, background: '#000' } })
      .composite([{ input: frame, left: 0, top: 0 }, { input: ref, left: 1280, top: 0 }]).png().toBuffer();
    const b = await call(PROMPT_B, combo);
    const bm = await sharp(b).metadata();
    const leftW = Math.round(bm.width * 1280 / (1280 + refW));
    await sharp(b).extract({ left: 0, top: 0, width: leftW, height: bm.height }).resize(1280, 720, { fit: 'fill' }).webp({ quality: 90 }).toFile(path.join(OUT, `${name}-B.webp`));
    console.log(name, 'ok (sortie B :', bm.width + 'x' + bm.height + ')');
  }
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
