// Real-browser regression tests. Run after the skill's tools dependencies are installed:
// node --test tools/tests/effects-checks.test.mjs   (CHROME may specify a browser path)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startStaticServer, closeServer } from '../server.mjs';
import { inspectPhoneHero, inspectTapTargets, inspectSemantics, isExpectedPreviewProbe } from '../check.mjs';

const engine = fileURLToPath(new URL('../../engine/', import.meta.url));
let browser, server, dir, base;
test.before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), '10k-effects-'));
  await Promise.all(['fx.js', 'fx.css'].map(f => fs.copyFile(path.join(engine, f), path.join(dir, f))));
  await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><html lang="en"><head><title>Fixture</title></head><body>Fixture</body></html>');
  server = await startStaticServer(dir); base = `http://127.0.0.1:${server.address().port}/`;
  const options = process.env.CHROME ? [{ executablePath: process.env.CHROME }] : [{ channel: 'chrome' }, { channel: 'msedge' }];
  for (const option of options) { try { browser = await chromium.launch(option); break; } catch {} }
  if (!browser) throw new Error('Install Chrome/Edge or set CHROME for browser regression tests.');
});
test.after(async () => { try { if (browser) await browser.close(); } finally { if (server) await closeServer(server); if (dir) await fs.rm(dir, { recursive: true, force: true }); } });

// Instrument GPU calls so lifecycle tests do not depend on a machine's GPU driver.
// The browser still runs the real effect, IntersectionObserver, RAF and CSS.
function instrumentGL({ failShader = false } = {}) {
  window.gpu = { contexts: 0, draws: 0 };
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, options) {
    if (type !== 'webgl') return original.call(this, type, options);
    gpu.contexts++;
    const noop = () => {};
    return {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
      ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLE_STRIP: 8,
      createShader: () => ({}), shaderSource: noop, compileShader: noop, getShaderParameter: () => !failShader,
      createProgram: () => ({}), attachShader: noop, linkProgram: noop, getProgramParameter: () => true, useProgram: noop,
      createBuffer: () => ({}), bindBuffer: noop, bufferData: noop, getAttribLocation: () => 0, enableVertexAttribArray: noop, vertexAttribPointer: noop,
      getUniformLocation: () => ({}), uniform3fv: noop, uniform2f: noop, uniform1f: noop, viewport: noop,
      drawArrays: () => gpu.draws++, deleteShader: noop, deleteProgram: noop, deleteBuffer: noop,
    };
  };
}
async function fixture(t, html, options = {}, instrumentation = true) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, ...options });
  t.after(() => ctx.close());
  if (instrumentation) await ctx.addInitScript(instrumentGL, typeof instrumentation === 'object' ? instrumentation : {});
  const pg = await ctx.newPage(); await pg.goto(base);
  await pg.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${base}fx.css"><style>body{margin:0} .field{height:300px} .spacer{height:1800px}</style></head><body>${html}<script src="${base}fx.js"></script></body></html>`);
  await pg.waitForFunction(() => document.documentElement.classList.contains('fx-on'));
  return pg;
}

test('aurora defers GPU startup, prewarms nearby, animates only onscreen, and pauses offscreen', async t => {
  const pg = await fixture(t, '<h1>Lazy effects</h1><div class="spacer"></div><section class="field" data-fx="aurora">Field</section>');
  await pg.waitForTimeout(160);
  assert.deepEqual(await pg.evaluate(() => gpu), { contexts: 0, draws: 0 });
  assert.equal(await pg.locator('canvas').count(), 0);
  assert.equal(await pg.locator('.fx-aurora-fallback').count(), 1);
  await pg.locator('.field').evaluate(el => scrollTo(0, el.offsetTop - innerHeight - 80));
  await pg.waitForFunction(() => gpu.contexts === 1);
  const warm = await pg.evaluate(() => gpu.draws);
  await pg.waitForTimeout(180);
  assert.equal(await pg.evaluate(() => gpu.draws), warm, 'prewarming must not start an offscreen animation');
  await pg.locator('.field').evaluate(el => scrollTo(0, el.offsetTop - innerHeight + 120));
  await pg.waitForFunction(n => gpu.draws > n + 1, warm);
  await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(100);
  const paused = await pg.evaluate(() => gpu.draws); await pg.waitForTimeout(180);
  assert.equal(await pg.evaluate(() => gpu.draws), paused);
  assert.equal(await pg.evaluate(() => gpu.contexts), 1, 'returning must reuse the existing context');
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  await pg.waitForFunction(() => !document.querySelector('canvas'));
  assert.equal(await pg.locator('canvas').count(), 0);
  assert.equal(await pg.locator('.fx-aurora-fallback').count(), 1);
});

