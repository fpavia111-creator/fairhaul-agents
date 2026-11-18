import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStandards, updateText } from '../src/index.js';

const item = (o) => ({ sku: 'A', standard_freight: 1, on_hand: 100, ...o });
const ship = (units, freight, d) => ({ sku: 'a', units, freight, ship_date: d });

test('variance is actual minus standard times units, matched without case', () => {
  const r = compareStandards([item()], [ship(50, 60, '2026-10-01')]);
  assert.equal(r.rows[0].variance, 10); assert.equal(r.rows[0].status, 'standard_too_low'); assert.equal(r.rows[0].proposed_standard, 1.2);
  assert.equal(r.rows[0].revaluation_estimate, 20);
});

test('a steady month-to-month cost proposes the average; a moving one proposes the latest month', () => {
  assert.equal(compareStandards([item()], [ship(50, 60, '2026-09-01'), ship(50, 62, '2026-10-01')]).rows[0].proposed_standard, 1.22);
  assert.equal(compareStandards([item()], [ship(50, 55, '2026-09-01'), ship(50, 75, '2026-10-01')]).rows[0].proposed_standard, 1.5);
});

test('too few units never proposes a change', () => {
  const r = compareStandards([item()], [ship(5, 50, '2026-10-01')]);
  assert.equal(r.rows[0].status, 'thin_data'); assert.equal(r.rows[0].proposed_standard, null);
});

test('the draft names the system and leaves the owner open when not given', () => {
  const t = updateText(compareStandards([item()], [ship(50, 60, '2026-10-01')]));
  assert.match(t, /TO CONFIRM: cost accounting owner/); assert.match(t, /\| A \|/);
});
