#!/usr/bin/env node
// Read-only usage fallback. Prefer the app's native usage tool when available.
// Usage: node usage.mjs [--input usage-snapshot.json] (input is useful for saved snapshots/tests).
// Reports actual durations; never infers a production level or changes the selected GPT.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const finite = v => typeof v === 'number' && Number.isFinite(v);
const resetSeconds = w => w.resets_at ?? w.resetsAt;
const minutes = w => w.window_minutes ?? w.windowDurationMins ?? w.window_duration_mins;
const percent = w => w.used_percent ?? w.usedPercent;

export function summarizeUsage(snapshot = {}, now = Date.now()) {
  const rate = snapshot.rlim || snapshot.rateLimits || snapshot.rate_limits || snapshot;
  const lines = [`PLAN=${snapshot.plan || snapshot.planType || rate.plan_type || rate.planType || 'unknown'}`];
  const byId = snapshot.rateLimitsByLimitId || snapshot.rate_limits_by_limit_id;
  const buckets = byId && Object.keys(byId).length ? Object.entries(byId) : [['account', rate]];
  let count = 0;
  for (const [id, bucket] of buckets) {
    for (const key of ['primary', 'secondary']) {
      const w = bucket?.[key]; if (!w) continue;
      const duration = minutes(w), used = percent(w), reset = resetSeconds(w);
      const label = duration === 300 ? 'FIVE_HOUR' : duration === 10080 ? 'WEEKLY' : `WINDOW_${key.toUpperCase()}`;
      const safeId = String(id).replace(/[^\w.-]/g, '_');
      const fields = [`${label}_USED=${finite(used) ? `${Math.round(used)}%` : 'unavailable'}`, `LIMIT_ID=${safeId}`, `WINDOW_MINUTES=${finite(duration) ? duration : 'unknown'}`];
      if (finite(used)) fields.push(`REMAINING=${Math.max(0, Math.min(100, 100 - used)).toFixed(0)}%`);
      if (finite(reset) && reset > 0) {
        const ms = reset * 1000;
        fields.push(`RESETS_AT=${new Date(ms).toISOString()}`);
        fields.push(ms <= now ? 'RESET_PASSED_UNVERIFIED=true' : `RESETS_IN_MIN=${Math.ceil((ms - now) / 60000)}`);
      } else fields.push('RESETS_AT=unavailable');
      lines.push(fields.join('  ')); count++;
    }
  }
  if (!count) lines.push('USAGE=unavailable');
  const at = snapshot.ts || (snapshot.timestamp ? Date.parse(snapshot.timestamp) : null);
  if (finite(at)) lines.push(`READING_AGE_MIN=${Math.max(0, Math.round((now - at) / 60000))}`);
  else lines.push('READING_AGE_MIN=unknown');
  if (snapshot.model) lines.push(`THIS_FOLDER_MODEL=${snapshot.model}`);
  lines.push('NOTE=Saved usage is not live verification; an elapsed reset does not prove fresh allowance.');
  return lines;
}

export async function readSessionSnapshot(dir, cwd = process.cwd(), now = Date.now()) {
  const files = [];
  function walk(d) {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.jsonl')) {
        const m = fs.statSync(p).mtimeMs;
        if (now - m < 7 * 864e5) files.push({ p, m });
      }
    }
  }
  walk(dir); files.sort((a, b) => b.m - a.m);
  let best = null, plan = null, planAt = 0, model = null, modelAt = 0;
  for (const { p } of files.slice(0, 25)) {
    let folder = null, fileModel = null, lastTs = 0;
    const stream = fs.createReadStream(p);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        if (!line.includes('"rate_limits"') && !line.includes('"turn_context"') && !line.includes('"session_meta"')) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        const ts = Date.parse(o.timestamp || '') || 0, pl = o.payload || {};
        if (o.type === 'session_meta' && pl.cwd) folder = pl.cwd;
        if (o.type === 'turn_context' && pl.model) { fileModel = pl.model; lastTs = Math.max(lastTs, ts); }
        const rlim = pl.rate_limits;
        if (pl.type === 'token_count' && rlim && (rlim.primary || rlim.secondary)) {
          if (!best || ts > best.ts) best = { ts, rlim };
          if (rlim.plan_type && ts >= planAt) { plan = rlim.plan_type; planAt = ts; }
        }
      }
    } finally { rl.close(); stream.destroy(); }
    const sameFolder = folder && (process.platform === 'win32' ? path.resolve(folder).toLowerCase() === path.resolve(cwd).toLowerCase() : path.resolve(folder) === path.resolve(cwd));
    if (sameFolder && fileModel && lastTs > modelAt) { model = fileModel; modelAt = lastTs; }
  }
  return { ...(best || {}), plan: plan || 'unknown', model };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Usage: node usage.mjs [--input usage-snapshot.json]'); return; }
  let snapshot;
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--input') throw new Error('Use --input <saved JSON snapshot> or no arguments.');
    snapshot = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  } else {
    const codexDir = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    snapshot = await readSessionSnapshot(path.join(codexDir, 'sessions'));
  }
  console.log(summarizeUsage(snapshot).join('\n'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(e => { console.error(`Usage check unavailable: ${e.message}`); process.exitCode = 1; });
}
