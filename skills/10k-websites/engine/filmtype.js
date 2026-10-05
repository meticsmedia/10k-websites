/* filmtype.js: words fixed to surfaces in the hero film. Ships with the 10K Websites skill.
   Copy into site/ unchanged, like scene.js. Load it after scene.js and site/filmtrack.js
   (written by .10k/tools/track.mjs). See references/engine.md, "Words fixed to the film".

   <div class="ft-layer" data-ft-layer aria-hidden="true">        inside .k-stage
     <div data-ft="wall" data-ft-fade="178 198">                   one surface per group
       <span data-ft-at="955,244,center" style="font-size:110px">The evening</span>
     </div>
   </div>

   Group attributes (all sizes and positions are film pixels on the surface's reference frame):
     data-ft="name"                surface from filmtrack.js
     data-ft-for="wide|phone"      only this layout (default: both)
     data-ft-fade="a b c d"        fade in over frames a..b, out over c..d ("-" = none)
     data-ft-depth="1.2"           a plane nearer (>1) or farther (<1) than the surface, for
                                   straight pushes and sideways moves
     data-ft-window="name:x,y,w,h[:open|hide]"  only visible through an opening (a door,
                                   window or arch) that sits on surface "name"; after that
                                   surface's track ends: open (camera passed through) or hide
     data-ft-paint="auto|on|off"   paint once and scale the picture (no shimmer as it grows)
     data-ft-edge="off"            keep it even at the screen edge (default: fades out there)
   Line: data-ft-at="x,y[,start|center|end]" puts the baseline at x,y.
   On the page: .ft-on on the hero; data-ft-replaces on the caption a group stands in for. */
