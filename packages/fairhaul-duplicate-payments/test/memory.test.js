import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairhaul-core';
import { manifest, findDuplicates } from '../src/index.js';
import { learnAndAccept } from '../../fairhaul-core/test/memory-flow.js';

const CSV = 'vendor,vendor_id,invoice_number,invoice_date,amount,paid_date,payment_ref,pro\n'
  + 'Ridgeline Freight,V100,INV-7710,2026-02-02,1250.00,2026-03-01,ACH-1,RF-7710\n'
  + 'Bluewater Factoring,V880,7710,2026-02-02,1250.00,2026-03-20,ACH-2,\n'
  + 'Prairie Express,V200,PX-100,2026-02-05,400.00,2026-03-02,ACH-3,\n';
const root = () => { const r = mkdtempSync(join(tmpdir(), 'duplicates-mem-')); writeFileSync(join(r, 'payments.csv'), CSV); return r; };
const rtFor = (r, o = {}) => new AgentRuntime(manifest, { root: r, stateDir: join(r, '.lodestar'), mode: 'assist', ...o });
const run = (rt) => rt.call('duplicates_scan', { payments: 'payments.csv', as_of: '2026-11-16' });

test('two vendor records a person confirmed are one carrier are searched as one vendor', async () => {
  const r = root(); const rt = rtFor(r);
  const tool = manifest.tools.find((t) => /_scan$|_find$|_search$/.test(t.name)).name;
  const call = () => rt.call(tool, { payments: 'payments.csv', as_of: '2026-11-16' });
  const before = await call();
  const groupsBefore = before.result.groups;
  const id = await learnAndAccept(rt, 'duplicates', 'same_vendor', { vendors: ['Ridgeline Freight', 'V880'], reason: 'Bluewater factors Ridgeline' });
  const after = await call();
  assert.ok(after.result.groups >= groupsBefore);
  assert.ok(after.result.to_recover_high + after.result.to_recover_medium >= 1250, JSON.stringify(after.result).slice(0, 400));
  assert.deepEqual(after.memory_applied.map((f) => f.id), [id]);
});

test('findDuplicates only widens with same-vendor groups: every group found without them is still found', () => {
  const rows = [
    { vendor: 'Ridgeline Freight', vendor_id: 'V100', invoice_number: 'INV-7710', invoice_date: '2026-02-02', amount: '1250', paid_date: '2026-03-01', pro: 'RF-7710' },
    { vendor: 'Ridgeline Freight', vendor_id: 'V100', invoice_number: '7710', invoice_date: '2026-02-02', amount: '1250', paid_date: '2026-03-21', pro: 'RF-7710' },
    { vendor: 'Rdg Frt', vendor_id: 'V101', invoice_number: 'R-1', invoice_date: '2026-04-02', amount: '310', paid_date: '2026-05-01', pro: 'RF-9' },
    { vendor: 'Ridgeline Freight', vendor_id: 'V100', invoice_number: 'R-2', invoice_date: '2026-04-02', amount: '310', paid_date: '2026-05-03', pro: 'RF-9' },
  ];
  const plain = findDuplicates(rows, { asOf: '2026-11-16' });
  const wide = findDuplicates(rows, { asOf: '2026-11-16', sameVendors: [{ id: 'MEM-x', vendors: ['Ridgeline Freight', 'Rdg Frt'] }] });
  assert.ok(wide.groups >= plain.groups);
  assert.ok(wide.items.some((g) => g.rule === 'same_pro' && g.invoice_numbers.join('/') === 'R-1/R-2'));
  assert.ok(!plain.items.some((g) => g.rule === 'same_pro'));
});

test('a same-vendor fact needs at least two vendors and a person to accept it', async () => {
  const rt = rtFor(root());
  const one = await rt.call('duplicates_learn', { kind: 'same_vendor', value: { vendors: ['Only One'] } });
  assert.notEqual(one.status, 'executed');
  const l = await rt.call('duplicates_learn', { kind: 'same_vendor', value: { vendors: ['A Co', 'B Co'] } });
  const p = await rt.call('duplicates_accept_learning', { id: l.result.fact.id, decision: 'accept' });
  assert.equal(p.status, 'needs_approval');
});
