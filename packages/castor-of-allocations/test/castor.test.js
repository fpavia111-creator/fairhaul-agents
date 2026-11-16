import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'lodestar-core';
import { manifest, allocate, journalLines } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const f = { costs: 'freight-costs.csv', order_lines: 'order-lines.csv' };

test('every cent of a shipment lands on its lines', () => {
  const r = allocate([{ shipment_id: 'A', cost: 100 }], [1, 1, 1].map((w, i) => ({ shipment_id: 'A', order_id: `O${i}`, weight: w })));
  assert.deepEqual(r.allocations.map((x) => x.freight), [33.33, 33.33, 33.34]);
  assert.equal(r.allocated, 100); assert.equal(r.unallocated, 0);
});

test('no measure at all falls back to equal shares and says so', () => {
  const r = allocate([{ shipment_id: 'A', cost: 50 }], [{ shipment_id: 'A', order_id: '1' }, { shipment_id: 'A', order_id: '2' }]);
  assert.deepEqual(r.allocations.map((x) => x.freight), [25, 25]);
  assert.match(r.problems[0].problem, /equal shares/);
});

test('the journal balances', () => {
  const r = allocate([{ shipment_id: 'A', cost: 100.01 }], [{ shipment_id: 'A', order_id: '1', weight: 1, cost_center: 'C1' }, { shipment_id: 'A', order_id: '2', weight: 2, cost_center: 'C2' }]);
  const j = journalLines(r);
  const dr = j.reduce((s, l) => s + (Number(l.debit) || 0), 0), cr = j.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  assert.equal(Math.round(dr * 100), Math.round(cr * 100)); assert.equal(cr, 100.01);
});

test('a changed journal cannot be approved', async () => {
  const root = mkdtempSync(join(tmpdir(), 'castor-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false });
  const w = await rt.call('castor_write_report', { ...f, journal_date: '2026-10-31' });
  assert.equal(w.status, 'executed', w.reason);
  writeFileSync(join(root, w.result.journal), readFileSync(join(root, w.result.journal), 'utf8') + '2026-10-31,6150,X,1,,sneaky\n');
  const args = { journal: w.result.journal, journal_sha256: w.result.journal_sha256 };
  const ask = await rt.call('castor_request_post', args); rt.approvals.approve(ask.approval_id, 'Tester');
  const r = await rt.call('castor_request_post', args);
  assert.equal(r.status, 'error'); assert.match(r.reason, /does not match/);
});
