import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settle } from '../src/index.js';

const rc = (o) => ({ load_id: 'L1', carrier: 'Acme Haul', rate: 1000, pod: true, ...o });
const inv = (o) => ({ load_id: 'l1', invoice_number: 'I1', amount: 1000, received_at: '2026-11-01', ...o });

test('pay is capped at the rate confirmation even when the invoice is higher', () => {
  const r = settle([rc()], { invoices: [inv({ amount: 1200 })], asOf: '2026-11-05' });
  assert.equal(r.rows[0].to_pay, 1000); assert.equal(r.held_back, 200);
});

test('a notice of assignment moves payment to the factor until it is released', () => {
  const noas = [{ carrier: 'ACME HAUL', factor: 'Factor Co', effective: '2026-01-01', released: '2026-10-15' }];
  assert.equal(settle([rc()], { invoices: [inv({ received_at: '2026-10-01' })], noas, asOf: '2026-10-05' }).rows[0].pay_to, 'Factor Co');
  assert.equal(settle([rc()], { invoices: [inv()], noas, asOf: '2026-11-05' }).rows[0].pay_to, 'Acme Haul');
});

test('no POD holds the load out of the batch', () => {
  const r = settle([rc({ pod: false })], { invoices: [inv()], asOf: '2026-11-05' });
  assert.equal(r.rows[0].status, 'hold_no_pod'); assert.equal(r.batch_loads, 0);
});
