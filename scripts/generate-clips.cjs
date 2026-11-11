/*
 * MASSIRI — clips vidéo entre images clés (Veo 3.1 First-Last Frame via AIML API).
 * Usage : node scripts/generate-clips.cjs C1 [C2 …] [--hq]
 *   --hq : modèle Veo 3.1 qualité (par défaut : version rapide, pour les essais)
 * Sortie : clips/C1.mp4 … (les versions existantes sont conservées en .vN)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const KF = path.join(ROOT, 'keyframes');
const OUT = path.join(ROOT, 'clips');
fs.mkdirSync(OUT, { recursive: true });
const KEY = process.env.AIMLAPI_KEY;
if (!KEY) throw new Error('AIMLAPI_KEY manquante');

const STATIC = 'Locked-off static camera, no camera movement, no cuts, one continuous shot. The stage, golden spotlight, haze and parquet floor stay exactly the same. Smooth, elegant, slow-motion transformation. Photorealistic, cinematic.';

const CLIPS = {
  C1: { from: 'K1', to: 'K2', duration: 6, prompt: `The glowing golden silk thread starts to sew in mid-air: fabric weaves itself along the thread, panel by panel, and a crisp white dress shirt forms around the invisible body. ${STATIC}` },
  // Variante essayée (C1.v2.mp4, écartée) : ajout de « the golden outline of the body fades away progressively
  // as the shirt forms, starting with the legs… » — les jambes restaient visibles et le ruban doré disparaissait.
  // Version sans fil d'or (demande : le fil s'enroulait autour de la chemise avant le gilet)
  C2: { from: 'K2', to: 'K3', duration: 8, prompt: `Locked-off static camera, one continuous shot, no cuts. The stage, golden spotlight, haze and parquet floor never change. The white shirt floats alone on an invisible man throughout. No golden thread, no ribbon, no rope anywhere in this shot.
0–1s: the white shirt hangs perfectly still.
1–3s: two smooth charcoal waistcoat panels fly in, one from each side, and close like wings over the front of the shirt; the buttons fasten one by one.
3–4s: a dark silk tie descends from above, hanging straight down.
4–5s: its loop opens above the collar, slips around it and the knot tightens.
5–8s: everything settles and stays perfectly still: only the shirt, smooth charcoal waistcoat and tie remain, exactly as in the end frame.
Photorealistic, cinematic, elegant, smooth motion.` },
  C3: { from: 'K3', to: 'K4', duration: 8, prompt: `Locked-off static camera, one continuous shot, no cuts. The stage, golden spotlight, haze and parquet floor never change. The shirt, waistcoat and tie float on an invisible man throughout: no body, no head, no hands ever appear. No golden thread, no ribbon, no rope anywhere in this shot.
0–1s: the shirt, smooth charcoal waistcoat and tie hang perfectly still.
1–2.5s: an exploded view of a charcoal suit jacket appears around them: all the separate jacket pieces materialize and float in mid-air in a wide symmetrical arc around the body, like a technical exploded diagram — the two sleeves on the far left and right, the two front panels and side panels slightly closer, the two collar and lapel pieces above the shoulders, the pocket flaps and the cuffs below.
2.5–4s: the floating pieces hover and drift gently, slowly rotating, held in perfect symmetry.
4–6s: all the pieces converge inward together in one smooth movement and snap precisely into place over the waistcoat, seam to seam: front panels, then sleeves, then collar and notch lapels, then pocket flaps, forming the complete jacket. A flat folded white pocket square appears in the breast pocket.
6–8s: everything stays perfectly still: the complete charcoal three-piece suit, jacket open, exactly as in the end frame.
Photorealistic, cinematic, elegant, smooth motion.` },
  C4: { from: 'K4', to: 'K5', duration: 8, prompt: `One continuous shot, no cuts. The stage, golden spotlight, haze and parquet floor never change. No golden thread, no ribbon, no rope anywhere in this shot.
0–1.5s: the complete charcoal three-piece suit floats perfectly still on an invisible man, jacket open, exactly as in the start frame.
1.5–4s: a tall Black man gradually materializes inside the suit, filling it from within: first his neck and jaw appear above the collar, then his hands slide out of the sleeves. His face always stays hidden in deep shadow above the jawline. Deep dark skin, warm golden rim light on the shoulders.
2–6s: the camera slowly and smoothly pushes in towards his chest, until the framing matches the end frame.
4–6s: he calmly brings his hands together and buttons his jacket.
6–8s: he stays perfectly still, hands on the jacket button, exactly as in the end frame.
Photorealistic, cinematic, elegant, smooth motion.` },
  C5: { from: 'K5', to: 'K6', duration: 8, prompt: `One continuous shot, no cuts, no crossfade, no double exposure: the man always stays fully solid and never becomes transparent. No golden thread, no ribbon, no rope anywhere in this shot.
0–1.5s: the Black man in the charcoal three-piece suit stands still on the dark stage under the golden spotlight, finishing buttoning his jacket, face hidden in shadow, exactly as in the start frame. The camera does not move.
1.5–3s: while he stays still and solid, only the background behind him changes progressively: rows of warm golden streetlights light up far away in the haze, palm trees appear, and the parquet floor turns into a wide wet night avenue with glowing reflections. The camera slowly and smoothly pulls back.
3–4s: a wide-brim charcoal fedora hat settles on his head, casting his face into deep shadow; he lowers his hands and starts walking alone towards the camera, one hand sliding into his trouser pocket.
4–5.5s: exactly four other elegant Black men gradually emerge from the haze at their exact places beside him, two on his left and two on his right, from left to right: ivory, midnight blue, then him in charcoal in the centre, terracotta, olive, each with a matching fedora hat and his own natural gesture. Exactly five men in total, never more than five people in the frame, no duplicates. All faces stay hidden in shadow beneath the hat brims.
5.5–8s: the same five men walk naturally towards the camera while the camera keeps pulling back at the same pace, ending exactly as in the end frame.
Photorealistic, cinematic, elegant, smooth motion.` },
  C6: { from: 'K6', to: 'K7', duration: 4, prompt: `Fast smooth dolly-in towards the cuff of the man in the charcoal suit, ending on an extreme macro of the jacket cuff with four horn buttons, the white shirt cuff and a gold cufflink. Continuous shot, photorealistic, cinematic.` },
};

async function dataUrl(id) {
  const buf = await sharp(path.join(KF, `${id}.png`)).resize({ width: 1920 }).jpeg({ quality: 90 }).toBuffer();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function generate(id, hq) {
  const c = CLIPS[id];
  if (!c) throw new Error('clip inconnu : ' + id);
  const model = hq ? 'google/veo-3.1-first-last-image-to-video' : 'google/veo-3.1-first-last-image-to-video-fast';
  const res = await fetch('https://api.aimlapi.com/v2/video/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: c.prompt,
      image_url: await dataUrl(c.from),
      last_image_url: await dataUrl(c.to),
      aspect_ratio: '16:9',
      duration: c.duration,
      resolution: '1080p',
      generate_audio: false,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${id}: soumission HTTP ${res.status} ${text.slice(0, 400)}`);
  const job = JSON.parse(text);
  console.log(`${id}: soumis (${job.status}) ${job.id}`);

  const started = Date.now();
  while (Date.now() - started < 20 * 60 * 1000) {
    await wait(15000);
    const r = await fetch(`https://api.aimlapi.com/v2/video/generations?generation_id=${encodeURIComponent(job.id)}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const t = await r.text();
    if (!r.ok) { console.log(`${id}: interrogation HTTP ${r.status}, nouvel essai`); continue; }
    const s = JSON.parse(t);
    if (s.status === 'completed' && s.video?.url) {
      const out = path.join(OUT, `${id}.mp4`);
      if (fs.existsSync(out)) {
        let v = 1;
        while (fs.existsSync(path.join(OUT, `${id}.v${v}.mp4`))) v++;
        fs.renameSync(out, path.join(OUT, `${id}.v${v}.mp4`));
      }
      fs.writeFileSync(out, Buffer.from(await (await fetch(s.video.url)).arrayBuffer()));
      const credits = s.meta?.usage?.credits_used;
      console.log(`${id}: OK -> clips/${id}.mp4 (${Math.round((Date.now() - started) / 1000)} s${credits ? `, ${credits} crédits` : ''})`);
      return;
    }
    if (s.status === 'error') throw new Error(`${id}: erreur ${JSON.stringify(s.error)}`);
    process.stdout.write(`${id}: ${s.status}… `);
  }
  throw new Error(`${id}: délai dépassé (20 min)`);
}

(async () => {
  const args = process.argv.slice(2);
  const hq = args.includes('--hq');
  const ids = args.filter(a => !a.startsWith('--'));
  const results = await Promise.allSettled(ids.map(id => generate(id, hq)));
  results.forEach(r => { if (r.status === 'rejected') console.log('ERREUR', r.reason.message); });
})();
