/*
 * Garde le sujet d'OCTABOOT et change seulement : peau brun profond + crâne rasé.
 * Réglages validés sur l'image 360 (référence) : FLUX.1 Kontext dev (SiliconFlow), même prompt, même graine.
 * Le coin bas-droit (étiquette « AI生成 » du fournisseur) est remis aux pixels d'origine.
 *
 * Le prompt dépend de la scène (voir octaboot-sujet/SCENES.md).
 *
 * Usage : node scripts/octaboot-sujet.cjs <premier> <dernier> [parallèle=3]
 *         node scripts/octaboot-sujet.cjs --list 307,317,328 [parallèle=3]
 *   OUT_DIR=… pour écrire ailleurs (ex. tests de scènes)
 * Sortie : <OUT_DIR>/frame_XXXXX.webp (brut : frame_XXXXX-brut.webp) + <OUT_DIR>/controle/
 * Nécessite SILICONFLOW_API_KEY. Les images déjà faites sont ignorées.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ARGS = process.argv.slice(2);
const LIST = ARGS[0] === '--list' ? ARGS[1].split(',').map(Number) : null;
const [FIRST, LAST] = LIST ? [LIST[0], LIST[LIST.length - 1]] : ARGS.slice(0, 2).map(Number);
const PAR = (LIST ? ARGS[2] : ARGS[2]) || '3';
const KEY = process.env.SILICONFLOW_API_KEY;
if (!KEY) throw new Error('SILICONFLOW_API_KEY manquante');
const SRC = 'C:/Users/DELL02/Desktop/Personal Builds/Octaboot-reference/assets/frames';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'octaboot-sujet');
const CTRL = path.join(OUT, 'controle');
const SEED = 4242;

// Prompts par scène — identiques à octaboot-sujet/SCENES.md
const SCENES = [
  { id: 'A', from: 307, to: 330, prompt: 'Make the skin of this man\'s hands, wrists and neck deep dark brown, as a Black man. If any part of his head becomes visible, it is a shaved bald head with deep dark brown skin. Keep everything else exactly the same: the suit floating on an otherwise invisible body, same pose, same black suit, white shirt, tie and pocket square, same lighting, haze, background and framing. Do not add a head or a face that is not in the image.' },
  { id: 'B', from: 331, to: 344, prompt: 'Make this same man a Black man with deep dark brown skin on his face, neck and hands, and a shaved bald head, clean-shaven with no beard. Keep him the same man otherwise and keep everything else exactly the same: same head size and position, same face direction and expression, same lighting on the face, same pose and hands, same black suit, white shirt, tie and pocket square, same haze, background and framing.' },
  { id: 'C', from: 345, to: 388, prompt: 'Make this same man a Black man with deep dark brown skin on his hands, wrists, neck and face, and a shaved bald head, clean-shaven with no beard. Keep him the same man otherwise and keep everything else exactly the same: same head size and position, same pose, head bowed, face in shadow exactly as dark as now, same hands adjusting the cuff, same black suit, white shirt, tie and pocket square, same lighting, haze, background and framing.' },
  { id: 'D', from: 389, to: 402, prompt: 'Make this same man a Black man with deep dark brown skin on his hands, wrists, neck and face, and a shaved bald head, clean-shaven with no beard. If he wears a hat, keep the hat exactly as it is and only the skin below it changes. Keep everything else exactly the same: same head size and position, same pose, head bowed, face in shadow exactly as dark as now, same black suit, same street background, streetlights, reflections, lighting and framing.' },
  { id: 'E', from: 403, to: 496, prompt: 'Make every man in this image a Black man with deep dark brown skin on his hands, wrists, neck and the visible part of his face, clean-shaven with no beard. Keep everything else exactly the same: exactly the same number of people, every hat stays on every head with the same shape and colour, faces stay in the shadow of the hat brims exactly as dark as now, same poses and steps, same suits in black, grey, ivory and burgundy, same night avenue, streetlights, wet reflections, lighting and framing.' },
  { id: 'F', from: 497, to: 527, prompt: 'Make the skin of every visible hand and wrist deep dark brown, as a Black man. Keep everything else exactly the same: same suits, same jacket cuff, buttons, white shirt cuff and cufflink, same composition, same focus and blur, same lighting and colours. Do not add any person or body part.' },
];
const sceneOf = n => SCENES.find(s => n >= s.from && n <= s.to);

// Visage sous le bord du chapeau (fin de D et E) : sans cette précision, le modèle ne le modifie pas
const HAT_FACE = ' The face under the hat brim also has deep dark brown skin and African facial features, while staying in shadow exactly as dark as now.';
const promptOf = n => sceneOf(n).prompt + (n >= 398 && n <= 496 ? HAT_FACE : '');

// Probabilité « peau » d'un pixel (espace YCbCr), bords progressifs
function skinScore(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (y < 35 || r < g || g < b * 0.85) return 0;
  const ramp = (v, lo, hi, soft) => Math.max(0, Math.min(1, (v - lo) / soft, (hi - v) / soft));
  return ramp(cr, 136, 172, 6) * ramp(cb, 80, 124, 6) * Math.min(1, (y - 35) / 20) * Math.min(1, (r - b) / 25);
}

async function skinMask(srcFile) {
  const { data, info } = await sharp(srcFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = Buffer.alloc(info.width * info.height);
  let count = 0;
  for (let i = 0, p = 0; p < m.length; i += 3, p++) { const s = skinScore(data[i], data[i + 1], data[i + 2]); m[p] = Math.round(s * 255); if (s > 0.5) count++; }
  // élargit et adoucit le masque pour couvrir aussi les ombres de la peau
  const soft = await sharp(m, { raw: { width: info.width, height: info.height, channels: 1 } }).blur(8).linear(3, 0).blur(3).extractChannel(0).raw().toBuffer(); // flou large × 3 = masque élargi puis adouci
  return { soft, count };
}

// Assemble : coin bas-droit d'origine ; scène A : la retouche n'est gardée que sur la peau d'origine
// (mains, cou) — le modèle ne peut donc pas ajouter de tête au personnage invisible.
async function compose(srcFile, editedBuf, n) {
  const o = await sharp(srcFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const e = await sharp(editedBuf).removeAlpha().resize(1280, 720, { fit: 'fill' }).raw().toBuffer();
  const W = o.info.width, H = o.info.height, out = Buffer.from(e);
  if (sceneOf(n).id === 'A') {
    const { soft } = await skinMask(srcFile);
    for (let p = 0, i = 0; p < soft.length; p++, i += 3) {
      const a = soft[p] / 255;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(e[i + c] * a + o.data[i + c] * (1 - a));
    }
  }
  for (let y = 600; y < H; y++) for (let x = 1040; x < W; x++) {
    const a = Math.min(1, (x - 1040) / 24, (y - 600) / 24);
    const i = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] * (1 - a) + o.data[i + c] * a);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } });
}
const NO_SKIN_FROM = 522; // à partir d'ici (macro sur la manche), aucune peau visible : image d'origine conservée

async function edit(n) {
  const name = `frame_${String(n).padStart(5, '0')}`;
  const out = path.join(OUT, `${name}.webp`);
  if (fs.existsSync(out)) return;
  const src = path.join(SRC, `${name}.webp`);
  if (n >= NO_SKIN_FROM) {
    await sharp(src).webp({ quality: 92 }).toFile(out); // aucune peau visible : image d'origine
    return;
  }
  // Retouche brute déjà générée (ex. après correction de l'assemblage) : on réassemble sans rappeler l'IA
  const brut = path.join(OUT, `${name}-brut.webp`);
  if (fs.existsSync(brut)) {
    await (await compose(src, await fs.promises.readFile(brut), n)).webp({ quality: 92 }).toFile(out);
    return;
  }
  const img = 'data:image/png;base64,' + (await sharp(src).png().toBuffer()).toString('base64');
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-Kontext-dev', prompt: promptOf(n), image: img, seed: SEED }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      const raw = Buffer.from(await (await fetch(JSON.parse(text).images[0].url)).arrayBuffer());
      await sharp(raw).resize(1280, 720, { fit: 'fill' }).webp({ quality: 92 }).toFile(path.join(OUT, `${name}-brut.webp`));
      await (await compose(src, raw, n)).webp({ quality: 92 }).toFile(out);
      return;
    } catch (e) { last = e; if (/balance|insufficient|401|403/i.test(e.message)) throw e; }
  }
  throw new Error(`${name}: ${last.message}`);
}

(async () => {
  fs.mkdirSync(CTRL, { recursive: true });
  const nums = [];
  if (LIST) nums.push(...LIST); else for (let n = FIRST; n <= LAST; n++) nums.push(n);
  const queue = [...nums];
  let ok = 0, ko = 0;
  await Promise.all(Array.from({ length: +PAR }, async () => {
    while (queue.length) {
      const n = queue.shift();
      try { await edit(n); ok++; } catch (e) { ko++; console.log('ERREUR', e.message); if (/balance|insufficient|401|403/i.test(e.message)) queue.length = 0; }
    }
  }));
  console.log(`lot ${FIRST}-${LAST} : ${ok} ok, ${ko} en erreur`);

  // Contrôle : planche avant/après + écart avec l'image précédente (original vs retouche)
  const W = 320, H = 180, cols = Math.min(6, nums.length), c = [];
  const grey = async p => sharp(p).resize(320, 180).greyscale().raw().toBuffer();
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  let po, pe; const report = [];
  for (let k = 0; k < nums.length; k++) {
    const name = `frame_${String(nums[k]).padStart(5, '0')}.webp`;
    const x = (k % cols) * (W + 4), y = Math.floor(k / cols) * (2 * H + 24);
    c.push({ input: Buffer.from(`<svg width="${W}" height="16"><rect width="100%" height="100%" fill="#000"/><text x="4" y="12" font-size="11" fill="#fff" font-family="Arial">${nums[k]}</text></svg>`), left: x, top: y });
    c.push({ input: await sharp(path.join(SRC, name)).resize(W, H).toBuffer(), left: x, top: y + 16 });
    if (!fs.existsSync(path.join(OUT, name))) continue;
    c.push({ input: await sharp(path.join(OUT, name)).resize(W, H).toBuffer(), left: x, top: y + 16 + H + 4 });
    const o = await grey(path.join(SRC, name)), e = await grey(path.join(OUT, name));
    if (po) report.push(`${nums[k]}  original ${diff(po, o).toFixed(1)}  retouche ${diff(pe, e).toFixed(1)}`);
    po = o; pe = e;
  }
  const sheet = path.join(CTRL, `lot-${FIRST}-${LAST}.png`);
  await sharp({ create: { width: cols * (W + 4), height: Math.ceil(nums.length / cols) * (2 * H + 24), channels: 3, background: '#fff' } }).composite(c).png().toFile(sheet);
  console.log('écart avec l\'image précédente (sur 255) :\n' + report.join('\n'));
  console.log('planche :', sheet);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
