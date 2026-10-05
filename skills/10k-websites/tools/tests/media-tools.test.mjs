import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writePoster, main as encode } from '../encode.mjs';
import { probeFilm, startReview } from '../review.mjs';
import { closeServer } from '../server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function dependency(name) { try { return require(name); } catch { return require(path.join(process.env.TENK_TEST_DEPS || path.resolve(here, '../../../../tools/node_modules'), name)); } }
const sharp = dependency('sharp');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const run = argv => { const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { encoding: 'utf8' }); assert.equal(r.status, 0, r.error?.message || r.stderr); };
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '10k film % ')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const film = path.join(dir, 'movie with space.mp4');
  // Nine red frames followed by exactly one blue frame: a first-frame or near-end
  // approximation cannot pass the last-frame color assertion.
  run(['-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=10:d=1', '-vf', "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='eq(n,9)'", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', film]);
  return { dir, film };
}
async function color(file) { const { data } = await sharp(fs.readFileSync(file)).resize(1, 1).raw().toBuffer({ resolveWithObject: true }); return [...data]; }
const isBlue = rgb => rgb[2] > 180 && rgb[0] < 70;
const isRed = rgb => rgb[0] > 180 && rgb[2] < 70;

test('poster defaults to the final decoded frame; explicit timestamp selects an earlier frame', async t => {
  const { dir, film } = fixture(t);
  const last = path.join(dir, 'last.webp'), first = path.join(dir, 'first.webp');
  await writePoster(film, last); await writePoster(film, first, { at: 0 });
  assert.ok(isBlue(await color(last)), 'last poster must show the unique final blue frame');
  assert.ok(isRed(await color(first)), '0-second poster must show the red opening');
  await assert.rejects(writePoster(film, path.join(dir, 'invalid.webp'), { at: 90 }), /outside|decoded/);
});

test('WebP fallback works with cwebp and with sharp when FFmpeg lacks the encoder', async t => {
  const { dir, film } = fixture(t);
  const cwebp = process.env.CWEBP || 'cwebp';
  if (spawnSync(cwebp, ['-version']).status === 0) {
    const file = path.join(dir, 'cwebp.webp');
    assert.equal(await writePoster(film, file, { webpEncoder: 'unavailable_encoder', cwebp }), 'cwebp');
    assert.ok(isBlue(await color(file)));
  }
  const file = path.join(dir, 'sharp.webp');
  assert.equal(await writePoster(film, file, { webpEncoder: 'unavailable_encoder', cwebp: path.join(dir, 'missing-cwebp'), sharpLoader: async () => ({ default: sharp }) }), 'sharp');
  assert.ok(isBlue(await color(file)));
});

test('poster-only preserves movie bytes; desktop and phone posters land on the ending', async t => {
  const { dir, film } = fixture(t), assets = path.join(dir, 'assets');
  await encode([film, assets, '--mobile']);
  const desktop = path.join(assets, 'hero.mp4'), phone = path.join(assets, 'hero-m.mp4');
  assert.ok(isBlue(await color(path.join(assets, 'hero-poster.webp'))));
  assert.ok(isBlue(await color(path.join(assets, 'hero-m-poster.webp'))));
  const before = [fs.readFileSync(desktop), fs.readFileSync(phone)];
  await encode([desktop, assets, '--mobile', '--poster-only', '--poster', '0']);
  assert.deepEqual(fs.readFileSync(desktop), before[0]); assert.deepEqual(fs.readFileSync(phone), before[1]);
  assert.ok(isRed(await color(path.join(assets, 'hero-poster.webp'))));
});

test('film viewer probes fps and exposes only the player and one seekable movie', async t => {
  const { dir, film } = fixture(t); fs.writeFileSync(path.join(dir, 'config.json'), '{"secret":true}');
  assert.equal(probeFilm(film).fps, 10);
  const server = await startReview(film, { port: 0 }); t.after(() => closeServer(server));
  const base = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(base)).text();
  assert.match(html, /Half speed/); assert.match(html, /Previous frame/); assert.match(html, /Next frame/); assert.match(html, /10\.000 fps/);
  const media = await fetch(`${base}/${encodeURIComponent(path.basename(film))}`, { headers: { Range: 'bytes=0-31' } });
  assert.equal(media.status, 206); assert.equal((await media.arrayBuffer()).byteLength, 32);
  assert.ok([403, 404].includes((await fetch(`${base}/config.json`)).status));
  let playwright; try { playwright = dependency('playwright-core'); } catch { return; }
  const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  if (!chrome) return;
  const browser = await playwright.chromium.launch({ executablePath: chrome, headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); await page.goto(base);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  await page.click('#forward'); await page.waitForFunction(() => Math.abs(document.querySelector('video').currentTime - 0.1) < 0.025);
  await page.click('#back'); await page.waitForFunction(() => document.querySelector('video').currentTime < 0.025);
  await page.selectOption('#speed', '0.5'); assert.equal(await page.$eval('video', v => v.playbackRate), 0.5);
  await page.selectOption('#speed', '1'); await page.click('#play');
  await page.waitForFunction(() => document.querySelector('video').ended, { timeout: 5000 });
  assert.equal(await page.$eval('#error', e => e.textContent), '');
});

test('encoding rejects source aliases before writing desktop or phone outputs', async t => {
  const { dir, film } = fixture(t), before = fs.readFileSync(film);
  const assets = path.join(dir, 'assets'); fs.mkdirSync(assets);
  fs.linkSync(film, path.join(assets, 'hero-m.mp4'));
  await assert.rejects(encode([film, assets, '--mobile']), /phone output movies are the same/);
  assert.equal(fs.existsSync(path.join(assets, 'hero.mp4')), false);
  assert.deepEqual(fs.readFileSync(film), before);
  fs.linkSync(film, path.join(assets, 'hero.mp4'));
  await assert.rejects(encode([film, assets]), /output movies are the same/);
  assert.deepEqual(fs.readFileSync(film), before);
});
