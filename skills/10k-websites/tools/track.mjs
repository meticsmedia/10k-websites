#!/usr/bin/env node
// track.mjs: measure how a surface in the hero film moves, frame by frame, so words can be
// fixed onto it (a wall, a sign, a table top, the ground, a product face). No dependencies
// beyond FFmpeg (and sharp for proof sheets).
//
// Track the film the page actually plays (site/assets/hero.mp4, not the raw master):
// the frame numbers must match what the visitor sees.
//
//   node track.mjs surface <film.mp4> --name wall --ref 240 --region x,y,w,h [--mask x,y,w,h ...]
//        [--model similarity|scale|translate|affine|perspective] [--from N] [--to N] [--out site/filmtrack.js]
//        [--variant wide|phone] [--smooth 4] [--work 640] [--floor 0.5]
//      Pick the reference frame where the surface is largest and clearest. Region and masks are
//      film pixels on that frame. Mask anything in the region that moves on its own (people,
//      flames, water, screens, reflections, trees in a window). Tracking runs from the reference
//      frame in both directions until the surface leaves the picture or can no longer be seen.
//   node track.mjs crop <wide.mp4> <phone.mp4> [--out site/filmtrack.js]
//      Finds where a phone clip made by encode.mjs --mobile sits inside the wide clip, so wide
//      tracks also drive the phone layout. Says so when the phone clip is not a crop.
//   node track.mjs proof <film.mp4> --name wall [--track site/filmtrack.js] [--out review/track-wall.jpg]
//      Draws the tracked region as a grid on 12 frames across its range. Inspect it: the grid
//      must stay glued to the surface in every tile.
//   node track.mjs list [--track site/filmtrack.js]
//
// Output: site/filmtrack.js (window.FILMTRACK), read by engine/filmtype.js. Matrices are CSS
// matrix(a,b,c,d,e,f) values that carry a point on the reference frame to the same point on
// frame k, in film pixels of the tracked clip.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FF = process.env.FFMPEG || 'ffmpeg';

/* ---------------- decoding ---------------- */
export function probe(film) {
  const r = spawnSync(FF, ['-hide_banner', '-i', film], { encoding: 'utf8' });
  const s = r.stderr || '';
  const v = s.match(/Video:.*?(\d{2,5})x(\d{2,5})/), f = s.match(/Video:.*?([\d.]+)\s*fps/), d = s.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!v) throw new Error(`Cannot read a video stream from ${film}${r.error ? ': ' + r.error.message : ''}`);
  return { width: +v[1], height: +v[2], fps: f ? +f[1] : 30, duration: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0 };
}
// every decoded frame as 8-bit grey at work width (exact frame order, no rate conversion)
export function decode(film, workW) {
  const info = probe(film);
  const w = Math.max(32, Math.round(workW / 2) * 2), h = Math.max(2, Math.round(info.height * w / info.width / 2) * 2);
  const est = Math.ceil((info.duration * info.fps + 8) * w * h * 1.3) + (64 << 20);
  const r = spawnSync(FF, ['-v', 'error', '-i', film, '-fps_mode', 'passthrough', '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: est });
  if (r.status !== 0) throw new Error(`FFmpeg could not decode ${film}: ${(r.stderr || '').toString().slice(-400)}`);
  const n = Math.floor(r.stdout.length / (w * h));
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(new Uint8Array(r.stdout.buffer, r.stdout.byteOffset + i * w * h, w * h));
  return { ...info, w, h, k: w / info.width, frames, n };
}
// frames that repeat the one before (frame-rate padding): they must hold, not move
export function duplicates(frames, w, h) {
  const dup = new Uint8Array(frames.length), diff = new Array(frames.length).fill(null), step = Math.max(1, Math.floor(Math.sqrt(w * h / 4000)));
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i], b = frames[i - 1]; let s = 0, c = 0;
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { s += Math.abs(a[y * w + x] - b[y * w + x]); c++; }
    diff[i] = s / c;
  }
  // a repeat is a frame far stiller than its neighbours (relative, so slow films still count)
  for (let i = 1; i < frames.length; i++) {
    const near = [diff[i - 1], diff[i + 1], diff[i - 2], diff[i + 2]].filter(v => v != null && v > 0);
    const typical = near.length ? near.sort((a, b) => a - b)[near.length >> 1] : 1;
    dup[i] = diff[i] < 0.35 || diff[i] < typical * 0.12 ? 1 : 0;
  }
  return dup;
}

