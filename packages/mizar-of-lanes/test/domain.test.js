// Lanes: grouping levels, truckload minimums, trends, capacity and not counting a saving twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseLanes, planText } from '../src/index.js';

const s = (id, extra = {}) => ({ shipment_id: id, ship_date: '2026-10-05', mode: 'LTL', carrier: 'Prairie', origin_state: 'IL', origin_postal: '60607', dest_state: 'TX', dest_postal: '75201', weight: 3000, pallets: 4, miles: 900, cost: 1200, ...extra });

test('a heavy LTL shipment already in a consolidation group is not counted again', () => {
  const r = analyseLanes([s('A', { weight: 12000, cost: 2000 }), s('B', { cost: 900 }), s('C', { ship_date: '2026-10-20', weight: 15000, cost: 2600 })]);
  assert.equal(r.consolidation_groups, 1); assert.equal(r.consolidation_saving, 425);
  assert.deepEqual(r.heavy.map((h) => h.shipment_id), ['C']); assert.equal(r.heavy_ltl_saving, 125);
});

test('grouping by state puts two Texas zip areas on one lane', () => {
  const rows = [s('A'), s('B', { dest_postal: '77002' })];
  assert.equal(analyseLanes(rows).lanes_count, 2);
  assert.equal(analyseLanes(rows, { lane_level: 'state' }).lanes[0].lane, 'IL → TX');
});

test('on a short lane the truckload minimum applies, and a group cheaper than it is not proposed', () => {
  const r = analyseLanes([s('A', { miles: 100, cost: 400 }), s('B', { miles: 100, cost: 450 })]);
  assert.equal(r.groups[0].truckload_estimate, 900); assert.equal(r.groups[0].worth_it, false); assert.equal(r.consolidation_groups, 0);
});

test('cost per hundredweight is trended month over month per lane', () => {
  const r = analyseLanes([s('A', { cost: 300 }), s('B', { ship_date: '2026-11-03', cost: 330 })]);
  assert.deepEqual(r.trend.map((t) => [t.month, t.cost_per_cwt]), [['2026-10', 10], ['2026-11', 11]]);
  assert.equal(r.lanes[0].cwt_change_pct, 10);
});

test('rows with no ship date are left out of every figure', () => {
  const r = analyseLanes([s('A'), s('B', { ship_date: '' })]);
  assert.equal(r.shipments, 1); assert.equal(r.spend, 1200);
});

test('a group with more pallets than a truck holds is not proposed', () => {
  assert.equal(analyseLanes([s('A', { pallets: 14 }), s('B', { pallets: 14 })]).groups.length, 0);
  assert.equal(analyseLanes([s('A', { pallets: 14 }), s('B', { pallets: 14 })], { max_pallets: 30 }).groups.length, 1);
});

test('the plan names the window and shows only the sections that have rows', () => {
  const r = analyseLanes([s('A', { cost: 1300 }), s('B', { ship_date: '2026-10-07', cost: 1300 })], { window_days: 2 });
  const text = planText(r, { team: 'Outbound planning' });
  assert.match(text, /within 2 day\(s\)/); assert.match(text, /## Ship together/); assert.doesNotMatch(text, /## Quote as truckload/);
  assert.match(text, /2026-10-05 to 2026-10-07/); assert.match(text, /Check customer delivery promises/);
});
