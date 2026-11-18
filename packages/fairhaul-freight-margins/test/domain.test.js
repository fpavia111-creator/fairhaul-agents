// Freight recovery: parcel billing terms, cost sources, policy leaks and threshold what-ifs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { termsOf, freightMargins, termsText } from '../src/index.js';

const o = (id, extra = {}) => ({ order_id: id, customer: 'Acme', shipment_id: `S-${id}`, order_value: 500, freight_billed: 0, terms: 'Prepaid', ...extra });

test('parcel billing options read the right way round', () => {
  assert.deepEqual(['Bill Recipient', 'Bill Receiver', 'Bill Third Party', 'Bill Sender', 'Bill Shipper', 'Prepaid & Add'].map(termsOf), ['collect', 'collect', 'collect', 'prepaid', 'prepaid', 'prepaid_add']);
});

test('a cost on the order wins over the shipment cost file', () => {
  const r = freightMargins([o('1', { freight_cost: 40 })], [{ shipment_id: 'S-1', cost: 99 }]);
  assert.equal(r.rows[0].freight_cost, 40); assert.equal(r.rows[0].cost_basis, 'order');
});

test('free shipping below the threshold is a leak only on prepaid orders that were not charged', () => {
  const r = freightMargins([o('1', { order_value: 300, freight_cost: 30 }), o('2', { order_value: 300, freight_cost: 30, freight_billed: 15 }), o('3', { order_value: 1500, freight_cost: 30 }), o('4', { order_value: 300, freight_cost: 30, terms: 'Collect' })], [], { threshold: 1000 });
  assert.deepEqual(r.rows.map((x) => x.flags.includes('free_below_threshold')), [true, false, false, false]);
  assert.equal(r.free_below_threshold, 30); assert.equal(r.collect_but_we_paid, 30);
});

test('threshold what-ifs charge the average billed rate of paying orders, never of collect ones', () => {
  const orders = [o('1', { order_value: 1000, freight_billed: 50, freight_cost: 60, terms: 'Prepaid & Add' }), o('2', { order_value: 400, freight_cost: 30 }), o('3', { order_value: 800, freight_cost: 40 }), o('4', { order_value: 900, freight_billed: 900, freight_cost: 0, terms: 'Collect' })];
  const r = freightMargins(orders, [], { threshold: 500, alternatives: [1000] });
  assert.equal(r.billed_rate_pct, 5);
  assert.deepEqual(r.scenarios.map((s) => [s.threshold, s.orders_paying, s.extra_recovery_estimate]), [[500, 1, 20], [1000, 2, 60]]);
});

test('freight above the share of order value is flagged when it was not fully charged', () => {
  const r = freightMargins([o('1', { order_value: 100, freight_cost: 25 }), o('2', { order_value: 100, freight_cost: 25, freight_billed: 25 })], [], { maxFreightPct: 10 });
  assert.deepEqual(r.rows.map((x) => x.flags.includes('freight_over_pct')), [true, false]);
});

test('orders with no cost are listed but left out of the totals', () => {
  const r = freightMargins([o('1', { freight_cost: 50, freight_billed: 20 }), o('2', { shipment_id: '' })]);
  assert.deepEqual([r.orders, r.with_cost, r.freight_cost, r.gap], [2, 1, 50, -30]);
  assert.equal(r.rows[1].flags, 'no_cost');
});

test('the terms review shows the threshold table only when there is something to compare', () => {
  const orders = [o('1', { freight_cost: 50 }), o('2', { order_value: 2000, freight_cost: 80, freight_billed: 100, terms: 'Prepaid & Add' })];
  assert.doesNotMatch(termsText(freightMargins(orders, [], { threshold: 1000 })), /Free-shipping threshold, estimated/);
  const both = termsText(freightMargins(orders, [], { threshold: 1000, alternatives: [250] }));
  assert.match(both, /Free-shipping threshold, estimated/); assert.match(both, /\[TO DECIDE/);
});
