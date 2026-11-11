/*
 * Clip entre une image de départ et une image d'arrivée — fal.ai Veo 3.1 Fast (first-last frame).
 * Usage : node scripts/fal-first-last.cjs <debut.png|webp> <fin.png|webp> <sortie.mp4> <durée 4s|6s|8s> "<prompt>"
 * Nécessite FAL_KEY.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [START, END, OUT, DURATION = '4s', PROMPT] = process.argv.slice(2);
const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error('FAL_KEY manquante');
const MODEL = 'fal-ai/veo3.1/fast/first-last-frame-to-video';
const headers = { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function upload(file) {
  const buf = await sharp(file).png().toBuffer();
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST', headers, body: JSON.stringify({ content_type: 'image/png', file_name: path.basename(file) + '.png' }),
  });
  const j = await init.json();
  if (!init.ok) throw new Error(`upload HTTP ${init.status} ${JSON.stringify(j).slice(0, 200)}`);
  const put = await fetch(j.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: buf });
  if (!put.ok) throw new Error(`upload PUT HTTP ${put.status}`);
  return j.file_url;
}

(async () => {
  const [first, last] = [await upload(START), await upload(END)];
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST', headers,
    body: JSON.stringify({ first_frame_url: first, last_frame_url: last, prompt: PROMPT, duration: DURATION, resolution: '720p', generate_audio: false, aspect_ratio: '16:9' }),
  });
  const job = await submit.json();
  if (!submit.ok) throw new Error(`soumission HTTP ${submit.status} ${JSON.stringify(job).slice(0, 300)}`);
  console.log('soumis', job.request_id);
  const t0 = Date.now();
  while (Date.now() - t0 < 20 * 60 * 1000) {
    await wait(10000);
    const st = await (await fetch(job.status_url, { headers })).json();
    if (st.status === 'COMPLETED') break;
    if (st.error) throw new Error(JSON.stringify(st).slice(0, 300));
  }
  const res = await (await fetch(job.response_url, { headers })).json();
  if (!res.video?.url) throw new Error('pas de vidéo : ' + JSON.stringify(res).slice(0, 300));
  fs.writeFileSync(OUT, Buffer.from(await (await fetch(res.video.url)).arrayBuffer()));
  console.log(`OK → ${OUT} (${Math.round((Date.now() - t0) / 1000)} s)`);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
