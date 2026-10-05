#!/usr/bin/env node
// Usage: node preview.mjs site [--port 8080]
import { startStaticServer, closeServer } from './server.mjs';

const args = process.argv.slice(2);
let port = 8080;
const i = args.indexOf('--port');
if (i >= 0) { port = Number(args[i + 1]); args.splice(i, 2); }
try {
  if (args.length > 1) throw new Error('Usage: node preview.mjs site [--port 8080]');
  const server = await startStaticServer(args[0] || 'site', { port });
  console.log(`Preview: http://127.0.0.1:${server.address().port}/`);
  console.log('Local preview only. PHP, private folders and dotfiles are not served. Press Ctrl+C to stop.');
  const stop = async () => { await closeServer(server); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another --port; no existing process was stopped.` : error.message);
  process.exitCode = 1;
}
