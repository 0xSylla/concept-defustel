/*
 * MASSIRI — génération des plans du film « Du fil à l'homme » via AIML API.
 * Usage : node scripts/generate-shots.cjs <id> [<id> ...]     (ex. 07, ou all)
 * Nécessite la variable d'environnement AIMLAPI_KEY.
 * Les images sont écrites dans shots/<id>.png (les fichiers existants sont conservés en .vN).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const KEY = process.env.AIMLAPI_KEY;
if (!KEY) throw new Error('AIMLAPI_KEY manquante');

const STYLE = 'Cinematic film still, photorealistic, shot on ARRI Alexa 65 with vintage anamorphic lenses, shallow depth of field, subtle 35mm film grain, low-key chiaroscuro lighting, deep inky blacks with retained shadow detail, luxury bespoke tailoring atmosphere. Main subject centred so the frame can be cropped to vertical. No text, no logos, no watermark.';
const ATELIER = 'Warm tungsten colour grade: amber highlights, rich blacks, a narrow beam of light with floating dust particles.';
const NIGHT = 'Night colour grade: deep midnight-blue shadows, warm golden practical lights.';
const SKIN = 'Lighting tuned for dark skin: soft warm key light from the side, golden rim light separating the silhouette from the black background, natural deep skin tones with visible detail, never washed-out or artificially lightened.';
const LAYER = (piece) => `Studio shot on pure solid black background (#000000), ${piece} of a charcoal bespoke suit floating weightlessly, fabric gently rippling as if suspended in zero gravity, warm golden rim light tracing the edges, nothing else in frame. Photorealistic, high detail. No text, no logos, no watermark.`;

const TAILOR_REF = 'references/tailleur.png';

const SHOTS = {
  '01': { prompt: `Total darkness. A single fine golden silk thread stretches horizontally across the frame, catching a narrow beam of warm light from above. Tiny dust particles drift in the beam. The thread glows softly. Vast negative space. ${STYLE} ${ATELIER}` },
  '02': { prompt: `Extreme macro of fine charcoal wool suiting cloth, herringbone weave visible thread by thread, raking warm side light revealing the texture. In the soft-focus background, stacked bolts of luxury wool on the wooden shelves of a tailor's atelier. ${STYLE} ${ATELIER}` },
  '03': { refs: [TAILOR_REF], prompt: `Close-up of the hands of the Black master tailor from the reference image (dark skin, his silver ring visible) tracing a precise line with white tailor's chalk on charcoal wool laid on a worn wooden cutting table. Large steel tailor's shears rest beside the cloth. Chalk dust floats in the light beam. His face is out of frame. ${STYLE} ${ATELIER} ${SKIN}` },
  '04': { prompt: `A half-finished jacket in raw canvas with white basting stitches on a vintage tailor's dummy, pins in the lapel and chalk marks on the chest, standing alone in a dark atelier, lit from the side by a single warm lamp, three-quarter view. ${STYLE} ${ATELIER}` },
  '05': { refs: [TAILOR_REF], prompt: `Extreme close-up of the dark-skinned fingers of the master tailor from the reference image hand-sewing a buttonhole on a charcoal jacket sleeve with golden silk thread, needle mid-pull, brass thimble on his middle finger. The golden thread is the brightest element in the frame. His face is out of frame. ${STYLE} ${ATELIER} ${SKIN}` },
  '06a': { prompt: LAYER('the jacket body without sleeves, with peak lapels and buttons,') },
  '06b': { prompt: LAYER('a single jacket sleeve with four working cuff buttons,') },
  '06c': { prompt: 'Studio shot on pure solid black background (#000000). ONLY a single loose panel of golden silk jacket lining fabric, floating and fluttering on its own, softly folded, with sheen. It is NOT attached to any jacket: no jacket, no sleeves, no lapels, no other garment in the frame. Warm golden rim light. Photorealistic, high detail. No text, no logos, no watermark.' },
  '06d': { prompt: 'Studio shot on pure solid black background (#000000). ONLY small tailoring details floating in mid-air: one folded burgundy silk pocket square and six dark horn buttons scattered around it. Absolutely no jacket, no garment, no fabric panel in the frame. Warm golden rim light. Photorealistic, high detail. No text, no logos, no watermark.' },
  // Retouche : le modèle a rendu 06d sur fond blanc ; on repart de l'image pour ne changer que le fond
  '06d-noir': { refs: ['shots/06d.png'], prompt: 'Keep the burgundy silk pocket square and the dark horn buttons exactly identical (same shapes, positions, sizes and colours). Replace ONLY the white background with a pure solid black background (#000000), edge to edge, and relight the objects with a warm golden rim light, as in a dark luxury studio. Nothing else in the frame. No text, no logos, no watermark.' },
  '06e': { prompt: LAYER('the complete assembled jacket, perfectly formed,') },
  '07': { refs: [TAILOR_REF], prompt: `Inside a dark wood-panelled atelier, a tall elegant Black man in his early thirties (deep dark skin, short fade haircut, neatly trimmed beard) stands with his back to the camera facing a tall antique mirror, wearing a finished charcoal three-piece suit. The master tailor from the reference image stands beside him adjusting the shoulder seam, a tape measure around his neck, shirt sleeves rolled up, wearing a waistcoat. Both faces are visible in the mirror, sharing a look of quiet pride. Warm tungsten light. ${STYLE} ${SKIN}` },
  // 08 : la référence est le plan 07 généré, pour garder le même client
  '08': { refs: ['shots/07.png'], prompt: `The same younger Black man in the charcoal three-piece suit from the reference image (not the older tailor), now walking alone towards the camera on a wet cobblestone street at night, low-angle shot, confident stride. Warm golden streetlights and their reflections on the wet pavement. The lit window of the tailor's atelier glows behind him, with no sign, no lettering and no writing anywhere in the frame. Light mist. ${STYLE} ${NIGHT} ${SKIN}` },
};

async function toDataUrl(file) {
  const buf = await sharp(path.join(ROOT, file)).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + buf.toString('base64');
}

async function generate(id) {
  const shot = SHOTS[id];
  if (!shot) throw new Error('plan inconnu : ' + id);
  const body = {
    model: shot.refs ? 'google/nano-banana-pro-edit' : 'google/nano-banana-pro',
    prompt: shot.prompt,
    aspect_ratio: '16:9',
    resolution: '2K',
    num_images: 1,
  };
  if (shot.refs) body.image_urls = await Promise.all(shot.refs.map(toDataUrl));

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

  const out = path.join(ROOT, 'shots', `${id}.png`);
  if (fs.existsSync(out)) {
    let v = 1;
    while (fs.existsSync(path.join(ROOT, 'shots', `${id}.v${v}.png`))) v++;
    fs.renameSync(out, path.join(ROOT, 'shots', `${id}.v${v}.png`));
  }
  fs.writeFileSync(out, img);
  const meta = await sharp(img).metadata();
  console.log(`${id}: OK ${meta.width}x${meta.height}`);
}

(async () => {
  let ids = process.argv.slice(2);
  if (ids[0] === 'all') ids = Object.keys(SHOTS).filter(id => id !== '08');
  const results = await Promise.allSettled(ids.map(generate));
  results.forEach(r => { if (r.status === 'rejected') console.log('ERREUR', r.reason.message); });
})();
