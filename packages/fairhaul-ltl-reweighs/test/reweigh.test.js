import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewCorrections } from '../src/index.js';

const c = (o) => ({ pro: 'P', carrier: 'A', product: 'X', handling_units: 1, length: 48, width: 40, height: 48, declared_weight: 1000, corrected_weight: 1000, declared_class: 70, corrected_class: 70, amount_added: 50, certificate: 'yes', ...o });

test('weight tolerance is the larger of percent and pounds', () => {
  assert.equal(reviewCorrections([c({ corrected_weight: 1020 })]).items[0].status, 'challenge');
  assert.equal(reviewCorrections([c({ corrected_weight: 1030 })]).items[0].status, 'accept');
  assert.equal(reviewCorrections([c({ declared_weight: 100, corrected_weight: 120 })]).items[0].status, 'challenge');
});

test('a reclass the density does not support is challenged; one it supports is not', () => {
  const dense = reviewCorrections([c({ corrected_class: 85 })]).items[0];
  assert.equal(dense.density, 18.75); assert.equal(dense.status, 'challenge');
  const light = reviewCorrections([c({ declared_weight: 300, corrected_weight: 300, corrected_class: 175 })]).items[0];
  assert.equal(light.status, 'accept'); assert.match(light.notes[0], /looks right/);
});

test('no certificate alone asks for it; repeats with standing figures become a data fix', () => {
  assert.equal(reviewCorrections([c({ certificate: '' , corrected_weight: 1100 })]).items[0].status, 'ask_for_certificate');
  const r = reviewCorrections([c({ pro: '1', corrected_weight: 1200 }), c({ pro: '2', corrected_weight: 1250 })]);
  assert.equal(r.fixes.length, 1); assert.equal(r.items[0].status, 'fix_our_data');
});
