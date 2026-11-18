// Proof of delivery: which POD counts, when to chase, what to hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPods, requestText } from '../src/index.js';

const AS_OF = '2026-11-16';
const load = (id, extra = {}) => ({ shipment_id: id, pro: `P-${id}`, carrier: 'Ridgeline Freight', delivery_date: '2026-11-10', pieces: 10, invoice_number: `INV-${id}`, invoice_amount: 1000, ...extra });
const pod = (id, extra = {}) => ({ pro: `P-${id}`, received_on: '2026-11-12', pod_delivery_date: '2026-11-10', signed_by: 'J. Smith', pieces_delivered: 10, exceptions: 'none', ...extra });

test('the most recently received POD is the one that counts', () => {
  const r = matchPods([load('A')], [pod('A', { received_on: '2026-11-11', signed_by: '' }), pod('A', { received_on: '2026-11-13' })], { asOf: AS_OF });
  assert.equal(r.items[0].status, 'ok'); assert.equal(r.items[0].pod_received, '2026-11-13');
});

test('a fresh delivery waits before anyone chases, but its invoice is still held', () => {
  const r = matchPods([load('A', { delivery_date: '2026-11-15' }), load('B', { delivery_date: '2026-11-15', invoice_number: '' })], [], { asOf: AS_OF, chaseAfterDays: 3 });
  assert.deepEqual(r.items.map((i) => [i.status, i.hold_invoice]), [['waiting', true], ['waiting', false]]);
  assert.equal(r.held_amount, 1000);
  assert.equal(matchPods([load('A', { delivery_date: '2026-11-10' })], [], { asOf: AS_OF, chaseAfterDays: 3 }).items[0].status, 'chase');
});

test('a date that differs from the invoice is a fix, not a reason to hold payment', () => {
  const r = matchPods([load('A', { invoice_delivery_date: '2026-11-09' })], [pod('A')], { asOf: AS_OF });
  assert.equal(r.items[0].status, 'fix'); assert.equal(r.items[0].hold_invoice, false);
  assert.match(r.items[0].issues[0].detail, /invoice says 2026-11-09/);
});

test('a short count with a receiver note goes to claim review and holds the invoice', () => {
  const r = matchPods([load('A')], [pod('A', { pieces_delivered: 8, exceptions: '2 cartons crushed' })], { asOf: AS_OF });
  assert.equal(r.items[0].status, 'claim_review'); assert.equal(r.items[0].hold_invoice, true);
  assert.deepEqual(r.items[0].issues.map((i) => i.code), ['short', 'exception_noted']);
});

test('a customer who requires a POD is named in the missing-POD note', () => {
  const r = matchPods([load('A', { pod_required: 'Y' })], [], { asOf: AS_OF });
  assert.match(r.items[0].issues[0].detail, /customer requires a POD/);
});

test('carrier POD rates leave out loads still in their wait period, worst carrier first', () => {
  const loads = [load('A'), load('B'), load('C', { carrier: 'Prairie Express' }), load('D', { carrier: 'Prairie Express', delivery_date: '2026-11-16' })];
  const r = matchPods(loads, [pod('A', { received_on: '2026-11-14' }), pod('C')], { asOf: AS_OF });
  assert.deepEqual(r.carriers.map((c) => [c.carrier, c.pod_pct, c.avg_days_to_pod, c.missing]), [['Ridgeline Freight', 50, 4, 1], ['Prairie Express', 100, 2, 0]]);
});

test('the request asks only for missing and unsigned PODs, and says the invoices wait', () => {
  const r = matchPods([load('A'), load('B'), load('C')], [pod('B', { signed_by: 'unsigned' }), pod('C', { pieces_delivered: 1 })], { asOf: AS_OF });
  const text = requestText(r.items, { from: 'AP team' });
  assert.match(text, /\| A \|.*Signed POD/); assert.match(text, /\| B \|.*receiver signature/); assert.doesNotMatch(text, /\| C \|/);
  assert.match(text, /hold the matching invoices/);
});