/* ---------------- image pyramid + Lucas-Kanade ---------------- */
function toFloat(g, w, h) { const f = new Float32Array(w * h); for (let i = 0; i < f.length; i++) f[i] = g[i]; return { d: f, w, h }; }
function half(im) {
  const w = im.w >> 1, h = im.h >> 1, d = new Float32Array(w * h), s = im.d, W = im.w;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = 2 * y * W + 2 * x; d[y * w + x] = (s[i] + s[i + 1] + s[i + W] + s[i + W + 1]) * 0.25; }
  return { d, w, h };
}
function blur(im) { // 1-2-1 separable, keeps LK well behaved on compressed video
  const { w, h } = im, s = im.d, t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, l = x ? s[i - 1] : s[i], r = x < w - 1 ? s[i + 1] : s[i]; t[i] = (l + 2 * s[i] + r) * 0.25; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, u = y ? t[i - w] : t[i], d = y < h - 1 ? t[i + w] : t[i]; o[i] = (u + 2 * t[i] + d) * 0.25; }
  return { d: o, w, h };
}
const LEVELS = 4;
function pyramid(g, w, h) { const p = [blur(toFloat(g, w, h))]; for (let l = 1; l < LEVELS; l++) p.push(half(p[l - 1])); return p; }
function sample(im, x, y) {
  const { w, h, d } = im;
  if (x < 0) x = 0; if (y < 0) y = 0; if (x > w - 1.001) x = w - 1.001; if (y > h - 1.001) y = h - 1.001;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + w] * (1 - fx) + d[i + w + 1] * fx) * fy;
}
const R = 7; // 15x15 window
// track one point from pyramid A (at p) to pyramid B, starting from guess g. Returns [x,y] or null.
function lk(A, B, px, py, gx, gy) {
  let dx = (gx - px) / (1 << (LEVELS - 1)), dy = (gy - py) / (1 << (LEVELS - 1));
  for (let l = LEVELS - 1; l >= 0; l--) {
    const a = A[l], b = B[l], s = 1 / (1 << l), cx = px * s, cy = py * s;
    if (cx < R + 1 || cy < R + 1 || cx > a.w - R - 2 || cy > a.h - R - 2) { if (l === 0) return null; dx *= 2; dy *= 2; continue; }
    let gxx = 0, gxy = 0, gyy = 0; const T = [], GX = [], GY = [];
    for (let v = -R; v <= R; v++) for (let u = -R; u <= R; u++) {
      const x = cx + u, y = cy + v, ix = (sample(a, x + 1, y) - sample(a, x - 1, y)) * 0.5, iy = (sample(a, x, y + 1) - sample(a, x, y - 1)) * 0.5;
      T.push(sample(a, x, y)); GX.push(ix); GY.push(iy); gxx += ix * ix; gxy += ix * iy; gyy += iy * iy;
    }
    const det = gxx * gyy - gxy * gxy;
    if (det < 1e-3) return null;
    for (let it = 0; it < 20; it++) {
      let bx = 0, by = 0, k = 0;
      for (let v = -R; v <= R; v++) for (let u = -R; u <= R; u++, k++) { const e = T[k] - sample(b, cx + u + dx, cy + v + dy); bx += e * GX[k]; by += e * GY[k]; }
      const ux = (gyy * bx - gxy * by) / det, uy = (gxx * by - gxy * bx) / det;
      dx += ux; dy += uy;
      if (ux * ux + uy * uy < 1e-4) break;
    }
    if (l > 0) { dx *= 2; dy *= 2; }
  }
  return [px + dx, py + dy];
}
// corner strength (min eigenvalue) on a grid of candidate points inside a predicate
function corners(g, w, h, inside, maxPts) {
  const cand = [], r = 3;
  for (let y = r + R + 2; y < h - r - R - 2; y += 2) for (let x = r + R + 2; x < w - r - R - 2; x += 2) {
    if (!inside(x, y)) continue;
    let a = 0, b = 0, c = 0;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const i = (y + v) * w + x + u, ix = (g[i + 1] - g[i - 1]) * 0.5, iy = (g[i + w] - g[i - w]) * 0.5; a += ix * ix; b += ix * iy; c += iy * iy;
    }
    const e = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b);
    if (e > 0) cand.push([e, x, y]);
  }
  if (!cand.length) return [];
  cand.sort((p, q) => q[0] - p[0]);
  const floor = cand[0][0] * 0.02, cell = Math.max(5, Math.sqrt(cand.length * 4 / maxPts)), taken = new Set(), out = [];
  for (const [e, x, y] of cand) {
    if (e < floor) break;
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    if (taken.has(key)) continue;
    taken.add(key); out.push([x, y]);
    if (out.length >= maxPts) break;
  }
  return out;
}

/* ---------------- motion models ---------------- */
// A surface's motion is a plane-to-plane map m = [a,b,c,d,e,f,g,h]:
//   x' = (a x + c y + e) / (g x + h y + 1),  y' = (b x + d y + f) / (g x + h y + 1)
// translate/scale/similarity/affine keep g = h = 0 (CSS matrix); perspective uses them (CSS matrix3d).
export const ID = [1, 0, 0, 1, 0, 0, 0, 0];
export const apply = (m, x, y) => { const w = m[6] * x + m[7] * y + 1; return [(m[0] * x + m[2] * y + m[4]) / w, (m[1] * x + m[3] * y + m[5]) / w]; };
const H = m => [[m[0], m[2], m[4]], [m[1], m[3], m[5]], [m[6], m[7], 1]];
const unH = A => { const s = A[2][2]; return [A[0][0] / s, A[1][0] / s, A[0][1] / s, A[1][1] / s, A[0][2] / s, A[1][2] / s, A[2][0] / s, A[2][1] / s]; };
const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export function invert(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = H(m);
  const A = [[e * i - f * h, c * h - b * i, b * f - c * e], [f * g - d * i, a * i - c * g, c * d - a * f], [d * h - e * g, b * g - a * h, a * e - b * d]];
  return unH(A);
}
export const compose = (m, n) => unH(mul(H(m), H(n))); // m after n
const MIN = { translate: 1, scale: 2, similarity: 2, affine: 3, perspective: 4 };
export const MODELS = Object.keys(MIN);
function solve(A, b) { // tiny least squares via normal equations
  const n = A[0].length, M = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (let r = 0; r < A.length; r++) for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] += A[r][i] * A[r][j]; M[i][n] += A[r][i] * b[r]; }
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) return null;
    for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}