test('reduced motion starts with no canvas or context and retains authored text styling', async t => {
  const pg = await fixture(t, '<h1 id="title" data-fx="split">Made <em id="italic">to move</em><br> &amp; <strong>stay.</strong></h1><span id="generic" data-fx="split" data-fx-split="chars">Beautiful &lt; details</span><section class="field" data-fx="aurora">Field</section>', { reducedMotion: 'reduce' });
  await pg.waitForTimeout(150);
  assert.equal(await pg.locator('canvas').count(), 0);
  assert.equal(await pg.evaluate(() => gpu.contexts), 0);
  assert.equal(await pg.locator('#italic').evaluate(el => getComputedStyle(el).fontStyle), 'italic');
  assert.equal(await pg.locator('#title br').count(), 1);
  assert.equal(await pg.locator('#title strong').count(), 1);
  assert.equal(await pg.locator('#generic').getAttribute('aria-label'), null, 'generic elements must not receive a prohibited name');
  assert.equal(await pg.locator('#title > .fx-sr').textContent(), 'Made to move & stay.');
  assert.equal(await pg.locator('#generic > .fx-sr').textContent(), 'Beautiful < details');
  assert.match(await pg.locator('#title').ariaSnapshot(), /heading "Made to move & stay\."/);
  const aria = await pg.locator('#generic').ariaSnapshot();
  assert.equal((aria.match(/Beautiful/g) || []).length, 1, 'animated text must be announced once');
  assert.equal(await pg.locator('#generic .fx-c').first().evaluate(el => getComputedStyle(el).transform), 'none');
});

test('normal split keeps inline markup and safe text; interactive descendants stay accessible', async t => {
  const pg = await fixture(t, '<h1 id="title" data-fx="split">A <em id="em">bold &amp; bright</em> future.</h1><p id="linked" data-fx="split">An <a href="#title">accessible link</a>.</p>');
  assert.equal(await pg.locator('#em').evaluate(el => getComputedStyle(el).fontStyle), 'italic');
  assert.equal(await pg.locator('#em .fx-w').count(), 3);
  assert.match(await pg.locator('#title').ariaSnapshot(), /heading "A bold & bright future\."/);
  assert.equal(await pg.locator('#linked .fx-w').count(), 0);
  assert.equal(await pg.locator('#linked a').getAttribute('aria-hidden'), null);
  assert.equal(await pg.locator('#title').getAttribute('aria-label'), null);
});

test('failed shader compilation leaves a static gradient without retries or a dead canvas', async t => {
  const pg = await fixture(t, '<h1>Fallback</h1><section class="field" data-fx="aurora">Field</section>', {}, { failShader: true });
  await pg.waitForFunction(() => gpu.contexts === 1); await pg.waitForTimeout(120);
  assert.equal(await pg.locator('canvas').count(), 0);
  assert.equal(await pg.locator('.fx-aurora-fallback').count(), 1);
  assert.equal(await pg.evaluate(() => gpu.draws), 0);
  await pg.evaluate(() => dispatchEvent(new Event('resize'))); await pg.waitForTimeout(80);
  assert.equal(await pg.evaluate(() => gpu.contexts), 1);
});

test('tap target checks use 44 by 44, associated labels, visibility and inline prose exceptions', async t => {
  const pg = await fixture(t, `<h1>Controls</h1><style>button{padding:0;border:0;width:44px;height:44px}.small{height:42px}.narrow{width:20px}label{display:inline-block;width:48px;height:48px}input{position:absolute;opacity:0;width:1px;height:1px}</style><button>Pass</button><button class="small">Short</button><button class="narrow">Thin</button><button hidden>Hidden</button><label><input type="radio" name="choice">Choose</label><p>A <a href="#">prose link</a>.</p>`);
  assert.deepEqual((await inspectTapTargets(pg)).map(r => r.name).sort(), ['Short', 'Thin']);
});

