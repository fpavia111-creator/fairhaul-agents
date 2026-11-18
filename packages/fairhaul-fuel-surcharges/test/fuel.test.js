import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFuel, weekBilled, compareTables } from '../src/index.js';

const block = { carrier: 'A', fuel: { basis: 'pct_of_linehaul', table: [{ min: 3, max: 3.5, value: 10 }, { min: 3.5, max: 4, value: 12 }] } };
const contract = { tolerance: 1, fuel_index: [{ week_of: '2026-10-05', price: 3.4 }, { week_of: '2026-10-12', price: 3.6 }], carriers: [block] };
const inv = (o) => ({ invoice_number: 'I1', carrier: 'A', ship_date: '2026-10-07', miles: 100, by_code: { linehaul: 1000, fuel: 100 }, ...o });

test('the diesel week is the latest index week on or before the ship date', () => {
  assert.equal(checkFuel([inv({})], contract).items[0].status, 'ok');
  assert.equal(checkFuel([inv({ ship_date: '2026-10-12' })], contract).items[0].expected, 120);
});

test('fuel priced at a later week is wrong_week, with the week it matches', () => {
  const r = checkFuel([inv({ by_code: { linehaul: 1000, fuel: 120 } })], contract).items[0];
  assert.equal(r.status, 'wrong_week'); assert.equal(r.week_billed, '2026-10-12'); assert.equal(r.difference, 20);
  assert.equal(weekBilled(block, contract.fuel_index, 999, 1000, 100, '2026-10-07'), null);
});

test('a discount line lowers the linehaul the percent applies to', () => {
  const r = checkFuel([inv({ by_code: { linehaul: 1200, discount: -200, fuel: 100 } })], contract).items[0];
  assert.equal(r.linehaul, 1000); assert.equal(r.status, 'ok');
});

test('a ship date before the first index week cannot be checked', () => {
  assert.equal(checkFuel([inv({ ship_date: '2026-09-01' })], contract).items[0].status, 'no_index');
});

test('per-mile and percent tables compare on the same reference load', () => {
  const c = compareTables({ carriers: [block, { carrier: 'B', fuel: { basis: 'per_mile', table: [{ min: 3, value: 0.3 }] } }] }, { prices: [3.6], linehaul: 1000, miles: 500 });
  assert.equal(c.carriers[0].cells[0].fuel, 120); assert.equal(c.carriers[1].cells[0].fuel, 150); assert.equal(c.highest_at_middle_price, 'B');
});
