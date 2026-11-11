/*
 * MASSIRI — images clés du film « L'anatomie d'un costume » (adaptation du principe OCTABOOT).
 * Générées EN CHAÎNE : chaque image part de la précédente pour garder décor, cadrage et lumière.
 * Usage : node scripts/generate-keyframes.cjs [K1 K2 …]   (sans argument : toute la chaîne)
 * Sortie : keyframes/K1.png … K7.png  (les versions existantes sont conservées en .vN)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'keyframes');
fs.mkdirSync(DIR, { recursive: true });
const KEY = process.env.AIMLAPI_KEY;
if (!KEY) throw new Error('AIMLAPI_KEY manquante');

const STAGE = 'Cinematic dark studio stage, a single warm golden tungsten spotlight from above, polished dark walnut parquet floor with soft reflections, light haze at floor level, deep black background, centered symmetrical composition, locked-off frontal camera at chest height, low-key lighting, luxury bespoke tailoring, photorealistic, 16:9. No text, no logos, no watermark.';
const KEEP = 'Keep the exact same stage, camera position, framing, floor, spotlight and haze as the reference image; only the garment changes.';
const SKIN = 'Natural deep dark skin tones with visible detail, never washed out or artificially lightened.';

const FRAMES = {
  K1: { prompt: `A single luminous golden silk thread floating in the air, tracing the outline of a standing man's silhouette like a drawing in light; the figure is otherwise empty and transparent. ${STAGE}` },
  K2: { ref: 'K1', prompt: `${KEEP} The golden thread silhouette has become a crisp white cotton dress shirt floating upright on an invisible man, sleeves relaxed, collar standing, a fine golden thread still visible along the seams. ${STAGE}` },
  K3: { ref: 'K2', prompt: `${KEEP} The same floating white shirt now wears a charcoal waistcoat with dark horn buttons and a dark silk tie; a golden thread stitches the waistcoat's last seam. Still an invisible man. ${STAGE}` },
  K4: { ref: 'K3', prompt: `${KEEP} A complete charcoal three-piece suit now floats upright on the invisible man, at exactly the same size, height and position in the frame as the shirt in the reference image (same shoulder width, same collar height): jacket with peak lapels and an ivory pocket square over the waistcoat, shirt and tie, perfectly tailored; the golden thread disappears into the lapel buttonhole. ${STAGE}` },
  K5: { ref: 'K4', prompt: `${KEEP} A tall elegant Black man now wears the same charcoal three-piece suit, buttoning his jacket. His face is hidden in deep shadow above the jawline; only his jaw, neck and hands are lit. Deep dark skin clearly visible on his hands and jaw, warm golden rim light on the shoulders. ${SKIN} ${STAGE}` },
  K6: { ref: 'K5', prompt: `The same man in the same charcoal three-piece suit, now in the centre of five elegant Black men walking towards the camera on a wide night avenue lined with warm golden streetlights and palm trees, wet pavement reflections. The others wear tailored suits in ivory, midnight blue, terracotta and olive. All wear wide-brim fedora hats; their faces are completely hidden in deep darkness beneath the hat brims and unreadable, strongly backlit by the streetlights behind them so the faces fall into silhouette; only their hands and the line of their jaws catch a little light, deep dark skin visible on the hands. Frontal camera at chest height, cinematic, photorealistic, 16:9. ${SKIN} No text, no logos, no watermark.` },
  K7: { ref: 'K5', prompt: `Extreme macro close-up of the cuff of the same charcoal jacket from the reference image: four working dark horn buttons with fine stitching, a crisp white shirt cuff below with a small polished gold cufflink, a hint of deep dark skin at the wrist. Low-key golden light, black background, shallow depth of field, photorealistic, 16:9. ${SKIN} No text, no logos, no watermark.` },
  // Gilet identique d'un bout à l'autre : K3 reprend sa propre scène et le gilet exact de K4
  'K3-match': { refs: ['K3', 'K4'], out: 'K3', prompt: `Image 1 gives the stage, camera, framing, lighting and the exact size and position of the floating garment. Image 2 gives the exact waistcoat, shirt and tie. Recreate image 1 (white shirt and waistcoat floating upright on an invisible man, no jacket, no body, no head, no hands) but the waistcoat must be IDENTICAL to the one worn under the jacket in image 2: the same smooth fine charcoal worsted wool (no tweed or flannel texture), NO golden or contrast edge stitching anywhere, the same dark discreet buttons, the same V-neck shape; the same white shirt with a clean collar without golden stitching, and the same dark tie. ${STAGE}` },
  // Costume identique d'un bout à l'autre : K4 reprend scène/échelle de K3 et le costume exact de K5
  'K4-match': { refs: ['K3', 'K5'], out: 'K4', prompt: `Image 1 gives the stage, camera, framing, lighting and the exact size and position of the floating garment. Image 2 gives the exact suit. Create the frame of image 1 where the white shirt and waistcoat are now completed by the full suit jacket of image 2, floating upright on an invisible man (no body, no head, no hands visible), at the same size and position as the garment in image 1. The suit must be IDENTICAL to image 2: the same smooth fine charcoal worsted wool (no tweed or flannel texture, no contrast or golden edge stitching), the same notch lapels, the same flat folded white pocket square, the same waistcoat, white shirt and dark tie. Jacket open, unbuttoned. ${STAGE}` },
  // 4e essai : on repart du 2e essai (gestes variés, archivé en K6.v4) et on ne change QUE des couleurs
  'K6-recolor': { ref: 'K6.v4', out: 'K6', prompt: `Keep this image exactly as it is — same men, same poses, gestures and strides, same hats shapes, same faces hidden in shadow, same avenue, lighting and framing. Change ONLY the colour of three outfits (suit and matching hat): the 2nd man from the left, currently in olive, becomes midnight blue; the 4th man from the left, currently in midnight blue, becomes terracotta; the 5th man from the left, currently in terracotta, becomes olive. The 1st man (ivory) and the 3rd man in the centre (charcoal three-piece) stay exactly as they are. Do not change anything else. ${SKIN} No text, no logos, no watermark.` },
  // 3e essai : gestes du 2e essai (image 1), ordre des couleurs de l'original validé (image 2)
  'K6-poses3': { refs: ['K6', 'K6.v2'], out: 'K6', prompt: `Image 1 gives the poses, gestures and stride of each of the five men, position by position. Image 2 gives the original colour order. Recreate image 1 exactly (same avenue, palm trees, streetlights, wet pavement, camera, lighting, fedora hats with faces hidden in deep shadow, same poses kept by POSITION in the group) but with the suit colours in this exact order from left to right, as in image 2: 1st ivory, 2nd midnight blue, 3rd charcoal (centre), 4th terracotta, 5th olive. Each hat matches its suit colour as in image 2. The centre man's charcoal three-piece suit stays identical. ${SKIN} No text, no logos, no watermark.` },
  // 2e essai : le 1er (K6-poses) restait trop aligné ; on impose profondeur et foulées
  'K6-poses2': { ref: 'K6', out: 'K6', prompt: `Re-stage the group in the reference image. Keep identical: the five men and their suit colours (ivory, midnight blue, charcoal, terracotta, olive), the fedora hats with faces hidden in deep shadow, the night avenue with palm trees, golden streetlights and wet pavement, the camera angle and the lighting. You MUST visibly change the group arrangement and body language, it must no longer look like a line-up: the man in charcoal walks clearly in FRONT, closer to the camera and larger in the frame, slightly off-centre; the four others walk BEHIND him at clearly different distances, two on his left and two on his right, partly overlapping, the furthest one noticeably smaller. Every man is at a different moment of his walk: one mid-stride with the left leg forward, one with the right leg forward, one planting his heel, one about to step. Varied gestures: charcoal man with one hand in his trouser pocket and the other arm relaxed; ivory man with both hands in his pockets; midnight blue man adjusting his cuff; terracotta man with arms swinging naturally; olive man buttoning his jacket. Different shoulder angles and head tilts, faces still hidden in shadow. Candid editorial fashion photograph, natural and relaxed, not symmetrical. ${SKIN} No text, no logos, no watermark.` },
  // Retouche de K6 validé : seules les poses changent (demande : éviter l'effet robotique)
  'K6-poses': { ref: 'K6', out: 'K6', prompt: `Keep EVERYTHING from the reference image identical: the same five men, the same suit colours and order (ivory, midnight blue, charcoal in the centre, terracotta, olive), the same fedora hats with faces hidden in shadow, the same night avenue, palm trees, streetlights, wet pavement, framing and lighting. Change ONLY their poses so the group feels natural and not robotic, like a candid editorial fashion photo: each man at a different phase of his stride; varied gestures — one with a hand in his trouser pocket, one with both hands in his pockets, one with arms swinging naturally, one adjusting his jacket button; staggered depth, with the man in charcoal slightly ahead in the centre and the others at slightly different distances instead of a perfect line; subtle differences in shoulder angle and head tilt, faces still hidden. ${SKIN} No text, no logos, no watermark.` },
};

async function toDataUrl(file) {
  const buf = await sharp(file).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + buf.toString('base64');
}

async function generate(id) {
  const f = FRAMES[id];
  const body = { prompt: f.prompt, aspect_ratio: '16:9', resolution: '2K', num_images: 1 };
  const refs = f.refs || (f.ref ? [f.ref] : []); // plusieurs références : « image 1 », « image 2 »…
  if (refs.length) {
    body.model = 'google/nano-banana-pro-edit';
    body.image_urls = await Promise.all(refs.map(r => toDataUrl(path.join(DIR, `${r}.png`))));
  } else {
    body.model = 'google/nano-banana-pro';
  }
  const res = await fetch('https://api.aimlapi.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${text.slice(0, 300)}`);
  const url = JSON.parse(text)?.data?.[0]?.url;
  if (!url) throw new Error(`${id}: pas d'image ${text.slice(0, 300)}`);
  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  const out = path.join(DIR, `${f.out || id}.png`); // f.out : retouche qui remplace une image existante
  if (fs.existsSync(out)) {
    let v = 1;
    while (fs.existsSync(path.join(DIR, `${f.out || id}.v${v}.png`))) v++;
    fs.renameSync(out, path.join(DIR, `${f.out || id}.v${v}.png`));
  }
  fs.writeFileSync(out, img);
  const m = await sharp(img).metadata();
  console.log(`${id}: OK ${m.width}x${m.height}`);
}

(async () => {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FRAMES);
  // En chaîne : K1 → K2 → … (K6 et K7 dépendent tous deux de K5 : générés en parallèle)
  for (const id of ids.filter(i => !['K6', 'K7'].includes(i))) await generate(id);
  await Promise.all(ids.filter(i => ['K6', 'K7'].includes(i)).map(generate));
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
