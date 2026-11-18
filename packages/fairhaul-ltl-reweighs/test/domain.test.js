// LTL corrections: tolerance, lighter reweighs, missing dimensions, repeats and the dispute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewCorrections, disputeText } from '../src/index.js';

const c = (pro, extra = {}) => ({ pro, carrier: 'Prairie Express', product: 'Widget case', declared_weight: 2000, corrected_weight: 2000, declared_class: 70, corrected_class: 70, amount_added: 50, certificate: 'yes', ...extra });

test('on a heavy shipment the percent tolerance is used, on a light one the pound floor', () => {
  assert.equal(reviewCorrections([c('P1', { corrected_weight: 2038 })]).items[0].status, 'challenge');
  assert.equal(reviewCorrections([c('P1', { corrected_weight: 2045 })]).items[0].status, 'accept');
  assert.equal(reviewCorrections([c('P1', { declared_weight: 300, corrected_weight: 324 })]).items[0].status, 'challenge');
  assert.equal(reviewCorrections([c('P1', { corrected_weight: 2045 })], { weight_tolerance_pct: 3 }).items[0].status, 'challenge');
});

test('a reweigh that came out lighter is not a weight dispute', () => {
  const r = reviewCorrections([c('P1', { corrected_weight: 1900 })]);
  assert.equal(r.items[0].weight_change, -100); assert.equal(r.items[0].status, 'accept');
});

test('a reclass with no dimensions on file is noted as unchecked, not challenged', () => {
  const r = reviewCorrections([c('P1', { corrected_class: 85 })]);
  assert.equal(r.items[0].status, 'accept'); assert.match(r.items[0].notes[0], /No dimensions on file/);
});

test('a missing certificate is asked for, and counted per carrier', () => {
  const r = reviewCorrections([c('P1', { certificate: 'no', amount_added: 80 }), c('P2', { carrier: 'Summit Carriers', certificate: '', amount_added: 20, product: 'Other' })]);
  assert.equal(r.ask_for_certificate, 2); assert.equal(r.certificate_amount, 100);
  assert.deepEqual(r.carriers.map((x) => [x.carrier, x.without_certificate]), [['Prairie Express', 1], ['Summit Carriers', 1]]);
});

test('a repeat threshold of three needs three standing corrections before it becomes a data fix', () => {
  const two = [c('P1', { corrected_weight: 2200 }), c('P2', { corrected_weight: 2300 })];
  assert.equal(reviewCorrections(two, { repeat_at: 3 }).fix_our_data, 0);
  const r = reviewCorrections([...two, c('P3', { corrected_weight: 2100 })], { repeat_at: 3 });
  assert.equal(r.fix_our_data, 3); assert.equal(r.fixes[0].weight_factor, 1.1); assert.match(r.fixes[0].fix, /10% above declared/);
});

test('a challenged correction does not count toward a repeat', () => {
  const r = reviewCorrections([c('P1', { corrected_weight: 2010 }), c('P2', { corrected_weight: 2200 })]);
  assert.equal(r.fixes.length, 0); assert.deepEqual(r.items.map((i) => i.status), ['challenge', 'accept']);
});

test('the dispute covers challenges and missing certificates only, with each reason', () => {
  const r = reviewCorrections([c('P1', { corrected_weight: 2010, amount_added: 40 }), c('P2', { certificate: 'no', amount_added: 25, product: 'B' }), c('P3', { corrected_weight: 2400, amount_added: 90, product: 'C' })]);
  const d = disputeText(r.items, { from: 'Shipping office' });
  assert.equal(d.total, 65); assert.deepEqual(d.pros, ['P1', 'P2']);
  assert.match(d.text, /within normal scale variation/); assert.match(d.text, /No inspection certificate/); assert.doesNotMatch(d.text, /\| P3 \|/);
});
