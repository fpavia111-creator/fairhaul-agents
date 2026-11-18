import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onTime, scorecards } from '../src/index.js';

test('on time: dates compare by day, times use the grace minutes', () => {
  assert.equal(onTime('2026-10-01', '2026-10-01'), true);
  assert.equal(onTime('2026-10-01', '2026-10-02'), false);
  assert.equal(onTime('2026-10-01 08:00', '2026-10-01 08:59', 60), true);
  assert.equal(onTime('2026-10-01 08:00', '2026-10-01 09:01', 60), false);
  assert.equal(onTime('2026-10-01', ''), null);
});

test('measures with no data drop out of the score instead of counting as zero', () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ shipment_id: `X${i}`, carrier: 'A', delivery_planned: '2026-10-01', delivery_actual: '2026-10-01' }));
  const c = scorecards(rows).cards[0];
  assert.equal(c.score, 100); assert.deepEqual(c.score_based_on, ['otd_pct', 'claim_free_pct']);
});

test('declined tenders count against acceptance but are not loads', () => {
  const rows = [{ shipment_id: '1', carrier: 'A', tender: 'Declined' }, { shipment_id: '2', carrier: 'A', tender: 'A' }];
  const c = scorecards(rows, { min_loads: 1 }).cards[0];
  assert.equal(c.acceptance_pct, 50); assert.equal(c.loads, 1);
});

test('weights change the ranking', () => {
  const mk = (carrier, late, declined) => [...Array.from({ length: 5 }, (_, i) => ({ shipment_id: `${carrier}${i}`, carrier, tender: 'A', delivery_planned: '2026-10-01', delivery_actual: i < late ? '2026-10-03' : '2026-10-01' })), ...Array.from({ length: declined }, (_, i) => ({ shipment_id: `${carrier}d${i}`, carrier, tender: 'D' }))];
  const rows = [...mk('Late', 2, 0), ...mk('Picky', 0, 4)];
  assert.equal(scorecards(rows, { weights: { otd_pct: 100, acceptance_pct: 1 } }).cards[0].carrier, 'Picky');
  assert.equal(scorecards(rows, { weights: { otd_pct: 1, acceptance_pct: 100 } }).cards[0].carrier, 'Late');
});
