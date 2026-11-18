import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeableKg, breakRate, airCode } from '../src/index.js';

test('chargeable weight is the larger of actual and volumetric, rounded up to the step', () => {
  assert.deepEqual(chargeableKg(100, 1), { volumetric_kg: 166.67, chargeable_kg: 167 });
  assert.equal(chargeableKg(100.2, 0, { step: 0.5 }).chargeable_kg, 100.5);
  assert.equal(chargeableKg(100.2, 0, { step: 1 }).chargeable_kg, 101);
  assert.equal(chargeableKg(0, 0).chargeable_kg, null);
});

test('a higher break is used when it costs less', () => {
  const b = { '-45': 6, '+45': 5, '+100': 4 };
  assert.equal(breakRate(30, b).cost, 180);
  assert.equal(breakRate(85, b).key, '+100'); assert.equal(breakRate(85, b).cost, 400);
  assert.equal(breakRate(70, b).key, '+45');
});

test('charge wording maps to codes', () => {
  assert.equal(airCode('Fuel Surcharge (MYC)'), 'FSC'); assert.equal(airCode('X-Ray Screening'), 'SCREENING'); assert.equal(airCode('Weight Charge'), 'AF');
});
