#!/usr/bin/env node
// Usage: node report.mjs <live URL or site folder> [reviewDir] [--seo https://yourdomain.com] [--seo-only]
// --seo writes sitemap.xml/robots.txt locally. --seo-only skips Lighthouse and its installation.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer, closeServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const excluded = name => name.startsWith('.') || /^(admin|api|data|node_modules)$/i.test(name);
export function htmlPages(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (excluded(entry.name) || entry.isSymbolicLink()) continue;
    const name = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...htmlPages(dir, name));
    else if (entry.isFile() && /\.html$/i.test(entry.name)) out.push(name);
  }
  return out;
}
const xml = value => value.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
export function writeSEO(site, base) {
  const parsed = new URL(base);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('--seo needs a public http(s) address without credentials, query or fragment.');
  const baseUrl = parsed.href.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const urls = htmlPages(site).map(p => `${baseUrl}/${p.replace(/(^|\/)index\.html$/, '$1').split('/').map(encodeURIComponent).join('/')}`);
  fs.writeFileSync(path.join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${xml(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(site, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /data/\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
  return `Wrote sitemap.xml (${urls.length} pages) and robots.txt for ${baseUrl}`;
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
}
export function searchBasics(html, label = 'index.html') {
  const missing = [];
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || '';
  if (!title) missing.push('a <title>'); else if (title.length > 65) missing.push(`a shorter title (${title.length} characters; aim for 65 or fewer)`);
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0]));
  const description = meta.find(m => m.name?.toLowerCase() === 'description')?.content;
  if (!description) missing.push('a meta description'); else if (description.length > 160 || description.length < 50) missing.push(`a meta description of 50 to 160 characters (now ${description.length})`);
  if (!/<html[^>]+\blang\s*=/i.test(html)) missing.push('lang on <html>');
  if ((html.match(/<h1[\s>]/gi) || []).length !== 1) missing.push('exactly one <h1>');
  if (!links.some(m => m.rel?.toLowerCase() === 'canonical')) missing.push('a canonical link');
  if (!meta.some(m => m.property?.toLowerCase() === 'og:image')) missing.push('og:image');
  if (!links.some(m => /(?:^|\s)icon(?:\s|$)/i.test(m.rel || ''))) missing.push('a favicon');
  if (/index\.html$/.test(label) && !/application\/ld\+json/i.test(html)) missing.push('structured business data (JSON-LD)');
  const noAlt = (html.match(/<img(?![^>]*\balt\s*=)[^>]*>/gi) || []).length;
  if (noAlt) missing.push(`alt text on ${noAlt} image(s)`);
  if (/<!--\s*DEPLOY STEP/i.test(html)) missing.push('the live address patched in at the DEPLOY STEP comment');
  const addresses = [...links.filter(m => /^(canonical|alternate)$/i.test(m.rel || '')).map(m => m.href), ...meta.filter(m => /^og:(image|url)$/i.test(m.property || '')).map(m => m.content)];
  if (addresses.some(u => !/^https?:\/\//i.test(u || ''))) missing.push('full http(s) addresses in canonical, hreflang and og tags');
  if (meta.some(m => /^(robots|googlebot)$/i.test(m.name || '') && /(?:^|[\s,])(noindex|none)(?:$|[\s,])/i.test(m.content || ''))) missing.push('remove the noindex directive if this page should appear in search');
  return missing.length ? `${label}: add or fix ${missing.join(', ')}.` : `${label}: all search basics in place.`;
}

export async function fetchText(url, { timeoutMs = 10000, maxBytes = 2 * 1024 * 1024 } = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': '10K-Website-Launch-Check' } });
    const reader = response.body?.getReader(), chunks = []; let length = 0;
    if (reader) for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new Error(`response exceeds ${maxBytes} bytes`); }
      chunks.push(Buffer.from(value));
    }
    return { ok: response.ok, status: response.status, url: response.url, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') };
  } catch (error) { return { ok: false, status: null, url: String(url), error: controller.signal.aborted ? `request timed out after ${timeoutMs} ms` : error.message }; }
  finally { clearTimeout(timer); }
}

// Evaluates robots rules for the Googlebot product token, including specific groups,
// longest matching path, wildcards and Allow winning a tie. This is a crawl check only.
export function googlebotAllowed(text, pathname = '/') {
  const groups = []; let group = null, rulesStarted = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(), colon = line.indexOf(':'); if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!group || rulesStarted) { group = { agents: [], rules: [] }; groups.push(group); rulesStarted = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow', 'disallow'].includes(key)) { group.rules.push({ allow: key === 'allow', path: value }); rulesStarted = true; }
  }
  const specific = groups.filter(g => g.agents.includes('googlebot'));
  const chosen = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  let winner = null;
  for (const rule of chosen.flatMap(g => g.rules)) {
    if (!rule.path) continue;
    const end = rule.path.endsWith('$'), literal = end ? rule.path.slice(0, -1) : rule.path;
    const regex = '^' + literal.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (end ? '$' : '');
    if (!new RegExp(regex).test(pathname)) continue;
    const length = Buffer.byteLength(literal.replace(/\*/g, ''));
    if (!winner || length > winner.length || (length === winner.length && rule.allow)) winner = { ...rule, length };
  }
  return { allowed: !winner || winner.allow, rule: winner ? `${winner.allow ? 'Allow' : 'Disallow'}: ${winner.path}` : 'no matching restriction' };
}

