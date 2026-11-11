/*
 * Assemble la vidéo MASSIRI complète, sans coupe :
 *   OCTABOOT 1-33 (poignets retirés dès 15) → chemise → gilet → veste → clip 4 (l'homme apparaît, finit sur Wan 345)
 *   → Wan chauve 346-401 → fondu vers Wan chapeau pendant la chute du chapeau (394-402) → Wan chapeau 403-503
 *   → fondu vers l'original sur la plongée (497-503) → original 504-535.
 * Chaque clip commence sur la dernière image du précédent : on retire ce doublon.
 * Sortie : montage-final/frames/ + montage-final/MASSIRI-complet.mp4 + mesure des sauts aux raccords.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = 'C:/Users/DELL02/Desktop/Personal Builds/Octaboot-reference/assets/frames';
const OUT = path.join(ROOT, 'montage-final');
const FR = path.join(OUT, 'frames');
const TMP = path.join(OUT, '_tmp');
const W = 1280, H = 720;

function extract(video, name) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `scale=${W}:${H}`, path.join(dir, '%05d.png')]);
  return fs.readdirSync(dir).sort().map(f => path.join(dir, f));
}
const raw = async f => sharp(f).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer();
function mix(a, b, t) { const o = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round(a[i] * (1 - t) + b[i] * t); return o; }

(async () => {
  fs.rmSync(FR, { recursive: true, force: true });
  fs.mkdirSync(FR, { recursive: true });
  const seq = []; // { buf, label }

  // 1. OCTABOOT 1-33 (15-33 : version sans poignets)
  for (let n = 1; n <= 33; n++) {
    const f = n >= 15 ? path.join(ROOT, 'octaboot-cuffs', 'frames', `frame_${String(n).padStart(5, '0')}.webp`) : path.join(SRC, `frame_${String(n).padStart(5, '0')}.webp`);
    seq.push({ buf: await raw(f), label: `octaboot ${n}` });
  }
  // 2-5. clips générés ; chacun commence sur la dernière image du précédent
  const clips = [
    ['chemise', 'octaboot-shirt/chemise-v1.mp4', 0],
    ['gilet', 'octaboot-shirt/gilet-v1.mp4', 1],
    ['veste', 'octaboot-shirt/veste-v1.mp4', 1],
    ['clip4', 'montage-final/clip4.mp4', 1],
  ];
  const baldEarly = extract(path.join(ROOT, 'octaboot-fal', 'resultat-continu-300-527.mp4'), 'chauve0');
  const BLEND = 10; // fin du clip 4 fondue dans les images Wan 336-345 (la dernière image de Veo dérive légèrement)
  for (const [name, file, skip] of clips) {
    const frames = extract(path.join(ROOT, file), name);
    for (let i = skip; i < frames.length; i++) {
      let buf = await raw(frames[i]);
      const fromEnd = frames.length - 1 - i;
      if (name === 'clip4' && fromEnd < BLEND) buf = mix(buf, await raw(baldEarly[45 - fromEnd]), (BLEND - fromEnd) / BLEND);
      seq.push({ buf, label: `${name} ${i}` });
    }
  }
  // 6. Wan chauve 346-401 + fondu vers Wan chapeau 394-402 ; Wan chapeau 403-503
  const bald = extract(path.join(ROOT, 'octaboot-fal', 'resultat-continu-300-527.mp4'), 'chauve'); // index = n - 300
  const hat = extract(path.join(ROOT, 'montage-final', 'wan-chapeau-385-503.mp4'), 'chapeau');      // index = n - 385
  const F0 = 394, F1 = 402;
  for (let n = 346; n <= 503; n++) {
    let buf;
    if (n < F0) buf = await raw(bald[n - 300]);
    else if (n <= F1) buf = mix(await raw(bald[n - 300]), await raw(hat[n - 385]), (n - F0) / (F1 - F0));
    else buf = await raw(hat[n - 385]);
    // 7. fondu vers l'original sur la plongée finale (497-503)
    if (n >= 497) buf = mix(buf, await raw(path.join(SRC, `frame_${String(n).padStart(5, '0')}.webp`)), (n - 496) / 7);
    seq.push({ buf, label: `wan ${n}` });
  }
  for (let n = 504; n <= 535; n++) seq.push({ buf: await raw(path.join(SRC, `frame_${String(n).padStart(5, '0')}.webp`)), label: `octaboot ${n}` });

  // écriture + mesure des sauts
  const small = async b => sharp(b, { raw: { width: W, height: H, channels: 3 } }).resize(320, 180).greyscale().raw().toBuffer();
  let prev = null; const jumps = [];
  for (let i = 0; i < seq.length; i++) {
    await sharp(seq[i].buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(FR, `f_${String(i + 1).padStart(5, '0')}.png`));
    const s = await small(seq[i].buf);
    if (prev) { let d = 0; for (let k = 0; k < s.length; k++) d += Math.abs(s[k] - prev[k]); jumps.push({ i: i + 1, d: d / s.length, from: seq[i - 1].label, to: seq[i].label }); }
    prev = s;
  }
  const joins = jumps.filter(j => j.from.split(' ')[0] !== j.to.split(' ')[0]);
  console.log(`${seq.length} images (${(seq.length / 24).toFixed(1)} s)`);
  console.log('raccords :'); joins.forEach(j => console.log(`  ${j.from} → ${j.to} : ${j.d.toFixed(1)}`));
  const top = [...jumps].sort((a, b) => b.d - a.d).slice(0, 8);
  console.log('plus gros sauts :'); top.forEach(j => console.log(`  ${j.from} → ${j.to} : ${j.d.toFixed(1)}`));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '24', '-i', path.join(FR, 'f_%05d.png'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', path.join(OUT, 'MASSIRI-complet.mp4')]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('vidéo :', path.join(OUT, 'MASSIRI-complet.mp4'));
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
