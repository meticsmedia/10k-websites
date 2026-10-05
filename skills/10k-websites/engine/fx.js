/* fx.js: the 10K Websites effects library. Vanilla JS, no dependencies, no build step.
   Every effect is switched on with data-fx="name" in the HTML and styled by fx.css.
   Do not edit per project: theme with CSS variables, tune with data-fx-* attributes.
   Everything respects prefers-reduced-motion and pauses when off screen.

   SCROLL
   expand   media that grows from a card to full screen as you scroll        data-fx-span="2"
   tilt     a framed screen that tilts back and settles flat as it arrives
   rail     a gallery that moves sideways while the section stays pinned
   shift    the whole page shifts colour as you scroll (on <body>)          data-fx-stops="0 #f4efe6 #241d16, 1 #221b25 #f3ece2"
   POINTER
   spotlight  a soft light follows the pointer across a grid of cards
   hover-tilt cards lean toward the pointer, with a glare
   magnet     buttons pull gently toward the pointer                        data-fx-strength="0.35"
   glass      a glassy button with a moving sheen
   reveal     list rows that show a floating photo on hover                  data-fx-img on each row
   TEXT
   split    headline words (or letters) rise into place when they appear     data-fx-split="chars"
   words    one word that cycles through a list                             data-fx-words="calm,warm,yours"
   count    a number that counts up when it appears                          data-fx-to="1200"
   AMBIENT
   columns  testimonial columns that drift upward forever (children .fx-col)
   marquee  a row that drifts sideways forever
   paths    slow flowing lines behind a section                               data-fx-lines="18"
   aurora   a soft moving colour field (WebGL) behind a section               data-fx-colors="#f3d9b1,#e9a87c,#7a9ea8"
*/
(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const PHONE = matchMedia('(max-width: 720px)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fx = name => $$(`[data-fx~="${name}"]`);
  const num = (el, k, d) => (el.dataset[k] !== undefined ? Number(el.dataset[k]) : d);
  const setVar = (el, k, v) => { const s = typeof v === 'number' ? v.toFixed(4) : v; if (el['_' + k] !== s) { el['_' + k] = s; el.style.setProperty(k, s); } };

  /* ---------- one scroll loop for every scroll-linked effect ---------- */
  const scrollers = [];
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } };
  function runScroll() { ticking = false; const vh = innerHeight; for (const s of scrollers) if (s.visible !== false) s.update(vh); }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { scrollers.forEach(s => s.resize && s.resize()); onScroll(); }, { passive: true });
  const watch = (el, s) => {
    scrollers.push(s);
    new IntersectionObserver(es => { s.visible = es[0].isIntersecting; if (s.visible) onScroll(); }, { rootMargin: '20% 0px' }).observe(el);
  };
  // progress of a pinned section: 0 when its top reaches the top of the screen, 1 when its bottom reaches the bottom
  const pinProgress = (el, vh) => { const r = el.getBoundingClientRect(); const range = r.height - vh; return range > 0 ? clamp(-r.top / range) : 0; };
  // progress of an element travelling up the screen: 0 when its top enters at the bottom, 1 when its centre is mid-screen
  const arriveProgress = (el, vh) => { const r = el.getBoundingClientRect(); return clamp((vh - r.top) / (vh * 0.5 + r.height * 0.5)); };

  /* ---------- expand ---------- */
  function expand(el) {
    el.style.setProperty('--fx-span', num(el, 'fxSpan', 2));
    watch(el, { update: vh => setVar(el, '--fx-p', ease(pinProgress(el, vh))) });
  }
  /* ---------- tilt ---------- */
  function tilt(el) { watch(el, { update: vh => setVar(el, '--fx-p', ease(arriveProgress(el, vh))) }); }
  /* ---------- rail ---------- */
  function rail(el) {
    const track = el.querySelector('.fx-rail-track');
    if (!track) return;
    const s = {
      resize() {
        if (PHONE.matches) { el.style.height = ''; track.style.transform = ''; return; }
        s.dist = Math.max(0, track.scrollWidth - innerWidth);
        el.style.height = `calc(100vh + ${s.dist}px)`;
      },
      update(vh) { if (PHONE.matches) return; const p = pinProgress(el, vh); setVar(el, '--fx-p', p); track.style.transform = `translate3d(${(-p * s.dist).toFixed(1)}px,0,0)`; }
    };
    s.resize(); watch(el, s);
    PHONE.addEventListener('change', () => { s.resize(); onScroll(); });
    // images can change the track width once they load
    $$('img', track).forEach(i => i.complete || i.addEventListener('load', () => { s.resize(); onScroll(); }, { once: true }));
  }
  /* ---------- shift ---------- */
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(' ')})`;
  function shift(el) {
    const stops = (el.dataset.fxStops || '').split(',').map(s => s.trim().split(/\s+/)).filter(s => s.length >= 2)
      .map(([at, bg, ink]) => ({ at: Number(at), bg: hex(bg), ink: ink ? hex(ink) : null })).sort((a, b) => a.at - b.at);
    if (stops.length < 2) return;
    const s = {
      update() {
        const max = document.documentElement.scrollHeight - innerHeight;
        const p = max > 0 ? clamp(scrollY / max) : 0;
        let i = 0; while (i < stops.length - 2 && p > stops[i + 1].at) i++;
        const a = stops[i], b = stops[i + 1], t = clamp((p - a.at) / ((b.at - a.at) || 1));
        setVar(el, '--fx-bg', mix(a.bg, b.bg, t));
        if (a.ink && b.ink) setVar(el, '--fx-ink', mix(a.ink, b.ink, t));
        setVar(el, '--fx-page', p);
      }
    };
    scrollers.push(s); s.update();
  }

  /* ---------- spotlight ---------- */
  function spotlight(el) {
    const cards = el.children.length ? [...el.children] : [el];
    el.addEventListener('pointermove', e => {
      for (const c of cards) { const r = c.getBoundingClientRect(); c.style.setProperty('--fx-x', `${e.clientX - r.left}px`); c.style.setProperty('--fx-y', `${e.clientY - r.top}px`); }
    }, { passive: true });
  }
  /* ---------- hover-tilt ---------- */
  function hoverTilt(el) {
    const max = num(el, 'fxMax', 8);
    let raf = null, tx = 0, ty = 0, x = 0, y = 0;
    const loop = () => {
      x = lerp(x, tx, 0.15); y = lerp(y, ty, 0.15);
      el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      el.style.setProperty('--fx-gx', `${50 + x * 50}%`); el.style.setProperty('--fx-gy', `${50 + y * 50}%`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(loop) : null;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width * 2 - 1; ty = (e.clientY - r.top) / r.height * 2 - 1; kick(); }, { passive: true });
    el.addEventListener('pointerleave', () => { tx = ty = 0; kick(); });
  }
  /* ---------- magnet ---------- */
  function magnet(el) {
    const k = num(el, 'fxStrength', 0.35);
    let raf = null, tx = 0, ty = 0, x = 0, y = 0;
    const loop = () => {
      x = lerp(x, tx, 0.18); y = lerp(y, ty, 0.18);
      el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(loop) : null;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); tx = (e.clientX - r.left - r.width / 2) * k; ty = (e.clientY - r.top - r.height / 2) * k; kick(); }, { passive: true });
    el.addEventListener('pointerleave', () => { tx = ty = 0; kick(); });
  }
  /* ---------- glass ---------- */
  function glass(el) {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--fx-x', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`); }, { passive: true });
  }
  /* ---------- reveal ---------- */
  function reveal(el) {
    const float = document.createElement('div');
    float.className = 'fx-reveal-float'; float.setAttribute('aria-hidden', 'true');
    const rows = $$('[data-fx-img]', el);
    const imgs = rows.map(r => { const i = new Image(); i.alt = ''; i.decoding = 'async'; i.loading = 'lazy'; i.src = r.dataset.fxImg; float.appendChild(i); return i; });
    document.body.appendChild(float);
    let raf = null, tx = 0, ty = 0, x = 0, y = 0;
    const loop = () => { x = lerp(x, tx, 0.16); y = lerp(y, ty, 0.16); float.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : null; };
    el.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
    rows.forEach((r, i) => {
      r.addEventListener('pointerenter', () => { imgs.forEach((im, j) => im.classList.toggle('is-on', i === j)); float.classList.add('is-on'); });
    });
    el.addEventListener('pointerleave', () => float.classList.remove('is-on'));
  }

  /* ---------- split ---------- */
  function split(el) {
    if (el.dataset.fxDone) return;
    // Split is for display text. Never hide an authored link/control from accessibility.
    if (el.querySelector('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
    el.dataset.fxDone = '1';
    const chars = el.dataset.fxSplit === 'chars';
    const copy = el.cloneNode(true);
    copy.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    const label = copy.textContent.trim().replace(/\s+/g, ' ');
    let n = 0;
    // Work on text nodes, so <em>, <strong>, line breaks, and their styles survive.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const token of node.textContent.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) { frag.append(document.createTextNode(token)); continue; }
        const word = document.createElement('span'); word.className = 'fx-w';
        const inner = document.createElement('span'); inner.className = 'fx-wi';
        if (chars) {
          for (const char of token) { const c = document.createElement('span'); c.className = 'fx-c'; c.style.setProperty('--i', n++); c.textContent = char; inner.append(c); }
        } else { word.style.setProperty('--i', n++); inner.textContent = token; }
        word.append(inner); frag.append(word);
      }
      node.replaceWith(frag);
    }
    // A visually hidden text node works on headings AND generic spans. aria-label on
    // generic spans is invalid and fragmented animated words must not be read twice.
    [...el.children].forEach(child => child.setAttribute('aria-hidden', 'true'));
    const sr = document.createElement('span'); sr.className = 'fx-sr'; sr.textContent = label;
    el.prepend(sr);
    el.style.setProperty('--fx-n', n);
    inView(el, () => el.classList.add('is-in'));
  }
  /* ---------- words ---------- */
  function words(el) {
    const list = (el.dataset.fxWords || '').split(',').map(s => s.trim()).filter(Boolean);
    if (list.length < 2) return;
    const every = num(el, 'fxEvery', 2400);
    el.setAttribute('aria-hidden', 'true');
    const sr = document.createElement('span'); sr.className = 'fx-sr'; sr.textContent = list.join(', ');
    el.after(sr);
    el.innerHTML = list.map((w, i) => `<span class="fx-word${i ? '' : ' is-on'}">${w}</span>`).join('');
    const spans = $$('.fx-word', el);
    const fit = () => { el.style.width = spans.find(s => s.classList.contains('is-on')).offsetWidth + 'px'; };
    fit();
    let i = 0, timer = null;
    const step = () => { spans[i].classList.remove('is-on'); spans[i].classList.add('is-out'); const prev = i; setTimeout(() => spans[prev].classList.remove('is-out'), 700); i = (i + 1) % spans.length; spans[i].classList.add('is-on'); fit(); };
    new IntersectionObserver(es => { clearInterval(timer); if (es[0].isIntersecting && !RM.matches) timer = setInterval(step, every); }).observe(el);
    document.fonts && document.fonts.ready.then(fit);
  }
  /* ---------- count ---------- */
  function count(el) {
    const to = num(el, 'fxTo', Number(el.textContent.replace(/[^\d.]/g, '')) || 0);
    const dec = num(el, 'fxDecimals', 0), dur = num(el, 'fxDuration', 1600);
    const fmt = new Intl.NumberFormat(document.documentElement.lang || undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const pre = el.dataset.fxPrefix || '', post = el.dataset.fxSuffix || '';
    const show = v => { el.textContent = pre + fmt.format(v) + post; };
    el.setAttribute('aria-label', pre + fmt.format(to) + post);
    if (RM.matches) return show(to);
    show(0);
    inView(el, () => { const t0 = performance.now(); const f = now => { const t = clamp((now - t0) / dur); show(to * ease(t)); if (t < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  }

  /* ---------- columns and marquee ---------- */
  function loopClone(track) {
    [...track.children].forEach(c => { const d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); d.querySelectorAll('a,button').forEach(a => a.tabIndex = -1); track.appendChild(d); });
  }
  function columns(el) {
    $$('.fx-col', el).forEach((col, i) => {
      const inner = document.createElement('div'); inner.className = 'fx-col-track';
      while (col.firstChild) inner.appendChild(col.firstChild);
      col.appendChild(inner); loopClone(inner);
      inner.style.animationDuration = `${num(col, 'fxSeconds', 38 + i * 9)}s`;
    });
    pauseOffscreen(el);
  }
  function marquee(el) {
    let track = el.querySelector('.fx-marquee-track');
    if (!track) { track = document.createElement('div'); track.className = 'fx-marquee-track'; while (el.firstChild) track.appendChild(el.firstChild); el.appendChild(track); }
    loopClone(track);
    track.style.animationDuration = `${num(el, 'fxSeconds', 40)}s`;
    pauseOffscreen(el);
  }
  /* ---------- paths ---------- */
  function paths(el) {
    const n = num(el, 'fxLines', 18);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'fx-paths'); svg.setAttribute('viewBox', '0 0 1000 600'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < n; i++) {
      const y0 = 600 * (i + 0.5) / n, a = 60 + rnd() * 140, b = 40 + rnd() * 120, off = rnd() * 200 - 100;
      const d = `M-50 ${y0} C 250 ${y0 - a + off}, 450 ${y0 + b}, 700 ${y0 - b / 2} S 1000 ${y0 + a / 3}, 1050 ${y0 + off / 3}`;
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d); p.setAttribute('pathLength', '1');
      p.style.setProperty('--fx-d', `${14 + rnd() * 16}s`); p.style.setProperty('--fx-o', (0.08 + 0.5 * (i / n)).toFixed(2)); p.style.animationDelay = `${-rnd() * 20}s`;
      svg.appendChild(p);
    }
    el.prepend(svg);
    pauseOffscreen(el);
  }
  /* ---------- aurora (WebGL) ---------- */
  const AFS = `precision mediump float;uniform vec2 r;uniform float t;uniform vec3 c1,c2,c3;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.6;
float a=fb(p+vec2(t*.03,t*.02));float b=fb(p*1.3-vec2(t*.02,-t*.025)+a);
vec3 col=mix(c1,c2,smoothstep(.25,.75,a));col=mix(col,c3,smoothstep(.45,.85,b)*.8);
col+=(h(gl_FragCoord.xy+t)-.5)*.025;gl_FragColor=vec4(col,1.);}`;
  function aurora(el) {
    const colors = (el.dataset.fxColors || '#f3d9b1,#e9a87c,#7a9ea8').split(',').map(c => c.trim());
    const cols = colors.map(c => hex(c).map(v => v / 255));
    ['--fx-a1', '--fx-a2', '--fx-a3'].forEach((k, i) => el.style.setProperty(k, colors[i] || colors[0]));
    // The static gradient is immediate, including reduced motion. No canvas, WebGL
    // context, shader compilation, or animation is paid for below-the-fold content.
    el.classList.add('fx-aurora-fallback');
    let cv, gl, program, buffer, shaders = [], uniforms = {}, failed = false;
    let near = false, visible = false, raf = null, last = 0, t = Math.random() * 100;
    const stop = () => { if (raf !== null) cancelAnimationFrame(raf); raf = null; };
    const size = () => {
      if (!gl) return;
      const r = el.getBoundingClientRect(), scale = 0.5;
      cv.width = Math.max(2, r.width * scale | 0); cv.height = Math.max(2, r.height * scale | 0);
      gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uniforms.r, cv.width, cv.height);
    };
    const dispose = () => {
      stop();
      if (gl) { shaders.forEach(s => gl.deleteShader(s)); if (program) gl.deleteProgram(program); if (buffer) gl.deleteBuffer(buffer); }
      if (cv) cv.remove(); cv = gl = null; shaders = [];
      el.classList.add('fx-aurora-fallback');
    };
    const init = () => {
      if (gl || failed || RM.matches || document.hidden || !near) return;
      try {
        cv = document.createElement('canvas'); cv.className = 'fx-aurora'; cv.setAttribute('aria-hidden', 'true');
        gl = cv.getContext('webgl', { antialias: false, alpha: false });
        if (!gl) throw new Error('WebGL unavailable');
        const sh = (ty, src) => {
          const shader = gl.createShader(ty); shaders.push(shader); gl.shaderSource(shader, src); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader unavailable');
          return shader;
        };
        program = gl.createProgram();
        gl.attachShader(program, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
        gl.attachShader(program, sh(gl.FRAGMENT_SHADER, AFS)); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program unavailable');
        gl.useProgram(program);
        buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const al = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
        ['r', 't', 'c1', 'c2', 'c3'].forEach(k => (uniforms[k] = gl.getUniformLocation(program, k)));
        ['c1', 'c2', 'c3'].forEach((k, i) => gl.uniform3fv(uniforms[k], cols[i] || cols[0]));
        size(); gl.uniform1f(uniforms.t, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        el.prepend(cv); el.classList.remove('fx-aurora-fallback');
        cv.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; dispose(); }, { once: true });
      } catch { failed = true; dispose(); }
    };
    const draw = now => {
      raf = null;
      if (!gl || !visible || RM.matches || document.hidden) return;
      if (now - last >= 33) { t += Math.min(now - last, 100) / 1000; last = now; gl.uniform1f(uniforms.t, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
      raf = requestAnimationFrame(draw);
    };
    const resume = () => {
      init();
      if (gl && visible && !RM.matches && !document.hidden && raf === null) { last = performance.now(); raf = requestAnimationFrame(draw); }
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { near = es[0].isIntersecting; if (near) resume(); }, { rootMargin: '160px 0px' }).observe(el);
      new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? resume() : stop(); }).observe(el);
    } // Old browsers keep the static gradient rather than start an unbounded loop.
    addEventListener('resize', () => { size(); resume(); }, { passive: true });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : resume());
    RM.addEventListener('change', () => {
      if (RM.matches) dispose();
      else resume();
    });
  }

  /* ---------- helpers ---------- */
  function inView(el, fn) {
    if (RM.matches || !('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting || es[0].boundingClientRect.top < 0) { io.disconnect(); fn(); } }, { rootMargin: '100000px 0px -10% 0px' });
    io.observe(el);
  }
  function pauseOffscreen(el) {
    new IntersectionObserver(es => el.classList.toggle('fx-paused', !es[0].isIntersecting)).observe(el);
  }

  /* ---------- start ---------- */
  const TABLE = { expand, tilt, rail, shift, spotlight, 'hover-tilt': hoverTilt, magnet, glass, reveal, split, words, count, columns, marquee, paths, aurora };
  const POINTER_ONLY = new Set(['spotlight', 'hover-tilt', 'magnet', 'reveal']);
  const MOTION = new Set(['expand', 'tilt', 'rail', 'shift', 'columns', 'marquee', 'paths']);
  function start() {
    document.documentElement.classList.add('fx-on');
    if (RM.matches) document.documentElement.classList.add('fx-still');
    for (const [name, init] of Object.entries(TABLE)) {
      if (POINTER_ONLY.has(name) && !FINE.matches) continue;
      if (MOTION.has(name) && RM.matches && name !== 'shift' && name !== 'paths') continue;
      fx(name).forEach(el => { try { init(el); } catch (e) { console.warn('fx', name, e); } });
    }
    onScroll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
