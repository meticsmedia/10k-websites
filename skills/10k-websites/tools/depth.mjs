#!/usr/bin/env node
// depth.mjs: make a depth map for the layered-depth hero. Runs locally and free.
// Usage: node depth.mjs <image> [outDir] [--name hero] [--mobile] [--focus 0.5] [--blur 2]
// Writes <name>.webp (the picture, max 2400 px wide), <name>-depth.png (white = near,
// black = far), and with --mobile a 9:16 phone crop of both around --focus (0 left .. 1 right).
// Prints the <canvas> tag to paste into the hero.
// Model: Depth Anything V2 Small (Apache-2.0), downloaded once (~27 MB) and cached.
import { pipeline, env } from '@huggingface/transformers';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const has = n => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const blur = Number(flag('--blur', 2));
const name = flag('--name', 'hero');
const focus = Math.min(1, Math.max(0, Number(flag('--focus', 0.5))));
const mobile = has('--mobile');
const [input, outDir = 'assets'] = args;
if (!input || !fs.existsSync(input)) {
  console.error('Usage: node depth.mjs <image> [outDir] [--name hero] [--mobile] [--focus 0.5]');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const P = f => path.join(outDir, f);
// paths as the page sees them: relative to the site folder when writing into site/assets
const W_ = path.basename(path.resolve(outDir)) === 'assets' ? 'assets' : outDir.split(path.sep).join('/');
env.cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.models');

const t0 = Date.now();
console.log('Loading depth model (first run downloads it)...');
const estimate = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'q8' });

// feed a copy no wider than 1024 px; the model works at ~518 px internally anyway
const src = sharp(input).rotate();
const meta = await src.clone().metadata();
const W = Math.min(meta.width, 2400), H = Math.round(W * meta.height / meta.width);
await src.clone().resize(W, H).webp({ quality: 84 }).toFile(P(`${name}.webp`));
const tmp = P('.depth-input.png');
await src.clone().resize({ width: Math.min(meta.width, 1024) }).png().toFile(tmp);
const { depth } = await estimate(tmp);
fs.unlinkSync(tmp);

// the model returns one channel at the input size, near = bright; store at half the picture size
const dw = Math.min(1024, W), dh = Math.round(dw * H / W);
let map = sharp(Buffer.from(depth.data), { raw: { width: depth.width, height: depth.height, channels: 1 } })
  .resize(dw, dh, { fit: 'fill' }).normalise();
if (blur > 0) map = map.blur(blur); // soft edges stop the picture tearing around near objects
const mapBuf = await map.png().toBuffer();
await sharp(mapBuf).png({ compressionLevel: 9 }).toFile(P(`${name}-depth.png`));

let extra = '';
if (mobile) {
  // 9:16 crop from the same spot in both files so they stay aligned
  const crop = async (buf, w, h, outW, file, fmt) => {
    const cw = Math.min(w, Math.round(h * 9 / 16));
    const left = Math.round((w - cw) * focus);
    let s2 = sharp(buf).extract({ left, top: 0, width: cw, height: h }).resize(outW, Math.round(outW * 16 / 9));
    s2 = fmt === 'webp' ? s2.webp({ quality: 82 }) : s2.png({ compressionLevel: 9 });
    await s2.toFile(P(file));
  };
  const picBuf = await sharp(P(`${name}.webp`)).toBuffer();
  await crop(picBuf, W, H, Math.min(1080, Math.round(H * 9 / 16)), `${name}-m.webp`, 'webp');
  await crop(mapBuf, dw, dh, Math.min(540, Math.round(dh * 9 / 16)), `${name}-m-depth.png`, 'png');
  extra = ` data-image-mobile="${W_}/${name}-m.webp" data-depth-mobile="${W_}/${name}-m-depth.png"`;
}
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s. Files are in ${outDir}/`);
console.log('\nPaste into the hero:');
console.log(`<canvas data-k-depth data-image="${W_}/${name}.webp" data-depth="${W_}/${name}-depth.png"${extra}></canvas>`);