(() => {
  'use strict';
  const T = window.FILMTRACK;
  const hero = document.querySelector('[data-k-hero]');
  const stage = hero && hero.querySelector('.k-stage');
  const video = stage && stage.querySelector('video[data-k-scrub]');
  const layer = stage && stage.querySelector('[data-ft-layer]');
  if (!T || !video || !layer) return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a || 1), 0, 1); return t * t * (3 - 2 * t); };
  const warned = new Set(), warn = m => { if (!warned.has(m)) { warned.add(m); console.warn('filmtype: ' + m); } };
  const ID = [1, 0, 0, 1, 0, 0, 0, 0];
  const apply = (m, x, y) => { const w = m[6] * x + m[7] * y + 1; return [(m[0] * x + m[2] * y + m[4]) / w, (m[1] * x + m[3] * y + m[5]) / w, w]; };
  const full = m => (m.length === 6 ? [...m, 0, 0] : m);

  /* ---------- groups ---------- */
  const rectOf = s => s.split(',').map(Number);
  const groups = [...layer.querySelectorAll('[data-ft]')].map(el => {
    const d = el.dataset, fade = (d.ftFade || '').trim().split(/\s+/).map(v => (v === '-' || v === '' ? null : Number(v)));
    while (fade.length < 4) fade.push(null);
    let win = null;
    if (d.ftWindow) { const [name, r, after] = d.ftWindow.split(':'); win = { name, r: rectOf(r), after: after === 'hide' ? 'hide' : 'open' }; }
    const clip = document.createElement('div'); clip.className = 'ft-clip';
    el.parentNode.insertBefore(clip, el); clip.appendChild(el);
    return { el, clip, surface: d.ft, only: d.ftFor || '', fade, depth: Number(d.ftDepth || 1), win,
      paint: d.ftPaint || 'auto', edge: d.ftEdge !== 'off', lines: [...el.querySelectorAll('[data-ft-at]')], box: null, canvas: null, res: 0, last: '' };
  });
  if (!groups.length) return;

  /* ---------- surfaces and the film-to-screen map ---------- */
  const isPhoneClip = () => video.videoWidth > 0 && video.videoWidth < video.videoHeight;
  // where a surface's numbers come from in the current layout
  function source(name, phone) {
    if (phone && T.phone && T.phone.surfaces && T.phone.surfaces[name]) return { S: T.phone.surfaces[name], space: 'phone', fps: T.phone.fps, frames: T.phone.frames };
    const S = T.wide && T.wide.surfaces && T.wide.surfaces[name];
    if (!S) { warn(`no surface "${name}" in filmtrack.js`); return null; }
    if (phone && !T.phoneCrop) { warn(`the phone clip is not a crop of the wide film, so "${name}" needs its own phone track (track.mjs --variant phone)`); return null; }
    return { S, space: phone ? 'crop' : 'wide', fps: T.wide.fps, frames: T.wide.frames };
  }
  function objectPos(W, H, fw, fh, c) {
    const p = getComputedStyle(video).objectPosition.split(/\s+/), f = (t, free) => (/%$/.test(t) ? free * parseFloat(t) / 100 : /px$/.test(t) ? parseFloat(t) : free / 2);
    return [f(p[0] || '50%', W - fw * c), f(p[1] || '50%', H - fh * c)];
  }
  function view(space) {
    const r = stage.getBoundingClientRect(), W = r.width, H = r.height;
    if (space === 'wide') { const [fw, fh] = T.wide.film, c = Math.max(W / fw, H / fh), [ox, oy] = objectPos(W, H, fw, fh, c); return { a: c, ox, oy, W, H }; }
    const fw = video.videoWidth || (T.phone ? T.phone.film[0] : 720), fh = video.videoHeight || (T.phone ? T.phone.film[1] : 1280);
    const c = Math.max(W / fw, H / fh), [ox, oy] = objectPos(W, H, fw, fh, c);
    if (space === 'phone') return { a: c, ox, oy, W, H };
    const { x, y, scale } = T.phoneCrop, a = c * scale;
    return { a, ox: ox - a * x, oy: oy - a * y, W, H };
  }
  // a plane nearer or farther than the tracked surface (straight push or sideways move)
  function atDepth(M, w) {
    if (w === 1) return M;
    if (M[6] || M[7]) { warn('data-ft-depth needs a translate, scale or similarity track'); return M; }
    const [a, b, c, d, e, f] = M, s = Math.sqrt(Math.abs(a * d - b * c));
    if (Math.abs(s - 1) < 0.002) return [a, b, c, d, e * w, f * w, 0, 0];
    const det = (1 - a) * (1 - d) - b * c; if (Math.abs(det) < 1e-9) return M;
    const px = ((1 - d) * e + c * f) / det, py = (b * e + (1 - a) * f) / det; // the point that does not move
    const q = 1 - w * (1 - 1 / s); if (q < 0.15) return null;                  // past the camera
    const k = 1 / q / s, L = [a * k, b * k, c * k, d * k];
    return [L[0], L[1], L[2], L[3], px - (L[0] * px + L[2] * py), py - (L[1] * px + L[3] * py), 0, 0];
  }
  const toScreen = (V, M) => {
    const A = V.a, X = V.ox, Y = V.oy;
    return [A * M[0] + X * M[6], A * M[1] + Y * M[6], A * M[2] + X * M[7], A * M[3] + Y * M[7], A * M[4] + X, A * M[5] + Y, M[6], M[7]];
  };
  const css = m => {
    const n = v => +v.toFixed(Math.abs(v) < 0.01 ? 9 : 5);
    return Math.abs(m[6]) < 1e-12 && Math.abs(m[7]) < 1e-12 ? `matrix(${[m[0], m[1], m[2], m[3], m[4], m[5]].map(n).join(',')})`
      : `matrix3d(${[m[0], m[1], 0, m[6], m[2], m[3], 0, m[7], 0, 0, 1, 0, m[4], m[5], 0, 1].map(n).join(',')})`;
  };

  /* ---------- layout (film pixels) ---------- */
  const offsetIn = (el, root) => { let x = 0, y = 0; for (let e = el; e && e !== root; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; };
  function probe(el) { let p = el.querySelector(':scope > .ft-probe'); if (!p) { p = document.createElement('i'); p.className = 'ft-probe'; el.prepend(p); } return p; }
  function layout(g, film) {
    g.el.style.width = film[0] + 'px'; g.el.style.height = film[1] + 'px';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const L of g.lines) {
      const [x, y, al = 'start'] = L.dataset.ftAt.split(','), w = L.offsetWidth, base = probe(L).offsetTop;
      const left = +x - (al === 'center' ? w / 2 : al === 'end' ? w : 0), top = +y - base;
      L.style.left = left + 'px'; L.style.top = top + 'px';
      x0 = Math.min(x0, left); y0 = Math.min(y0, top); x1 = Math.max(x1, left + w); y1 = Math.max(y1, top + L.offsetHeight);
    }
    g.box = x0 < x1 ? [x0, y0, x1, y1] : null;
  }

  /* ---------- painting: one bitmap, only ever scaled ---------- */
  function shadows(s) {
    if (!s || s === 'none') return [];
    const parts = [], re = /(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]+|[a-z]+)|(-?[\d.]+)px/gi;
    for (const one of s.split(/,(?![^(]*\))/)) {
      let col = 'rgba(0,0,0,1)', nums = [], m; re.lastIndex = 0;
      while ((m = re.exec(one))) { if (m[1]) col = m[1]; else nums.push(+m[2]); }
      parts.push({ col, x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0 });
    }
    return parts.reverse(); // CSS paints the first shadow on top
  }
  function runs(g) {
    if (g.runs) return g.runs;
    const out = [];
    for (const L of g.lines) {
      const walker = document.createTreeWalker(L, NodeFilter.SHOW_TEXT), texts = [];
      for (let n; (n = walker.nextNode());) if (n.nodeValue.trim()) texts.push(n);
      for (const t of texts) { const s = document.createElement('span'); s.className = 'ft-run'; t.parentNode.insertBefore(s, t); s.appendChild(t); out.push(s); }
    }
    return (g.runs = out);
  }
  function paint(g, R) {
    if (!g.box) return;
    const pad = 48, [x0, y0, x1, y1] = g.box, bx = x0 - pad, by = y0 - pad, bw = x1 - x0 + 2 * pad, bh = y1 - y0 + 2 * pad;
    if (!g.canvas) { g.canvas = document.createElement('canvas'); g.canvas.className = 'ft-paint'; g.el.appendChild(g.canvas); }
    const c = g.canvas; R = Math.min(R, 4096 / bw, 4096 / bh);
    Object.assign(c.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
    c.width = Math.max(1, Math.round(bw * R)); c.height = Math.max(1, Math.round(bh * R));
    const x = c.getContext('2d'); x.setTransform(R, 0, 0, R, -bx * R, -by * R);
    for (const s of runs(g)) {
      const cs = getComputedStyle(s), [lx, ly] = offsetIn(probe(s), g.el);
      x.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('letterSpacing' in x) x.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      if ('fontKerning' in x) x.fontKerning = cs.fontKerning === 'none' ? 'none' : 'normal';
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      const text = s.textContent, far = 20000;
      for (const sh of shadows(cs.textShadow)) { // shadow only: the letters are drawn far away
        x.shadowColor = sh.col; x.shadowBlur = sh.blur * R; x.shadowOffsetX = (far + sh.x) * R; x.shadowOffsetY = sh.y * R;
        x.fillStyle = sh.col; x.fillText(text, lx - far, ly);
      }
      x.shadowColor = 'transparent'; x.fillStyle = cs.color; x.fillText(text, lx, ly);
    }
    g.el.classList.add('ft-painted'); g.res = R;
  }
  const areaScale = (M, b) => {
    const q = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(p => apply(M, ...p));
    let s = 0; for (let i = 0; i < 4; i++) s += q[i][0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * q[i][1];
    return Math.sqrt(Math.abs(s / 2) / ((b[2] - b[0]) * (b[3] - b[1])));
  };

  /* ---------- per frame ---------- */
  let frame = 0, on = false, V = {}, phone = false, ready = false;
  function prepare() {
    phone = isPhoneClip(); V = {};
    layer.dataset.ftVariant = phone ? 'phone' : 'wide';
    for (const g of groups) {
      g.src = (g.only && g.only !== (phone ? 'phone' : 'wide')) ? null : source(g.surface, phone);
      g.wsrc = g.win ? source(g.win.name, phone) : null;
      g.last = ''; g.el.style.visibility = 'hidden';
      if (!g.src) continue;
      layout(g, g.src.space === 'phone' ? T.phone.film : T.wide.film);
      const v = V[g.src.space] || (V[g.src.space] = view(g.src.space)), m = g.src.S.m;
      let lo = Infinity, hi = 0;
      for (const e of m) if (e && g.box) { const M = atDepth(full(e), g.depth); if (M) { const s = areaScale(M, g.box); lo = Math.min(lo, s); hi = Math.max(hi, s); } }
      const want = g.paint === 'on' || (g.paint === 'auto' && hi / lo > 1.15);
      if (want) paint(g, Math.min(4, hi * v.a * (devicePixelRatio || 1)));
      else if (g.canvas) { g.canvas.remove(); g.canvas = null; g.el.classList.remove('ft-painted'); }
    }
    ready = true;
  }
  const fadeAt = (f, k) => (f[0] == null ? 1 : smooth(k, f[0], f[1])) * (f[2] == null ? 1 : 1 - smooth(k, f[2], f[3]));
  function render() {
    if (!on) return;
    if (!ready) prepare();
    for (const g of groups) {
      let op = 0, M = null, clip = 'none';
      if (g.src && g.box) {
        const S = g.src.S, k = clamp(frame, 0, S.m.length - 1);
        op = fadeAt(g.fade, k);
        // a track that stops before the film does fades over 6 frames instead of popping
        if (S.from > 0) op *= smooth(k, S.from, S.from + 6);
        if (S.to < g.src.frames - 1) op *= 1 - smooth(k, S.to - 6, S.to);
        const e = op > 0.003 && S.m[k] ? atDepth(full(S.m[k]), g.depth) : null;
        if (e) {
          const v = V[g.src.space], b = g.box, Ms = toScreen(v, e);
          const q = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(p => apply(Ms, ...p));
          if (q.every(p => p[2] > 0.05)) {
            M = Ms;
            if (g.edge) {
              const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
              op *= smooth(Math.min(Math.min(...xs), v.W - Math.max(...xs)), 8, 40) * smooth(Math.min(Math.min(...ys), v.H - Math.max(...ys)), -12, 24);
            }
          }
        }
        if (M && g.win) {
          const W = g.wsrc && g.wsrc.S, wk = W && W.m[clamp(frame, 0, W.m.length - 1)];
          if (wk) {
            const Mw = toScreen(V[g.wsrc.space] || (V[g.wsrc.space] = view(g.wsrc.space)), full(wk)), r = g.win.r;
            clip = `polygon(${[[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]].map(p => apply(Mw, ...p)).map(p => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(',')})`;
          } else if (!W || frame < W.from || g.win.after === 'hide') M = null;
        }
      }
      const key = M && op > 0.003 ? `${css(M)}|${op.toFixed(3)}|${clip}` : 'off';
      if (key === g.last) continue;
      g.last = key;
      if (key === 'off') { g.el.style.visibility = 'hidden'; continue; }
      g.el.style.transform = css(M); g.el.style.opacity = op.toFixed(3); g.el.style.visibility = 'visible';
      g.clip.style.clipPath = clip === 'none' ? '' : clip;
    }
    layer.dataset.ftFrame = frame;
  }

  /* ---------- the frame actually on screen ---------- */
  const fps = () => ((phone && T.phone ? T.phone.fps : T.wide && T.wide.fps) || 30);
  const setFrame = k => { if (k !== frame) { frame = k; render(); } };
  video.addEventListener('seeked', () => setFrame(Math.floor(video.currentTime * fps() + 1e-3)));
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    const onFrame = (now, md) => { setFrame(Math.round(md.mediaTime * fps())); video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }
  const redo = () => { ready = false; render(); };
  video.addEventListener('loadedmetadata', redo);
  addEventListener('resize', redo, { passive: true });
  if (document.fonts) { document.fonts.ready.then(redo); document.fonts.addEventListener('loadingdone', redo); }

  /* ---------- on only when the film really plays ---------- */
  function mode() {
    const next = !REDUCED.matches && hero.classList.contains('k-media-ready') && !hero.classList.contains('k-static') && !hero.classList.contains('k-media-failed');
    if (next === on) return;
    on = next; hero.classList.toggle('ft-on', on);
    if (on) redo();
  }
  new MutationObserver(mode).observe(hero, { attributes: true, attributeFilter: ['class'] });
  REDUCED.addEventListener('change', mode);
  mode();
})();
