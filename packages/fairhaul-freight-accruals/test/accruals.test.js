import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairhaul-core';
import { manifest, buildAccrual, journalLines } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const f = { shipments: 'shipments.csv', invoices: 'invoices.csv', period_end: '2026-10-31', contract: 'contract.json' };

test('the journal balances', () => {
  const r = buildAccrual([{ shipment_id: 'A', carrier: 'X', ship_date: '2026-10-01', quoted_amount: 100, cost_center: 'C1' }, { shipment_id: 'B', carrier: 'X', ship_date: '2026-10-02', quoted_amount: 50.25, cost_center: 'C2' }], [], { periodEnd: '2026-10-31' });
  const j = journalLines(r);
  const dr = j.reduce((s, l) => s + (Number(l.debit) || 0), 0), cr = j.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  assert.equal(Math.round(dr * 100), Math.round(cr * 100)); assert.equal(cr, 150.25);
});

test('an invoice dated inside the period stops the accrual; one dated after gives the amount', () => {
  const s = [{ shipment_id: 'A', pro: 'P1', carrier: 'X', ship_date: '2026-10-10' }];
  const inv = (d) => [{ invoice_number: 'I', carrier: 'X', pro: 'P1', invoice_date: d, total: 99, origin: {}, destination: {} }];
  assert.equal(buildAccrual(s, inv('2026-10-30'), { periodEnd: '2026-10-31' }).accrued, 0);
  const late = buildAccrual(s, inv('2026-11-03'), { periodEnd: '2026-10-31' });
  assert.equal(late.lines[0].amount, 99); assert.equal(late.lines[0].basis, 'invoice_after_period_end');
});

test('a changed journal cannot be approved', async () => {
  const root = mkdtempSync(join(tmpdir(), 'accruals-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false });
  const w = await rt.call('accruals_write_report', f);
  assert.equal(w.status, 'executed', w.reason);
  writeFileSync(join(root, w.result.journal), readFileSync(join(root, w.result.journal), 'utf8') + '2026-10-31,6100,X,1,,sneaky\n');
  const args = { journal: w.result.journal, journal_sha256: w.result.journal_sha256 };
  const ask = await rt.call('accruals_request_post', args); rt.approvals.approve(ask.approval_id, 'Tester');
  const r = await rt.call('accruals_request_post', args);
  assert.equal(r.status, 'error'); assert.match(r.reason, /does not match/);
});
