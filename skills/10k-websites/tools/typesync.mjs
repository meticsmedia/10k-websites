#!/usr/bin/env node
// typesync.mjs: proves that words fixed to the film (engine/filmtype.js) stay on the frame the
// visitor actually sees, on desktop and phone, while scrolling forward, backward and jumping.
// Usage: node .10k/tools/typesync.mjs site [review] [--frames 0,40,80,...]
// Writes review/typesync-desk.jpg and review/typesync-phone.jpg: the hero at chosen frames with
// the film-type layer drawn. Look at them: every word must sit where it was designed to.
// Uses the Chrome (or Edge) already installed. CHROME=/path overrides.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStaticServer, closeServer } from './server.mjs';

const FF = process.env.FFMPEG || 'ffmpeg';
const TW = 64, TH = 36;
const wait = ms => new Promise(r => setTimeout(r, ms));

// every decoded frame of a clip as a tiny grey thumbnail
function thumbs(file) {
  const r = spawnSync(FF, ['-v', 'error', '-i', file, '-fps_mode', 'passthrough', '-vf', `scale=${TW}:${TH}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`FFmpeg could not decode ${file}`);
  const n = r.stdout.length / (TW * TH);
  return Array.from({ length: n }, (_, i) => z(r.stdout.subarray(i * TW * TH, (i + 1) * TW * TH)));
}
// compare shapes, not raw levels: FFmpeg's grey and the browser's grey use different ranges
const z = a => { let m = 0, v = 0; for (const x of a) m += x; m /= a.length; for (const x of a) v += (x - m) ** 2; const s = Math.sqrt(v / a.length) || 1; return Float32Array.from(a, x => (x - m) / s); };
const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s / a.length; };
// which decoded frame a captured thumbnail is (frames that look identical count as the same)
function identify(ref, g, near) {
  let best = -1, bd = Infinity;
  for (let k = Math.max(0, near - 12); k <= Math.min(ref.length - 1, near + 12); k++) { const d = dist(ref[k], g); if (d < bd) { bd = d; best = k; } }
  return { best, bd };
}
const same = (ref, a, b) => a === b || (ref[a] && ref[b] && dist(ref[a], ref[b]) < 0.01);

async function launch() {
  const tries = process.env.CHROME ? [{ executablePath: process.env.CHROME }] : [{ channel: 'chrome' }, { channel: 'msedge' }];
  for (const t of tries) { try { return await chromium.launch(t); } catch {} }
  throw new Error('Could not find Chrome or Edge. Install Google Chrome, or set CHROME to a Chromium-based browser.');
}

async function run(site, out, opts = {}) {
  const root = path.resolve(site);
  fs.mkdirSync(out, { recursive: true });
  const server = await startStaticServer(root), base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await launch();
  const problems = [], notes = [];
  try {
    for (const [name, ctxOpts] of [['desk', { viewport: { width: 1440, height: 900 } }],
                                   ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
      const ctx = await browser.newContext(ctxOpts), pg = await ctx.newPage(), errors = [];
      pg.on('pageerror', e => errors.push(e.message));
      pg.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('filmtype:'))) errors.push(m.text()); });
      await pg.goto(base, { waitUntil: 'load' });
      try { await pg.waitForFunction(() => document.querySelector('[data-k-hero]')?.classList.contains('k-media-ready'), null, { timeout: 45000 }); }
      catch { problems.push(`${name}: the hero film never became ready.`); await ctx.close(); continue; }
      await wait(600);
      const info = await pg.evaluate(() => {
        const h = document.querySelector('[data-k-hero]'), v = h.querySelector('video[data-k-scrub]'), L = h.querySelector('[data-ft-layer]');
        return { top: h.getBoundingClientRect().top + scrollY, height: h.offsetHeight, dur: v.duration, src: new URL(v.currentSrc || v.src, location).pathname,
          dataSrc: innerWidth < innerHeight && v.dataset.srcMobile ? v.dataset.srcMobile : v.dataset.src, on: h.classList.contains('ft-on'), layer: !!L,
          groups: L ? L.querySelectorAll('[data-ft]').length : 0, fps: (window.FILMTRACK && window.FILMTRACK.wide && window.FILMTRACK.wide.fps) || 30 };
      });
      if (!info.layer) { problems.push(`${name}: no [data-ft-layer] in the hero. Nothing to check.`); await ctx.close(); continue; }
      if (!info.on) { problems.push(`${name}: filmtype.js did not switch on (.ft-on missing). Check the script order: scene.js, filmtrack.js, filmtype.js.`); await ctx.close(); continue; }
      const clip = path.join(root, decodeURIComponent(info.dataSrc || '').replace(/^\//, ''));
      if (!fs.existsSync(clip)) { problems.push(`${name}: cannot find the playing clip ${info.dataSrc}.`); await ctx.close(); continue; }
      const ref = thumbs(clip), N = ref.length;
      const vh = ctxOpts.viewport.height, range = info.height - vh, yAt = k => info.top + range * Math.min(1, (k + 0.5) / info.fps / info.dur);

      // 1. sync under real scrolling: every animation frame, compare the frame the type uses with the frame on screen
      await pg.evaluate(y => scrollTo(0, y), info.top);
      await wait(900);
      await pg.evaluate(({ TW, TH }) => {
        const v = document.querySelector('video[data-k-scrub]'), L = document.querySelector('[data-ft-layer]');
        const c = document.createElement('canvas'); c.width = TW; c.height = TH; const g = c.getContext('2d', { willReadFrequently: true });
        window.__ts = []; window.__tsOn = true;
        const step = () => {
          if (!window.__tsOn) return;
          if (v.readyState >= 2) {
            g.drawImage(v, 0, 0, TW, TH);
            const d = g.getImageData(0, 0, TW, TH).data, gray = new Array(TW * TH);
            for (let i = 0; i < TW * TH; i++) gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
            window.__ts.push({ f: Number(L.dataset.ftFrame || 0), gray });
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { TW, TH });
      const wheel = async (dy, n, gap) => { for (let i = 0; i < n; i++) { await pg.mouse.wheel(0, dy); await wait(gap); } };
      if (name === 'desk') {
        await wheel(range / 40, 40, 45); await wait(1200);           // forward, steady
        await wheel(-range / 14, 14, 30); await wait(1200);          // backward, fast
        await pg.evaluate(y => scrollTo(0, y), yAt(Math.floor(N * 0.8))); await wait(1500); // a jump
        await pg.evaluate(y => scrollTo(0, y), yAt(Math.floor(N * 0.2))); await wait(1500);
      } else {
        for (const k of [0.15, 0.4, 0.7, 0.95, 0.5, 0.05]) { await pg.evaluate(y => scrollTo({ top: y, behavior: 'smooth' }), yAt(Math.floor(N * k))); await wait(1300); }
      }
      const log = await pg.evaluate(() => { window.__tsOn = false; return window.__ts; });
      let bad = 0, worst = 0, shown = 0;
      for (const e of log) {
        const { best, bd } = identify(ref, z(e.gray), e.f);
        if (bd > 0.35) continue; // a frame mid-decode or covered: not comparable
        shown++;
        if (!same(ref, best, e.f)) { bad++; worst = Math.max(worst, Math.abs(best - e.f)); }
      }
      const share = shown ? bad / shown : 1;
      if (!shown) problems.push(`${name}: could not compare any frames (the film never painted).`);
      else if (share > 0.03 || worst > 2) problems.push(`${name}: the words were on a different frame from the film in ${bad} of ${shown} painted frames (up to ${worst} frames apart). filmtype.js must follow the frame on screen; check that nothing else moves [data-ft] groups and that filmtrack.js was made from this exact clip.`);
      else notes.push(`${name}: words and film agreed on ${shown - bad} of ${shown} painted frames (${bad ? `at most ${worst} apart` : 'exactly'}).`);
      if (Math.abs(N - (await pg.evaluate(() => (window.FILMTRACK.phone && innerWidth < innerHeight ? window.FILMTRACK.phone.frames : window.FILMTRACK.wide.frames)))) > 1)
        problems.push(`${name}: filmtrack.js was measured on a clip with a different number of frames from ${info.dataSrc}. Re-run track.mjs on the clip the page plays.`);

      // 2. the same frame gives the same state, however you arrive at it
      const probeK = Math.floor(N * 0.6), states = [];
      for (const from of [0.1, 0.95, 0.3]) {
        await pg.evaluate(y => scrollTo(0, y), yAt(Math.floor(N * from))); await wait(900);
        await pg.evaluate(y => scrollTo(0, y), yAt(probeK)); await wait(1600);
        states.push(await pg.evaluate(() => [...document.querySelectorAll('[data-ft]')].map(g => g.style.visibility !== 'visible' ? 'hidden' : `${g.style.transform}|${(+g.style.opacity || 0).toFixed(2)}`).join(' ')
          + ' @' + document.querySelector('[data-ft-layer]').dataset.ftFrame));
      }
      if (new Set(states).size > 1) problems.push(`${name}: arriving at frame ${probeK} from different places gave different word positions (${[...new Set(states)].map(s => s.split(' @').pop()).join(' vs frame ')}). Type must depend only on the frame shown.`);

      // 3. contact sheet at chosen frames
      const frames = opts.frames || Array.from({ length: 8 }, (_, i) => Math.round(i * (N - 1) / 7));
      const shots = [];
      for (const k of frames) {
        await pg.evaluate(y => scrollTo(0, y), yAt(k));
        for (let i = 0; i < 30; i++) { await wait(90); const s = await pg.evaluate(() => document.querySelector('video').seeking); if (!s && i > 5) break; }
        await wait(300);
        const f = await pg.evaluate(() => document.querySelector('[data-ft-layer]').dataset.ftFrame);
        shots.push({ k, f, buf: await pg.screenshot() });
      }
      try {
        const sharp = (await import('sharp')).default, tw = name === 'desk' ? 480 : 195;
        const tiles = await Promise.all(shots.map(async s => {
          const t = await sharp(s.buf).resize(tw).png().toBuffer(), m = await sharp(t).metadata();
          const label = Buffer.from(`<svg width="${m.width}" height="${m.height}"><rect width="58" height="22" fill="black" opacity=".6"/><text x="6" y="16" font-family="Menlo,monospace" font-size="13" fill="#fff">${s.f}</text></svg>`);
          return sharp(t).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
        }));
        const m = await sharp(tiles[0]).metadata(), cols = 4, rows = Math.ceil(tiles.length / cols);
        const file = path.join(out, `typesync-${name}.jpg`);
        await sharp({ create: { width: cols * (m.width + 6), height: rows * (m.height + 6), channels: 3, background: '#111' } })
          .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * (m.width + 6), top: Math.floor(i / cols) * (m.height + 6) }))).jpeg({ quality: 85 }).toFile(file);
        notes.push(`${name}: wrote ${file} (frames ${shots.map(s => s.f).join(', ')}).`);
      } catch (e) { notes.push(`${name}: contact sheet skipped (${e.message}).`); }
      for (const e of [...new Set(errors)]) problems.push(`${name}: ${e}`);
      await ctx.close();
    }

    // 4. reduced motion: the film type steps aside and the normal captions return
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }), pg = await ctx.newPage();
    await pg.goto(base, { waitUntil: 'load' }); await wait(1500);
    const rm = await pg.evaluate(() => {
      const h = document.querySelector('[data-k-hero]'), L = h && h.querySelector('[data-ft-layer]');
      const hidden = [...document.querySelectorAll('[data-ft-replaces]')].filter(e => getComputedStyle(e).clipPath === 'inset(50%)').length;
      return { on: h && h.classList.contains('ft-on'), shown: L ? getComputedStyle(L).display !== 'none' : false, hidden, replaced: document.querySelectorAll('[data-ft-replaces]').length };
    });
    if (rm.on || rm.shown) problems.push('reduced motion: the film type is still showing. It must give way to the still hero.');
    if (rm.hidden) problems.push('reduced motion: captions marked data-ft-replaces are still hidden. The still hero needs them.');
    if (!rm.replaced) notes.push('No captions are marked data-ft-replaces. If the film type replaces a heading, mark the heading so the still hero and screen readers keep it.');
    await ctx.close();
  } finally { await browser.close(); await closeServer(server); }
  return { problems, notes };
}

export async function main(argv = process.argv.slice(2)) {
  const pos = argv.filter(a => !a.startsWith('--')), fi = argv.indexOf('--frames');
  const [site = 'site', out = 'review'] = pos.filter(a => a !== (fi >= 0 ? argv[fi + 1] : null));
  const frames = fi >= 0 ? argv[fi + 1].split(',').map(Number) : null;
  const { problems, notes } = await run(site, out, { frames });
  for (const n of notes) console.log(n);
  if (problems.length) { console.log('\nTo fix:'); for (const p of problems) console.log(`- ${p}`); process.exitCode = 1; }
  else console.log('\nFilm type: nothing to fix. Now look at the contact sheets.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });
