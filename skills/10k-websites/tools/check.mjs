#!/usr/bin/env node
// check.mjs: walk the finished site in a real browser and report what a visitor would hit.
// Usage: node check.mjs <siteDir> [reviewDir]      (default reviewDir: review/)
// Uses the Chrome (or Edge) already installed on this computer. CHROME=/path overrides.
// Writes review/contact-sheet.png, review/phone.png, review/phone-top.png and prints a report.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { startStaticServer } from './server.mjs';

async function main() {
const [siteDir = 'site', reviewDir = 'review'] = process.argv.slice(2);
if (!fs.existsSync(path.join(siteDir, 'index.html'))) { console.error(`No index.html in ${siteDir}`); process.exit(1); }
fs.mkdirSync(reviewDir, { recursive: true });

/* ---- public-only loopback preview; never serves backend/configuration source ---- */
const root = path.resolve(siteDir);
const server = await startStaticServer(root);
const base = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {

/* ---- browser ---- */
async function launch() {
  const tries = process.env.CHROME ? [{ executablePath: process.env.CHROME }] : [{ channel: 'chrome' }, { channel: 'msedge' }];
  for (const t of tries) { try { return await chromium.launch(t); } catch {} }
  throw new Error('Could not find Chrome or Edge. Install Google Chrome, or set CHROME to a Chromium-based browser.');
}
browser = await launch();
const issues = [], notes = [], notedPreviewProbes = new Set();
const bad = s => issues.push(s), ok = s => notes.push(s);
const wait = ms => new Promise(r => setTimeout(r, ms));

// luminance for WCAG contrast
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function page(opts, rel = '') {
  const ctx = await browser.newContext(opts);
  // Inspection is GET/HEAD-only, even if site scripts attempt an automatic mutation.
  await ctx.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
  const pg = await ctx.newPage();
  pg._errors = []; pg._media = []; pg._mediaResponses = [];
  pg.on('pageerror', e => pg._errors.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pg._errors.push(m.text()); });
  pg.on('response', r => {
    if (/\.(mp4|webm|mov)(\?|$)/i.test(r.url()) && r.status() < 400) pg._mediaResponses.push(r.url());
    if (isExpectedPreviewProbe(r.url(), r.status(), base, r.request().method())) {
      if (!notedPreviewProbes.size) ok('The local enquiry stamp probe is intentionally blocked by the static server. Backend storage and email delivery still require separate live verification.');
      notedPreviewProbes.add(r.url()); return;
    }
    if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) pg._errors.push(`Missing file (${r.status()}): ${r.url().replace(base, '')}`);
  });
  pg.on('request', r => { if (/\.(mp4|webm|mov)(\?|$)/i.test(r.url())) pg._media.push(r.url()); });
  await pg.goto(base + rel, { waitUntil: 'load' });
  await wait(1200);
  return { ctx, pg };
}
const heroInfo = pg => pg.evaluate(() => [...document.querySelectorAll('[data-k-hero]')].map(h => ({
  top: h.getBoundingClientRect().top + scrollY, height: h.offsetHeight, cls: h.className,
  video: !!h.querySelector('video[data-k-scrub]'), depth: !!h.querySelector('canvas[data-k-depth]'),
  bands: h.querySelectorAll('[data-k-band]').length })));
async function goP(pg, hero, p) {
  await pg.evaluate(y => scrollTo(0, y), hero.top + (hero.height - (await pg.evaluate(() => innerHeight))) * p);
  // wait for the smoothed progress and any video seek to settle
  for (let i = 0; i < 30; i++) {
    await wait(80);
    const s = await pg.evaluate(() => { const h = document.querySelector('[data-k-hero]'); const v = h && h.querySelector('video');
      return { p: h ? h.style.getPropertyValue('--k-p') : '', seeking: v ? v.seeking : false }; });
    if (!s.seeking && s.p === (pg._lastP || '')) break;
    pg._lastP = s.p;
  }
  await wait(120);
}

/* ================= desktop ================= */
{
  const { ctx, pg } = await page({ viewport: { width: 1440, height: 900 } });
  const heroes = await heroInfo(pg);
  if (!heroes.length) ok('No scroll hero on the home page.');
  const hero = heroes[0];
  if (hero) {
    // 1. media actually loads and follows the scroll
    await wait(hero.video ? 4000 : 1500);
    const cls = await pg.evaluate(() => document.querySelector('[data-k-hero]').className);
    if (/k-media-failed/.test(cls)) bad('The hero media failed to load. Visitors only see the still poster.');
    else if (!/k-media-ready/.test(cls)) bad('The hero media never finished loading within a few seconds.');

    // 2. frames across the journey, for dead scroll and the contact sheet
    const steps = 20, frames = [], tinies = [];
    for (let i = 0; i <= steps; i++) {
      const p = i / steps; await goP(pg, hero, p);
      const shot = await pg.screenshot();
      frames.push(await sharp(shot).resize(360, 225).png().toBuffer());
      tinies.push(await sharp(shot).resize(96, 60).greyscale().raw().toBuffer());
    }
    if (hero.video) {
      const t = await pg.evaluate(() => { const v = document.querySelector('video[data-k-scrub]'); return { t: v.currentTime, d: v.duration }; });
      if (!(t.d > 0) || t.t < t.d * 0.85) bad(`At the end of the hero the video sits at ${t.t.toFixed(1)} s of ${(t.d || 0).toFixed(1)} s. It is not following the scroll.`);
      else ok('Video follows the scroll to its last frame.');
    }
    // dead scroll: compare each frame with the one 3 steps later (15% of the hero's scroll)
    const diff = (a, b) => { let d = 0; for (let j = 0; j < a.length; j++) d += Math.abs(a[j] - b[j]); return d / a.length; };
    const dead = new Set();
    for (let i = 0; i + 3 <= steps; i++) if (diff(tinies[i], tinies[i + 3]) < 1.2) for (let k = i; k < i + 3; k++) dead.add(k);
    if (process.env.K_DEBUG) console.log('window diffs', tinies.slice(0, -3).map((t, i) => diff(t, tinies[i + 3]).toFixed(2)).join(' '));
    if (dead.size) bad(`Dead scroll: about ${Math.round(dead.size / steps * 100)}% of the hero scroll changes almost nothing on screen. Shorten data-k-span, raise data-push or data-strength, or give that stretch a beat.`);
    else ok('No dead stretches in the hero scroll.');

    // 3. every caption reaches full opacity, and stays readable across normal flicks
    const bandPeak = await pg.evaluate(() => [...document.querySelectorAll('[data-k-hero] [data-k-band]')].map(() => 0));
    for (let i = 0; i <= 100; i++) {
      await pg.evaluate(y => scrollTo(0, y), hero.top + (hero.height - 900) * i / 100);
      await wait(i === 0 ? 400 : 45);
      const ops = await pg.evaluate(() => [...document.querySelectorAll('[data-k-hero] [data-k-band]')].map(b => +getComputedStyle(b).opacity));
      ops.forEach((o, j) => (bandPeak[j] = Math.max(bandPeak[j], o)));
    }
    bandPeak.forEach((o, j) => { if (o < 0.98) bad(`Caption ${j + 1} never reaches full opacity (peak ${o.toFixed(2)}). Widen its data-k-band range.`); });
    for (const step of [120, 360]) {
      await pg.evaluate(y => scrollTo(0, y), hero.top); await wait(600);
      const seen = bandPeak.map(() => 0);
      for (let y = 0; y < hero.height - 900; y += step) {
        await pg.mouse.wheel(0, step); await wait(420);
        const ops = await pg.evaluate(() => [...document.querySelectorAll('[data-k-hero] [data-k-band]')].map(b => +getComputedStyle(b).opacity));
        ops.forEach((o, j) => { if (o > 0.95) seen[j]++; });
      }
      seen.forEach((n, j) => {
        if (step === 120 && n > 0 && n < 5 && j > 0) bad(`Caption ${j + 1} is readable for only ${n} normal flicks. Give it more scroll room.`);
        if (step === 360 && n === 0) bad(`Caption ${j + 1} can be skipped entirely by a fast flick.`);
      });
    }

    // 4. contrast of each caption against the frame actually behind it
    const n = bandPeak.length;
    for (let j = 0; j < n; j++) {
      const range = await pg.evaluate(j => document.querySelectorAll('[data-k-hero] [data-k-band]')[j].dataset.kBand.split(/\s+/).map(Number), j);
      const samples = [0.3, 0.5, 0.7].map(f => range[0] + (range[1] - range[0]) * f);
      let worstRatio = 99;
      for (const p of samples) {
        await goP(pg, hero, Math.min(1, p));
        const info = await pg.evaluate(j => {
          const b = document.querySelectorAll('[data-k-hero] [data-k-band]')[j];
          const t = [...b.querySelectorAll('*')].find(e => e.childNodes.length && [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) || b;
          const r = b.getBoundingClientRect(), c = getComputedStyle(t).color.match(/[\d.]+/g).map(Number);
          b.dataset.kCheck = '1';
          return { x: Math.max(0, r.x), y: Math.max(0, r.y), w: Math.min(r.width, innerWidth - Math.max(0, r.x)), h: Math.min(r.height, innerHeight - Math.max(0, r.y)), c };
        }, j);
        if (info.w < 4 || info.h < 4) continue;
        await pg.addStyleTag({ content: '[data-k-check] *, [data-k-check] { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; } [data-k-check] img, [data-k-check] svg { visibility: hidden !important; }' });
        await wait(60);
        const clip = await pg.screenshot({ clip: { x: info.x, y: info.y, width: info.w, height: info.h } });
        await pg.evaluate(() => { document.querySelectorAll('[data-k-check]').forEach(e => delete e.dataset.kCheck); document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('[data-k-check]')) s.remove(); }); });
        const { data, info: im } = await sharp(clip).raw().toBuffer({ resolveWithObject: true });
        const L = []; for (let i = 0; i < data.length; i += im.channels) L.push(lum(data[i], data[i + 1], data[i + 2]));
        L.sort((a, b) => a - b);
        const text = lum(info.c[0], info.c[1], info.c[2]);
        const bg = text > 0.4 ? L[Math.floor(L.length * 0.98)] : L[Math.floor(L.length * 0.02)]; // the worst 2% of the backdrop
        worstRatio = Math.min(worstRatio, ratio(text, bg));
      }
      if (worstRatio < 3.5) bad(`Caption ${j + 1} is hard to read: contrast ${(Math.floor(worstRatio * 10) / 10).toFixed(1)}:1 at its worst frame (needs 3.5:1). Deepen its scrim or move it into calmer space.`);
      else if (worstRatio < 99) ok(`Caption ${j + 1} contrast ${worstRatio.toFixed(1)}:1 at its worst frame.`);
    }

    // contact sheet: 21 frames, 7 across
    const cols = 7, rows = Math.ceil(frames.length / cols);
    await sharp({ create: { width: cols * 364, height: rows * 229, channels: 3, background: '#111' } })
      .composite(frames.map((f, i) => ({ input: f, left: (i % cols) * 364 + 2, top: Math.floor(i / cols) * 229 + 2 })))
      .png().toFile(path.join(reviewDir, 'contact-sheet.png'));
  }
  // 5. the rest of the page: reveals, sideways scroll, errors
  await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await wait(1500);
  const hidden = await pg.evaluate(() => [...document.querySelectorAll('[data-k-in]')].filter(e => !e.classList.contains('is-in')).length);
  if (hidden) bad(`${hidden} reveal element(s) never appeared after scrolling to the bottom.`);
  // 6. headlines set so tight that the words run together (a word gap under ~0.14em reads as one word)
  const tight = await pg.evaluate(() => {
    const out = [];
    for (const h of document.querySelectorAll('h1,h2,h3,[data-k-caption],.display,[class*="headline"]')) {
      const txt = (h.getAttribute('aria-label') || h.textContent || '').trim();
      if (txt.length < 6 || !/\s/.test(txt) || h.offsetParent === null) continue;
      const cs = getComputedStyle(h), fs = parseFloat(cs.fontSize);
      if (fs < 32) continue;
      const probe = (s) => { const sp = document.createElement('span'); sp.textContent = s;
        sp.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font};letter-spacing:${cs.letterSpacing};word-spacing:${cs.wordSpacing};font-kerning:${cs.fontKerning}`;
        document.body.appendChild(sp); const w = sp.getBoundingClientRect().width; sp.remove(); return w; };
      const gap = probe('n n') - probe('nn');
      if (gap / fs < 0.14 && parseFloat(cs.wordSpacing) < 0) out.push({ t: txt.slice(0, 40), em: (gap / fs).toFixed(2) });
    }
    return out;
  });
  tight.forEach(x => ok(`Review the spacing in "${x.t}" visually: its negative word-spacing gives an estimated ${x.em}em gap. Font metrics alone do not establish a defect.`));
  if (await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) bad('The desktop page scrolls sideways. Something is wider than the screen.');
  pg._errors.forEach(e => bad('Console error (desktop): ' + e));
  await ctx.close();
}

/* ================= phones: traverse the actual film, then reverse ================= */
for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 812 }, { width: 375, height: 667 }]) {
  const { ctx, pg } = await page({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const label = `${viewport.width}x${viewport.height}`;
  await pg.screenshot({ path: path.join(reviewDir, viewport.width === 390 ? 'phone-top.png' : `phone-top-${label}.png`) });
  const result = await inspectPhoneHero(pg, { capture: async (progress) => {
    const file = path.join(reviewDir, `phone-${label}-hero-${String(Math.round(progress * 100)).padStart(3, '0')}.png`);
    await pg.screenshot({ path: file }); return file;
  } });
  result.issues.forEach(e => bad(`Phone ${label}: ${e}`));
  result.notes.forEach(e => ok(`Phone ${label}: ${e}`));
  if (result.frames.length) {
    const width = 195, height = Math.round(viewport.height * width / viewport.width);
    const tiles = await Promise.all(result.frames.map(f => sharp(f).resize(width, height).png().toBuffer()));
    await sharp({ create: { width: tiles.length * (width + 4), height: height + 4, channels: 3, background: '#111' } })
      .composite(tiles.map((input, i) => ({ input, left: i * (width + 4) + 2, top: 2 })))
      .png().toFile(path.join(reviewDir, `phone-contact-sheet-${label}.png`));
  }
  const targets = await inspectTapTargets(pg);
  if (targets.length) ok(`Phone ${label}: review ${targets.length} control(s) with an effective touch area below 44×44 px: ${targets.map(t => `${t.name} (${t.width}×${t.height})`).join(', ')}. Inline prose links are excluded.`);
  const semantics = await inspectSemantics(pg, { checkMenus: true });
  semantics.forEach(e => bad(`Phone ${label}: ${e}`));
  await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await wait(900);
  if (await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) bad(`Phone ${label}: the page scrolls sideways.`);
  if (viewport.width === 390) await pg.screenshot({ path: path.join(reviewDir, 'phone.png'), fullPage: true });
  pg._errors.forEach(e => bad(`Console error (phone ${label}): ${e}`));
  await ctx.close();
}

/* ================= reduced motion ================= */
{
  const { ctx, pg } = await page({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await wait(1500);
  if (pg._media.length) bad('With reduced motion switched on, the page still downloads the hero video.');
  if (await pg.locator('canvas.fx-aurora').count()) bad('With reduced motion switched on, aurora still creates a GPU canvas instead of its static gradient.');
  const cls = await pg.evaluate(() => (document.querySelector('[data-k-hero]') || {}).className || '');
  if (cls && !/k-static/.test(cls)) bad('With reduced motion switched on, the hero still moves.');
  await ctx.close();
}

/* ================= every other page (multi-page sites) ================= */
const SKIP = /^(admin|api|data|node_modules|\.)/;
const pages = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (SKIP.test(r)) continue;
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
    else if (e.name.endsWith('.html') && r !== 'index.html') pages.push(r);
  }
})(root, '');
const links = new Set();
for (const rel of ['index.html', ...pages]) {
  for (const vp of [{ viewport: { width: 1440, height: 900 } }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
    const { ctx, pg } = await page(vp, rel === 'index.html' ? '' : rel);
    const found = await pg.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')));
    found.forEach(h => links.add(JSON.stringify([rel, h])));
    if (rel !== 'index.html') {
      const phone = vp.viewport.width < 500;
      await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await wait(900);
      if (await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) bad(`${rel}: the ${phone ? 'phone' : 'desktop'} page scrolls sideways.`);
      if (!(await pg.evaluate(() => document.querySelectorAll('h1').length))) bad(`${rel}: the page has no h1 heading.`);
      pg._errors.forEach(e => bad(`${rel} (${phone ? 'phone' : 'desktop'}): ${e}`));
      if (phone) await pg.screenshot({ path: path.join(reviewDir, `phone-${rel.replace(/[\/]/g, '-').replace(/\.html$/, '')}.png`) });
    }
    await ctx.close();
  }
}
// every link inside the site must point at a real file
for (const j of links) {
  const [from, href] = JSON.parse(j);
  if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) continue;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) continue;
  let target = clean.startsWith('/') ? path.join(root, clean) : path.join(root, path.dirname(from), clean);
  if (clean.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) bad(`${from}: the link "${href}" points at a page or file that does not exist.`);
}
if (pages.length) ok(`Checked ${pages.length + 1} pages and every link between them.`);

// every picture is used once: no repeats across the site, and nothing from the opening film reused below it
{
  const uses = new Map(); // absolute file -> list of pages
  const add = (from, ref) => {
    if (!ref || /^(data:|https?:|#)/i.test(ref)) return;
    const clean = ref.trim().split('#')[0].split('?')[0];
    if (!/\.(png|jpe?g|webp|avif|gif)$/i.test(clean)) return;
    const abs = clean.startsWith('/') ? path.join(root, clean) : path.join(root, path.dirname(from), clean);
    if (!uses.has(abs)) uses.set(abs, []);
    uses.get(abs).push(from);
  };
  const scan = (from, text) => {
    for (const m of text.matchAll(/\b(?:src|data-src|data-image)\s*=\s*["']([^"']+)["']/gi)) add(from, m[1]);
    for (const m of text.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) add(from, m[1].split(',')[0].trim().split(/\s+/)[0]);
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(from, m[1]);
  };
  for (const rel of ['index.html', ...pages]) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8')
      .replace(/<section\b[^>]*data-k-hero[\s\S]*?<\/section>/i, '')   // the hero's own poster is fine
      .replace(/<head\b[\s\S]*?<\/head>/i, '');                          // share picture and icons are fine
    scan(rel, html);
  }
  for (const css of fs.readdirSync(root).filter(f => f.endsWith('.css') && !/^(scene|fx|pages)\.css$/.test(f)))
    for (const m of fs.readFileSync(path.join(root, css), 'utf8').matchAll(/([^{}]+)\{([^{}]*)\}/g))
      if (!/hero|k-stage|k-static|k-poster/i.test(m[1])) scan(css, m[2]);   // the hero's own stills and fallbacks are fine
  const byHash = new Map();
  for (const [abs, from] of uses) {
    if (!fs.existsSync(abs)) continue;
    const h = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex');
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push({ file: path.relative(root, abs), from });
    if (from.length > 1) bad(`The picture ${path.relative(root, abs)} is used ${from.length} times (${[...new Set(from)].join(', ')}). Every section needs its own new picture.`);
    if (/^hero[-_.]/i.test(path.basename(abs))) bad(`${path.relative(root, abs)} is a frame from the opening film, reused lower on the page. Give that section its own new picture.`);
  }
  for (const list of byHash.values()) if (list.length > 1) bad(`These pictures are the same image under different names: ${list.map(x => x.file).join(', ')}. Every section needs its own new picture.`);
  // look-alikes: the same picture saved at another size, or a frame the opening film was made from
  const dhash = async f => { const px = await sharp(f).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer(); let bits = ''; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0'; return bits; };
  const dist = (a, b) => { let d = 0; for (let i = 0; i < 64; i++) if (a[i] !== b[i]) d++; return d; };
  const exact = new Set([...byHash.values()].filter(l => l.length > 1).flatMap(l => l.map(x => x.file)));
  const used = [];
  for (const abs of uses.keys()) if (fs.existsSync(abs)) { try { used.push({ file: path.relative(root, abs), h: await dhash(abs) }); } catch {} }
  const frames = [];
  if (fs.existsSync(reviewDir)) for (const f of fs.readdirSync(reviewDir))
    if (/\.(png|jpe?g|webp)$/i.test(f) && /(open|event|rest|start|end|key|frame)/i.test(f) && !/sheet|contact|phone/i.test(f)) { try { frames.push({ file: f, h: await dhash(path.join(reviewDir, f)) }); } catch {} }
  for (let i = 0; i < used.length; i++) {
    for (let j = i + 1; j < used.length; j++) if (dist(used[i].h, used[j].h) <= 5 && !(exact.has(used[i].file) && exact.has(used[j].file))) bad(`${used[i].file} and ${used[j].file} look like the same picture. Every section needs its own new picture.`);
    for (const k of frames) if (dist(used[i].h, k.h) <= 5) { bad(`${used[i].file} looks like ${k.file}, a frame the opening film was made from. Give that section its own new picture.`); break; }
  }
}

// speed basics for the first screen: pictures below the opening scene must wait until they are needed
for (const rel of ['index.html', ...pages]) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const eager = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0])
    .filter(t => !/loading\s*=\s*["']?lazy/i.test(t) && !/fetchpriority\s*=\s*["']?high/i.test(t) && !/data-k-(hero|poster)/i.test(t));
  if (eager.length) bad(`${rel}: ${eager.length} picture(s) below the opening scene load immediately and slow the first screen on phones. Add loading="lazy" (and width/height) to every <img> after the hero.`);
}

console.log('\n10K Websites check');
console.log(issues.length ? `\nFIX (${issues.length}):\n- ` + issues.join('\n- ') : '\nNothing to fix.');
if (notes.length) console.log('\nNOTES:\n- ' + notes.join('\n- '));
console.log(`\nLook at ${reviewDir}/contact-sheet.png, the phone-contact-sheet-*.png files (including every transition), phone-top.png and phone.png. Automatic checks cannot judge whether the subject is composed well in each crop.`);
process.exitCode = issues.length ? 1 : 0;
} finally {
  try { if (browser) await browser.close(); } finally { await new Promise(resolve => server.close(resolve)); }
}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 2; });
}


// Exported for fixture tests. These inspect only the known scroll-engine contract and
// ordinary local page semantics; they do not submit forms or follow external links.
export async function inspectPhoneHero(pg, { capture } = {}) {
  const issues = [], notes = [], frames = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const hero = await pg.evaluate(() => {
    const h = document.querySelector('[data-k-hero]'); if (!h) return null;
    const v = h.querySelector('video[data-k-scrub]');
    return { top: h.getBoundingClientRect().top + scrollY, height: h.offsetHeight,
      static: h.classList.contains('k-static'), video: !!v, mobile: v?.dataset.srcMobile || '', desktop: v?.dataset.src || '' };
  });
  if (!hero) return { issues, notes: ['No scroll hero.'], frames };
  const viewport = await pg.evaluate(() => innerHeight);
  if (hero.static) {
    notes.push('Designed still hero. Review its visible subject, text and call to action.');
    if (capture) frames.push(await capture(0));
    return { issues, notes, frames };
  }
  const times = [];
  const settle = async progress => {
    await pg.evaluate(y => scrollTo(0, y), hero.top + Math.max(0, hero.height - viewport) * progress);
    let last = '';
    for (let i = 0; i < 40; i++) {
      await wait(90);
      const state = await pg.evaluate(() => {
        const h = document.querySelector('[data-k-hero]'), v = h.querySelector('video[data-k-scrub]');
        return { value: h.style.getPropertyValue('--k-p'), seeking: !!v?.seeking, ready: !v || v.readyState >= 2 };
      });
      if (i > 2 && state.ready && !state.seeking && state.value === last) break;
      last = state.value;
    }
  };
  for (const progress of [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1]) {
    await settle(progress);
    const state = await pg.evaluate(() => {
      const h = document.querySelector('[data-k-hero]'), v = h.querySelector('video[data-k-scrub]');
      const clipped = [];
      for (const band of h.querySelectorAll('[data-k-band]')) {
        const style = getComputedStyle(band);
        if (+style.opacity < 0.85 || style.visibility === 'hidden' || style.display === 'none') continue;
        const walker = document.createTreeWalker(band, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode, parent = node.parentElement;
          if (!node.textContent.trim() || parent.closest('.fx-sr,[hidden]')) continue;
          const s = getComputedStyle(parent); if (s.visibility === 'hidden' || +s.opacity === 0) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          if ([...range.getClientRects()].some(r => r.width > 1 && r.height > 1 && (r.left < -2 || r.right > innerWidth + 2 || r.top < -2 || r.bottom > innerHeight + 2))) {
            clipped.push((band.getAttribute('aria-label') || band.textContent).trim().replace(/\s+/g, ' ').slice(0, 55)); break;
          }
        }
      }
      return { failed: h.classList.contains('k-media-failed'), ready: h.classList.contains('k-media-ready'),
        time: v?.currentTime, duration: v?.duration, source: v?.currentSrc, clipped,
        sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (state.failed) issues.push('Hero media failed to load.');
    if (state.sideways) issues.push(`Sideways overflow at ${Math.round(progress * 100)}% of the hero.`);
    state.clipped.forEach(text => issues.push(`Visible hero text is clipped at ${Math.round(progress * 100)}%: "${text}". Check this frame.`));
    times.push(state);
    if (capture) frames.push(await capture(progress));
  }
  if (hero.video) {
    const end = times.at(-1), first = times[0];
    if (!end.ready || !(end.duration > 0)) issues.push('Phone video did not become ready.');
    else {
      if (end.time < end.duration * 0.85 || end.time - first.time < end.duration * 0.6) issues.push('Phone video does not follow forward scrolling through the complete film.');
      if (times.some((state, i) => i > 0 && state.time + 0.1 < times[i - 1].time)) issues.push('Phone video jumps backwards during forward scrolling.');
      await settle(0.1);
      const reverse = await pg.evaluate(() => document.querySelector('video[data-k-scrub]').currentTime);
      if (reverse > end.duration * 0.3) issues.push('Phone video does not return toward its opening when scrolling backwards.');
      if (!issues.some(e => /video/.test(e))) notes.push('Phone film follows forward and reverse scrolling. Inspect the contact sheet for crop and join quality.');
    }
    if (hero.mobile) {
      const expected = new URL(hero.mobile, pg.url()).href;
      const resources = await pg.evaluate(() => performance.getEntriesByType('resource').map(r => ({ url: r.name, status: r.responseStatus })));
      const requests = pg._media || resources.map(r => r.url);
      const loaded = pg._mediaResponses || resources.filter(r => r.status >= 200 && r.status < 400).map(r => r.url);
      // scene.js deliberately fetches the selected movie before assigning a blob URL.
      // The successful portrait request is its provenance; a blob URL alone is not.
      const portraitBlob = end.source?.startsWith('blob:') && loaded.includes(expected);
      if (end.source !== expected && !portraitBlob) issues.push('Phone is not using its declared portrait video source.');
      const desktop = new URL(hero.desktop || hero.mobile, pg.url()).href;
      if (desktop !== expected && requests.includes(desktop)) issues.push('Phone downloads the desktop film in addition to its portrait film.');
    }
  } else notes.push('Phone depth scene traversed. Inspect the contact sheet for crop and motion quality.');
  return { issues: [...new Set(issues)], notes, frames };
}

export async function inspectTapTargets(pg) {
  return pg.evaluate(() => {
    const visible = el => {
      for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || p.hidden || p.getAttribute('aria-hidden') === 'true') return false; }
      return [...el.getClientRects()].some(r => r.width > 0 && r.height > 0);
    };
    const out = [];
    for (const el of document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"]')) {
      if (el.disabled) continue;
      if (el.matches('a') && getComputedStyle(el).display === 'inline' && el.closest('p,li,dd,figcaption') && !el.closest('nav,[role="navigation"]')) continue;
      const candidates = [el, ...el.labels || []].filter(visible);
      if (!candidates.length) continue;
      // An associated label is itself a clickable hit area, including styled radios.
      const rects = candidates.map(e => e.getBoundingClientRect());
      if (rects.some(r => r.width >= 44 && r.height >= 44)) continue;
      const r = rects.sort((a, b) => b.width * b.height - a.width * a.height)[0];
      out.push({ name: (el.getAttribute('aria-label') || el.textContent || el.name || el.id || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 35), width: Math.round(r.width), height: Math.round(r.height) });
    }
    return out;
  });
}

export async function inspectSemantics(pg, { checkMenus = false } = {}) {
  const issues = await pg.evaluate(() => {
    const out = [], ids = new Set();
    for (const el of document.querySelectorAll('[id]')) { if (ids.has(el.id)) out.push(`Duplicate id "${el.id}" can break labels and navigation.`); ids.add(el.id); }
    if (!document.querySelector('h1')) out.push('Page has no h1 heading.');
    for (const el of document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby]')) {
      for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby'])
        for (const id of (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean))
          if (!document.getElementById(id)) out.push(`${attr} refers to missing id "${id}".`);
    }
    for (const button of document.querySelectorAll('button,[role="button"]')) {
      const label = button.getAttribute('aria-label') || (button.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') || button.textContent || [...button.querySelectorAll('img[alt]')].map(img => img.alt).join(' ');
      if (!label.trim()) out.push('A button has no accessible name. Add visible text or aria-label.');
    }
    for (const link of document.querySelectorAll('a[href^="#"]')) {
      const hash = link.getAttribute('href').slice(1); if (!hash) continue;
      let id; try { id = decodeURIComponent(hash); } catch { id = hash; }
      if (!document.getElementById(id) && ![...document.querySelectorAll('a[name]')].some(a => a.name === id)) out.push(`Navigation link "#${id}" has no target.`);
    }
    for (const form of document.forms) {
      for (const el of form.elements) {
        if (!el.matches('input,select,textarea') || /^(hidden|submit|reset|button)$/i.test(el.type) || el.disabled || el.closest('[hidden],[aria-hidden="true"]') || !el.getClientRects().length) continue;
        const labelled = (el.getAttribute('aria-label') || '').trim() || (el.getAttribute('aria-labelledby') || '').trim() || [...el.labels || []].some(l => l.textContent.trim());
        if (!labelled) out.push(`Form control "${el.name || el.id || el.type}" has no accessible label.`);
        if (el.required && !el.name) out.push(`Required form control "${el.id || el.type}" has no name and cannot be submitted.`);
      }
    }
    return out;
  });
  if (checkMenus) {
    const menus = pg.locator('button[aria-expanded][aria-controls]');
    for (let i = 0; i < await menus.count(); i++) {
      const button = menus.nth(i);
      if (!(await button.isVisible())) continue;
      const controlsNav = await button.evaluate(el => (el.getAttribute('aria-controls') || '').split(/\s+/).some(id => {
        const panel = document.getElementById(id); return panel && (panel.matches('nav,[role="navigation"]') || panel.querySelector('nav,[role="navigation"]'));
      }));
      if (!controlsNav) continue;
      const before = await button.getAttribute('aria-expanded');
      await button.click();
      const after = await button.getAttribute('aria-expanded');
      if (after === before) issues.push('Navigation button does not update aria-expanded when pressed.');
      if (after === 'true') {
        await button.press('Escape');
        if (await button.getAttribute('aria-expanded') === 'true') {
          issues.push('Expanded navigation does not close with Escape.'); await button.click();
        }
      }
      if (await button.getAttribute('aria-expanded') !== before) await button.click();
    }
  }
  return [...new Set(issues)];
}

export function isExpectedPreviewProbe(url, status, base, method = 'GET') {
  if (status !== 403 || method !== 'GET') return false;
  try {
    const request = new URL(url), origin = new URL(base);
    return request.origin === origin.origin && /(?:^|\/)api\/submit\.php$/.test(request.pathname) && request.searchParams.get('stamp') === '1';
  } catch { return false; }
}
