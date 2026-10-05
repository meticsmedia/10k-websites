/* scene.js: the 10K Websites scroll engine. Vanilla JS, no dependencies.
   The page is written as normal semantic HTML. This file only reads data-k-* attributes
   and drives them from scroll. Do not edit it per project: style it with CSS and
   write any one-off behavior in the page's own script, reading the --k-p variable.

   HERO  <section data-k-hero data-k-span="4">          span = scroll length in viewport heights
           <div class="k-stage"> ...media, layers, bands... </div>
         </section>
         The stage stays pinned while the visitor scrolls through the span.
         The hero publishes --k-p (0..1, smoothed) for CSS.

   MEDIA (one per hero, inside .k-stage)
     <video data-k-scrub data-src="assets/hero.mp4" data-src-mobile="assets/hero-m.mp4"
            data-poster="assets/hero-poster.webp" data-poster-mobile="assets/hero-m-poster.webp"
            data-bytes="6400000" muted playsinline></video>
         Scroll scrubs the clip. Streamed as a Blob (works on hosts without range requests),
         with gated seeks and a smoothed playhead. Optional .k-ring shows load progress.
         Phones get the poster unless data-src-mobile is given.
     <canvas data-k-depth data-image="assets/hero.webp" data-depth="assets/hero-depth.png"
             data-image-mobile="..." data-depth-mobile="..." data-strength="0.035"
             data-push="0.06" data-pointer="1"></canvas>
         One image plus its depth map, rendered in WebGL. Near things move more than far
         things as the visitor scrolls (a slow camera push) and moves the pointer.

   LAYERS  <img data-k-layer="0.25" data-k-drift="12" ...>
         Independent planes. layer = vertical travel across the hero in viewport heights
         (negative moves up faster). drift = pointer response in px. Use for cut-out subjects,
         mist, dust, and headlines that sit between planes.

   BANDS   <div class="k-band" data-k-band="0.10 0.35"> ... </div>
         Caption that is fully visible across the progress range, with eased edges.
         Publishes --k (0..1 assembly progress) on the band. The first band starts visible,
         the last band stays visible to the end.

   FLOW    <div data-k-in> ... </div>   gets .is-in once it scrolls into view.
*/
(() => {
  'use strict';
  const mm = q => window.matchMedia(q);
  const REDUCED = mm('(prefers-reduced-motion: reduce)');
  const PHONE_GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)'
  ].map(mm);
  const isPhone = () => PHONE_GATES.some(m => m.matches);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (x, e0, e1) => { const t = clamp((x - e0) / (e1 - e0 || 1), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- scrub video ---------- */
  function ScrubVideo(el, hero) {
    const self = { el, ready: false, busy: false, pending: null, armed: false };
    const ring = hero.querySelector('.k-ring');
    const src = () => (isPhone() ? el.dataset.srcMobile : el.dataset.src);
    const poster = (isPhone() && el.dataset.posterMobile) || el.dataset.poster;
    if (poster) hero.style.setProperty('--k-poster', `url("${poster}")`);
    el.muted = true; el.playsInline = true; el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1;

    function seek(t) {
      if (!self.ready || !isFinite(el.duration)) return;
      if (self.busy) { self.pending = t; return; }
      self.busy = true; el.currentTime = clamp(t, 0, el.duration - 0.04);
    }
    el.addEventListener('seeked', () => {
      self.busy = false;
      if (self.pending !== null) { const t = self.pending; self.pending = null; seek(t); }
    });
    el.addEventListener('error', () => { self.busy = false; self.pending = null; fail(); });

    function fail() { hero.classList.add('k-media-failed'); if (ring) ring.hidden = true; }

    async function load() {
      const url = src();
      if (!url || self.armed) return;
      self.armed = true;
      try {
        const ctrl = new AbortController();
        let dog = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(url, { signal: ctrl.signal, priority: 'low' });
        if (!res.ok || !res.body) throw new Error('video ' + res.status);
        const total = Number(res.headers.get('Content-Length')) || Number(el.dataset.bytes) || 0;
        const reader = res.body.getReader(); const parts = []; let got = 0, last = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          clearTimeout(dog); dog = setTimeout(() => ctrl.abort(), 20000);
          parts.push(value); got += value.length;
          const now = performance.now();
          if (ring && total && (now - last > 100)) { last = now; ring.style.setProperty('--k-load', (got / total).toFixed(3)); }
        }
        clearTimeout(dog);
        if (ring) { ring.style.setProperty('--k-load', '1'); setTimeout(() => (ring.hidden = true), 400); }
        el.addEventListener('loadeddata', () => { self.ready = true; hero.classList.add('k-media-ready'); hero._kick(); }, { once: true });
        el.src = URL.createObjectURL(new Blob(parts, { type: res.headers.get('Content-Type') || 'video/mp4' }));
        el.load();
      } catch (e) { fail(); }
    }
    self.enable = () => { if (src()) load(); else hero.classList.add('k-media-static'); };
    self.render = p => seek(p * (el.duration || 0));
    return self;
  }

  /* ---------- depth image (WebGL) ---------- */
  const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;v.y=1.-v.y;gl_Position=vec4(a,0.,1.);}';
  const FS = [
    'precision mediump float;varying vec2 v;uniform sampler2D img,dep;',
    'uniform vec2 off;uniform float zoom,str;uniform vec2 cover;',
    'void main(){',
    ' vec2 uv=(v-.5)*cover/(1.+zoom)+.5;',
    ' float d=texture2D(dep,uv).r;',
    ' vec2 o=off*str*(d-.35);',
    // a second depth tap softens the tearing a single tap shows around near objects
    ' float d2=texture2D(dep,uv-o).r; o=off*str*(mix(d,d2,.5)-.35);',
    ' gl_FragColor=texture2D(img,clamp(uv-o,.001,.999));}'
  ].join('');
  function DepthImage(el, hero) {
    const self = { el, ready: false, px: 0, py: 0, tx: 0, ty: 0 };
    const strength = Number(el.dataset.strength || 0.035);
    const push = Number(el.dataset.push || 0.06);
    const usePointer = el.dataset.pointer !== '0';
    let gl, prog, tex = [], loc = {}, imgW = 16, imgH = 9;
    el.setAttribute('aria-hidden', 'true');
    const pick = k => (isPhone() && el.dataset[k + 'Mobile']) || el.dataset[k];
    const poster = pick('image');
    if (poster) hero.style.setProperty('--k-poster', `url("${poster}")`);

    function loadImg(u) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; }); }
    function mkTex(i, unit) {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, i);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(w => gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }
    function sh(type, s) { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    async function init() {
      try {
        gl = el.getContext('webgl', { antialias: false, premultipliedAlpha: false });
        if (!gl) throw new Error('no webgl');
        const [img, dep] = await Promise.all([loadImg(pick('image')), loadImg(pick('depth'))]);
        imgW = img.naturalWidth; imgH = img.naturalHeight;
        prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog); gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
        tex = [mkTex(img, 0), mkTex(dep, 1)];
        ['img', 'dep', 'off', 'zoom', 'str', 'cover'].forEach(n => (loc[n] = gl.getUniformLocation(prog, n)));
        gl.uniform1i(loc.img, 0); gl.uniform1i(loc.dep, 1);
        self.ready = true; hero.classList.add('k-media-ready'); size(); hero._kick();
      } catch (e) { hero.classList.add('k-media-failed'); }
    }
    function size() {
      if (!gl) return;
      const r = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(r.width * dpr)); el.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, el.width, el.height);
      const ca = r.width / r.height, ia = imgW / imgH; // object-fit: cover
      gl.uniform2f(loc.cover, ca > ia ? 1 : ca / ia, ca > ia ? ia / ca : 1);
    }
    if (usePointer) {
      window.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        self.tx = (e.clientX / innerWidth - 0.5) * 2; self.ty = (e.clientY / innerHeight - 0.5) * 2; hero._kick();
      }, { passive: true });
    }
    self.enable = () => { if (!gl) init(); };
    self.resize = size;
    self.render = (p, dt) => {
      if (!self.ready) return false;
      const k = 1 - Math.pow(1 - 0.08, dt / 16.667);
      self.px += (self.tx - self.px) * k; self.py += (self.ty - self.py) * k;
      // scroll moves the viewpoint down and in; the pointer adds a small orbit
      const ox = self.px * 0.6, oy = self.py * 0.4 + (p - 0.5) * 1.2;
      gl.uniform2f(loc.off, ox, oy); gl.uniform1f(loc.zoom, p * push); gl.uniform1f(loc.str, strength);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return Math.abs(self.tx - self.px) > 0.002 || Math.abs(self.ty - self.py) > 0.002;
    };
    return self;
  }

  /* ---------- hero ---------- */
  function Hero(hero) {
    const stage = hero.querySelector('.k-stage');
    const span = Number(hero.dataset.kSpan || 3);
    const bands = [...hero.querySelectorAll('[data-k-band]')].map((el, i, all) => {
      const [a, b] = el.dataset.kBand.split(/\s+/).map(Number);
      return { el, a, b, first: i === 0, last: i === all.length - 1, op: -1, k: -1 };
    });
    const layers = [...hero.querySelectorAll('[data-k-layer],[data-k-drift]')].map(el => ({
      el, rate: Number(el.dataset.kLayer || 0), drift: Number(el.dataset.kDrift || 0), t: ''
    }));
    const vEl = hero.querySelector('video[data-k-scrub]');
    const dEl = hero.querySelector('canvas[data-k-depth]');
    const media = vEl ? ScrubVideo(vEl, hero) : dEl ? DepthImage(dEl, hero) : null;
    let target = 0, shown = 0, raf = null, lastT = 0, onScreen = true, motion = false, px = 0, py = 0, tpx = 0, tpy = 0, lastP = '';

    const progress = () => {
      const r = hero.getBoundingClientRect(); const range = r.height - innerHeight;
      return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
    };
    function paintBands(p) {
      for (const b of bands) {
        const f = Math.min(0.03, (b.b - b.a) / 3);
        const inO = b.first ? 1 : smooth(p, b.a - f, b.a + f);
        const outO = b.last ? 1 : 1 - smooth(p, b.b - f, b.b + f);
        const op = Math.round(inO * outO * 100) / 100;
        const k = Math.round(clamp((p - b.a + f) / (2 * f + 0.02), 0, 1) * 100) / 100;
        if (op !== b.op) { b.op = op; b.el.style.opacity = op; b.el.style.visibility = op < 0.01 ? 'hidden' : 'visible'; }
        if (k !== b.k) { b.k = k; b.el.style.setProperty('--k', b.first ? 1 : k); }
      }
    }
    function paintLayers(p) {
      for (const L of layers) {
        const y = -L.rate * p * innerHeight, x = L.drift * px, yy = L.drift * py * 0.6;
        const t = `translate3d(${x.toFixed(1)}px,${(y + yy).toFixed(1)}px,0)`;
        if (t !== L.t) { L.t = t; L.el.style.transform = t; }
      }
    }
    function tick(now) {
      const dt = Math.min(100, now - (lastT || now)); lastT = now;
      const k = 1 - Math.pow(1 - 0.14, dt / 16.667);
      shown += (target - shown) * k;
      px += (tpx - px) * k; py += (tpy - py) * k;
      const settled = Math.abs(target - shown) < 0.0004 && Math.abs(tpx - px) < 0.002 && Math.abs(tpy - py) < 0.002;
      if (settled) shown = target;
      const ps = shown.toFixed(4);
      if (ps !== lastP) { lastP = ps; hero.style.setProperty('--k-p', ps); }
      paintBands(shown); paintLayers(shown);
      const mediaBusy = media && media.render ? media.render(shown, dt) : false;
      if ((!settled || mediaBusy) && onScreen && motion) raf = requestAnimationFrame(tick);
      else { raf = null; lastT = 0; }
    }
    hero._kick = () => { target = progress(); if (raf === null && onScreen && motion) raf = requestAnimationFrame(tick); };

    function setMode() {
      const staticHero = REDUCED.matches || (vEl && isPhone() && !vEl.dataset.srcMobile);
      motion = !staticHero;
      hero.classList.toggle('k-static', staticHero);
      hero.style.height = staticHero ? '' : span * 100 + 'vh';
      if (staticHero) { bands.forEach(b => { b.op = 1; b.el.style.opacity = 1; b.el.style.visibility = 'visible'; b.el.style.setProperty('--k', 1); });
        layers.forEach(L => { L.t = ''; L.el.style.transform = ''; }); if (raf) cancelAnimationFrame(raf); raf = null;
        return; } // static heroes show the poster image through CSS
      bands.forEach(b => { b.op = -1; b.k = -1; });
      if (media) media.enable();
      shown = target = progress(); hero._kick();
    }
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) hero._kick(); }, { rootMargin: '10% 0px' }).observe(hero);
    addEventListener('scroll', hero._kick, { passive: true });
    addEventListener('resize', () => { if (media && media.resize) media.resize(); hero._kick(); }, { passive: true });
    if (layers.some(L => L.drift)) addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tpx = (e.clientX / innerWidth - 0.5) * 2; tpy = (e.clientY / innerHeight - 0.5) * 2; hero._kick();
    }, { passive: true });
    [...PHONE_GATES, REDUCED].forEach(m => m.addEventListener('change', setMode));
    setMode();
  }

  /* ---------- flow reveals ---------- */
  function flow() {
    const els = document.querySelectorAll('[data-k-in]');
    if (REDUCED.matches || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '100000px 0px -12% 0px' }); // tall top margin: anything already scrolled past counts as seen
    els.forEach(e => io.observe(e));
  }

  document.addEventListener('visibilitychange', () => document.body.classList.toggle('k-paused', document.hidden));
  const start = () => { document.querySelectorAll('[data-k-hero]').forEach(Hero); flow(); document.documentElement.classList.add('k-on'); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
