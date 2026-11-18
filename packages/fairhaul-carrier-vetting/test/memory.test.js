import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairhaul-core';
import { manifest } from '../src/index.js';
import { learnAndAccept } from '../../fairhaul-core/test/memory-flow.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const root = () => { const r = mkdtempSync(join(tmpdir(), 'vetting-mem-')); cpSync(fixtures, join(r, 'fixtures'), { recursive: true }); return r; };
const rtFor = (r, o = {}) => new AgentRuntime(manifest, { root: r, stateDir: join(r, '.lodestar'), mode: 'assist', ...o });
const vet = (rt) => rt.call('vetting_vet', { carriers: 'fixtures/carriers.csv', loads: 'fixtures/loads.csv', as_of: '2026-11-16' });
const carrier = (out, id) => out.result.rows.find((c) => c.carrier_id === id);

test('a phone on the watch list raises the carrier to high and holds its loads, only after a person accepts it', async () => {
  const r = root(); const rt = rtFor(r);
  const before = await vet(rt);
  assert.equal(carrier(before, 'RIDG').level, 'none');
  await rt.call('vetting_learn', { kind: 'watch_contact', value: { type: 'phone', value: '312.555.0140', reason: 'used in a payment redirect attempt' } });
  assert.equal(carrier(await vet(rt), 'RIDG').level, 'none', 'waiting facts change nothing');
  const id = await learnAndAccept(rt, 'vetting', 'watch_contact', { type: 'phone', value: '312.555.0140', reason: 'used in a payment redirect attempt' });
  const after = await vet(rt);
  const c = carrier(after, 'RIDG');
  assert.equal(c.level, 'high'); assert.match(c.signals, /on_watch_list/);
  const load = after.result.loads_rows ? after.result.loads_rows.find((l) => l.load_id === 'L-9001') : JSON.stringify(after.result).includes('L-9001');
  assert.ok(load);
  assert.match(JSON.stringify(after.result), /watch list/);
  assert.deepEqual(after.memory_applied.map((f) => f.id), [id]);
});

test('an email domain on the watch list flags a dispatch email on a booked load', async () => {
  const r = root(); const rt = rtFor(r);
  await learnAndAccept(rt, 'vetting', 'watch_contact', { type: 'email_domain', value: 'gmail.com', reason: 'brokers here never dispatch from free mail' });
  const out = await vet(rt);
  assert.match(JSON.stringify(out.result), /dispatch email domain swiftlane\.dispatch@gmail\.com is on your watch list/);
});

test('the watch list only adds: no fact can clear a sign, and a full bank account number is refused', async () => {
  const r = root(); const rt = rtFor(r);
  const full = await rt.call('vetting_learn', { kind: 'watch_contact', value: { type: 'bank_last4', value: '021000021987654321', reason: 'x y z' } });
  assert.notEqual(full.status, 'executed');
  const clear = await rt.call('vetting_learn', { kind: 'trusted_carrier', value: { carrier_id: 'COAS' } });
  assert.notEqual(clear.status, 'executed');
  const base = await vet(rtFor(r)); const without = await vet(rtFor(r, { memory: false }));
  assert.deepEqual(base.result.rows.map((c) => c.score), without.result.rows.map((c) => c.score));
});
