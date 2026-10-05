import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { googlebotAllowed, fetchText, liveSearchChecks, main, writeSEO } from '../report.mjs';
import { closeServer } from '../server.mjs';

const fixture = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), '10k-report space % ')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const serve = async handler => { const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); return server; };

test('Googlebot rules honor specific groups, longest path and Allow on ties', () => {
  const robots = 'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /private\nAllow: /private/open\nDisallow: /draft*\nAllow: /draft-public$\n';
  assert.equal(googlebotAllowed(robots, '/').allowed, true);
  assert.equal(googlebotAllowed(robots, '/private').allowed, false);
  assert.equal(googlebotAllowed(robots, '/private/open').allowed, true);
  assert.equal(googlebotAllowed(robots, '/draft-one').allowed, false);
  assert.equal(googlebotAllowed(robots, '/draft-public').allowed, true);
  assert.equal(googlebotAllowed('User-agent: Googlebot\nDisallow: /\nAllow: /', '/').allowed, true);
  assert.equal(googlebotAllowed('User-agent: *\nDisallow:', '/').allowed, true);
});

test('SEO-only writes public pages without installing or running Lighthouse', async t => {
  const dir = fixture(t), site = path.join(dir, 'site'), output = path.join(dir, 'review'); fs.mkdirSync(site);
  fs.writeFileSync(path.join(site, 'index.html'), '<html lang="en"><title>Test</title><h1>Test</h1></html>');
  fs.mkdirSync(path.join(site, 'nested', 'admin'), { recursive: true }); fs.writeFileSync(path.join(site, 'nested', 'admin', 'secret.html'), 'PRIVATE');
  fs.writeFileSync(path.join(site, 'space & name.html'), 'Page');
  let called = false;
  const result = await main([site, output, '--seo', 'https://example.com', '--seo-only'], { lighthouseRunner: () => { called = true; }, install: false });
  assert.equal(called, false); assert.deepEqual(result.failures, []);
  const sitemap = fs.readFileSync(path.join(site, 'sitemap.xml'), 'utf8'); assert.match(sitemap, /space%20%26%20name\.html/); assert.doesNotMatch(sitemap, /secret/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'launch-report.json'))).seoOnly, true);
  assert.throws(() => writeSEO(site, 'https://user:password@example.com'), /credentials/);
});

test('live crawl checks follow final page origin/path and fail on Googlebot blocks', async t => {
  const target = await serve((req, res) => {
    if (req.url === '/robots.txt') { res.setHeader('Content-Type', 'text/plain'); return res.end('User-agent: Googlebot\nDisallow: /private'); }
    if (req.url === '/sitemap.xml') { res.setHeader('Content-Type', 'application/xml'); return res.end('<urlset></urlset>'); }
    res.end('<html lang="en"><title>Private</title><h1>Private</h1></html>');
  }); t.after(() => closeServer(target));
  const redirect = await serve((_req, res) => { res.writeHead(302, { Location: `http://127.0.0.1:${target.address().port}/private` }); res.end(); }); t.after(() => closeServer(redirect));
  const result = await liveSearchChecks(`http://127.0.0.1:${redirect.address().port}/old`);
  assert.equal(result.failed, true); assert.ok(result.messages.some(m => m.includes('/private: BLOCKED'))); assert.ok(result.messages.some(m => m.includes('redirects')));
});

test('fetches terminate on stalled responses and oversized bodies with readable errors', async t => {
  const server = await serve((req, res) => { if (req.url === '/big') res.end('x'.repeat(200)); });
  t.after(() => { server.closeAllConnections(); return closeServer(server); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const result = await fetchText(base, { timeoutMs: 50 }); assert.equal(result.ok, false); assert.match(result.error, /timed out/);
  const big = await fetchText(base + '/big', { maxBytes: 100 }); assert.equal(big.ok, false); assert.match(big.error, /exceeds/);
});

test('a Lighthouse exception closes the local server and saves an honest failed report', async t => {
  const dir = fixture(t), site = path.join(dir, 'site'), output = path.join(dir, 'review'); fs.mkdirSync(site); fs.writeFileSync(path.join(site, 'index.html'), '<h1>Test</h1>');
  let server, url;
  const result = await main([site, output], {
    install: false, lighthouseCli: fileURLToPath(import.meta.url), onServer: value => { server = value; url = `http://127.0.0.1:${server.address().port}`; },
    lighthouseRunner: async () => { assert.equal((await fetch(url)).status, 200); throw new Error('Deliberate local Lighthouse failure'); }
  });
  assert.equal(server.listening, false); assert.deepEqual(result.scores, {}); assert.match(result.failures[0], /Deliberate local/);
  await assert.rejects(fetch(url));
  assert.match(fs.readFileSync(path.join(output, 'launch-report.json'), 'utf8'), /Deliberate local/);
});

test('a Lighthouse run with no fresh output cannot reuse stale scores', async t => {
  const dir = fixture(t), site = path.join(dir, 'site'), output = path.join(dir, 'review'); fs.mkdirSync(site); fs.mkdirSync(output); fs.writeFileSync(path.join(site, 'index.html'), '<h1>Test</h1>');
  for (const mode of ['mobile', 'desktop']) fs.writeFileSync(path.join(output, `lighthouse-${mode}.report.json`), JSON.stringify({ categories: { performance: { score: 1 } } }));
  const result = await main([site, output], { install: false, lighthouseCli: fileURLToPath(import.meta.url), lighthouseRunner: async () => ({ status: 0, stderr: '' }) });
  assert.deepEqual(result.scores, {}); assert.equal(result.failures.length, 2); assert.match(result.failures[0], /No report was produced/);
});
