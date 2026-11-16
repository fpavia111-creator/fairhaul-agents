// Freight standards: zero standards, items costed too high, unknown SKUs and revaluation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStandards, updateText } from '../src/index.js';

const item = (sku, standard, extra = {}) => ({ sku, description: `Item ${sku}`, standard_freight: standard, on_hand: 100, ...extra });
const ship = (sku, units, freight, date = '2026-10-10') => ({ sku, units, freight, ship_date: date });

test('a zero standard with real freight is too low, and a new standard is proposed', () => {
  const r = compareStandards([item('A', 0)], [ship('A', 50, 100)]);
  assert.equal(r.rows[0].status, 'standard_too_low'); assert.equal(r.rows[0].proposed_standard, 2); assert.equal(r.under_costed, 100);
});

test('a standard far above actual is over-costed, with a negative variance', () => {
  const r = compareStandards([item('A', 3)], [ship('A', 100, 200)]);
  assert.deepEqual([r.rows[0].status, r.rows[0].variance, r.rows[0].variance_pct, r.over_costed], ['standard_too_high', -100, -33.3, -100]);
});

test('an item with no shipments in the period is listed, not changed', () => {
  const r = compareStandards([item('A', 2), item('B', 1)], [ship('A', 50, 100)]);
  assert.deepEqual(r.rows.find((x) => x.sku === 'B').status, 'no_shipments'); assert.equal(r.to_change, 0);
});

test('a SKU shipped in volume with no standard gets one proposed; a small one does not', () => {
  const r = compareStandards([], [ship('NEW', 40, 60), ship('TINY', 3, 9)]);
  assert.deepEqual(r.rows.map((x) => [x.sku, x.status, x.proposed_standard]), [['NEW', 'no_standard', 1.5], ['TINY', 'no_standard', null]]);
});

test('the revaluation estimate is the change in standard times units on hand', () => {
  const r = compareStandards([item('A', 1, { on_hand: 250 })], [ship('A', 100, 150)]);
  assert.equal(r.rows[0].proposed_standard, 1.5); assert.equal(r.rows[0].revaluation_estimate, 125); assert.equal(r.revaluation_estimate, 125);
});

test('items to change come first, the largest variance ahead', () => {
  const r = compareStandards([item('S', 1), item('B', 1), item('OK', 1)], [ship('S', 100, 130), ship('B', 100, 300), ship('OK', 100, 101)]);
  assert.deepEqual(r.rows.map((x) => x.sku), ['B', 'S', 'OK']);
});

test('the update lists thin items separately and says Pollux changes no costs', () => {
  const r = compareStandards([item('A', 1), item('T', 1)], [ship('A', 100, 200), ship('T', 5, 50)]);
  const text = updateText(r, { system: 'Example ERP', effective: '2026-12-01' });
  assert.match(text, /# Freight standard update, effective 2026-12-01/); assert.match(text, /Not changed for lack of volume: T \(5 units\)/);
  assert.match(text, /Load into: Example ERP\. Pollux does not change item costs\./);
});
