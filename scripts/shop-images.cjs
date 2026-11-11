/*
 * Photos produits du shop — SiliconFlow (FLUX.2-pro).
 *   <id>-porte : porté par un modèle, sans tête, pose sartoriale, dans la lumière du film (image par défaut)
 *   <id>-seul  : packshot propre sur fond anthracite proche du fond du site, lumière douce (image au survol)
 *   <id>-blanc : même packshot sur fond blanc (page « Nos accessoires »)
 * Usage : node scripts/shop-images.cjs chaussettes-porte chaussettes-seul …   (sans argument : liste)
 * Sortie : site/assets/img/shop/<id>.webp (900×1125) ; anciennes versions en .vN.webp
 * Nécessite SILICONFLOW_API_KEY.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const KEY = process.env.SILICONFLOW_API_KEY;
const DIR = path.join(__dirname, '..', 'site', 'assets', 'img', 'shop');

const WORN = 'Sartorial menswear editorial photograph, the man\'s head and face are out of frame, the camera stays tight on the accessory. ' +
  'Dark studio, a single soft warm spotlight from above, light haze, deep black background, low-key cinematic lighting, ' +
  'elegant natural pose, impeccable tailoring, shallow depth of field, photorealistic, vertical 4:5. Black man with deep dark brown skin where skin is visible. ' +
  'No text, no logo, no watermark.';
const CLEAN = 'Minimal catalogue product photograph, flat lay seen straight from above, the product perfectly centered and upright ' +
  'with generous empty margin all around (the product fills about 60% of the frame height), on a plain very dark charcoal background, almost black (#141416), ' +
  'soft even diffused light from above that gently models the material, only a faint contact shadow, true-to-life colour and crisp material detail, photorealistic, vertical 4:5. ' +
  'No person, no props, no text, no logo, no watermark.';

const WHITE = 'Minimal catalogue product photograph, flat lay seen straight from above, the product perfectly centered and upright ' +
  'with generous empty margin all around, on a plain pure white seamless background, soft shadowless diffused light, only a faint contact shadow, ' +
  'true-to-life colour and crisp material detail, photorealistic, vertical 4:5. No person, no props, no text, no logo, no watermark.';

const SHOTS = {
  'chaussettes-porte': 'Close-up of the legs of a seated man, his right leg clearly crossed over his left knee so the right ankle is in the foreground: the hem of his charcoal wool trousers rides up to reveal a fine ribbed midnight navy mid-calf dress sock, one black polished leather oxford shoe raised in the air, the other foot flat on the floor behind, softly blurred.',
  'chaussettes-seul': 'A pair of fine ribbed mid-calf dress socks in midnight navy laid flat side by side, both pointing the same way with the feet at the bottom and toes to the left, the back sock slightly offset up and to the right behind the front one.',
  'cravate-porte': 'Tight shot from just below the chin down to the chest: the hands of the man are finishing the knot of a black woven silk tie, pulling the knot up to a crisp white shirt collar, a neat dimple under the knot, a black waistcoat.',
  'cravate-seul': 'A black woven silk necktie laid flat and straight, vertical, the wide blade at the bottom, the narrow end tucked neatly behind.',
  'pochette-porte': 'Three-quarter close-up of the chest of a black wool suit jacket: two fingers are adjusting an ivory silk pocket square in a puff fold in the breast pocket, light grazing across the silk, white shirt and black tie at the edge of the frame.',
  'pochette-seul': 'An ivory silk pocket square laid flat, folded into a neat square with one corner turned, hand-rolled edges visible, soft sheen.',
  'manchettes-porte': 'Tight shot of a wrist: one hand fastening a round black onyx cufflink set in aged brass on the French cuff of a crisp white shirt, a slight gap between the black jacket sleeve and the cuff.',
  'manchettes-seul': 'A pair of round black onyx cufflinks set in aged brass, lying side by side, one face up and one turned to show its toggle back.',
  'ceinture-porte': 'Waist-height shot: one hand holds the black jacket open, revealing a black calfskin leather belt with a slim brushed aged-brass buckle on charcoal wool trousers, white shirt tucked in, slight three-quarter angle.',
  'ceinture-seul': 'A black calfskin leather dress belt with a slim brushed aged-brass buckle, coiled in a neat loose circle, buckle on top.',
  'noeud-porte': 'Evening wear close-up from the chin down: one hand pulls one end of a black silk self-tie bow tie, half untied on a white wing-collar dress shirt, satin peak lapel of a black tuxedo jacket.',
  'noeud-seul': 'A black silk self-tie bow tie, tied, lying flat, satin sheen on the folds.',
  // page « Nos accessoires » : packshots sur fond blanc (6 pièces + 6 déclinaisons)
  'chaussettes-blanc': 'A pair of fine ribbed mid-calf dress socks in midnight navy laid flat side by side, both pointing the same way with the feet at the bottom and toes to the left, the back sock slightly offset up and to the right behind the front one.',
  'chaussettes-bordeaux-blanc': 'A pair of fine ribbed mid-calf dress socks in deep burgundy laid flat side by side, both pointing the same way with the feet at the bottom and toes to the left, the back sock slightly offset up and to the right behind the front one.',
  'chaussettes-gris-blanc': 'A pair of fine ribbed mid-calf dress socks in charcoal grey laid flat side by side, both pointing the same way with the feet at the bottom and toes to the left, the back sock slightly offset up and to the right behind the front one.',
  'cravate-blanc': 'A black woven silk necktie laid flat and straight, vertical, the wide blade at the bottom, the narrow end tucked neatly behind.',
  'cravate-bordeaux-blanc': 'A deep burgundy silk grenadine necktie with an open woven texture, laid flat and straight, vertical, the wide blade at the bottom, the narrow end tucked neatly behind.',
  'pochette-blanc': 'An ivory silk pocket square laid flat, folded into a neat square with one corner turned, hand-rolled edges visible, soft sheen.',
  'pochette-nuit-blanc': 'A midnight navy silk pocket square laid flat, folded into a neat square with one corner turned, hand-rolled edges visible, soft sheen.',
  'manchettes-blanc': 'A pair of round black onyx cufflinks set in aged brass, lying side by side, one face up and one turned to show its toggle back.',
  'manchettes-nacre-blanc': 'A pair of round white mother-of-pearl cufflinks set in polished silver, lying side by side, one face up and one turned to show its toggle back, iridescent sheen.',
  'ceinture-blanc': 'A black calfskin leather dress belt with a slim brushed aged-brass buckle, coiled in a neat loose circle, buckle on top.',
  'ceinture-cognac-blanc': 'A cognac brown suede leather belt with a slim brushed aged-brass buckle, coiled in a neat loose circle, buckle on top.',
  'noeud-blanc': 'A black silk self-tie bow tie, tied, lying flat, satin sheen on the folds.',
};

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) return console.log('images :', Object.keys(SHOTS).join(', '));
  if (!KEY) throw new Error('SILICONFLOW_API_KEY manquante');
  fs.mkdirSync(DIR, { recursive: true });
  for (const id of ids) {
    const prompt = `${SHOTS[id]} ${id.endsWith('-blanc') ? WHITE : id.endsWith('-seul') ? CLEAN : WORN}`;
    const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'black-forest-labs/FLUX.2-pro', prompt, image_size: '864x1080', seed: 4242 }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${text.slice(0, 200)}`);
    const img = Buffer.from(await (await fetch(JSON.parse(text).images[0].url)).arrayBuffer());
    const out = path.join(DIR, `${id}.webp`);
    if (fs.existsSync(out)) { let v = 1; while (fs.existsSync(path.join(DIR, `${id}.v${v}.webp`))) v++; fs.renameSync(out, path.join(DIR, `${id}.v${v}.webp`)); }
    await sharp(img).resize(900, 1125, { fit: 'cover' }).webp({ quality: 84 }).toFile(out);
    console.log(id, 'OK ->', out);
  }
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
