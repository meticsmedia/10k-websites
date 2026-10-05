import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startStaticServer, closeServer } from '../server.mjs';

const fixture = t => { const base = fs.mkdtempSync(path.join(os.tmpdir(), '10k-server-')); t.after(() => fs.rmSync(base, { recursive: true, force: true })); const root = path.join(base, 'public site'); fs.mkdirSync(root); fs.writeFileSync(path.join(root, 'index.html'), '<h1>Ready</h1>'); return { base, root }; };
function request(server, pathname, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: pathname, method, headers }, response => { const data = []; response.on('data', d => data.push(d)); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(data).toString() })); });
    req.on('error', reject); req.end();
  });
}

test('static previews serve GET/HEAD and seekable byte ranges, including 416', async t => {
  const { root } = fixture(t); fs.writeFileSync(path.join(root, 'film.mp4'), '0123456789');
  const server = await startStaticServer(root); t.after(() => closeServer(server));
  assert.equal((await request(server, '/')).body, '<h1>Ready</h1>');
  const range = await request(server, '/film.mp4', { headers: { Range: 'bytes=2-5' } });
  assert.equal(range.status, 206); assert.equal(range.body, '2345'); assert.equal(range.headers['content-range'], 'bytes 2-5/10');
  assert.equal((await request(server, '/film.mp4', { headers: { Range: 'bytes=-3' } })).body, '789');
  assert.equal((await request(server, '/film.mp4', { headers: { Range: 'bytes=8-' } })).body, '89');
  const head = await request(server, '/film.mp4', { method: 'HEAD', headers: { Range: 'bytes=2-5' } });
  assert.equal(head.status, 200); assert.equal(head.headers['content-length'], '10'); assert.equal(head.body, '');
  for (const value of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=1-2,4-5', 'invalid']) {
    const result = await request(server, '/film.mp4', { headers: { Range: value } }); assert.equal(result.status, 416, value); assert.equal(result.headers['content-range'], 'bytes */10');
  }
  assert.equal((await request(server, '/', { method: 'POST' })).status, 405);
});

test('private paths, malformed encoding, traversal and symlink escapes are denied', async t => {
  const { base, root } = fixture(t);
  for (const name of ['api', 'admin', 'data', '.hidden', 'nested/.config']) { fs.mkdirSync(path.join(root, name), { recursive: true }); fs.writeFileSync(path.join(root, name, 'secret.txt'), 'DO NOT EXPOSE'); }
  fs.writeFileSync(path.join(root, 'secret.php'), '<?php SECRET ?>'); fs.writeFileSync(path.join(root, '.env'), 'SECRET');
  for (const filename of ['inbox.db', 'inbox.sqlite', 'requests.log', 'site.config', 'settings.backup', 'config.json', 'unknown.bin']) fs.writeFileSync(path.join(root, filename), 'SECRET');
  const outside = path.join(base, 'public site-other'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'secret.txt'), 'OUTSIDE');
  try { fs.symlinkSync(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir'); fs.symlinkSync(path.join(root, 'admin'), path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir'); } catch (error) { if (error.code !== 'EPERM') throw error; }
  const server = await startStaticServer(root); t.after(() => closeServer(server));
  for (const pathname of ['/api/secret.txt', '/admin/secret.txt', '/data/secret.txt', '/.hidden/secret.txt', '/nested/.config/secret.txt', '/secret.php', '/.env', '/%2e%2e/public%20site-other/secret.txt', '/%2e%2e%2fpublic%20site-other/secret.txt', '/foo%5c..%5c.env', '/escape/secret.txt', '/alias/secret.txt']) assert.ok([403, 404].includes((await request(server, pathname)).status), pathname);
  for (const filename of ['inbox.db', 'inbox.sqlite', 'requests.log', 'site.config', 'settings.backup', 'config.json', 'unknown.bin']) assert.ok([403, 404].includes((await request(server, '/' + filename)).status), filename);
  assert.equal((await request(server, '/%ZZ')).status, 400);
  assert.equal((await request(server, '/', { headers: { Host: 'attacker.example' } })).status, 403);
});

test('only loopback binds; a port conflict leaves the original server running', async t => {
  const { root } = fixture(t);
  await assert.rejects(startStaticServer(root, { host: '0.0.0.0' }), /loopback|127\.0\.0\.1/);
  const first = await startStaticServer(root); t.after(() => closeServer(first));
  await assert.rejects(startStaticServer(root, { port: first.address().port }), { code: 'EADDRINUSE' });
  assert.equal((await request(first, '/')).status, 200);
});
