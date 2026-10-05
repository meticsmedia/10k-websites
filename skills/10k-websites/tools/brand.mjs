#!/usr/bin/env node
// brand.mjs: the brand kit every $10K site ships with. Favicons, app icons, the social share picture and the web manifest.
// Usage: node brand.mjs site --name "Your Business" --tagline "One line about what you do"
//          --bg "#f4efe6" --ink "#241d16" --accent "#b5652e" [--logo site/assets/logo.svg] [--image site/assets/hero-poster.webp]
//          [--font path/to/Display.ttf]   (the brand's display font file, .ttf or .otf, for the share picture)
// With no --logo, it draws a monogram from the first letter. Writes into the site folder and prints the <head> tags.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const name = flag('--name', 'My brand'), tagline = flag('--tagline', '');
const bg = flag('--bg', '#f4efe6'), ink = flag('--ink', '#1d1b18'), accent = flag('--accent', ink);
const logo = flag('--logo', ''), image = flag('--image', ''), font = flag('--font', '');
const [site = 'site'] = args;
if (!fs.existsSync(path.join(site, 'index.html'))) { console.error(`No index.html in ${site}`); process.exit(1); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 1. the mark: the owner's logo, or a monogram in the brand colours
let markSvg;
if (logo && fs.existsSync(logo)) {
  markSvg = fs.readFileSync(logo, 'utf8');
} else {
  const letter = esc([...name.trim()][0] || 'K');
  markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="44" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="${accent}">${letter}</text></svg>`;
}
fs.writeFileSync(path.join(site, 'favicon.svg'), markSvg);
const markBuf = Buffer.from(markSvg);
const icon = async (size, file, pad = 0.14) => {
  const inner = Math.round(size * (1 - pad * 2));
  const m = await sharp(markBuf, { density: 384 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: m, gravity: 'center' }]).png().toFile(path.join(site, file));
};
await icon(180, 'apple-touch-icon.png');
await icon(192, 'icon-192.png');
await icon(512, 'icon-512.png', 0.2);
await sharp(markBuf, { density: 384 }).resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(site, 'favicon-48.png'));

// 2. the social share picture (1200 x 630): the hero, a soft shade, the name, the line
const W = 1200, H = 630;
let base = sharp({ create: { width: W, height: H, channels: 3, background: bg } });
const layers = [];
if (image && fs.existsSync(image)) layers.push({ input: await sharp(image).resize(W, H, { fit: 'cover' }).toBuffer() });
const dark = image ? true : false;
const textFill = dark ? '#ffffff' : ink;
layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${dark ? 0.62 : 0}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/></svg>`) });
const titleSize = name.length > 22 ? 64 : 84;
const titleY = H - (tagline ? 132 : 84);
if (font && fs.existsSync(font)) {
  // the brand's own display face, rendered from its font file
  const t = await sharp({ text: { text: `<span foreground="${textFill}">${esc(name)}</span>`, fontfile: path.resolve(font), font: `${path.basename(font).replace(/\.[ot]tf$/i, '').replace(/[-_]/g, ' ')} ${Math.round(titleSize * 0.75)}`, rgba: true, dpi: 96 } }).png().toBuffer();
  const m = await sharp(t).metadata();
  layers.push({ input: t, left: 72, top: Math.max(0, titleY - m.height + 12) });
}
const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${font ? '' : `<text x="72" y="${titleY}" font-family="Georgia, serif" font-size="${titleSize}" fill="${textFill}">${esc(name)}</text>`}
  ${tagline ? `<text x="74" y="${H - 72}" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="${textFill}" fill-opacity="0.88">${esc(tagline)}</text>` : ''}
</svg>`;
layers.push({ input: Buffer.from(textSvg) });
const markSmall = await sharp(markBuf, { density: 384 }).resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
layers.push({ input: markSmall, left: W - 72 - 64, top: 56 });
await base.composite(layers).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(site, 'og.jpg'));

// 3. the web manifest, so a phone can add the site to its home screen with the right name and icon
fs.writeFileSync(path.join(site, 'site.webmanifest'), JSON.stringify({ name, short_name: name.length > 12 ? name.split(' ')[0] : name, icons: [
  { src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
  theme_color: bg, background_color: bg, display: 'browser' }, null, 2));

console.log('Brand kit written: favicon.svg, favicon-48.png, apple-touch-icon.png, icon-192.png, icon-512.png, og.jpg, site.webmanifest');
console.log(`Look at ${site}/og.jpg: it is the picture people see when the link is shared.\n\nPaste into every page's <head>:`);
console.log(`<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${bg}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(tagline)}">
<meta property="og:image" content="/og.jpg"><!-- DEPLOY STEP: make this the full https:// address -->
<meta property="og:url" content="/"><!-- DEPLOY STEP: the live address -->
<meta name="twitter:card" content="summary_large_image">`);