async function phoneFixture(t, { broken = false, clipped = false, blob = false, desktopAlso = false } = {}) {
  const pg = await fixture(t, `<h1>Phone story</h1><section data-k-hero class="k-media-ready" style="height:2000px"><div style="position:sticky;top:0;height:600px"><video data-k-scrub data-src="desktop.webm" data-src-mobile="phone.webm"></video><div data-k-band="0 1" style="${clipped ? 'margin-left:-30px;' : ''}">Readable story</div></div></section><div style="height:1000px"></div>`, { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }, false);
  if (blob) {
    await pg.route('**/*.webm', route => route.fulfill({ status: 200, contentType: 'video/webm', body: 'fixture media' }));
    // Same fetch-to-blob provenance as the engine, without relying on a video decoder
    // for this source-selection regression (the integration check uses real movies).
    await pg.evaluate(async ({ base, desktopAlso }) => { await (await fetch(base + 'phone.webm')).blob(); if (desktopAlso) await fetch(base + 'desktop.webm'); }, { base, desktopAlso });
  }
  await pg.evaluate(({ broken, base, blob }) => {
    const hero = document.querySelector('[data-k-hero]'), video = hero.querySelector('video');
    let time = 0;
    Object.defineProperties(video, { duration: { get: () => 10 }, readyState: { get: () => 2 }, currentTime: { get: () => time }, currentSrc: { get: () => blob ? 'blob:' + base + 'fixture-movie' : base + 'phone.webm' } });
    const tick = () => { const p = Math.max(0, Math.min(1, (scrollY - hero.offsetTop) / (hero.offsetHeight - innerHeight))); hero.style.setProperty('--k-p', p.toFixed(4)); time = broken ? 5 : p * 10; };
    addEventListener('scroll', tick); tick();
  }, { broken, base, blob });
  return pg;
}
test('phone traversal checks both directions and declared source at every supported size', async t => {
  const pg = await phoneFixture(t);
  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 812 }, { width: 375, height: 667 }]) {
    await pg.setViewportSize(viewport);
    const result = await inspectPhoneHero(pg);
    assert.deepEqual(result.issues, []);
    assert.ok(result.notes.some(n => n.includes('forward and reverse')));
  }
});
test('phone traversal catches stuck media and clipped captions', async t => {
  const pg = await phoneFixture(t, { broken: true, clipped: true });
  const result = await inspectPhoneHero(pg);
  assert.ok(result.issues.some(i => /forward scrolling/.test(i)));
  assert.ok(result.issues.some(i => /backwards/.test(i)));
  assert.ok(result.issues.some(i => /text is clipped/.test(i)));
});

test('semantic checks exercise menu and inspect labels without ever submitting a form', async t => {
  const pg = await fixture(t, `<h1>Contact</h1><button id="toggle" aria-controls="nav" aria-expanded="false">Menu</button><nav id="nav" hidden>Navigation</nav><form method="post" action="submit.php"><label for="email">Email</label><input id="email" name="email" type="email" required><button>Send</button></form>`);
  let mutations = 0;
  pg.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations++; });
  await pg.evaluate(() => {
    const button = document.querySelector('#toggle'), nav = document.querySelector('nav');
    const set = open => { button.setAttribute('aria-expanded', String(open)); nav.hidden = !open; };
    button.onclick = () => set(button.getAttribute('aria-expanded') !== 'true');
    button.onkeydown = e => { if (e.key === 'Escape') set(false); };
  });
  assert.deepEqual(await inspectSemantics(pg, { checkMenus: true }), []);
  assert.equal(await pg.locator('#toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(mutations, 0);
  await pg.locator('#email').evaluate(el => { el.removeAttribute('name'); el.id = 'changed'; });
  const issues = await inspectSemantics(pg);
  assert.ok(issues.some(i => /no accessible label/.test(i)));
  assert.ok(issues.some(i => /no name/.test(i)));
  assert.equal(mutations, 0);
});


test('phone source check accepts engine fetch-to-blob and still catches desktop downloads', async t => {
  const correct = await phoneFixture(t, { blob: true });
  assert.deepEqual((await inspectPhoneHero(correct)).issues, []);
  const double = await phoneFixture(t, { blob: true, desktopAlso: true });
  assert.ok((await inspectPhoneHero(double)).issues.some(i => /downloads the desktop/.test(i)));
});

test('only the expected blocked local enquiry probe becomes a preview note', () => {
  const base = 'http://127.0.0.1:8080/';
  assert.equal(isExpectedPreviewProbe(base + 'api/submit.php?stamp=1', 403, base), true);
  for (const [url, status, method] of [
    [base + 'api/config.php', 403, 'GET'], [base + 'api/submit.php', 403, 'GET'],
    [base + 'api/submit.php?stamp=1', 500, 'GET'], [base + 'api/submit.php?stamp=1', 403, 'POST'],
    ['https://example.test/api/submit.php?stamp=1', 403, 'GET']
  ]) assert.equal(isExpectedPreviewProbe(url, status, base, method), false);
});