function norm(pts) { // Hartley normalisation keeps the perspective fit well conditioned
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  const d = pts.reduce((s, p) => s + Math.hypot(p[0] - mx, p[1] - my), 0) / n || 1, k = Math.SQRT2 / d;
  return { k, mx, my, T: [[k, 0, -k * mx], [0, k, -k * my], [0, 0, 1]], p: pts.map(([x, y]) => [(x - mx) * k, (y - my) * k]) };
}
export function fit(model, Q, P, wts) {
  const A = [], b = [], W = i => (wts ? Math.sqrt(wts[i]) : 1);
  if (model === 'perspective') {
    const nq = norm(Q), np = norm(P);
    for (let i = 0; i < Q.length; i++) {
      const [x, y] = nq.p[i], [u, v] = np.p[i], w = W(i);
      A.push([w * x, 0, w * y, 0, w, 0, -w * x * u, -w * y * u], [0, w * x, 0, w * y, 0, w, -w * x * v, -w * y * v]); b.push(w * u, w * v);
    }
    const s = solve(A, b); if (!s) return null;
    const Tpi = [[1 / np.k, 0, np.mx], [0, 1 / np.k, np.my], [0, 0, 1]];
    return unH(mul(mul(Tpi, H(s)), nq.T));
  }
  for (let i = 0; i < Q.length; i++) {
    const [x, y] = Q[i], [u, v] = P[i], w = W(i);
    if (model === 'translate') { A.push([w, 0], [0, w]); b.push(w * (u - x), w * (v - y)); }
    else if (model === 'scale') { A.push([w * x, w, 0], [w * y, 0, w]); b.push(w * u, w * v); }
    else if (model === 'similarity') { A.push([w * x, -w * y, w, 0], [w * y, w * x, 0, w]); b.push(w * u, w * v); }
    else { A.push([w * x, w * y, w, 0, 0, 0], [0, 0, 0, w * x, w * y, w]); b.push(w * u, w * v); }
  }
  const s = solve(A, b); if (!s) return null;
  if (model === 'translate') return [1, 0, 0, 1, s[0], s[1], 0, 0];
  if (model === 'scale') return [s[0], 0, 0, s[0], s[1], s[2], 0, 0];
  if (model === 'similarity') return [s[0], s[1], -s[1], s[0], s[2], s[3], 0, 0];
  return [s[0], s[3], s[1], s[4], s[2], s[5], 0, 0];
}
function ransac(model, Q, P, thr, rand) {
  const n = Q.length, k = MIN[model];
  if (n < k + 2) return null;
  let best = null, bestIn = [];
  for (let it = 0; it < 150; it++) {
    const pick = new Set(); while (pick.size < k) pick.add(Math.floor(rand() * n));
    const idx = [...pick], m = fit(model, idx.map(i => Q[i]), idx.map(i => P[i])); if (!m) continue;
    const inl = []; for (let i = 0; i < n; i++) { const [x, y] = apply(m, ...Q[i]); if (Math.hypot(x - P[i][0], y - P[i][1]) < thr) inl.push(i); }
    if (inl.length > bestIn.length) { bestIn = inl; best = m; }
  }
  if (!best || bestIn.length < k + 2) return null;
  // refit on inliers, then one robust reweighting
  let m = fit(model, bestIn.map(i => Q[i]), bestIn.map(i => P[i]));
  const res = bestIn.map(i => { const [x, y] = apply(m, ...Q[i]); return Math.hypot(x - P[i][0], y - P[i][1]); });
  m = fit(model, bestIn.map(i => Q[i]), bestIn.map(i => P[i]), res.map(r => 1 / (1 + (r / (thr * 0.5)) ** 2))) || m;
  const final = [], err = [];
  for (let i = 0; i < n; i++) { const [x, y] = apply(m, ...Q[i]), e = Math.hypot(x - P[i][0], y - P[i][1]); if (e < thr) { final.push(i); err.push(e); } }
  return { m, inliers: final, rms: Math.sqrt(err.reduce((s, e) => s + e * e, 0) / Math.max(1, err.length)) };
}
function seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------------- surface tracking ---------------- */
const inRect = (r, x, y) => x >= r[0] && y >= r[1] && x <= r[0] + r[2] && y <= r[1] + r[3];
function quad(m, r) { return [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]].map(([x, y]) => apply(m, x, y)); }
function area(q) { let s = 0; for (let i = 0; i < 4; i++) { const [x0, y0] = q[i], [x1, y1] = q[(i + 1) % 4]; s += x0 * y1 - x1 * y0; } return Math.abs(s) / 2; }
const scaleOf = (m, r) => Math.sqrt(area(quad(m, r)));
// fraction of the region (on the reference frame) that lands inside frame k
function visibleFraction(m, region, W, H) {
  let c = 0, t = 0;
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) { const [x, y] = apply(m, region[0] + region[2] * i / 8, region[1] + region[3] * j / 8); t++; if (x >= 0 && y >= 0 && x <= W && y <= H) c++; }
  return c / t;
}

