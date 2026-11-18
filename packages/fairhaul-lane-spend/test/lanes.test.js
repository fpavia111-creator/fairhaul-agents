import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseLanes } from '../src/index.js';

const s = (o) => ({ shipment_id: 'S', ship_date: '2026-10-01', mode: 'LTL', origin_state: 'IL', origin_postal: '60607', dest_state: 'TX', dest_postal: '75201', weight: 6000, pallets: 8, miles: 900, cost: 1500, ...o });

test('same-day LTL on one lane that fits a truck and costs more than truckload is a group', () => {
  const r = analyseLanes([s({ shipment_id: 'A' }), s({ shipment_id: 'B' })]);
  assert.equal(r.consolidation_groups, 1); assert.equal(r.groups[0].truckload_estimate, 2475); assert.equal(r.consolidation_saving, 525);
});

test('a group over truck capacity is not proposed', () => {
  assert.equal(analyseLanes([s({ shipment_id: 'A', pallets: 14 }), s({ shipment_id: 'B', pallets: 14 })]).groups.length, 0);
});

test('the window lets shipments a few days apart combine', () => {
  const rows = [s({ shipment_id: 'A' }), s({ shipment_id: 'B', ship_date: '2026-10-03' })];
  assert.equal(analyseLanes(rows).groups.length, 0); assert.equal(analyseLanes(rows, { window_days: 2 }).groups.length, 1);
});

test('truckload shipments are not consolidation candidates', () => {
  assert.equal(analyseLanes([s({ shipment_id: 'A', mode: 'TL' }), s({ shipment_id: 'B', mode: 'TL' })]).groups.length, 0);
});
