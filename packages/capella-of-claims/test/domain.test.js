// Freight claims: carrier terms, what is not a claim, concealed damage and chasing filed claims.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanExceptions, trackClaims, claimText } from '../src/index.js';

const AS_OF = '2026-11-16';
const ex = (id, extra = {}) => ({ shipment_id: id, pro: `P-${id}`, carrier: 'Ridgeline Freight, Inc.', exception_type: 'Damaged', delivery_date: '2026-10-01', goods_value: 1000, freight_charge: 200, noted_on_pod: 'yes', ...extra });

test('carrier terms are found whatever the legal suffix or case of the carrier name', () => {
  const r = scanExceptions([ex('S1')], [], { carriers: { 'RIDGELINE FREIGHT': { filing_window_days: 60, liability_limit_per_shipment: 500 } } }, { asOf: AS_OF });
  assert.equal(r.items[0].deadline, '2026-11-30'); assert.equal(r.items[0].amount, 500); assert.equal(r.items[0].capped_from, 1200);
});

test('an overage is not a claim and has no deadline', () => {
  const r = scanExceptions([ex('S1', { exception_type: 'Overage' })], [], {}, { asOf: AS_OF });
  assert.deepEqual([r.items[0].status, r.items[0].deadline, r.to_file], ['not_a_claim', null, 0]);
});

test('a claim below the minimum is listed but not proposed', () => {
  const r = scanExceptions([ex('S1', { goods_value: 40, freight_charge: 0 })], [], { min_claim_amount: 50 }, { asOf: AS_OF });
  assert.equal(r.items[0].status, 'below_minimum'); assert.equal(r.claimable, 0);
});

test('concealed damage found after the report window gets a warning; within it, a plain note', () => {
  const late = scanExceptions([ex('S1', { exception_type: 'Concealed damage', found_on: '2026-10-09' })], [], {}, { asOf: AS_OF });
  assert.match(late.items[0].notes[0], /8 day\(s\) after delivery, later than the 5 days/);
  const soon = scanExceptions([ex('S1', { exception_type: 'Concealed damage', found_on: '2026-10-03' })], [], {}, { asOf: AS_OF });
  assert.equal(soon.items[0].notes[0], 'Concealed damage found 2 day(s) after delivery.');
});

test('damage on a POD signed clean warns that the carrier will dispute it', () => {
  const r = scanExceptions([ex('S1', { noted_on_pod: 'no' })], [], {}, { asOf: AS_OF });
  assert.match(r.items[0].notes[0], /signed clean/); assert.equal(r.items[0].status, 'file');
});

test('filed claims: overdue acknowledgement, overdue resolution, short pay, and a withdrawn claim is not chased', () => {
  const r = trackClaims([
    { claim_id: 'C1', shipment_id: 'S1', carrier: 'A', filed_on: '2026-09-01', amount: 900 },
    { claim_id: 'C2', shipment_id: 'S2', carrier: 'A', filed_on: '2026-06-01', amount: 500, acknowledged_on: '2026-06-10' },
    { claim_id: 'C3', shipment_id: 'S3', carrier: 'A', filed_on: '2026-08-01', amount: 400, paid_amount: 300, paid_on: '2026-10-01' },
    { claim_id: 'C4', shipment_id: 'S4', carrier: 'A', filed_on: '2026-05-01', amount: 200, status: 'Withdrawn' },
  ], {}, { asOf: AS_OF });
  assert.deepEqual(r.items.map((i) => i.findings.map((f) => f.code)), [['ack_overdue'], ['resolution_overdue'], ['short_paid'], []]);
  assert.deepEqual(r.items.map((i) => i.outstanding), [900, 500, 100, 0]);
  assert.equal(r.outstanding, 1500); assert.equal(r.recovered, 300);
});

test('the claim letter shows salvage, leaves out freight when excluded, and asks for a description', () => {
  const r = scanExceptions([ex('S1', { salvage_value: 150 })], [], { include_freight_charges: false }, { asOf: AS_OF });
  const text = claimText(r.items[0], { reference: 'CLM-77' });
  assert.match(text, /\| Less salvage \| -150 \|/); assert.doesNotMatch(text, /Freight charges/); assert.match(text, /\*\*Total claimed\*\* \| \*\*850\*\*/);
  assert.match(text, /\[TO CONFIRM what was lost or damaged and how\]/); assert.match(text, /Our reference:\*\* CLM-77/);
});
