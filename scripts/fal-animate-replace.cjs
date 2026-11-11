/*
 * Remplace le personnage d'une vidéo par celui d'une image de référence — fal.ai, Wan 2.2 Animate « replace ».
 * Usage : node scripts/fal-animate-replace.cjs <video.mp4> <reference.png|jpg|webp> <sortie.mp4> [resolution=720p]
 * Nécessite FAL_KEY.
 */
const fs = require('fs');
const path = require('path');

const [VIDEO, REF, OUT, RES = '720p'] = process.argv.slice(2);
const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error('FAL_KEY manquante');
const MODEL = 'fal-ai/wan/v2.2-14b/animate/replace';
const MIME = { '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const headers = { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' };

// Envoi sur le stockage fal (les données base64 dans la requête échouaient pour la vidéo)
async function upload(file) {
  const contentType = MIME[path.extname(file).toLowerCase()];
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST', headers, body: JSON.stringify({ content_type: contentType, file_name: path.basename(file) }),
  });
  const j = await init.json();
  if (!init.ok) throw new Error(`upload initiate HTTP ${init.status} ${JSON.stringify(j).slice(0, 200)}`);
  const put = await fetch(j.upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: fs.readFileSync(file) });
  if (!put.ok) throw new Error(`upload PUT HTTP ${put.status}`);
  return j.file_url;
}

(async () => {
  const [videoUrl, imageUrl] = [await upload(VIDEO), await upload(REF)];
  console.log('fichiers envoyés');
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST', headers,
    body: JSON.stringify({ video_url: videoUrl, image_url: imageUrl, resolution: RES, seed: 4242, video_quality: 'high' }),
  });
  const job = await submit.json();
  if (!submit.ok) throw new Error(`soumission HTTP ${submit.status} ${JSON.stringify(job).slice(0, 300)}`);
  console.log('soumis', job.request_id);

  const started = Date.now();
  while (Date.now() - started < 30 * 60 * 1000) {
    await wait(10000);
    const st = await (await fetch(job.status_url, { headers })).json();
    if (st.status === 'COMPLETED') break;
    if (st.status === 'FAILED' || st.error) throw new Error(JSON.stringify(st).slice(0, 300));
    process.stdout.write(`${st.status}… `);
  }
  const result = await (await fetch(job.response_url, { headers })).json();
  if (!result.video?.url) throw new Error('pas de vidéo : ' + JSON.stringify(result).slice(0, 300));
  fs.writeFileSync(OUT, Buffer.from(await (await fetch(result.video.url)).arrayBuffer()));
  console.log(`\nOK → ${OUT} (${Math.round((Date.now() - started) / 1000)} s)`);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
