// Freight allocation: fallbacks, several bills per shipment, credits and the journal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, journalLines } from '../src/index.js';

const line = (sid, order, extra = {}) => ({ shipment_id: sid, order_id: order, customer: 'Acme', sku: 'SKU-1', units: 10, weight: 100, cube: 10, value: 1000, cost_center: 'CC-1', ...extra });
const sum = (rows, k) => Math.round(rows.reduce((a, x) => a + (Number(x[k]) || 0), 0) * 100) / 100;

test('when one line has no weight the split falls back to cube, and the report says so', () => {
  const r = allocate([{ shipment_id: 'S1', cost: 300 }], [line('S1', 'O1', { weight: 0, cube: 20 }), line('S1', 'O2', { cube: 10 })]);
  assert.deepEqual(r.allocations.map((a) => [a.basis, a.freight]), [['cube', 200], ['cube', 100]]);
  assert.match(r.problems[0].problem, /not every line has weight; split by cube instead/);
});

test('two bills on one shipment are each split, and nothing is lost to rounding', () => {
  const r = allocate([{ shipment_id: 'S1', cost: 100, invoice_number: 'A' }, { shipment_id: 'S1', cost: 10.01, invoice_number: 'B' }], [line('S1', 'O1'), line('S1', 'O2'), line('S1', 'O3')]);
  assert.equal(r.allocated, 110.01); assert.equal(r.unallocated, 0);
  assert.deepEqual(r.allocations.filter((a) => a.invoice_number === 'A').map((a) => a.freight), [33.33, 33.33, 33.34]);
});

test('a credit note reverses on the other side of the journal, which still balances', () => {
  const r = allocate([{ shipment_id: 'S1', cost: 500 }, { shipment_id: 'S2', cost: -80 }], [line('S1', 'O1'), line('S2', 'O2', { cost_center: 'CC-2' })]);
  const j = journalLines(r, { clearing: '2100', date: '2026-10-31' });
  assert.deepEqual(j.map((x) => [x.account, x.cost_center, x.debit, x.credit]), [['freight_out', 'CC-1', 500, ''], ['freight_out', 'CC-2', '', 80], ['2100', '', '', 420]]);
  assert.equal(sum(j, 'debit'), sum(j, 'credit'));
  assert.ok(j.every((x) => x.debit === '' || x.debit >= 0));
});

test('a shipment with no order lines stays unallocated and is reported', () => {
  const r = allocate([{ shipment_id: 'S9', cost: 75 }], [line('S1', 'O1')]);
  assert.equal(r.unallocated, 75); assert.match(r.problems[0].problem, /no order lines/);
  assert.deepEqual(journalLines(r), []);
});

test('per-unit freight by SKU and freight as a share of sales by customer', () => {
  const r = allocate([{ shipment_id: 'S1', cost: 200 }], [line('S1', 'O1', { sku: 'A', units: 4, value: 400 }), line('S1', 'O2', { sku: 'B', customer: 'Beta', units: 20, value: 2000 })], { basis: 'units' });
  assert.deepEqual(r.by_sku.map((x) => [x.sku, x.freight, x.per_unit]), [['B', 166.67, 8.3335], ['A', 33.33, 8.3325]]);
  assert.deepEqual(r.by_customer.map((x) => [x.customer, x.freight_pct_of_value]), [['Beta', 8.33], ['Acme', 8.33]]);
});

test('lines with their own GL account keep it; others get the default', () => {
  const r = allocate([{ shipment_id: 'S1', cost: 100 }], [line('S1', 'O1', { gl_account: '6110' }), line('S1', 'O2')], { defaultGl: '6100' });
  assert.deepEqual(r.by_cost_center.map((x) => [x.gl_account, x.freight]), [['6110', 50], ['6100', 50]]);
});
