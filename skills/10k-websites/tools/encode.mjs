#!/usr/bin/env node
// encode.mjs: prepare a generated film so it scrubs smoothly under the scroll wheel.
// Usage: node encode.mjs <film.mp4> [outDir] [--name hero] [--mobile] [--focus 0.5] [--crf 23] [--max-mb 12]
//   --mobile     also make a 9:16 phone version (720x1280) cropped around --focus
//   --focus      horizontal centre of the phone crop, 0 = left edge, 1 = right edge
//   --crf        starting quality (lower is sharper and bigger); the tool raises it if the file is too big
//   --max-mb     size target for the desktop file (default 12, or 14 for films longer than 8 seconds)
// Long films (10 to 15 seconds, the story journey) are sized automatically: the tool keeps the source
// frame rate (24 for most AI video), then raises the compression step by step until the file fits.
// Writes <name>.mp4, <name>-m.mp4 (optional), <name>-poster.webp, and prints the HTML attributes.
// Needs ffmpeg on PATH, or set FFMPEG=/path/to/ffmpeg.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Decode the actual last frame, then encode the still separately. Poster repair never needs
// another movie encode. cwebp and sharp cover FFmpeg distributions without libwebp.
export async function writePoster(input, output, { at = 'last', ffmpeg = process.env.FFMPEG || 'ffmpeg', cwebp = process.env.CWEBP || 'cwebp', webpEncoder = 'libwebp', sharpLoader = () => import('sharp') } = {}) {
  if (at !== 'last' && (!Number.isFinite(Number(at)) || Number(at) < 0)) throw new Error('--poster must be last or a nonnegative time in seconds.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '10k-poster-'));
  const png = path.join(temp, 'frame.png');
  const invoke = (bin, argv) => spawnSync(bin, argv, { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  try {
    const seek = at === 'last' ? ['-sseof', '-1'] : ['-ss', String(Number(at))];
    const frames = at === 'last' ? ['-fps_mode', 'passthrough', '-update', '1'] : ['-frames:v', '1'];
    const decoded = invoke(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...seek, '-i', input, '-an', ...frames, png]);
    if (decoded.error || decoded.status !== 0 || !fs.existsSync(png)) throw new Error(`Poster frame could not be decoded${decoded.error ? ` (${decoded.error.message})` : ''}: ${(decoded.stderr || '').slice(-800) || 'requested time is outside the film'}`);
    const encoded = invoke(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-frames:v', '1', '-c:v', webpEncoder, '-quality', '82', output]);
    if (!encoded.error && encoded.status === 0 && fs.existsSync(output) && fs.statSync(output).size) return 'ffmpeg';
    const webp = invoke(cwebp, ['-quiet', '-q', '82', png, '-o', output]);
    if (!webp.error && webp.status === 0 && fs.existsSync(output) && fs.statSync(output).size) return 'cwebp';
    try {
      const mod = await sharpLoader();
      await (mod.default || mod)(png).webp({ quality: 82 }).toFile(output);
      return 'sharp';
    } catch (error) { throw new Error(`Poster decoded, but no WebP encoder succeeded. Install the local tools dependencies (sharp), or make cwebp/libwebp available. ${error.message}`); }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

export async function main(args = process.argv.slice(2)) {
args = [...args];
const has = n => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const flag = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const mobile = has('--mobile');
const posterOnly = has('--poster-only');
const posterAt = flag('--poster', 'last');
const name = flag('--name', 'hero');
const focus = Math.min(1, Math.max(0, Number(flag('--focus', 0.5))));
const crfArg = flag('--crf', null);
const maxArg = flag('--max-mb', null);
const [input, outDir = 'assets'] = args;
if (!input || !fs.existsSync(input) || args.length > 2 || !/^[A-Za-z0-9_-]+$/.test(name) || !Number.isFinite(focus)) throw new Error('Usage: node encode.mjs <film.mp4> [outDir] [--name hero] [--mobile] [--focus 0.5] [--poster last|seconds] [--poster-only]');
if (posterAt !== 'last' && (!Number.isFinite(Number(posterAt)) || Number(posterAt) < 0)) throw new Error('--poster must be last or a nonnegative time in seconds.');
if ((maxArg !== null && !(Number(maxArg) > 0)) || (crfArg !== null && (!Number.isFinite(Number(crfArg)) || Number(crfArg) < 0 || Number(crfArg) > 51))) throw new Error('Use a positive --max-mb and --crf from 0 to 51.');
fs.mkdirSync(outDir, { recursive: true });
const FF = process.env.FFMPEG || 'ffmpeg';

function run(list) { return spawnSync(FF, ['-hide_banner', ...list], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
function ff(list, label) {
  const r = run(['-loglevel', 'error', '-y', ...list]);
  if (r.error) throw new Error(`Could not run ffmpeg (${r.error.code}). Install it, or set FFMPEG to its path.`);
  if (r.status !== 0) throw new Error(`${label} failed:\n${r.stderr}`);
}

// Probe the length and frame rate from ffmpeg's own header (no ffprobe needed).
const probe = run(['-i', input]);
if (probe.error) throw new Error(`Could not run ffmpeg (${probe.error.code}). Install it, or set FFMPEG to its path.`);
const info = probe.stderr || '';
const dm = info.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
const duration = dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]) : 5;
const fm = info.match(/Video:.*?([\d.]+)\s*fps/);
const srcFps = fm ? parseFloat(fm[1]) : 30;
// Keep the source frame rate up to 30. Raising 24 to 30 only adds duplicate frames and bytes.
const fps = String(Math.min(30, Math.max(12, Math.round(srcFps))));
const long = duration > 8;
const target = (maxArg ? Number(maxArg) : (long ? 14 : 12)) * 1e6;
const phoneTarget = target / 2;
const startCrf = crfArg ? Number(crfArg) : (long ? 24 : 23);

// Short keyframe spacing, no B-frames, audio removed, index at the front: every seek lands fast.
const scrub = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', fps,
  '-g', '6', '-keyint_min', '6', '-sc_threshold', '0', '-bf', '0', '-movflags', '+faststart'];
const size = f => fs.statSync(f).size;
const mb = f => (size(f) / 1e6).toFixed(1) + ' MB';

// Encode, then step the compression up until the file fits its target (at most 3 extra passes).
function fit(file, vfFor, crf0, limit, maxCrf, label) {
  let crf = crf0, width = 1920, tries = 0;
  for (;;) {
    ff(['-i', input, '-vf', vfFor(width), ...scrub, '-crf', String(crf), file], label);
    const s = size(file);
    if (s <= limit || tries >= 3 || (crf >= maxCrf && width <= 1600)) return { crf, width, fits: s <= limit };
    tries++;
    const step = Math.max(2, Math.ceil(6 * Math.log2(s / limit)));
    if (crf + step > maxCrf && width > 1600) { width = 1600; crf = Math.min(maxCrf, crf + Math.max(1, step - 3)); }
    else crf = Math.min(maxCrf, crf + step);
  }
}

const desk = posterOnly ? input : path.join(outDir, `${name}.mp4`);
const aliasesInput = file => {
  if (path.resolve(file) === path.resolve(input)) return true;
  if (!fs.existsSync(file)) return false;
  if (fs.realpathSync(file) === fs.realpathSync(input)) return true;
  const a = fs.statSync(file), b = fs.statSync(input);
  return a.ino !== 0 && a.ino === b.ino && a.dev === b.dev;
};
if (!posterOnly && aliasesInput(desk)) throw new Error('Input and output movies are the same file. Use --poster-only to repair its poster, or a different output directory/name.');
if (!posterOnly && mobile && aliasesInput(path.join(outDir, `${name}-m.mp4`))) throw new Error('Input and phone output movies are the same file. Choose a different output directory/name.');
const d = posterOnly ? null : fit(desk, w => `scale='min(${w},iw)':-2:flags=lanczos`, startCrf, target, 30, 'Desktop encode');

let phone = null, p = null;
if (mobile) {
  phone = path.join(outDir, `${name}-m.mp4`);
  const crop = () => `crop=ih*9/16:ih:(iw-ih*9/16)*${focus}:0,scale=720:1280:flags=lanczos`;
  if (posterOnly && !fs.existsSync(phone)) throw new Error(`Existing phone movie not found: ${phone}`);
  if (!posterOnly) p = fit(phone, crop, startCrf + 3, phoneTarget, 32, 'Phone encode');
}

const poster = path.join(outDir, `${name}-poster.webp`);
const mposter = path.join(outDir, `${name}-m-poster.webp`);
const posterEncoder = await writePoster(desk, poster, { at: posterAt });
if (phone) await writePoster(phone, mposter, { at: posterAt });

console.log(`Film: ${duration.toFixed(1)} s at ${fps} fps`);
console.log(`Desktop clip: ${desk} (${mb(desk)}${d ? `, ${d.width}px wide, crf ${d.crf}` : ', unchanged'})`);
if (phone) console.log(`Phone clip:   ${phone} (${mb(phone)}${p ? `, crf ${p.crf}` : ', unchanged'})`);
console.log(`Poster:       ${poster} (${posterAt === 'last' ? 'last decoded frame' : `${posterAt} s`}, ${posterEncoder})`);
if (d && !d.fits) console.log(`Warning: still over ${(target / 1e6).toFixed(0)} MB at the strongest safe compression. Review delivery resolution and compression against visual quality; preserve the approved action and story. Change the film itself only with the user's agreement.`);
// paths as the page sees them: relative to the site folder when writing into site/assets
const rel = f => path.basename(path.resolve(outDir)) === 'assets' ? path.relative(path.dirname(path.resolve(outDir)), path.resolve(f)).split(path.sep).join('/') : f.split(path.sep).join('/');
console.log('\nPaste into the hero:');
console.log(`<video data-k-scrub data-src="${rel(desk)}"${phone ? ` data-src-mobile="${rel(phone)}"` : ''} data-poster="${rel(poster)}"${phone ? ` data-poster-mobile="${rel(mposter)}"` : ''} data-bytes="${size(desk)}" muted playsinline></video>`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
