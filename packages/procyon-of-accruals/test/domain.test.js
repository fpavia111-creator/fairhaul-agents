// Month-end accrual: later bills, the order of estimates, what is skipped, age and last period.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccrual } from '../src/index.js';

const PE = '2026-10-31';
const ship = (id, extra = {}) => ({ shipment_id: id, pro: `P-${id}`, carrier: 'Ridgeline', ship_date: '2026-10-20', origin_state: 'IL', origin_postal: '60607', dest_state: 'TX', dest_postal: '75201', cost_center: 'CC-1', ...extra });
const inv = (n, pro, total, date, extra = {}) => ({ invoice_number: n, carrier: 'Ridgeline', pro, invoice_date: date, total, origin: { state: 'IL', postal: '60607' }, destination: { state: 'TX', postal: '75201' }, ...extra });

test('a bill dated after month end for a shipment already billed in the month is still accrued', () => {
  const r = buildAccrual([ship('A')], [inv('I1', 'P-A', 900, '2026-10-25'), inv('I2', 'P-A', 75, '2026-11-04')], { periodEnd: PE });
  assert.deepEqual(r.lines.map((l) => [l.shipment_id, l.amount, l.basis]), [['A', 75, 'later_invoice_after_one_in_period']]);
  assert.equal(r.shipments_in_period, 1); assert.equal(r.billed_in_period, 1);
});

test('estimates use the quote, then the lane average of two bills, then the carrier average of three', () => {
  const hist = [inv('H1', 'X1', 100, '2026-09-01'), inv('H2', 'X2', 200, '2026-09-02'), inv('H3', 'X3', 600, '2026-09-03', { destination: { state: 'GA', postal: '30301' } })];
  const r = buildAccrual([ship('Q', { quoted_amount: 333 }), ship('L'), ship('C', { dest_state: 'OH', dest_postal: '43004' }), ship('N', { carrier: 'Unknown Co' })], hist, { periodEnd: PE });
  assert.deepEqual(r.lines.map((l) => [l.shipment_id, l.amount, l.basis]), [['Q', 333, 'quote'], ['L', 150, 'lane_average_of_2'], ['C', 300, 'carrier_average_of_3'], ['N', null, 'no_estimate']]);
  assert.equal(r.without_estimate, 1); assert.deepEqual(r.by_basis, { quote: 1, lane_average: 1, carrier_average: 1, no_estimate: 1 });
});

test('cancelled, unshipped and next-month shipments are skipped and counted', () => {
  const r = buildAccrual([ship('A', { status: 'Cancelled' }), ship('B', { ship_date: '' }), ship('C', { ship_date: '2026-11-01' }), ship('D', { quoted_amount: 10 })], [], { periodEnd: PE });
  assert.deepEqual(r.skipped, { not_shipped: 1, after_period: 1, cancelled: 1 }); assert.equal(r.accrued, 1);
});

test('shipments unbilled for more than 60 days are counted as aged', () => {
  const r = buildAccrual([ship('OLD', { ship_date: '2026-08-15', quoted_amount: 10 }), ship('NEW', { quoted_amount: 10 })], [], { periodEnd: PE });
  assert.equal(r.over_60_days, 1); assert.equal(r.lines.find((l) => l.shipment_id === 'OLD').age_days, 77);
});

test('last period\'s accrual is measured against what was billed since', () => {
  const r = buildAccrual([], [inv('I1', 'S1', 110, '2026-10-05', { shipment_id: 'S1' }), inv('I2', 'S2', 180, '2026-10-06', { shipment_id: 'S2' })], { periodEnd: PE, prior: [{ shipment_id: 'S1', amount: 100 }, { shipment_id: 'S2', amount: 200 }, { shipment_id: 'S3', amount: 50 }] });
  assert.deepEqual(r.reversals.map((x) => [x.shipment_id, x.status, x.variance]), [['s1', 'billed', 10], ['s2', 'billed', -20], ['s3', 'still_unbilled', null]]);
  assert.deepEqual(r.accuracy, { shipments: 2, accrued: 300, actual: 290, variance: -10, mean_abs_error_pct: 10 });
});

test('a period end that is not a date stops the run with a clear message', () => {
  assert.throws(() => buildAccrual([], [], { periodEnd: 'end of October' }), /period_end must be a date/);
});
