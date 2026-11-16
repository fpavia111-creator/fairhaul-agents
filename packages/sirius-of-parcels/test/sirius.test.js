import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'lodestar-core';
import { manifest, packagesFrom, auditParcels } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const pk = (over) => packagesFrom([{ tracking: 'T1', invoice_number: 'I1', invoice_date: '2026-11-01', carrier: 'UPS', service: 'UPS Ground', promised_at: '2026-11-03T23:59:00', delivered_at: '2026-11-03T10:00:00', charge_description: 'Transportation', charge_amount: '10', ...over }]);

test('on time is clean, late on a guaranteed service is refundable', () => {
  assert.equal(auditParcels(pk(), { asOf: '2026-11-05' }).items[0].status, 'ok');
  const late = auditParcels(pk({ delivered_at: '2026-11-04T09:00:00' }), { asOf: '2026-11-05' }).items[0];
  assert.equal(late.status, 'claim'); assert.equal(late.refundable, 10); assert.equal(late.claim_by, '2026-11-16');
});

test('grace minutes and closed windows', () => {
  const p = pk({ promised_at: '2026-11-03T10:30:00', delivered_at: '2026-11-03T10:40:00' });
  assert.equal(auditParcels(p, { terms: { late_grace_minutes: 15 }, asOf: '2026-11-05' }).items[0].status, 'ok');
  assert.equal(auditParcels(p, { asOf: '2026-12-30' }).items[0].status, 'window_closed');
});

test('dimensional weight: billed at the right weight is clean', () => {
  const p = pk({ actual_weight: 9, billed_weight: 14, length: 16, width: 12, height: 10 });
  assert.equal(auditParcels(p, { asOf: '2026-11-05' }).items[0].status, 'ok');
  assert.equal(auditParcels(p, { terms: { dim_divisor: 166 }, asOf: '2026-11-05' }).items[0].findings[0].code, 'dim_overbilled');
});

test('report writes CSV, HTML and a calendar with reminders', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sirius-')); cpSync(fixtures, root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('sirius_write_report', { invoices: 'parcel-invoices.csv', terms: 'terms.json', as_of: '2026-11-16' });
  assert.equal(r.status, 'executed', r.reason);
  const ics = readFileSync(r.result.files[2], 'utf8');
  assert.match(ics, /Parcel refund requests due: UPS/); assert.match(ics, /TRIGGER:-P2D/);
});

test('the refund request lists only packages inside the window', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sirius-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false, mode: 'auto', autoActions: ['sirius_draft_refund_request'] });
  const d = await rt.call('sirius_draft_refund_request', { invoices: 'parcel-invoices.csv', terms: 'terms.json', voids: 'voids.csv', as_of: '2026-11-16', carrier: 'UPS' });
  assert.equal(d.status, 'executed', d.reason); assert.equal(d.result.tracking.length, 5); assert.equal(d.result.amount, 85.93);
  const fx = await rt.call('sirius_draft_refund_request', { invoices: 'parcel-invoices.csv', as_of: '2026-11-16', carrier: 'FedEx' });
  assert.equal(fx.status, 'error'); assert.match(fx.reason, /inside the claim window/);
});
