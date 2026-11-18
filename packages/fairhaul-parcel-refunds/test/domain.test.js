// Parcel audit: guarantees, duplicates, voids, addresses, dimensional weight and the refund request.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packagesFrom, auditParcels, refundText } from '../src/index.js';

const line = (over = {}) => ({ tracking: 'T1', invoice_number: 'I1', invoice_date: '2026-11-01', carrier: 'UPS', service: 'UPS Ground', promised_at: '2026-11-03', delivered_at: '2026-11-03T16:00:00', charge_description: 'Transportation', charge_amount: '10', ...over });
const audit = (rows, opts = {}) => auditParcels(packagesFrom(rows), { asOf: '2026-11-05', ...opts });
const codes = (i) => i.findings.map((f) => f.code);

test('a commitment with no time means by the end of that day, so an afternoon delivery is on time', () => {
  assert.equal(audit([line()]).items[0].status, 'ok');
  const late = audit([line({ delivered_at: '2026-11-04T09:00:00' })]).items[0];
  assert.deepEqual(codes(late), ['late_delivery']); assert.equal(late.refundable, 10);
  assert.equal(audit([line({ promised_at: '2026-11-03T10:30:00', delivered_at: '2026-11-03' })]).items[0].status, 'ok');
});

test('economy services are not guaranteed even though their names contain a guaranteed one', () => {
  const r = audit([line({ service: 'UPS Ground Saver', delivered_at: '2026-11-05' }), line({ tracking: 'T2', service: 'FedEx Ground Economy', delivered_at: '2026-11-05' })]);
  assert.deepEqual(r.items.map((i) => codes(i)), [['late_no_guarantee'], ['late_no_guarantee']]);
  assert.equal(r.refundable_open, 0);
  assert.deepEqual(codes(audit([line({ service: 'UPS Ground Saver', delivered_at: '2026-11-05' })], { terms: { guaranteed_services: ['ground saver'] } }).items[0]), ['late_delivery']);
  assert.deepEqual(codes(audit([line({ delivered_at: '2026-11-05' })], { terms: { guarantee_waived: true } }).items[0]), ['late_no_guarantee']);
});

test('a label billed again with transportation is a duplicate; a later adjustment-only invoice is not', () => {
  const again = audit([line(), line({ invoice_number: 'I2', invoice_date: '2026-11-04' })]);
  assert.deepEqual(codes(again.items[1]), ['duplicate_tracking']); assert.equal(again.items[1].refundable, 10);
  const adj = audit([line(), line({ invoice_number: 'I2', invoice_date: '2026-11-04', charge_description: 'Residential Surcharge', charge_amount: '5.85' })]);
  assert.deepEqual(codes(adj.items[1]), []);
});

test('a voided label that was billed and a residential charge on a business address are both refundable', () => {
  const r = audit([line({ recipient_address: '100 Example Pkwy, Springfield' }), line({ recipient_address: '100 Example Pkwy, Springfield', charge_description: 'Residential Surcharge', charge_amount: '5.85' }), line({ tracking: 'V1' })], { voids: [{ tracking: 'V1' }], terms: { commercial_addresses: ['100 example parkway springfield'] } });
  const by = Object.fromEntries(r.items.map((i) => [i.tracking, i]));
  assert.deepEqual(by.T1.findings.map((f) => [f.code, f.amount]), [['residential_on_business', 5.85]]);
  assert.deepEqual(codes(by.V1), ['voided_label_billed']); assert.equal(r.refundable_open, 15.85);
});

test('dimensional weight is only disputed when your own dimensions are on file', () => {
  const noDims = audit([line({ actual_weight: 9, billed_weight: 22 })]).items[0];
  assert.deepEqual(noDims.findings.map((f) => [f.code, f.amount]), [['dim_unverified', null]]); assert.equal(noDims.status, 'review');
  const dims = audit([line({ actual_weight: 9, billed_weight: 22, length: 16, width: 12, height: 10 })]).items[0];
  assert.equal(dims.findings[0].code, 'dim_overbilled'); assert.equal(dims.findings[0].amount, 3.64);
});

test('a repeated address correction points at the address book; a package with no delivery scan is chased', () => {
  const r = audit([line({ recipient_address: '9 Example Ave', charge_description: 'Address Correction', charge_amount: '23.75' }), line({ tracking: 'T2', recipient_address: '9 Example Ave', charge_description: 'Address Correction', charge_amount: '23.75' }), line({ tracking: 'T3', ship_date: '2026-10-20', promised_at: '2026-10-22', delivered_at: '' })], { asOf: '2026-11-05' });
  assert.match(r.items[1].findings[0].detail, /again for 9 Example Ave \(also on T1\)/);
  assert.deepEqual(codes(r.items[2]), ['missing_delivery_scan']);
});

test('the refund request lists only open claims, totals them and leaves the contact to confirm', () => {
  const r = audit([line({ delivered_at: '2026-11-04' }), line({ tracking: 'OLD', invoice_date: '2026-10-01', promised_at: '2026-09-29', delivered_at: '2026-09-30' })]);
  assert.deepEqual(r.items.map((i) => i.status), ['claim', 'window_closed']); assert.equal(r.refundable_lost, 10);
  const d = refundText(r.items, { carrier: 'UPS', from: 'Shipping team' });
  assert.equal(d.total, 10); assert.deepEqual(d.tracking, ['T1']);
  assert.match(d.text, /\[TO CONFIRM UPS billing adjustments contact or portal\]/); assert.match(d.text, /\[TO CONFIRM shipper account number\]/); assert.doesNotMatch(d.text, /OLD/);
});