export async function liveSearchChecks(target, fetchOptions = {}) {
  const original = new URL(target), page = await fetchText(original, fetchOptions);
  const parsed = page.ok ? new URL(page.url) : original;
  const [robots, sitemap] = await Promise.all([fetchText(new URL('/robots.txt', parsed), fetchOptions), fetchText(new URL('/sitemap.xml', parsed), fetchOptions)]);
  const messages = []; let failed = !page.ok;
  if (page.ok && parsed.href !== original.href) messages.push(`Page redirects from ${original.href} to ${parsed.href}; crawl checks use the final address.`);
  if (!page.ok) messages.push(`Page check failed: ${page.error || `HTTP ${page.status}`}.`);
  else {
    messages.push(searchBasics(page.text, 'live index.html'));
    const directive = page.headers.get('x-robots-tag') || '';
    if (/\b(noindex|none)\b/i.test(directive)) { messages.push(`X-Robots-Tag prevents indexing: ${directive}.`); failed = true; }
    if (basicsNoindex(page.text)) failed = true;
  }
  if (robots.ok) {
    if (/^\s*(?:<!doctype\s+html|<html)/i.test(robots.text)) { messages.push('Googlebot crawl check could not be verified: robots.txt returned HTML.'); failed = true; }
    else { const result = googlebotAllowed(robots.text, parsed.pathname + parsed.search); messages.push(`Googlebot crawl check for ${parsed.pathname}: ${result.allowed ? 'allowed' : 'BLOCKED'} by robots.txt (${result.rule}).`); if (!result.allowed) failed = true; }
  } else if (robots.status === 404 || robots.status === 410) messages.push(`Googlebot crawl check: robots.txt is absent (HTTP ${robots.status}); no robots.txt restriction was found.`);
  else { messages.push(`Googlebot crawl check could not be verified: ${robots.error || `robots.txt returned HTTP ${robots.status}`}.`); failed = true; }
  if (!sitemap.ok) { messages.push(`Sitemap check failed: ${sitemap.error || `HTTP ${sitemap.status}`}.`); failed = true; }
  else if (!/<(?:urlset|sitemapindex)\b/i.test(sitemap.text)) { messages.push('Sitemap check failed: sitemap.xml did not return a sitemap document.'); failed = true; }
  else messages.push('Sitemap document responds successfully.');
  messages.push('These checks report observed crawl restrictions and search basics. They do not guarantee Google indexing.');
  return { messages, failed };
}

function basicsNoindex(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0])).some(m => /^(robots|googlebot)$/i.test(m.name || '') && /(?:^|[\s,])(noindex|none)(?:$|[\s,])/i.test(m.content || ''));
}

