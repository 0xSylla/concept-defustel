/* ===================================================================
   DEFUSTEL — le film piloté par le défilement
   Séquence d'images sur canvas + textes calés sur les images (data-from / data-to).
   Chargement du grossier au fin : une image sur 32, puis 16, 8, 4, 2, 1.
   La scène démarre après la passe « une sur 8 » ; en attendant une image,
   on affiche la plus proche déjà chargée.
   Fin : arrivé sur l'image finale, le nom se brode tout seul sur la manchette (en ~3,5 s).
   =================================================================== */
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const FRAME_COUNT = 627;
  const MOBILE = matchMedia('(max-aspect-ratio: 1/1)').matches;
  const TAIL = 590;                // dès ici, images pleines aussi sur mobile (le cadrage glisse vers la manchette)
  const framePath = i => `assets/frames/${MOBILE && i < TAIL ? 'm' : 'd'}/${String(i + 1).padStart(4, '0')}.webp`;
  const STEPS = [32, 16, 8, 4, 2, 1];
  const START_STEP = 8;

  /* Cadrage : point de l'image gardé à l'écran (0-1). Centre, puis glisse vers la broderie
     pendant la fin de la plongée (sans effet quand l'écran a le format de l'image). */
  const FOCUS_FROM = 596, FOCUS_TO = FRAME_COUNT - 1, FOCUS_END = [0.325, 0.8];
  const ease = t => t * t * (3 - 2 * t);
  function focusAt(i) {
    const t = ease(Math.min(1, Math.max(0, (i - FOCUS_FROM) / (FOCUS_TO - FOCUS_FROM))));
    return [0.5 + (FOCUS_END[0] - 0.5) * t, 0.5 + (FOCUS_END[1] - 0.5) * t];
  }

  const canvas = document.getElementById('frames');
  const ctx = canvas.getContext('2d', { alpha: false });
  const embSvg = document.getElementById('embroidery');
  const images = new Array(FRAME_COUNT);
  const ready = new Uint8Array(FRAME_COUNT);
  const state = { frame: 0 };
  let shown = -1, dpr = 1;

  /* ---------- Dessin (cover + cadrage) ------------------------------ */
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    shown = -1;
    render();
  }

  function nearestReady(t) {
    for (let d = 0; d < FRAME_COUNT; d++) {
      if (t - d >= 0 && ready[t - d]) return t - d;
      if (t + d < FRAME_COUNT && ready[t + d]) return t + d;
    }
    return -1;
  }

  function render() {
    const i = nearestReady(Math.round(state.frame));
    if (i < 0 || i === shown) return;
    shown = i;
    const img = images[i];
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const [fx, fy] = focusAt(i);
    const dx = Math.min(0, Math.max(cw - dw, cw / 2 - fx * dw));
    const dy = Math.min(0, Math.max(ch - dh, ch / 2 - fy * dh));
    ctx.fillStyle = '#0a0a0b';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
    // la broderie suit l'image finale, en coordonnées de l'image (1280×720)
    const last = i === FRAME_COUNT - 1;
    embSvg.style.visibility = last ? 'visible' : 'hidden';
    emb.autoplay(i);
    if (last) Object.assign(embSvg.style, { left: dx / dpr + 'px', top: dy / dpr + 'px', width: dw / dpr + 'px', height: dh / dpr + 'px' });
  }

  /* ---------- Broderie ---------------------------------------------- */
  const emb = (function () {
    const E = window.EMBROIDERY;
    const NS = 'http://www.w3.org/2000/svg';
    const word = document.getElementById('emb-word');
    const fillG = word.querySelector('.emb-fill');
    const maskG = document.getElementById('emb-mask-paths');
    const needle = document.getElementById('emb-needle');
    const mk = (parent, d, attrs) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      for (const k in attrs) p.setAttribute(k, attrs[k]);
      parent.appendChild(p);
      return p;
    };
    const runG = word.querySelector('.emb-run');
    const letters = E.letters.map(d => ({
      fill: mk(fillG, d, { opacity: 0 }),
      run: mk(runG, d, {}),
      mask: mk(maskG, d, {}),
    }));
    letters.forEach(l => { l.len = l.mask.getTotalLength(); l.mask.style.strokeDasharray = `${l.len} ${l.len}`; });
    const total = letters.reduce((s, l) => s + l.len, 0);
    const STITCH = 0.78;            // part du temps où l'aiguille trace les contours ; ensuite le remplissage se termine

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    function draw(p) {
      const reach = Math.min(1, p / STITCH) * total;
      let acc = 0, tip = null;
      letters.forEach(l => {
        const done = clamp(reach - acc, 0, l.len);
        l.mask.style.strokeDashoffset = l.len - done;
        if (done > 0 && done < l.len) tip = l.mask.getPointAtLength(done);
        // le satin d'une lettre se pose dès que son contour est fermé
        l.fill.setAttribute('opacity', clamp((p - (acc + l.len) / total * STITCH) / 0.12, 0, 1));
        acc += l.len;
      });
      needle.style.opacity = tip ? 1 : 0;
      if (tip) { needle.setAttribute('cx', tip.x); needle.setAttribute('cy', tip.y); }
    }
    draw(0);

    // se joue une fois arrivé sur l'image finale ; se réarme si l'on remonte nettement dans le film
    const st = { p: 0 };
    let tween = null;
    function autoplay(i) {
      if (i === FRAME_COUNT - 1 && !tween) tween = gsap.to(st, { p: 1, duration: 3.5, ease: 'none', delay: 0.3, onUpdate: () => draw(st.p) });
      else if (i < FRAME_COUNT - 30 && tween) { tween.kill(); tween = null; st.p = 0; draw(0); }
    }
    return { autoplay };
  })();

  /* ---------- Chargement ------------------------------------------ */
  const loader = document.getElementById('loader');
  const fill = document.getElementById('loader-fill');
  const pct = document.getElementById('loader-pct');

  function preload(onStart) {
    const order = [];
    const seen = new Uint8Array(FRAME_COUNT);
    for (const step of STEPS) {
      for (let i = 0; i < FRAME_COUNT; i += step) if (!seen[i]) { seen[i] = 1; order.push(i); }
      if (!seen[FRAME_COUNT - 1]) { seen[FRAME_COUNT - 1] = 1; order.push(FRAME_COUNT - 1); }
    }
    const firstPass = Math.ceil(FRAME_COUNT / START_STEP) + ((FRAME_COUNT - 1) % START_STEP ? 1 : 0); // passes 32, 16, 8 (+ dernière image)
    let loaded = 0, started = false, next = 0;

    function done(i) {
      loaded++;
      if (!started) {
        const p = Math.min(1, loaded / firstPass);
        fill.style.width = (p * 100).toFixed(1) + '%';
        pct.textContent = Math.round(p * 100);
        if (p >= 1) { started = true; loader.classList.add('is-done'); onStart(); }
      }
      if (Math.abs(i - state.frame) < 40) render();
      load();
    }
    function load() {
      if (next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { ready[i] = 1; done(i); };
      img.onerror = () => done(i);
      img.src = framePath(i);
      images[i] = img;
    }
    for (let k = 0; k < 8; k++) load(); // 8 requêtes en parallèle
  }

  /* ---------- Scène ----------------------------------------------- */
  function build() {
    sizeCanvas();
    const progressFill = document.getElementById('progress-fill');
    const movementNo = document.getElementById('movement-no');
    const hero = document.querySelector('[data-panel="hero"]');
    const panels = gsap.utils.toArray('.panel:not(.panel--hero)');
    const at = f => (f - 1) / (FRAME_COUNT - 1);   // data-from / data-to : numéros d'image
    const FADE = 0.03;
    const cues = panels.map(p => [at(+p.dataset.from), at(+p.dataset.to)]);

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#scene', start: 'top top', end: 'bottom bottom',
        scrub: 0.6,
        onUpdate(self) {
          progressFill.style.width = (self.progress * 100).toFixed(2) + '%';
          let no = 0;
          cues.forEach(([inAt], i) => { if (self.progress >= inAt) no = i + 1; });
          movementNo.textContent = String(no).padStart(2, '0');
        },
      },
    });

    tl.to(state, { frame: FRAME_COUNT - 1, duration: 1, onUpdate: render }, 0);
    tl.to(hero, { autoAlpha: 0, y: -30, duration: 0.025, ease: 'power2.in' }, 0.004);

    // décalages via variables CSS : la mise en page (ordinateur / mobile) reste dans le CSS, même après un redimensionnement
    panels.forEach((panel, i) => {
      const [inAt, outAt] = cues[i];
      const dx = panel.classList.contains('panel--right') ? 44 : -44;
      gsap.set(panel, { autoAlpha: 0, '--sx': dx + 'px', '--sy': '24px' });
      tl.to(panel, { autoAlpha: 1, '--sx': '0px', '--sy': '0px', duration: FADE, ease: 'power2.out' }, inAt);
      if (outAt < 1 - FADE) tl.to(panel, { autoAlpha: 0, '--sx': -dx * 0.5 + 'px', duration: FADE, ease: 'power2.in' }, outAt);
    });
    ScrollTrigger.refresh();
  }

  let raf;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sizeCanvas); });

  preload(build);
})();
