import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { summarizeUsage, readSessionSnapshot } from '../usage.mjs';
const now = Date.parse('2026-10-01T00:00:00Z');

test('a primary weekly window is weekly, independent of plan or bucket position', () => {
  const lines = summarizeUsage({ plan: 'prolite', ts: now, rlim: { primary: { used_percent: 88, window_minutes: 10080, resets_at: now / 1000 + 86400 } } }, now).join('\n');
  assert.match(lines, /WEEKLY_USED=88%/); assert.doesNotMatch(lines, /FIVE_HOUR|MODE=/); assert.match(lines, /REMAINING=12%/);
});
test('native multiple limits, missing fields and real five-hour window are preserved', () => {
  const lines = summarizeUsage({ rateLimitsByLimitId: { gpt: { primary: { usedPercent: 32, windowDurationMins: 300 } }, other: { primary: { usedPercent: null } } } }, now).join('\n');
  assert.match(lines, /FIVE_HOUR_USED=32%/); assert.match(lines, /WINDOW_PRIMARY_USED=unavailable/); assert.match(lines, /WINDOW_MINUTES=unknown/);
});
test('stale expired reset never turns an old reading into zero usage', () => {
  const lines = summarizeUsage({ ts: now - 7200000, primary: { used_percent: 99, window_minutes: 300, resets_at: now / 1000 - 60 } }, now).join('\n');
  assert.match(lines, /USED=99%/); assert.match(lines, /RESET_PASSED_UNVERIFIED=true/); assert.match(lines, /READING_AGE_MIN=120/);
});
test('session fallback ignores message payloads and identifies the requested folder model', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), '10k-usage-test-'));
  try {
    const cwd = path.join(dir, 'site');
    const records = [
      { timestamp: new Date(now).toISOString(), type: 'session_meta', payload: { cwd } },
      { timestamp: new Date(now).toISOString(), type: 'turn_context', payload: { model: 'test-top-gpt' } },
      { timestamp: new Date(now).toISOString(), type: 'event_msg', payload: { type: 'user_message', message: 'private conversation rate_limits' } },
      { timestamp: new Date(now).toISOString(), type: 'event_msg', payload: { type: 'token_count', rate_limits: { plan_type: 'unknown', primary: { used_percent: 5, window_minutes: 10080 } } } }
    ];
    await fs.writeFile(path.join(dir, 'fixture.jsonl'), records.map(JSON.stringify).join('\n'));
    const r = await readSessionSnapshot(dir, cwd, now);
    assert.equal(r.model, 'test-top-gpt'); assert.equal(r.rlim.primary.window_minutes, 10080); assert.ok(!JSON.stringify(r).includes('private conversation'));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
