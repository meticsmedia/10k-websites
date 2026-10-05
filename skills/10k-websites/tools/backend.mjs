#!/usr/bin/env node
// backend.mjs: add the real backend (form inbox + email) to a site. No packages needed.
// Usage: node <skill>/tools/backend.mjs site --name "Your Business" --owner owner@example.com --url https://example.com [--from hello@example.com] [--new-code]
// Copies api/, admin/, data/ and forms.js into the site, writes api/config.php once, and prints the inbox setup code.
// Running it again keeps the existing secret and database; --new-code issues a fresh setup code (for a forgotten password).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const has = n => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const name = flag('--name', ''), owner = flag('--owner', ''), url = (flag('--url', '') || '').replace(/\/$/, '');
let from = flag('--from', ''); const newCode = has('--new-code');
const [site = 'site'] = args;
if (!fs.existsSync(path.join(site, 'index.html'))) { console.error(`No index.html in ${site}`); process.exit(1); }
const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'backend');
if (!fs.existsSync(src)) { console.error('Run this from the skill folder (node <skill>/tools/backend.mjs ...), where the backend/ files live.'); process.exit(1); }

const copy = (a, b) => {
  if (fs.statSync(a).isDirectory()) { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) copy(path.join(a, f), path.join(b, f)); }
  else if (!b.endsWith('config.php')) fs.copyFileSync(a, b);
};
for (const f of ['api', 'admin', 'data', 'forms.js']) copy(path.join(src, f), path.join(site, f));

const cfgPath = path.join(site, 'api', 'config.php');
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
let cfg = {};
if (fs.existsSync(cfgPath)) {
  const txt = fs.readFileSync(cfgPath, 'utf8');
  for (const m of txt.matchAll(/'(\w+)'\s*=>\s*'((?:\\'|[^'])*)'/g)) cfg[m[1]] = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}
const rand = n => crypto.randomBytes(n).toString('hex');
const host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
cfg.site_name = name || cfg.site_name || 'My website';
cfg.owner_email = owner || cfg.owner_email || '';
cfg.site_url = url || cfg.site_url || '';
cfg.from_email = from || cfg.from_email || (host ? `no-reply@${host}` : cfg.owner_email);
cfg.secret = cfg.secret || rand(32);
cfg.db_file = cfg.db_file || `inbox-${rand(8)}.sqlite`;
const fresh = !cfg.setup_code || newCode;
if (fresh) cfg.setup_code = crypto.randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 8);
fs.writeFileSync(cfgPath, `<?php\n// config.php: written by backend.mjs. Keep it private; it is blocked from the web by .htaccess.\nif (!defined('K_BACKEND')) { http_response_code(404); exit; }\nreturn [\n${Object.entries(cfg).map(([k, v]) => `  '${k}' => '${esc(v)}',`).join('\n')}\n];\n`);

console.log(`Backend added to ${site}/ (api/, admin/, data/, forms.js).`);
console.log(`Owner email: ${cfg.owner_email || '(none: messages only go to the inbox)'}   From: ${cfg.from_email}`);
if (fresh) console.log(`INBOX_SETUP_CODE=${cfg.setup_code}   (the owner enters this once at /admin/ to choose their password)`);
else console.log('Existing setup kept. Use --new-code if the owner forgot their password.');
console.log('Add <script src="forms.js" defer></script> to every page with a form, and data-k-form="name" to each <form>.');