export async function runLighthouse(cli, url, output, mode, { timeoutMs = 300000 } = {}) {
  const argv = [cli, url, '--quiet', '--output=json', '--output=html', `--output-path=${output}`, '--only-categories=performance,accessibility,best-practices,seo', `--chrome-flags=--headless=new${process.getuid?.() === 0 ? ' --no-sandbox' : ''}`];
  if (mode === 'desktop') argv.push('--preset=desktop');
  return new Promise(resolve => {
    const child = spawn(process.execPath, argv, { env: process.env });
    let stderr = '', settled = false, expired = false;
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); clearTimeout(force); resolve(result); };
    child.stdout.resume(); child.stderr.on('data', data => { stderr = (stderr + data).slice(-8000); });
    let force;
    const timer = setTimeout(() => { expired = true; child.kill(); force = setTimeout(() => child.kill('SIGKILL'), 2000); }, timeoutMs);
    child.on('error', error => finish({ status: null, stderr: error.message }));
    child.on('close', status => finish({ status, stderr: expired ? `Lighthouse timed out after ${timeoutMs} ms. ${stderr}` : stderr }));
  });
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const args = [...argv], take = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const value = args[i + 1]; args.splice(i, 2); return value; };
  const seo = take('--seo', '');
  const onlyAt = args.indexOf('--seo-only'), seoOnly = onlyAt >= 0; if (seoOnly) args.splice(onlyAt, 1);
  const [target = 'site', reviewDir = 'review'] = args;
  if (args.length > 2 || args.some(arg => arg.startsWith('--'))) throw new Error('Usage: node report.mjs <URL or site> [reviewDir] [--seo URL] [--seo-only]');
  const isUrl = /^https?:\/\//i.test(target), site = isUrl ? null : path.resolve(target);
  if (seo && isUrl) throw new Error('--seo writes local files; use it with a site folder.');
  fs.mkdirSync(reviewDir, { recursive: true });
  if (seo && site) console.log(writeSEO(site, seo));
  const basics = [], scores = {}, failures = [];
  if (site) {
    for (const rel of htmlPages(site)) basics.push(searchBasics(fs.readFileSync(path.join(site, rel), 'utf8'), rel));
    if (!fs.existsSync(path.join(site, 'sitemap.xml'))) basics.push('No sitemap.xml yet. Use --seo https://yourdomain.com once the address is known.');
  } else {
    const checks = await liveSearchChecks(target, options.fetchOptions); basics.push(...checks.messages);
    if (checks.failed) failures.push('A live search check failed or found a crawl/indexing restriction; see Search basics.');
  }
  let server = null, url = target;
  try {
    if (!seoOnly) {
      const cli = options.lighthouseCli || path.join(here, 'node_modules', 'lighthouse', 'cli', 'index.js');
      if (!fs.existsSync(cli)) {
        if (options.install === false) throw new Error('Lighthouse is unavailable.');
        console.log('Installing Lighthouse in this tools folder (a minute or two)...');
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const result = spawnSync(npm, ['install', '--no-save', '--ignore-scripts', 'lighthouse@13'], { cwd: here, stdio: 'inherit', shell: process.platform === 'win32', timeout: 180000 });
        if (result.error || result.status !== 0 || !fs.existsSync(cli)) throw new Error('Could not install Lighthouse. Search checks were saved; use --seo-only to run without it.');
      }
      if (site) { server = await startStaticServer(site); url = `http://127.0.0.1:${server.address().port}/`; options.onServer?.(server); }
      console.log('Running Lighthouse (phone, then desktop).');
      for (const mode of ['mobile', 'desktop']) {
        const output = path.resolve(reviewDir, `lighthouse-${mode}`);
        // An unsuccessful run must never inherit a previous run's scores.
        for (const extension of ['json', 'html']) fs.rmSync(`${output}.report.${extension}`, { force: true });
        const result = await (options.lighthouseRunner || runLighthouse)(cli, url, output, mode);
        const json = `${output}.report.json`;
        if (result.status !== 0 || !fs.existsSync(json)) { failures.push(`Lighthouse (${mode}) did not finish: ${(result.stderr || 'No report was produced.').slice(-800)}`); continue; }
        try {
          const report = JSON.parse(fs.readFileSync(json, 'utf8'));
          if (!report.categories || report.runtimeError) throw new Error(report.runtimeError?.message || 'Missing score categories.');
          scores[mode] = { cats: Object.fromEntries(Object.entries(report.categories).map(([key, value]) => [key, typeof value.score === 'number' ? Math.round(value.score * 100) : null])), lcp: report.audits?.['largest-contentful-paint']?.displayValue, cls: report.audits?.['cumulative-layout-shift']?.displayValue, fixes: Object.values(report.audits || {}).filter(a => a.score !== null && ((a.scoreDisplayMode === 'binary' && a.score < 1) || (a.scoreDisplayMode === 'numeric' && a.score < 0.5))).map(a => a.title).slice(0, 8) };
        } catch (error) { failures.push(`Lighthouse (${mode}) returned an invalid report: ${error.message}`); }
      }
    }
  } catch (error) { failures.push(error.message); }
  finally { await closeServer(server); }
  const report = { target, seoOnly, scores, basics, failures };
  fs.writeFileSync(path.join(reviewDir, 'launch-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`\n${seoOnly ? 'Search checks' : 'Launch report'}${isUrl ? ` for ${target}` : ' (local preview; use the live address for final results)'}`);
  const names = { performance: 'Speed', accessibility: 'Accessibility', 'best-practices': 'Best practices', seo: 'SEO' };
  for (const [mode, score] of Object.entries(scores)) {
    console.log(`${mode === 'mobile' ? 'Phone' : 'Desktop'}: ${Object.entries(score.cats).map(([key, value]) => `${names[key] || key} ${value ?? 'unavailable'}`).join(' · ')}`);
    if (score.fixes.length) console.log('To improve: ' + score.fixes.join('; '));
    console.log(`Full report: ${path.resolve(reviewDir, `lighthouse-${mode}.report.html`)}`);
  }
  if (basics.length) console.log('\nSearch basics:\n- ' + basics.join('\n- '));
  for (const failure of failures) console.error(failure);
  console.log(`Saved: ${path.resolve(reviewDir, 'launch-report.json')}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(report => { if (report.failures.length) process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
