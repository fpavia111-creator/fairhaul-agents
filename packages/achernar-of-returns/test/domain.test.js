// Returns from authorisation to credit: the cases a returns desk argues about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackReturns, disputeText } from '../src/index.js';

const AS_OF = '2026-11-16';
const rma = (id, extra = {}) => ({ rma: id, customer: 'Acme', sku: 'SKU-1', units: 4, value: 100, reason: 'damaged', authorised_at: '2026-11-01', tracking: `T-${id}`, ...extra });

test('cancelled and void RMAs are left out of every count', () => {
  const r = trackReturns([rma('R1', { status: 'Cancelled' }), rma('R2', { status: 'VOID' }), rma('R3')], { asOf: AS_OF });
  assert.equal(r.rmas, 1); assert.equal(r.return_value, 100);
});

test('a credit with nothing received is money at risk, for the full credit', () => {
  const r = trackReturns([rma('R1')], { credits: [{ rma: 'r1', credit: 80 }], asOf: AS_OF });
  const f = r.items.find((x) => x.code === 'credited_not_received');
  assert.equal(f.amount, 80); assert.equal(r.credit_at_risk, 80); assert.equal(r.by_stage.credited_not_received, 1);
});

test('a full credit after half the units came back is over-credited by the missing half', () => {
  const r = trackReturns([rma('R1')], { receipts: [{ rma: 'R1', received_at: '2026-11-05', units_received: 2 }], credits: [{ rma: 'R1', credit: 100 }], asOf: AS_OF });
  assert.deepEqual(r.items.map((x) => [x.code, x.amount]).sort(), [['over_credited', 50], ['short_received', null]]);
  assert.equal(r.rmas_detail[0].stage, 'closed');
});

test('the credit clock waits for the grace days, then the owed credit is the received share', () => {
  const receipts = [{ rma: 'R1', received_at: '2026-11-12', units_received: 4 }];
  assert.equal(trackReturns([rma('R1')], { receipts, asOf: AS_OF, creditDays: 7 }).credits_owed, 0);
  const late = trackReturns([rma('R1')], { receipts, asOf: '2026-11-30', creditDays: 7 });
  assert.equal(late.credits_owed, 100);
  const part = trackReturns([rma('R1')], { receipts: [{ ...receipts[0], units_received: 1 }], asOf: '2026-11-30' });
  assert.equal(part.credits_owed, 25);
});

test('return freight billed twice and freight on a tracking with no RMA are both disputable', () => {
  const charges = [{ tracking: 'T-R1', carrier: 'Parcel Co', amount: 12.5, invoice_number: 'A' }, { tracking: 't-r1', carrier: 'Parcel Co', amount: 12.5, invoice_number: 'B' }, { tracking: 'T-STRAY', carrier: 'Parcel Co', amount: 9, invoice_number: 'C' }];
  const r = trackReturns([rma('R1')], { receipts: [{ rma: 'R1', received_at: '2026-11-03' }], credits: [{ rma: 'R1', credit: 100 }], charges, asOf: AS_OF });
  assert.equal(r.by_code.freight_billed_twice, 1); assert.equal(r.by_code.freight_without_rma, 1);
  assert.equal(r.freight_disputable, 21.5); assert.equal(r.return_freight, 34);
  const d = disputeText(r, 'parcel co', charges, { from: 'Returns desk' });
  assert.equal(d.count, 2); assert.equal(d.amount, 21.5); assert.match(d.text, /Billed twice/); assert.match(d.text, /No return authorised/);
  assert.equal(disputeText(r, 'Other Carrier', charges).count, 0);
});

test('an untouched label turns into label_unused only after the unused window', () => {
  assert.equal(trackReturns([rma('R1', { authorised_at: '2026-11-01' })], { asOf: AS_OF, unusedDays: 30 }).by_stage.awaiting_return, 1);
  const old = trackReturns([rma('R1', { authorised_at: '2026-09-01' })], { asOf: AS_OF, unusedDays: 30 });
  assert.equal(old.by_stage.label_unused, 1); assert.match(old.items[0].detail, /76 days ago/);
});

test('reasons are ranked by the freight spent on them, with freight as a share of value', () => {
  const r = trackReturns([rma('R1', { reason: 'changed mind', value: 50 }), rma('R2', { reason: 'damaged', value: 200 })], { charges: [{ tracking: 'T-R1', amount: 20 }, { tracking: 'T-R2', amount: 10 }], asOf: AS_OF });
  assert.deepEqual(r.by_reason.map((x) => [x.reason, x.freight, x.freight_pct_of_value]), [['changed mind', 20, 40], ['damaged', 10, 5]]);
});
