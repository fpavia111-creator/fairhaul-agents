import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairhaul-core';
import { manifest, scanExceptions, trackClaims } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const f = { exceptions: 'exceptions.csv', claims: 'claims-log.csv', terms: 'terms.json', as_of: '2026-11-16' };
const ex = (o) => ({ shipment_id: 'S1', carrier: 'X', delivery_date: '2026-11-01', exception_type: 'damage', noted_on_pod: 'yes', goods_value: 500, ...o });

test('claim amount is goods plus freight less salvage; freight can be left out', () => {
  assert.equal(scanExceptions([ex({ freight_charge: 100, salvage_value: 50 })], [], {}, { asOf: '2026-11-16' }).items[0].amount, 550);
  assert.equal(scanExceptions([ex({ freight_charge: 100 })], [], { include_freight_charges: false }, { asOf: '2026-11-16' }).items[0].amount, 500);
});

test('deadline counts from delivery; one day left is file_now, one day late is expired', () => {
  const at = (d) => scanExceptions([ex({ delivery_date: d })], [], { filing_window_days: 10 }, { asOf: '2026-11-16' }).items[0];
  assert.equal(at('2026-11-07').status, 'file_now'); assert.equal(at('2026-11-07').days_left, 1);
  assert.equal(at('2026-11-05').status, 'expired');
});

test('the lower of the per-lb and per-shipment caps applies, and the letter shows it', () => {
  const terms = { carriers: { X: { liability_limit_per_lb: 2, liability_limit_per_shipment: 400 } } };
  const r = scanExceptions([ex({ weight: 100 })], [], terms, { asOf: '2026-11-16' }).items[0];
  assert.equal(r.amount, 200); assert.equal(r.capped_from, 500);
  assert.match(scanExceptions([ex({})], [], terms, { asOf: '2026-11-16' }).items[0].notes.join(' '), /add the weight/);
});

test('a fully paid claim is closed; a declined one stays open', () => {
  const r = trackClaims([{ claim_id: 'A', shipment_id: 'S', filed_on: '2026-01-01', amount: 100, paid_amount: 100 }, { claim_id: 'B', shipment_id: 'T', filed_on: '2026-11-01', amount: 80, status: 'Denied' }], {}, { asOf: '2026-11-16' });
  assert.equal(r.items[0].open, false); assert.equal(r.items[1].findings[0].code, 'declined'); assert.equal(r.outstanding, 80);
});

test('the report writes a deadline calendar with one event per claim to file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'claims-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false });
  const w = await rt.call('claims_write_report', f);
  assert.equal(w.status, 'executed', w.reason);
  const ics = readFileSync(w.result.files.find((x) => x.endsWith('.ics')), 'utf8');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.match(readFileSync(w.result.files.find((x) => x.endsWith('.csv')), 'utf8').split('\n')[1], /^L-2004/);
});

test('a changed claim draft cannot be approved, and open markers need a note', async () => {
  const root = mkdtempSync(join(tmpdir(), 'claims-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false, mode: 'auto', autoActions: ['claims_draft_claim'] });
  const d = await rt.call('claims_draft_claim', { ...f, shipment_id: 'L-2003', from: 'Fictional Co', contact: 'claims@coastal.example' });
  assert.equal(d.status, 'executed', d.reason); assert.equal(d.result.amount, 1000);
  assert.match(readFileSync(join(root, d.result.draft), 'utf8'), /liability limit \(from 1345\)/);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256 };
  const ask = await rt.call('claims_request_file', args); rt.approvals.approve(ask.approval_id, 'Tester');
  const open = await rt.call('claims_request_file', args);
  assert.equal(open.status, 'error'); assert.match(open.reason, /open markers/);
  writeFileSync(join(root, d.result.draft), readFileSync(join(root, d.result.draft), 'utf8') + '\nextra\n');
  const args2 = { ...args, accept_open_issues: true, note: 'ok' };
  const ask2 = await rt.call('claims_request_file', args2); rt.approvals.approve(ask2.approval_id, 'Tester');
  const changed = await rt.call('claims_request_file', args2);
  assert.equal(changed.status, 'error'); assert.match(changed.reason, /does not match/);
});