export function trackSurface(V, opts) {
  const { region, masks = [], model = 'similarity', ref, from = 0, to = V.n - 1, maxPts = 260, log = () => {} } = opts;
  const k = V.k, W = V.width, H = V.height, n = V.n;
  if (!(ref >= 0 && ref < n)) throw new Error(`--ref ${ref} is outside the film (0..${n - 1}).`);
  const dup = duplicates(V.frames, V.w, V.h), pyr = new Map(), rand = seeded(7);
  const P = i => { if (!pyr.has(i)) { if (pyr.size > 6) pyr.delete(pyr.keys().next().value); pyr.set(i, pyramid(V.frames[i], V.w, V.h)); } return pyr.get(i); };
  const inside = M => { const Mi = invert(M); return (x, y) => { const [u, v] = apply(Mi, x / k, y / k); return inRect(region, u, v) && !masks.some(r => inRect(r, u, v)); }; };
  const thr = Math.max(0.9, 1.6 * k * Math.max(1, W / 1920)); // work px
  const out = new Array(n).fill(null), stats = new Array(n).fill(null);
  out[ref] = ID;

  for (const dir of [1, -1]) {
    let M = ID, key = ref, keyM = M, feats = [];
    const rekey = (i, Mi) => {
      const pts = corners(V.frames[i], V.w, V.h, inside(Mi), maxPts), Minv = invert(Mi);
      feats = pts.map(([x, y]) => ({ kx: x, ky: y, x, y, q: apply(Minv, x / k, y / k) }));
      key = i; keyM = Mi;
      return feats.length;
    };
    if (rekey(ref, M) < 8) throw new Error('Too few trackable details inside --region on the reference frame. Choose a region with visible texture or edges, or a larger one.');
    const start = feats.length;
    for (let i = ref + dir; dir > 0 ? i <= Math.min(to, n - 1) : i >= Math.max(from, 0); i += dir) {
      const prev = i - dir;
      if ((dir > 0 && dup[i]) || (dir < 0 && dup[prev])) { out[i] = out[prev]; stats[i] = stats[prev]; continue; }
      const A = P(key), B = P(i), Bp = P(prev), Q = [], Pp = [], live = [];
      for (const f of feats) {
        const p = lk(A, B, f.kx, f.ky, f.x, f.y); if (!p) continue;
        const back = lk(B, A, p[0], p[1], f.kx, f.ky); if (!back || Math.hypot(back[0] - f.kx, back[1] - f.ky) > thr * 0.6) continue;
        // keyframe templates drift under big scale change; cross-check against the previous frame too
        const step = lk(Bp, B, f.x, f.y, p[0], p[1]); if (!step || Math.hypot(step[0] - p[0], step[1] - p[1]) > thr) continue;
        f.nx = p[0]; f.ny = p[1]; live.push(f); Q.push(f.q); Pp.push([p[0] / k, p[1] / k]);
      }
      const fitR = ransac(model, Q, Pp, thr / k, rand);
      if (!fitR || fitR.inliers.length < 8) { log(`  ${dir > 0 ? 'forward' : 'backward'}: lost the surface at frame ${i}`); break; }
      M = fitR.m;
      const keep = new Set(fitR.inliers); feats = live.filter((f, j) => keep.has(j)); feats.forEach(f => { f.x = f.nx; f.y = f.ny; });
      out[i] = M; stats[i] = { pts: feats.length, rms: +fitR.rms.toFixed(2) };
      const vis = visibleFraction(M, region, W, H);
      if (vis < 0.2) { log(`  ${dir > 0 ? 'forward' : 'backward'}: surface left the picture at frame ${i}`); out[i] = null; break; }
      const sr = scaleOf(M, region) / scaleOf(keyM, region);
      if (feats.length < Math.max(14, start * 0.45) || sr > 1.18 || sr < 1 / 1.18) rekey(i, M);
    }
  }
  return { m: out, stats, dup };
}

