import { test } from 'node:test';
import assert from 'node:assert/strict';
import { award } from '../src/index.js';

const lanes = [{ lane_id: 'A', annual_loads: 100, incumbent: 'Old', incumbent_rate: 1000 }, { lane_id: 'B', annual_loads: 100, incumbent: 'Old', incumbent_rate: 1000 }];
const bids = [{ lane_id: 'A', carrier: 'Cheap', rate: 900 }, { lane_id: 'A', carrier: 'Old', rate: 950 }, { lane_id: 'B', carrier: 'Cheap', rate: 800 }, { lane_id: 'B', carrier: 'Old', rate: 990 }];

test('lowest bid wins with no rules, savings against the incumbent', () => {
  const r = award(lanes, bids); assert.equal(r.annual_cost, 170000); assert.equal(r.savings, 30000);
});

test('the share cap moves the rest to the next carrier, biggest savings first', () => {
  const r = award(lanes, bids, { max_share_pct: 50 });
  assert.equal(r.results[1].awards[0].carrier, 'Cheap'); assert.equal(r.results[0].awards[0].carrier, 'Old');
});

test('capacity splits a lane and leftovers are uncovered', () => {
  const r = award([{ lane_id: 'A', annual_loads: 100 }], [{ lane_id: 'A', carrier: 'X', rate: 1, capacity: 60 }], { backup: false });
  assert.equal(r.results[0].uncovered_loads, 40); assert.equal(r.results[0].status, 'partly_covered');
});

test('excluded carriers are never awarded', () => {
  assert.equal(award(lanes, bids, { exclude: ['cheap'] }).carriers.length, 1);
});
