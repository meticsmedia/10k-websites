// Local previews only. Never expose a project directory on the network.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const inside = (root, file) => { const rel = path.relative(root, file); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
const forbidden = part => part.startsWith('.') || /^(?:api|admin|data|node_modules)$/i.test(part) || /^(?:config|credentials|secrets?)(?:[._-]|$)/i.test(part) || /\.(?:php\d*|phtml|phar|db|sqlite3?|sql|log|config|bak|backup|old|orig|pem|key|env|ini|toml|ya?ml)$/i.test(part);
const reply = (res, status, extra = {}) => { res.writeHead(status, { 'Content-Length': 0, 'Cache-Control': 'no-store', ...extra }); res.end(); };

// Supports one HTTP byte range. Multiple ranges are deliberately rejected.
export function byteRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2]) || !size) return false;
  let start, end;
  if (!m[1]) { const suffix = Number(m[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) return false; start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(m[1]); end = m[2] ? Number(m[2]) : size - 1; if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return false; end = Math.min(end, size - 1); }
  return { start, end };
}

export async function startStaticServer(root, { port = 0, host = '127.0.0.1', allowlist = null, virtualFiles = {} } = {}) {
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('Preview servers must bind to 127.0.0.1 or ::1.');
  if (!Number.isInteger(Number(port)) || Number(port) < 0 || Number(port) > 65535) throw new Error('Port must be an integer from 0 to 65535.');
  const realRoot = await fs.promises.realpath(path.resolve(root));
  if (!(await fs.promises.stat(realRoot)).isDirectory()) throw new Error('Preview root must be a directory.');
  const allowed = allowlist && new Set(allowlist);
  const server = http.createServer(async (req, res) => {
    // DNS rebinding cannot turn this server into a remotely addressed origin.
    if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(req.headers.host || '')) return reply(res, 403);
    if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { Allow: 'GET, HEAD' });
    let pathname;
    try { pathname = decodeURIComponent((req.url || '').split('?')[0]); } catch { return reply(res, 400); }
    if (!pathname.startsWith('/') || /[\\\0]/.test(pathname)) return reply(res, 403);
    const parts = pathname.split('/').filter(Boolean);
    if (parts.some(forbidden)) return reply(res, 403);
    if (allowed && !allowed.has(pathname)) return reply(res, 404);
    const virtual = Object.hasOwn(virtualFiles, pathname) ? virtualFiles[pathname] : null;
    if (virtual) {
      const body = Buffer.from(virtual.body);
      res.writeHead(200, { 'Content-Type': virtual.type || 'text/html; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    let handle;
    try {
      let candidate = path.resolve(realRoot, `.${pathname}`);
      if (!inside(realRoot, candidate)) return reply(res, 403);
      if ((await fs.promises.stat(candidate)).isDirectory()) candidate = path.join(candidate, 'index.html');
      const real = await fs.promises.realpath(candidate);
      if (!inside(realRoot, real) || path.relative(realRoot, real).split(path.sep).some(forbidden)) return reply(res, 403);
      if (!Object.hasOwn(TYPES, path.extname(real).toLowerCase())) return reply(res, 404);
      handle = await fs.promises.open(real, 'r');
      const stat = await handle.stat();
      if (!stat.isFile()) { await handle.close(); return reply(res, 404); }
      const range = byteRange(req.method === 'GET' ? req.headers.range : null, stat.size);
      if (range === false) { await handle.close(); return reply(res, 416, { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' }); }
      const headers = { 'Content-Type': TYPES[path.extname(real).toLowerCase()] || 'application/octet-stream', 'Content-Length': range ? range.end - range.start + 1 : stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
      if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === 'HEAD') { await handle.close(); return res.end(); }
      pipeline(handle.createReadStream(range || {}), res, () => {});
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (!res.headersSent) reply(res, ['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code) ? 404 : 500);
      else res.destroy();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(port), host, () => { server.removeListener('error', reject); resolve(); });
  });
  return server;
}

export async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections?.(); });
}