/* ---------------- smoothing ---------------- */
// Smooth where the region's four corners land (in the frame order the visitor sees; duplicate
// frames hold), then refit the model to the smoothed corners. Works for every model.
export function smooth(track, model, half = 4, ref, region) {
  const { m, dup } = track, n = m.length, uniq = [];
  for (let i = 0; i < n; i++) if (m[i] && !dup[i]) uniq.push(i);
  const C = [[region[0], region[1]], [region[0] + region[2], region[1]], [region[0] + region[2], region[1] + region[3]], [region[0], region[1] + region[3]]];
  const P = uniq.map(i => C.map(c => apply(m[i], ...c))), out = m.slice();
  for (let j = 0; j < uniq.length; j++) {
    const lo = Math.max(0, j - half), hi = Math.min(uniq.length - 1, j + half), S = [];
    for (let c = 0; c < 4; c++) {
      const pt = [];
      for (let d = 0; d < 2; d++) {
        const A = [], b = [];
        for (let t = lo; t <= hi; t++) { const x = t - j, w = 1 - (Math.abs(x) / (half + 1)) ** 3; A.push([w, w * x, w * x * x]); b.push(w * P[t][c][d]); }
        const s = A.length >= 3 ? solve(A, b) : null; pt.push(s ? s[0] : P[j][c][d]);
      }
      S.push(pt);
    }
    // the model fixes what the corners may do (a scale-only plane stays square, and so on)
    out[uniq[j]] = fit(model === 'perspective' ? 'perspective' : model, C, S) || m[uniq[j]];
  }
  for (let i = 1; i < n; i++) if (dup[i] && out[i - 1] && m[i]) out[i] = out[i - 1];
  if (ref != null) out[ref] = ID;
  return out;
}
// how far the smoothed track sits from the measurement, and the largest frame-to-frame jolt
// (change of speed) of any region point that is on screen: what a viewer would see as a shake
export function quality(raw, sm, region, dup, W = Infinity, H = Infinity) {
  const G = []; for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) G.push([region[0] + region[2] * i / 4, region[1] + region[3] * j / 4]);
  const on = p => p[0] >= 0 && p[1] >= 0 && p[0] <= W && p[1] <= H;
  let dev = 0, jolt = 0, at = -1; const seq = [];
  for (let i = 0; i < sm.length; i++) {
    if (!sm[i] || !raw[i]) { seq.push(null); continue; }
    const P = G.map(c => apply(sm[i], ...c));
    G.forEach((c, j) => { if (!on(P[j])) return; const a = apply(raw[i], ...c); dev = Math.max(dev, Math.hypot(a[0] - P[j][0], a[1] - P[j][1])); });
    seq.push(dup[i] ? null : { i, P });
  }
  const u = seq.filter(Boolean);
  for (let t = 2; t < u.length; t++) {
    const [a, b, c] = [u[t - 2], u[t - 1], u[t]]; if (c.i - a.i > 4) continue;
    G.forEach((_, j) => { if (!on(c.P[j]) || !on(a.P[j])) return; const acc = Math.hypot(c.P[j][0] - 2 * b.P[j][0] + a.P[j][0], c.P[j][1] - 2 * b.P[j][1] + a.P[j][1]); if (acc > jolt) { jolt = acc; at = c.i; } });
  }
  return { deviation: +dev.toFixed(2), jolt: +jolt.toFixed(2), joltAt: at };
}
// Picture check, independent of the tracker: carry the surface from frame j to frame i with
// the track (m[i] after inverse m[j]) and compare the pixels (normalised cross-correlation,
// 1 = identical). Neighbouring frames (gap) catch jumps and slips; the proof sheet catches slow drift.
function ncc(V, A, B, M, region, masks, mi) {
  const k = V.k, step = Math.max(2, Math.sqrt(region[2] * region[3] / 3000));
  const smp = (f, x, y) => { x *= k; y *= k; if (x < 0 || y < 0 || x >= V.w - 1 || y >= V.h - 1) return null; const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * V.w + x0; return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + V.w] * (1 - fx) + f[i + V.w + 1] * fx) * fy; };
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = region[1]; y < region[1] + region[3]; y += step) for (let x = region[0]; x < region[0] + region[2]; x += step) {
    if (masks.some(r => inRect(r, x, y))) continue;
    const pa = apply(mi, x, y), pb = apply(M, x, y), u = smp(A, pa[0], pa[1]), v = smp(B, pb[0], pb[1]); if (u == null || v == null) continue;
    n++; sa += u; sb += v; saa += u * u; sbb += v * v; sab += u * v;
  }
  if (n < 30) return null;
  const va = saa - sa * sa / n, vb = sbb - sb * sb / n;
  return va > 1 && vb > 1 ? (sab - sa * sb / n) / Math.sqrt(va * vb) : null;
}
export function photoMatch(V, m, dup, region, masks = [], gap = 4) {
  const out = new Array(m.length).fill(null), uniq = [];
  for (let i = 0; i < m.length; i++) if (m[i] && !dup[i]) uniq.push(i);
  for (let j = 0; j < uniq.length; j++) {
    const i = uniq[j], o = uniq[j + gap] ?? uniq[j - gap]; if (o == null) continue;
    const v = ncc(V, V.frames[o], V.frames[i], m[i], region, masks, m[o]);
    out[i] = v == null ? null : +v.toFixed(3);
  }
  for (let i = 1; i < m.length; i++) if (dup[i] && m[i]) out[i] = out[i - 1];
  return out;
}
// Smooth as much as the picture allows: per frame, the widest window whose result matches the
// pixels as well as the raw measurement. Noisy stretches get smoothed; real fast moves and
// sudden steps in the film (joins, held frames) keep the measured position.
export function adaptiveSmooth(V, tr, model, half, ref, region, masks) {
  const halves = [...new Set([half, Math.max(1, half >> 1), 1])].filter(h => h >= 1).sort((a, b) => b - a);
  const raw = photoMatch(V, tr.m, tr.dup, region, masks, 2), out = tr.m.slice();
  const cands = halves.map(h => { const m = smooth(tr, model, h, ref, region); return { m, pm: photoMatch(V, m, tr.dup, region, masks, 2) }; });
  for (let i = 0; i < out.length; i++) {
    if (!tr.m[i] || tr.dup[i]) continue;
    const c = cands.find(c => c.m[i] && (raw[i] == null || c.pm[i] == null || c.pm[i] >= raw[i] - 0.006));
    out[i] = c ? c.m[i] : tr.m[i];
  }
  for (let i = 1; i < out.length; i++) if (tr.dup[i] && out[i - 1] && tr.m[i]) out[i] = out[i - 1];
  if (ref != null) out[ref] = ID;
  return out;
}
// keep the unbroken run around the reference frame where the picture check holds
export function trimRange(sm, match, ref, floor = 0.5) {
  const out = sm.slice(); let lo = ref, hi = ref;
  while (lo - 1 >= 0 && out[lo - 1] && (match[lo - 1] == null || match[lo - 1] >= floor)) lo--;
  while (hi + 1 < out.length && out[hi + 1] && (match[hi + 1] == null || match[hi + 1] >= floor)) hi++;
  for (let i = 0; i < out.length; i++) if (i < lo || i > hi) out[i] = null;
  return { m: out, from: lo, to: hi };
}

