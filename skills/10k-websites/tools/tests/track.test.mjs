// Tracker tests on synthetic films with known motion: node --test tools/tests/track.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decode, trackSurface, smooth, duplicates, apply, findCrop, main } from '../track.mjs';

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const run = argv => { const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
function dir(t) { const d = fs.mkdtempSync(path.join(os.tmpdir(), '10k track ')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; }
// a large textured plate, then a moving window over it
function plate(d) { const p = path.join(d, 'plate.png'); run(['-f', 'lavfi', '-i', 'cellauto=s=1600x1000:rule=110:random_fill_ratio=0.5,format=gray', '-vf', 'gblur=sigma=1.2', '-frames:v', '1', p]); return p; }

test('a sideways move is measured exactly, and the far end of the film agrees', async t => {
  const d = dir(t), p = plate(d), film = path.join(d, 'pan.mp4');
  // the window moves 3 px right per frame, so the picture moves 3 px left
  run(['-loop', '1', '-framerate', '30', '-i', p, '-vf', "crop=640:360:x='100+3*n':y=200,format=yuv420p", '-frames:v', '60', '-r', '30', '-c:v', 'libx264', '-crf', '12', film]);
  const V = decode(film, 640), region = [100, 60, 440, 240];
  const tr = trackSurface(V, { region, model: 'translate', ref: 0 });
  for (const k of [10, 30, 59]) { assert.ok(tr.m[k], `frame ${k} tracked`); assert.ok(Math.abs(tr.m[k][4] + 3 * k) < 0.6, `frame ${k}: x ${tr.m[k][4]} vs ${-3 * k}`); assert.ok(Math.abs(tr.m[k][5]) < 0.6); }
});

test('a push in is measured as growth about a fixed point, in both directions from the reference', async t => {
  const d = dir(t), p = plate(d), film = path.join(d, 'push.mp4');
  // the window shrinks 0.5% per frame about the plate centre: the picture grows by 1/(1-0.005n)
  run(['-loop', '1', '-framerate', '30', '-i', p, '-vf', "zoompan=z='1/(1-0.005*on)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=800x500:fps=30,format=yuv420p", '-frames:v', '61', '-c:v', 'libx264', '-crf', '12', film]);
  const V = decode(film, 640), region = [250, 150, 300, 200];
  const tr = trackSurface(V, { region, model: 'scale', ref: 30 });
  for (const k of [0, 15, 45, 60]) {
    const want = (1 - 0.005 * 30) / (1 - 0.005 * k);
    assert.ok(tr.m[k], `frame ${k} tracked`);
    assert.ok(Math.abs(tr.m[k][0] / want - 1) < 0.01, `frame ${k}: scale ${tr.m[k][0].toFixed(4)} vs ${want.toFixed(4)}`);
    const c = apply(tr.m[k], 400, 250); assert.ok(Math.hypot(c[0] - 400, c[1] - 250) < 2, `frame ${k}: the centre stays put`);
  }
});

test('repeated frames from 24 to 30 fps padding are found and held still', async t => {
  const d = dir(t), p = plate(d), film = path.join(d, 'pad.mp4');
  run(['-loop', '1', '-framerate', '24', '-i', p, '-vf', "crop=640:360:x='100+4*n':y=200,fps=30,format=yuv420p", '-frames:v', '50', '-c:v', 'libx264', '-crf', '12', film]);
  const V = decode(film, 640), dup = duplicates(V.frames, V.w, V.h);
  const n = [...dup].filter(Boolean).length;
  assert.ok(n >= 8 && n <= 11, `about one repeat in five (got ${n} of 50)`);
  const tr = trackSurface(V, { region: [100, 60, 440, 240], model: 'translate', ref: 0 });
  const sm = smooth(tr, 'translate', 4, 0, [100, 60, 440, 240]);
  for (let i = 1; i < 50; i++) if (dup[i]) assert.deepEqual(sm[i], sm[i - 1], `frame ${i} repeats frame ${i - 1}`);
});

test('a phone crop is located in the wide film', async t => {
  const d = dir(t), p = plate(d), wide = path.join(d, 'wide.mp4'), phone = path.join(d, 'phone.mp4');
  run(['-loop', '1', '-framerate', '30', '-i', p, '-vf', "crop=1280:720:x='20+2*n':y=100,format=yuv420p", '-frames:v', '20', '-r', '30', '-c:v', 'libx264', '-crf', '14', wide]);
  run(['-i', wide, '-vf', 'crop=ih*9/16:ih:(iw-ih*9/16)*0.3:0,scale=360:640', '-c:v', 'libx264', '-crf', '14', phone]);
  const c = findCrop(wide, phone);
  assert.ok(c.isCrop, `recognised as a crop (difference ${c.error})`);
  assert.ok(Math.abs(c.x - (1280 - 405) * 0.3) < 3, `x ${c.x}`);
  assert.ok(Math.abs(c.scale - 640 / 720) < 1e-3);
});

test('the command line writes filmtrack.js that the page script can read', async t => {
  const d = dir(t), p = plate(d), film = path.join(d, 'pan.mp4'), out = path.join(d, 'site', 'filmtrack.js');
  run(['-loop', '1', '-framerate', '30', '-i', p, '-vf', "crop=640:360:x='100+2*n':y=200,format=yuv420p", '-frames:v', '30', '-r', '30', '-c:v', 'libx264', '-crf', '12', film]);
  const log = console.log; console.log = () => {};
  try { await main(['surface', film, '--name', 'wall', '--ref', '0', '--region', '100,60,440,240', '--model', 'translate', '--out', out]); } finally { console.log = log; }
  const src = fs.readFileSync(out, 'utf8'), w = {}; new Function('window', src)(w);
  const s = w.FILMTRACK.wide.surfaces.wall;
  assert.equal(w.FILMTRACK.wide.frames, 30); assert.equal(s.m.length, 30); assert.equal(s.m[0].length, 8);
  assert.ok(Math.abs(s.m[20][4] + 40) < 0.8, `frame 20 x ${s.m[20][4]}`);
});
