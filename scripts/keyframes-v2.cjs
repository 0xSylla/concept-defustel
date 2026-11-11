/*
 * MASSIRI v2 — images clés via SiliconFlow (FLUX.2). Prompts : PROMPTS-MASSIRI-V2.md
 * Usage : node scripts/keyframes-v2.cjs KA [KB …]     Sortie : keyframes-v2/<clé>.png (anciennes versions en .vN)
 * Nécessite SILICONFLOW_API_KEY.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const KEY = process.env.SILICONFLOW_API_KEY;
if (!KEY) throw new Error('SILICONFLOW_API_KEY manquante');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'keyframes-v2');
fs.mkdirSync(DIR, { recursive: true });

const STAGE = 'Cinematic dark studio stage, a single warm golden tungsten spotlight from directly above forming a soft cone of light, polished dark walnut parquet floor with warm golden reflections, light haze at floor level, deep black background, centered symmetrical composition, locked-off frontal camera at chest height, low-key lighting, golden rim light on edges, luxury bespoke tailoring, photorealistic, 16:9. No text, no logos, no watermark.';

const FRAMES = {
  KA: { prompt: `A full-length smooth glossy gold mannequin of an athletic man standing upright far away in the centre of the stage, arms relaxed along the body, polished liquid-gold surface reflecting the spotlight, faint golden particles drifting around it. The figure fills about 45% of the frame height. ${STAGE}` },
  KB: { refs: ['KA'], prompt: `Edit image 1. Keep the exact same stage, camera, floor line, spotlight cone, haze and lighting as image 1. The same glossy gold mannequin is now much closer to the camera and floating in mid-air at chest height above the parquet: only its head, torso and arms remain, the legs have faded away below the hips. It fills most of the frame height, centred. Arms slightly away from the body, polished liquid-gold surface with warm highlights, a few golden particles drifting off. ${STAGE}` },
};

async function dataUrl(file) {
  const buf = await sharp(file).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + buf.toString('base64');
}

async function generate(id) {
  const f = FRAMES[id];
  const body = { model: f.refs ? 'black-forest-labs/FLUX.2-flex' : 'black-forest-labs/FLUX.2-pro', prompt: f.prompt, image_size: '1024x576', seed: 4242 };
  if (f.refs) {
    body.input_image = await dataUrl(path.join(DIR, `${f.refs[0]}.png`));
    if (f.refs[1]) body.input_image_2 = await dataUrl(path.join(DIR, `${f.refs[1]}.png`));
  }
  const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${text.slice(0, 200)}`);
  const img = Buffer.from(await (await fetch(JSON.parse(text).images[0].url)).arrayBuffer());
  const out = path.join(DIR, `${id}.png`);
  if (fs.existsSync(out)) { let v = 1; while (fs.existsSync(path.join(DIR, `${id}.v${v}.png`))) v++; fs.renameSync(out, path.join(DIR, `${id}.v${v}.png`)); }
  await sharp(img).resize(1280, 720, { fit: 'fill' }).png().toFile(out);
  console.log(`${id}: OK`);
}

(async () => { for (const id of process.argv.slice(2)) await generate(id); })().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
