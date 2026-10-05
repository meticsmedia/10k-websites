#!/usr/bin/env node
// kit.mjs: the client kit. A one-page brand guide and a handover note, as print-ready PDFs.
// Usage: node kit.mjs .10k/kit.json site [outDir]      (default outDir: client-kit/)
// kit.json holds the facts (you write it from the design package and plan file):
// { "name": "", "tagline": "", "live_url": "", "preview_url": "", "admin_url": "",
//   "colors": [{ "name": "Paper", "hex": "#f4efe6", "role": "Background" }],
//   "fonts": [{ "name": "Fraunces", "role": "Headlines", "weights": "400, 600" }],
//   "voice": ["Warm and unhurried", "..."], "words_we_use": ["...", "..."], "words_we_avoid": ["luxury", "..."],
//   "photo_style": "Natural light, real materials, no people facing the camera",
//   "owner": "", "made_by": "", "domain": "", "hosting": "Hostinger Premium", "renewals": ["Hosting: renews ...", "..."],
//   "how_to_change": ["Open ChatGPT in the website folder", "..."], "included": ["..."], "not_included": ["..."], "contact": "" }
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [kitFile = '.10k/kit.json', site = 'site', outDir = 'client-kit'] = process.argv.slice(2);
if (!fs.existsSync(kitFile)) { console.error(`No ${kitFile}. Write it first (see the top of this file).`); process.exit(1); }
const K = JSON.parse(fs.readFileSync(kitFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataUri = f => { if (!f || !fs.existsSync(f)) return ''; const ext = path.extname(f).slice(1).replace('jpg', 'jpeg').replace('svg', 'svg+xml'); return `data:image/${ext};base64,${fs.readFileSync(f).toString('base64')}`; };
const logo = dataUri(path.join(site, 'favicon.svg'));
const share = dataUri(path.join(site, 'og.jpg'));
const c0 = (K.colors || [])[0]?.hex || '#f4efe6', ink = (K.colors || []).find(c => /text|ink/i.test(c.role || ''))?.hex || '#1d1b18';
const fontLink = (K.fonts || []).length ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${K.fonts.map(f => `family=${encodeURIComponent(f.name)}:wght@${String(f.weights || '400').replace(/\s/g, '').split(',').join(';')}`).join('&')}&display=swap">` : '';
const head = f => (K.fonts || [])[f]?.name ? `'${K.fonts[f].name}', ` : '';
const list = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
const css = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font:11pt/1.55 ${head(1)}system-ui,sans-serif;color:${ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;padding:18mm 18mm 16mm;position:relative;background:#fff}
h1{font:600 30pt/1.05 ${head(0)}Georgia,serif;margin:0 0 4mm;letter-spacing:-.01em}h2{font:600 10pt/1.2 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;margin:9mm 0 3mm;opacity:.65}
.lede{font-size:13pt;opacity:.8;margin:0}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:10mm}.logo{width:22mm;height:22mm}
.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(36mm,1fr));gap:4mm}.chip{border-radius:3mm;height:22mm;border:1px solid #0001}.sw small{display:block;opacity:.7}
.type{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.spec{font-size:22pt;line-height:1.1}.cols{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
ul{margin:0;padding-left:5mm}li{margin:1mm 0}.share{width:100%;border-radius:3mm;margin-top:2mm}.foot{position:absolute;bottom:10mm;left:18mm;right:18mm;font-size:8.5pt;opacity:.55;display:flex;justify-content:space-between}
.box{border:1px solid #0002;border-radius:3mm;padding:5mm 6mm}.kv{display:grid;grid-template-columns:38mm 1fr;gap:2mm 6mm}.kv dt{opacity:.65}.kv dd{margin:0;word-break:break-all}`;

const guide = `<!doctype html><html><head><meta charset="utf-8">${fontLink}<style>${css}</style></head><body><div class="page">
<div class="top"><div><h1>${esc(K.name)}</h1><p class="lede">${esc(K.tagline)}</p></div>${logo ? `<img class="logo" src="${logo}" alt="">` : ''}</div>
<h2>Colours</h2><div class="sw">${(K.colors || []).map(c => `<div><div class="chip" style="background:${esc(c.hex)}"></div><strong>${esc(c.name)}</strong><small>${esc(c.hex)} · ${esc(c.role)}</small></div>`).join('')}</div>
<h2>Type</h2><div class="type">${(K.fonts || []).map((f, i) => `<div><div class="spec" style="font-family:'${esc(f.name)}';font-weight:${String(f.weights || '400').split(',')[0]}">${i === 0 ? esc(K.name) : 'Every detail, chosen on purpose'}</div><small>${esc(f.name)} · ${esc(f.role)} · ${esc(f.weights)}</small></div>`).join('')}</div>
<div class="cols"><div><h2>Voice</h2><ul>${list(K.voice)}</ul></div><div><h2>Words</h2><p><strong>We say:</strong> ${esc((K.words_we_use || []).join(', '))}</p><p><strong>We avoid:</strong> ${esc((K.words_we_avoid || []).join(', '))}</p></div></div>
${K.photo_style ? `<h2>Photography</h2><p>${esc(K.photo_style)}</p>` : ''}
${share ? `<h2>How the site looks when shared</h2><img class="share" src="${share}" alt="">` : ''}
<div class="foot"><span>${esc(K.name)} brand guide</span><span>${esc(K.made_by)}</span></div></div></body></html>`;

const handover = `<!doctype html><html><head><meta charset="utf-8">${fontLink}<style>${css}</style></head><body><div class="page">
<div class="top"><div><h1>Your new website</h1><p class="lede">${esc(K.name)}. Everything you need to know, on one page.</p></div>${logo ? `<img class="logo" src="${logo}" alt="">` : ''}</div>
<h2>The essentials</h2><div class="box"><dl class="kv">
${K.live_url ? `<dt>Your website</dt><dd>${esc(K.live_url)}</dd>` : ''}${K.preview_url ? `<dt>Preview address</dt><dd>${esc(K.preview_url)}</dd>` : ''}
${K.admin_url ? `<dt>Your message inbox</dt><dd>${esc(K.admin_url)} (your own password)</dd>` : ''}${K.domain ? `<dt>Domain</dt><dd>${esc(K.domain)}</dd>` : ''}
${K.hosting ? `<dt>Hosting</dt><dd>${esc(K.hosting)}</dd>` : ''}${K.owner ? `<dt>Owner</dt><dd>${esc(K.owner)}</dd>` : ''}</dl></div>
<div class="cols"><div><h2>What you own</h2><ul><li>The domain and the hosting account, in your name.</li><li>Every file of the website, in one folder.</li><li>The brand guide, logo and images.</li>${list(K.included)}</ul></div>
<div><h2>Renewals</h2><ul>${list(K.renewals)}</ul>${(K.not_included || []).length ? `<h2>Not included</h2><ul>${list(K.not_included)}</ul>` : ''}</div></div>
<h2>How to change something</h2><ol>${list(K.how_to_change)}</ol>
<h2>If something goes wrong</h2><p>Your hosting keeps backups, and the full website folder can be put back online in one step. ${esc(K.contact)}</p>
<div class="foot"><span>Handover for ${esc(K.owner || K.name)}</span><span>${esc(K.made_by)}</span></div></div></body></html>`;

const browser = await (async () => {
  const tries = process.env.CHROME ? [{ executablePath: process.env.CHROME }] : [{ channel: 'chrome' }, { channel: 'msedge' }];
  for (const t of tries) { try { return await chromium.launch(t); } catch {} }
  console.error('Could not find Chrome or Edge.'); process.exit(2);
})();
const pg = await browser.newPage();
for (const [file, html] of [['brand-guide', guide], ['handover', handover]]) {
  fs.writeFileSync(path.join(outDir, `${file}.html`), html);
  await pg.setContent(html, { waitUntil: 'networkidle' });
  await pg.pdf({ path: path.join(outDir, `${file}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await pg.setViewportSize({ width: 794, height: 1123 });
  await pg.screenshot({ path: path.join(outDir, `${file}.png`), fullPage: true });
}
await browser.close();
console.log(`Client kit written to ${outDir}/: brand-guide.pdf, handover.pdf (and .png previews to look at).`);
