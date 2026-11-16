import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPods } from '../src/index.js';

const load = (o) => ({ shipment_id: 'S1', pro: 'P1', carrier: 'A', delivery_date: '2026-11-01', pieces: 5, invoice_number: 'I1', invoice_amount: 100, ...o });
const pod = (o) => ({ pro: 'P1', received_on: '2026-11-02', pod_delivery_date: '2026-11-01', signed_by: 'X', pieces_delivered: 5, exceptions: 'none', ...o });

test('a clean, signed POD with matching date and pieces is ok and not held', () => {
  const i = matchPods([load({})], [pod({})], { asOf: '2026-11-10' }).items[0];
  assert.equal(i.status, 'ok'); assert.equal(i.hold_invoice, false);
});

test('a POD matches by shipment id when the PRO is missing', () => {
  assert.equal(matchPods([load({})], [pod({ pro: '', shipment_id: 's1' })], { asOf: '2026-11-10' }).items[0].status, 'ok');
});

test('"N/A" and "clean" exceptions are not exceptions; real notes go to claim review', () => {
  assert.equal(matchPods([load({})], [pod({ exceptions: 'N/A' })]).items[0].status, 'ok');
  assert.equal(matchPods([load({})], [pod({ exceptions: 'wet pallet' })]).items[0].status, 'claim_review');
});

test('a load not delivered and not invoiced needs nothing', () => {
  const i = matchPods([load({ delivery_date: '', invoice_number: '' })], []).items[0];
  assert.equal(i.status, 'ok'); assert.equal(i.issues.length, 0);
});
