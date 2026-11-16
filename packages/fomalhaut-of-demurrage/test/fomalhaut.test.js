import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countDays, nthDay, tierCost, clocks } from '../src/index.js';

test('business days skip weekends and excluded dates', () => {
  assert.equal(countDays('2026-11-13', '2026-11-17', { business_days: true }), 3);
  assert.equal(nthDay('2026-11-09', 3, {}, ['2026-11-10']), '2026-11-12');
});

test('tiers price days in order and the last tier runs on', () => {
  const t = [{ days: 2, rate: 100 }, { days: 2, rate: 200 }, { rate: 300 }];
  assert.equal(tierCost(1, t), 100); assert.equal(tierCost(5, t), 900); assert.equal(tierCost(0, t), 0);
});

test('demurrage stops at gate out and detention starts the same day', () => {
  const terms = { start_offset_days: 1, lines: { L: { demurrage: { free_days: 2, tiers: [{ rate: 10 }] }, detention: { free_days: 2, tiers: [{ rate: 5 }] } } } };
  const [i] = clocks([{ container: 'C', line: 'L', discharged: '2026-11-01', gate_out: '2026-11-05', empty_returned: '2026-11-08' }], terms, { asOf: '2026-11-20' });
  assert.equal(i.dem_charge_days, 2); assert.equal(i.dem_cost, 20);
  assert.equal(i.det_charge_days, 2); assert.equal(i.det_cost, 10); assert.equal(i.status, 'closed');
});

test('size-specific tiers are used when the size matches', () => {
  const terms = { lines: { L: { demurrage: { free_days: 0, tiers: [{ rate: 10 }], tiers_by_size: { '40HC': [{ rate: 20 }] } } } } };
  assert.equal(clocks([{ container: 'C', line: 'L', size: '40 HC', discharged: '2026-11-01' }], terms, { asOf: '2026-11-02' })[0].dem_cost, 20);
});
