/*
 * Remplace l'homme par celui de la référence (K5), image par image, via SiliconFlow FLUX.2-flex
 * (image 1 = trame à modifier, image 2 = référence). Traitement par lots avec contrôle :
 * après chaque lot, une planche « avant / après » et une mini-vidéo sont générées pour validation.
 *
 * Usage : node scripts/flux2-replace.cjs <premier> <dernier>
 *   Sorties : octaboot-flux2/frames/frame_XXXXX.webp
 *             octaboot-flux2/controle/lot-<premier>-<dernier>.png et .mp4
 * Nécessite SILICONFLOW_API_KEY. Les trames déjà traitées sont ignorées (reprise possible).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const [FIRST, LAST] = process.argv.slice(2).map(Number);
const KEY = process.env.SILICONFLOW_API_KEY;
if (!KEY) throw new Error('SILICONFLOW_API_KEY manquante');
const ROOT = path.join(__dirname, '..');
const SRC = 'C:/Users/DELL02/Desktop/Personal Builds/Octaboot-reference/assets/frames';
const OUT = path.join(ROOT, 'octaboot-flux2', 'frames');
const CTRL = path.join(ROOT, 'octaboot-flux2', 'controle');
const REF = path.join(ROOT, 'flow-octaboot', 'reference-visage.jpg'); // visage entièrement visible (fourni par l'utilisateur)
const SEED = 4242;
const PAR = 3;

// v2 : prompt court, ne décrit que ce qui change (la v1 décrivait le défilé et le modèle l'inventait)
const PROMPT = 'Edit image 1. Keep image 1 exactly as it is and change only the person\'s skin, face, hair and beard so that he looks like the Black man in image 2: deep dark brown skin, shaved bald head, clean-shaven face, same facial features. Do not take anything else from image 2. Same composition, same people, same pose, same clothes, same lighting, same background as image 1. Face stays in shadow as in image 1.';

let refData;
async function edit(n) {
  const name = `frame_${String(n).padStart(5, '0')}`;
  const out = path.join(OUT, `${name}.webp`);
  if (fs.existsSync(out)) return;
  const frame = (await sharp(path.join(SRC, `${name}.webp`)).png().toBuffer()).toString('base64');
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'black-forest-labs/FLUX.2-flex', prompt: PROMPT, image_size: '1024x576', seed: SEED,
          input_image: 'data:image/png;base64,' + frame, input_image_2: refData, // FLUX.2 ne lit que ces noms de champs
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      const img = Buffer.from(await (await fetch(JSON.parse(text).images[0].url)).arrayBuffer());
      await sharp(img).resize(1280, 720, { fit: 'fill' }).webp({ quality: 90 }).toFile(out);
      return;
    } catch (e) {
      lastErr = e;
      if (/balance|insufficient|401|403/i.test(e.message)) throw e;
    }
  }
  throw new Error(`${name}: ${lastErr.message}`);
}

async function controlSheet(nums) {
  const W = 320, H = 180, cols = 6, c = [];
  for (let k = 0; k < nums.length; k++) {
    const name = `frame_${String(nums[k]).padStart(5, '0')}.webp`;
    const x = (k % cols) * (W + 4), y = Math.floor(k / cols) * (2 * H + 24);
    const label = Buffer.from(`<svg width="${W}" height="16"><rect width="100%" height="100%" fill="#000"/><text x="4" y="12" font-size="11" fill="#fff" font-family="Arial">${nums[k]}</text></svg>`);
    c.push({ input: label, left: x, top: y });
    c.push({ input: await sharp(path.join(SRC, name)).resize(W, H).toBuffer(), left: x, top: y + 16 });
    if (fs.existsSync(path.join(OUT, name))) c.push({ input: await sharp(path.join(OUT, name)).resize(W, H).toBuffer(), left: x, top: y + 16 + H + 4 });
  }
  const rows = Math.ceil(nums.length / cols);
  const file = path.join(CTRL, `lot-${FIRST}-${LAST}.png`);
  await sharp({ create: { width: cols * (W + 4), height: rows * (2 * H + 24), channels: 3, background: '#fff' } }).composite(c).png().toFile(file);
  return file;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CTRL, { recursive: true });
  refData = 'data:image/png;base64,' + (await sharp(REF).resize({ height: 720 }).png().toBuffer()).toString('base64');

  const nums = [];
  for (let n = FIRST; n <= LAST; n++) nums.push(n);
  const queue = [...nums];
  let ok = 0, ko = 0, stop = false;
  async function worker() {
    while (queue.length && !stop) {
      const n = queue.shift();
      try { await edit(n); ok++; } catch (e) { ko++; console.log('ERREUR', e.message); if (/balance|insufficient|401|403/i.test(e.message)) stop = true; }
    }
  }
  await Promise.all(Array.from({ length: PAR }, worker));
  console.log(`lot ${FIRST}-${LAST} : ${ok} ok, ${ko} en erreur`);

  const sheet = await controlSheet(nums);
  // mini-vidéo du lot (originaux remplacés par les retouches disponibles)
  const tmp = path.join(CTRL, `_lot-${FIRST}`);
  fs.mkdirSync(tmp, { recursive: true });
  nums.forEach((n, i) => {
    const name = `frame_${String(n).padStart(5, '0')}.webp`;
    const src = fs.existsSync(path.join(OUT, name)) ? path.join(OUT, name) : path.join(SRC, name);
    fs.copyFileSync(src, path.join(tmp, `${String(i).padStart(4, '0')}.webp`));
  });
  const mp4 = path.join(CTRL, `lot-${FIRST}-${LAST}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '24', '-i', path.join(tmp, '%04d.webp'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', mp4]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('contrôle :', sheet, mp4);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