/* ---------------- phone crop ---------------- */
export function findCrop(wideFilm, phoneFilm) {
  const pw = probe(phoneFilm), ww = probe(wideFilm);
  const W = decode(wideFilm, 480), Pv = decode(phoneFilm, Math.round(480 * pw.width / ww.width * ww.height / pw.height));
  const scale = pw.height / ww.height; // a full-height crop (encode.mjs --mobile)
  const pick = [0, Math.floor(Math.min(W.n, Pv.n) / 2), Math.min(W.n, Pv.n) - 1];
  const cw = ww.height * pw.width / pw.height; // crop width in wide px
  const score = x0 => { // mean abs difference, wide frame vs phone frame resampled into wide px
    let s = 0, c = 0;
    for (const f of pick) {
      const a = W.frames[f], b = Pv.frames[f];
      for (let y = 4; y < W.h - 4; y += 3) for (let u = 2; u < Pv.w - 2; u += 2) {
        const wx = Math.round((x0 + u / Pv.w * cw) * W.k), wy = Math.round(y / W.h * Pv.h); if (wx < 0 || wx >= W.w) continue;
        s += Math.abs(a[y * W.w + wx] - b[wy * Pv.w + u]); c++;
      }
    }
    return c ? s / c : 1e9;
  };
  let best = 0, bs = 1e9;
  for (let x = 0; x <= ww.width - cw + 0.5; x += 2) { const s = score(x); if (s < bs) { bs = s; best = x; } }
  for (let x = best - 2; x <= best + 2; x += 0.25) { const s = score(x); if (s < bs) { bs = s; best = x; } }
  return { x: +best.toFixed(2), y: 0, scale: +scale.toFixed(6), error: +bs.toFixed(2), isCrop: bs < 9, focus: +(best / Math.max(1, ww.width - cw)).toFixed(3) };
}

/* ---------------- file ---------------- */
export function readTrackFile(file) {
  if (!fs.existsSync(file)) return { version: 1 };
  const s = fs.readFileSync(file, 'utf8'), i = s.indexOf('window.FILMTRACK=');
  if (i < 0) throw new Error(`${file} is not a filmtrack file.`);
  return JSON.parse(s.slice(i + 17).trim().replace(/;\s*$/, ''));
}
export function writeTrackFile(file, data) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `/* filmtrack.js: written by .10k/tools/track.mjs. Do not edit by hand; re-run the tool.\n   Surfaces: ${Object.entries(data).filter(([k]) => k === 'wide' || k === 'phone').map(([v, d]) => Object.keys(d.surfaces || {}).map(s => `${v}.${s}`).join(', ')).join(', ') || 'none'} */\nwindow.FILMTRACK=${JSON.stringify(data)};\n`);
}
const r5 = v => Math.round(v * 1e5) / 1e5, r2 = v => Math.round(v * 100) / 100;
export const pack = m => m ? [r5(m[0]), r5(m[1]), r5(m[2]), r5(m[3]), r2(m[4]), r2(m[5]), +m[6].toExponential(5), +m[7].toExponential(5)] : null;

