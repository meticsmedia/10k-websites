#!/usr/bin/env node
// Usage: node review.mjs review/hero-joined.mp4 [--port 8081] [--fps 24]
// One private, seekable film viewer. Nothing else in review/ is exposed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { startStaticServer, closeServer } from './server.mjs';

export function probeFilm(file) {
  const ff = process.env.FFMPEG || 'ffmpeg';
  const probeBin = process.env.FFPROBE || (path.dirname(ff) === '.' ? 'ffprobe' : path.join(path.dirname(ff), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'));
  const result = spawnSync(probeBin, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,r_frame_rate:format=duration', '-of', 'json', file], { encoding: 'utf8', timeout: 30000 });
  if (!result.error && result.status === 0) {
    try {
      const data = JSON.parse(result.stdout), stream = data.streams?.[0];
      const ratio = value => { const [a, b = 1] = String(value || '0').split('/').map(Number); return b ? a / b : 0; };
      const fps = ratio(stream?.avg_frame_rate) || ratio(stream?.r_frame_rate);
      if (fps > 0) return { fps, duration: Number(data.format?.duration), variable: Math.abs(fps - ratio(stream?.r_frame_rate)) > 0.01 };
    } catch {}
  }
  const fallback = spawnSync(ff, ['-hide_banner', '-i', file], { encoding: 'utf8', timeout: 30000 });
  const m = (fallback.stderr || '').match(/Video:.*?([\d.]+)\s*fps/);
  if (m && Number(m[1]) > 0) return { fps: Number(m[1]), duration: null, variable: true };
  throw new Error('Could not probe the film frame rate. Install ffprobe/ffmpeg or supply the known rate with --fps.');
}

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function reviewHTML(name, source, fps, variable = false) {
  const settings = JSON.stringify({ source, fps }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Film review · ${escape(name)}</title>
<style>html{color-scheme:dark;font:16px system-ui;background:#14161a;color:#edf1f5}body{margin:0 auto;max-width:1400px;padding:24px}h1{font-size:22px}video{display:block;width:100%;max-height:75vh;background:#08090a}.tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-block:16px}button,select,input{font:inherit;padding:10px;min-height:44px}input[type=range]{padding:0;flex:1;min-width:180px}p{color:#bbc4cf;line-height:1.5}output{font-variant-numeric:tabular-nums}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #70c7ff}#error{color:#ffb3a9}</style>
<h1>${escape(name)}</h1><video id="film" controls playsinline preload="metadata"></video>
<div class="tools"><button id="back" type="button">← Previous frame</button><button id="play" type="button">Play / pause</button><button id="forward" type="button">Next frame →</button><label>Speed <select id="speed"><option value="1">Normal</option><option value="0.5">Half speed</option><option value="0.25">Quarter speed</option></select></label></div>
<div class="tools"><label for="seek">Seek</label><input id="seek" type="range" min="0" max="1" value="0" step="any"><output id="time">Loading metadata…</output></div>
<p>Watch the complete film at normal speed, then review the action and joins at half speed. Pause and use the arrow keys or frame buttons to inspect an instant. Frame step: ${fps.toFixed(3)} fps${variable ? ' (average/probed rate; variable-rate footage may not step to every source frame)' : ''}. This viewer shows the film; it does not certify its quality.</p><p id="error" role="alert"></p>
<script>const settings=${settings};const film=document.querySelector('#film'),seek=document.querySelector('#seek'),time=document.querySelector('#time');film.src=settings.source;
const stamp=n=>Number.isFinite(n)?n.toFixed(3)+' s':'—';
function update(){if(Number.isFinite(film.duration)){seek.max=film.duration;seek.value=film.currentTime;time.textContent=stamp(film.currentTime)+' / '+stamp(film.duration);}}
function step(direction){film.pause();if(!Number.isFinite(film.duration))return;film.currentTime=Math.max(0,Math.min(film.duration-0.5/settings.fps,film.currentTime+direction/settings.fps));}
document.querySelector('#back').onclick=()=>step(-1);document.querySelector('#forward').onclick=()=>step(1);document.querySelector('#play').onclick=()=>{if(film.paused)film.play().catch(e=>document.querySelector('#error').textContent=e.message);else film.pause();};
document.querySelector('#speed').onchange=e=>film.playbackRate=Number(e.target.value);seek.oninput=()=>{film.pause();film.currentTime=Number(seek.value);};['loadedmetadata','timeupdate','seeked','durationchange'].forEach(e=>film.addEventListener(e,update));film.onerror=()=>document.querySelector('#error').textContent='The browser could not play this film. Use a browser-compatible MP4 or open the source in a local video player.';
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}});</script></html>`;
}

export async function startReview(file, { port = 8081, fps: override } = {}) {
  const real = await fs.promises.realpath(path.resolve(file));
  if (!/\.(?:mp4|webm|mov)$/i.test(real) || !(await fs.promises.stat(real)).isFile()) throw new Error('Choose an MP4, WebM or MOV film.');
  const { fps, variable } = override ? { fps: Number(override), variable: false } : probeFilm(real);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 1000) throw new Error('--fps must be a known positive frame rate.');
  const name = path.basename(real), route = `/${name}`;
  if (name.startsWith('.')) throw new Error('Rename this hidden film before reviewing it.');
  return startStaticServer(path.dirname(real), { port, allowlist: ['/', route], virtualFiles: { '/': { body: reviewHTML(name, `/${encodeURIComponent(name)}`, fps, variable) } } });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const value = args[i + 1]; args.splice(i, 2); return value; };
  const port = Number(flag('--port', 8081)), fps = flag('--fps', null);
  try {
    if (args.length !== 1) throw new Error('Usage: node review.mjs <film.mp4> [--port 8081] [--fps 24]');
    const server = await startReview(args[0], { port, fps });
    console.log(`Film review: http://127.0.0.1:${server.address().port}/`);
    console.log('Watch the complete film and its joins. Press Ctrl+C to stop.');
    const stop = async () => { await closeServer(server); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  } catch (error) { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another --port; no process was stopped.` : error.message); process.exitCode = 1; }
}
