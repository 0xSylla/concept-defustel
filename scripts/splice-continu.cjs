/*
 * Recolle proprement le résultat fal.ai (continu, images 300-527) dans la séquence OCTABOOT complète.
 *  1. Étalonnage : chaque image générée est ramenée à la moyenne / l'écart-type (par canal) de l'image d'origine.
 *  2. Fondu d'entrée : original jusqu'à IN_START, mélange progressif jusqu'à IN_END, puis version générée.
 *  3. Fondu de sortie : version générée jusqu'à OUT_START, mélange jusqu'à OUT_END, puis original.
 *  4. Mesure des sauts entre images consécutives sur toute la séquence (1-535).
 *
 * Usage : node scripts/splice-continu.cjs <résultat.mp4> <premier image du résultat> <dossier sortie>
 *   Variables : IN_START, IN_END, OUT_START, OUT_END (numéros d'image)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const [RESULT, FIRST, OUT] = process.argv.slice(2);
const SRC = 'C:/Users/DELL02/Desktop/Personal Builds/Octaboot-reference/assets/frames';
const IN_START = +(process.env.IN_START || 312), IN_END = +(process.env.IN_END || 322);
const OUT_START = +(process.env.OUT_START || 500), OUT_END = +(process.env.OUT_END || 510);
const TOTAL = 535, W = 1280, H = 720;
const name = n => `frame_${String(n).padStart(5, '0')}`;

function stats(buf) {
  const m = [0, 0, 0], s = [0, 0, 0], n = buf.length / 3;
  for (let i = 0; i < buf.length; i += 3) for (let c = 0; c < 3; c++) m[c] += buf[i + c];
  for (let c = 0; c < 3; c++) m[c] /= n;
  for (let i = 0; i < buf.length; i += 3) for (let c = 0; c < 3; c++) s[c] += (buf[i + c] - m[c]) ** 2;
  for (let c = 0; c < 3; c++) s[c] = Math.sqrt(s[c] / n) || 1;
  return { m, s };
}

(async () => {
  const gen = path.join(OUT, '_gen');
  fs.mkdirSync(gen, { recursive: true });
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', RESULT, '-start_number', String(FIRST), path.join(gen, 'g_%05d.png')]);
  const genCount = fs.readdirSync(gen).length;
  const genLast = +FIRST + genCount - 1;

  for (let n = 1; n <= TOTAL; n++) {
    const orig = await sharp(path.join(SRC, `${name(n)}.webp`)).removeAlpha().resize(W, H).raw().toBuffer();
    let out = orig;
    const inGen = n >= +FIRST && n <= genLast;
    // poids de la version générée : 0 = original, 1 = générée
    let w = 0;
    if (inGen) {
      if (n < IN_START || n > OUT_END) w = 0;
      else if (n < IN_END) w = (n - IN_START) / (IN_END - IN_START);
      else if (n <= OUT_START) w = 1;
      else w = 1 - (n - OUT_START) / (OUT_END - OUT_START);
    }
    if (w > 0) {
      const g = await sharp(path.join(gen, `g_${String(n).padStart(5, '0')}.png`)).removeAlpha().resize(W, H).raw().toBuffer();
      // étalonnage sur l'image d'origine correspondante
      const so = stats(orig), sg = stats(g);
      out = Buffer.alloc(orig.length);
      for (let i = 0; i < g.length; i += 3) for (let c = 0; c < 3; c++) {
        const v = (g[i + c] - sg.m[c]) * (so.s[c] / sg.s[c]) + so.m[c];
        out[i + c] = Math.max(0, Math.min(255, Math.round(v * w + orig[i + c] * (1 - w))));
      }
    }
    await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 92 }).toFile(path.join(OUT, 'frames', `${name(n)}.webp`));
  }

  // contrôle : sauts entre images consécutives, original vs montage
  const grey = async f => sharp(f).resize(320, 180).greyscale().raw().toBuffer();
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  let po, pm; const worst = [];
  for (let n = 1; n <= TOTAL; n++) {
    const o = await grey(path.join(SRC, `${name(n)}.webp`));
    const m = await grey(path.join(OUT, 'frames', `${name(n)}.webp`));
    if (po) worst.push({ n, orig: diff(po, o), mont: diff(pm, m) });
    po = o; pm = m;
  }
  // un saut est suspect s'il dépasse nettement celui de l'original au même endroit
  const suspicious = worst.filter(x => x.mont > x.orig * 1.6 + 1.5).sort((a, b) => (b.mont - b.orig) - (a.mont - a.orig));
  console.log(`images ${FIRST}-${genLast} générées ; fondus ${IN_START}-${IN_END} et ${OUT_START}-${OUT_END}`);
  console.log('sauts suspects (n : original → montage) :', suspicious.length ? '' : 'aucun');
  suspicious.slice(0, 15).forEach(x => console.log(`  ${x.n} : ${x.orig.toFixed(1)} → ${x.mont.toFixed(1)}`));

  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '24', '-i', path.join(OUT, 'frames', 'frame_%05d.webp'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', path.join(OUT, 'MASSIRI-video-complete.mp4')]);
  fs.rmSync(gen, { recursive: true, force: true });
  console.log('vidéo :', path.join(OUT, 'MASSIRI-video-complete.mp4'));
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