/* ---------------- proof sheet ---------------- */
export async function proofSheet(film, surface, out, { cols = 4, tiles = 12, tileW = 480, frames = null } = {}) {
  let sharp; try { sharp = (await import('sharp')).default; } catch { throw new Error('The proof sheet needs sharp: run npm install in .10k/tools.'); }
  const info = probe(film), w = tileW, h = Math.round(info.height * w / info.width / 2) * 2, k = w / info.width;
  const valid = surface.m.map((m, i) => (m ? i : -1)).filter(i => i >= 0);
  const pick = frames ? frames.filter(i => surface.m[i]) : [...new Set(Array.from({ length: tiles }, (_, j) => valid[Math.round(j * (valid.length - 1) / Math.max(1, tiles - 1))]))];
  const r = spawnSync(FF, ['-v', 'error', '-i', film, '-fps_mode', 'passthrough', '-vf', `select='${pick.map(i => `eq(n\\,${i})`).join('+')}',scale=${w}:${h},format=rgb24`, '-f', 'rawvideo', '-'], { maxBuffer: w * h * 3 * (pick.length + 2) + (8 << 20) });
  const buf = r.stdout, [rx, ry, rw, rh] = surface.region, comp = [];
  pick.forEach((fi, t) => {
    const img = Buffer.from(buf.subarray(t * w * h * 3, (t + 1) * w * h * 3)), m = surface.m[fi];
    const dot = (x, y, c) => { x = Math.round(x); y = Math.round(y); for (let v = -1; v <= 0; v++) for (let u = -1; u <= 0; u++) { const X = x + u, Y = y + v; if (X >= 0 && Y >= 0 && X < w && Y < h) { const i = (Y * w + X) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; } } };
    const line = (a, b, c) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1; for (let s = 0; s <= n; s++) dot(a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n, c); };
    const P = (u, v) => { const p = apply(m, rx + rw * u, ry + rh * v); return [p[0] * k, p[1] * k]; };
    for (let g = 0; g <= 6; g++) { const c = g % 3 ? [255, 210, 0] : [0, 255, 200]; line(P(g / 6, 0), P(g / 6, 1), c); line(P(0, g / 6), P(1, g / 6), c); }
    for (const mk of surface.masks || []) { const [mx, my, mw, mh] = mk, q = (u, v) => { const p = apply(m, mx + mw * u, my + mh * v); return [p[0] * k, p[1] * k]; }; line(q(0, 0), q(1, 0), [255, 60, 60]); line(q(1, 0), q(1, 1), [255, 60, 60]); line(q(1, 1), q(0, 1), [255, 60, 60]); line(q(0, 1), q(0, 0), [255, 60, 60]); }
    const label = Buffer.from(`<svg width="${w}" height="${h}"><rect x="0" y="0" width="70" height="26" fill="black" opacity=".6"/><text x="8" y="19" font-family="Menlo,monospace" font-size="16" fill="#fff">${fi}</text></svg>`);
    comp.push({ img, fi, label, t });
  });
  const rows = Math.ceil(comp.length / cols), gap = 6;
  const tilesOut = await Promise.all(comp.map(c => sharp(c.img, { raw: { width: w, height: h, channels: 3 } }).composite([{ input: c.label, top: 0, left: 0 }]).png().toBuffer()));
  await sharp({ create: { width: cols * (w + gap), height: rows * (h + gap), channels: 3, background: '#111' } })
    .composite(tilesOut.map((b, t) => ({ input: b, left: (t % cols) * (w + gap), top: Math.floor(t / cols) * (h + gap) }))).jpeg({ quality: 86 }).toFile(out);
  return pick;
}

