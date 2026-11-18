// Broker carrier pay: what is owed, to whom, and when.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settle, batchText } from '../src/index.js';

const AS_OF = '2026-11-16';
const rc = (id, extra = {}) => ({ load_id: id, carrier: 'Summit Carriers', rate: 1000, accessorials: 0, pod: 'yes', pay_terms_days: 30, ...extra });
const inv = (id, amount, extra = {}) => ({ load_id: id, carrier: 'Summit Carriers', invoice_number: `S-${id}`, amount, received_at: '2026-11-10', ...extra });

test('a notice that took effect after the invoice arrived still moves this batch to the factor', () => {
  const r = settle([rc('L1')], { invoices: [inv('L1', 1000)], noas: [{ carrier: 'Summit Carriers', factor: 'Apex Factoring', effective: '2026-11-12' }], asOf: AS_OF });
  assert.equal(r.rows[0].pay_to, 'Apex Factoring'); assert.deepEqual(r.batch_by_payee.map((p) => p.pay_to), ['Apex Factoring']);
});

test('a payment to the carrier is judged by the notice in force on the day it was paid', () => {
  const noas = [{ carrier: 'Summit Carriers', factor: 'Apex Factoring', effective: '2026-11-12' }];
  const before = settle([rc('L1')], { invoices: [inv('L1', 1000)], payments: [{ load_id: 'L1', payee: 'Summit Carriers', amount: 1000, paid_at: '2026-11-11' }], noas, asOf: AS_OF });
  assert.equal(before.by_code.paid_wrong_party, undefined);
  const after = settle([rc('L1')], { invoices: [inv('L1', 1000)], payments: [{ load_id: 'L1', payee: 'Summit Carriers', amount: 1000, paid_at: '2026-11-13' }], noas, asOf: AS_OF });
  assert.equal(after.wrong_party_exposure, 1000); assert.match(after.items[0].detail, /in force then directs payment to Apex Factoring/);
});

test('quick pay nets the fee, shortens terms to two days and pays a lower invoice as billed', () => {
  const r = settle([rc('L1', { quick_pay: 'yes' }), rc('L2')], { invoices: [inv('L1', 1000, { received_at: '2026-11-15' }), inv('L2', 900)], asOf: AS_OF });
  const [a, b] = r.rows;
  assert.deepEqual([a.owed, a.due, a.to_pay, a.status], [970, '2026-11-17', 970, 'ready']);
  assert.deepEqual([b.to_pay, b.due], [900, '2026-12-10']);
});

test('an invoice received long ago and unpaid is past due, counted at the capped amount', () => {
  const r = settle([rc('L1', { pay_terms_days: 15 })], { invoices: [inv('L1', 1200, { received_at: '2026-10-01' })], asOf: AS_OF });
  assert.equal(r.rows[0].status, 'past_due'); assert.equal(r.past_due, 1000); assert.equal(r.held_back, 200);
  assert.match(r.items.find((f) => f.code === 'past_due').detail, /due 2026-10-16 on net 15; 31 days late/);
});

test('two payments for one load are recoverable above what was owed', () => {
  const r = settle([rc('L1')], { invoices: [inv('L1', 1000)], payments: [{ load_id: 'L1', payee: 'Summit Carriers', amount: 1000 }, { load_id: 'L1', payee: 'Summit Carriers', amount: 1000 }], asOf: AS_OF });
  assert.equal(r.recoverable, 1000); assert.equal(r.rows[0].status, 'paid'); assert.equal(r.batch_loads, 0);
});

test('an invoice or payment for a load with no rate confirmation is reported, and the payment counted', () => {
  const r = settle([rc('L1')], { invoices: [inv('L9', 400)], payments: [{ load_id: 'L8', payee: 'Ghost Freight', amount: 650 }], asOf: AS_OF });
  assert.deepEqual(Object.keys(r.by_code).sort(), ['invoice_without_ratecon', 'payment_without_ratecon']);
  assert.equal(r.rows[0].status, 'awaiting_invoice');
});

test('the batch note lists holds, capped invoices and earlier payments to check', () => {
  const r = settle([rc('L1'), rc('L2', { pod: 'no' }), rc('L3')], { invoices: [inv('L1', 1100), inv('L2', 1000), inv('L3', 1000)], payments: [{ load_id: 'L3', payee: 'Someone Else', amount: 1000 }], asOf: AS_OF });
  const text = batchText(r, { pay_date: '2026-11-18' });
  assert.match(text, /# Carrier payment batch, 2026-11-18/); assert.match(text, /Held for proof of delivery: L2/);
  assert.match(text, /L1: Invoice S-L1 is 1100/); assert.match(text, /L3: Paid 1000 to Someone Else/);
  assert.match(text, /\| Summit Carriers \| L1 \| 1000 \|/);
});

test('a notice written under the carrier\'s full legal name still binds a load booked under its short name', () => {
  const noas = [{ carrier: 'Summit Carriers Freight Lines LLC', factor: 'Apex Factoring, Inc.', effective: '2026-10-01' }];
  const r = settle([rc('L1', { carrier: 'Summit Carriers' })], { invoices: [inv('L1', 1000)], payments: [{ load_id: 'L1', amount: 1000, payee: 'Apex Factoring', paid_at: '2026-11-12' }], noas, asOf: AS_OF });
  assert.equal(r.rows[0].pay_to, 'Apex Factoring, Inc.');
  assert.equal(r.items.filter((f) => f.code === 'paid_wrong_party').length, 0, 'paying the factor under its short name is right');
  const wrong = settle([rc('L1')], { invoices: [inv('L1', 1000)], payments: [{ load_id: 'L1', amount: 1000, payee: 'Summit Carriers', paid_at: '2026-11-12' }], noas, asOf: AS_OF });
  assert.equal(wrong.items.filter((f) => f.code === 'paid_wrong_party').length, 1);
});