/* ---------------- CLI ---------------- */
function parseArgs(argv) {
  const pos = [], o = { mask: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; if (k === 'mask') o.mask.push(v); else o[k] = v; }
    else pos.push(a);
  }
  return { pos, o };
}
const rect = s => { const r = String(s).split(',').map(Number); if (r.length !== 4 || r.some(v => !Number.isFinite(v)) || r[2] <= 0 || r[3] <= 0) throw new Error(`Expected x,y,w,h in film pixels, got "${s}".`); return r; };

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv, { pos, o } = parseArgs(rest);
  const out = o.out && o.out !== true ? o.out : 'site/filmtrack.js';
  if (cmd === 'surface') {
    const film = pos[0];
    if (!film || !fs.existsSync(film)) throw new Error('Usage: node track.mjs surface <film.mp4> --name wall --ref N --region x,y,w,h [--mask x,y,w,h] [--model similarity|scale|translate|affine|perspective]');
    const name = String(o.name || ''); if (!/^[A-Za-z][\w-]*$/.test(name)) throw new Error('--name must be a simple word, such as wall or sign.');
    const model = String(o.model || 'similarity'); if (!MIN[model]) throw new Error('--model must be translate, scale, similarity, affine or perspective.');
    const variant = String(o.variant || 'wide'); if (!/^(wide|phone)$/.test(variant)) throw new Error('--variant must be wide or phone.');
    const region = rect(o.region), masks = o.mask.map(rect), ref = Number(o.ref);
    const t0 = Date.now(); console.log(`Decoding ${film}...`);
    const V = decode(film, Number(o.work || 640));
    console.log(`${V.n} frames, ${V.width}x${V.height} at ${V.fps} fps. Tracking "${name}" from frame ${ref} (${model})...`);
    const tr = trackSurface(V, { region, masks, model, ref: Number.isFinite(ref) ? ref : 0, from: o.from != null ? Number(o.from) : 0, to: o.to != null ? Number(o.to) : V.n - 1, log: s => console.log(s) });
    const sm0 = adaptiveSmooth(V, tr, model, Number(o.smooth ?? 4), ref, region, masks);
    const pm = photoMatch(V, sm0, tr.dup, region, masks), floor = Number(o.floor ?? 0.5);
    const { m: sm, from: first, to: last } = trimRange(sm0, pm, ref, floor);
    const q = quality(tr.m, sm, region, tr.dup, V.width, V.height);
    const kept = pm.map((v, i) => [v, i]).filter(([v, i]) => v != null && sm[i]), worst = kept.reduce((a, b) => (b[0] < a[0] ? b : a), [2, -1]);
    const raw = sm0.map((m, i) => (m ? i : -1)).filter(i => i >= 0);
    const data = readTrackFile(out); data.version = 1;
    const V0 = data[variant] && data[variant].film && (data[variant].film[0] !== V.width || data[variant].film[1] !== V.height || data[variant].frames !== V.n) ? {} : data[variant] || {};
    data[variant] = { ...V0, src: path.basename(film), film: [V.width, V.height], fps: V.fps, frames: V.n, surfaces: { ...(V0.surfaces || {}), [name]: { ref, region, masks, model, from: first, to: last, match: pm.map((v, i) => (v == null || !sm[i] ? null : +v.toFixed(2))), m: sm.map(pack) } } };
    writeTrackFile(out, data);
    const pts = tr.stats.filter(Boolean).map(s => s.pts);
    console.log(`Followed the surface over frames ${raw[0]}-${raw[raw.length - 1]} (${Math.min(...pts)}-${Math.max(...pts)} details per frame).`);
    if (first > raw[0] || last < raw[raw.length - 1]) console.log(`Kept frames ${first}-${last}: outside them the picture check fell under ${floor}, so the track no longer matches the surface there.`);
    else console.log(`Kept all of it: frames ${first}-${last}.`);
    console.log(`Picture check (neighbouring frames, 1 = identical): worst ${worst[0].toFixed(2)} at frame ${worst[1]}. Smoothing moved the region by at most ${q.deviation} film px; largest on-screen jolt ${q.jolt} px (frame ${q.joltAt}).`);
    if (q.jolt > 6) console.log(`WARNING: the track jolts by ${q.jolt} px at frame ${q.joltAt}. If the proof sheet shows the film itself jumping there (a join), that is right; otherwise mask anything that moves on its own or try a simpler --model.`);
    if (last - first < 12) console.log('WARNING: under half a second of usable track. Choose a different --ref, region or --model.');
    console.log(`Wrote ${out} (${variant}.${name}) in ${((Date.now() - t0) / 1000).toFixed(1)} s. Next: node track.mjs proof ${film} --name ${name}${variant === 'phone' ? ' --variant phone' : ''}`);
    return data;
  }
  if (cmd === 'crop') {
    const [wide, phone] = pos;
    if (!wide || !phone) throw new Error('Usage: node track.mjs crop <wide.mp4> <phone.mp4> [--out site/filmtrack.js]');
    const c = findCrop(wide, phone), data = readTrackFile(out);
    if (!c.isCrop) { console.log(`The phone clip does not match a crop of the wide clip (difference ${c.error}). Track the phone clip's own surfaces with --variant phone.`); return c; }
    data.version = 1; data.phoneCrop = { x: c.x, y: c.y, scale: c.scale }; writeTrackFile(out, data);
    console.log(`Phone clip = wide film from x ${c.x} px (focus ${c.focus}), scaled ${c.scale}. Difference ${c.error}/255. Wrote ${out}: wide tracks now drive the phone layout.`);
    return c;
  }
  if (cmd === 'proof') {
    const film = pos[0], data = readTrackFile(o.track && o.track !== true ? o.track : out), variant = String(o.variant || 'wide');
    const s = data[variant] && data[variant].surfaces && data[variant].surfaces[o.name];
    if (!film || !s) throw new Error(`Usage: node track.mjs proof <film.mp4> --name <surface> [--variant ${variant}]. Known: ${Object.keys((data[variant] || {}).surfaces || {}).join(', ') || 'none'}`);
    const file = o.out && o.out !== true ? o.out : `review/track-${variant === 'phone' ? 'phone-' : ''}${o.name}.jpg`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const pick = await proofSheet(film, s, file, { frames: o.frames && o.frames !== true ? String(o.frames).split(',').map(Number) : null, tileW: Number(o.tile || 480) });
    console.log(`Wrote ${file} (frames ${pick.join(', ')}). The grid must stay fixed to the surface in every tile; red boxes are masks.`);
    return file;
  }
  if (cmd === 'list') {
    const data = readTrackFile(o.track && o.track !== true ? o.track : out);
    for (const v of ['wide', 'phone']) for (const [n, s] of Object.entries((data[v] || {}).surfaces || {})) console.log(`${v}.${n}: ref ${s.ref}, frames ${s.from}-${s.to}, ${s.model}, region ${s.region.join(',')}`);
    if (data.phoneCrop) console.log(`phoneCrop: x ${data.phoneCrop.x}, scale ${data.phoneCrop.scale}`);
    return data;
  }
  throw new Error('Commands: surface, crop, proof, list. See the top of track.mjs.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
