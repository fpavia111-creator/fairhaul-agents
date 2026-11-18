// Carrier scorecards from shipment history: grouping, billing, claims, tracking, ranking and the review note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorecards, reviewText } from '../src/index.js';

const load = (carrier, i, extra = {}) => ({ shipment_id: `${carrier[0]}${i}`, carrier, tender: 'Accepted', delivery_planned: '2026-10-01', delivery_actual: '2026-10-01', ...extra });

test('one carrier written with and without its legal form is scored once, under the name used most', () => {
  const rows = [load('Ridgeline Freight Inc.', 1), load('Ridgeline Freight Inc.', 2), load('Ridgeline Freight', 3)];
  const r = scorecards(rows, { min_loads: 1 });
  assert.equal(r.carriers, 1); assert.equal(r.cards[0].carrier, 'Ridgeline Freight Inc.'); assert.equal(r.cards[0].loads, 3);
});

test('billing accuracy uses the tolerance, and every amount above expected adds to overbilled', () => {
  const rows = [load('A', 1, { billed_amount: '1010', expected_amount: '1000' }), load('A', 2, { billed_amount: '1050', expected_amount: '1000' }), load('A', 3, { billed_amount: '900', expected_amount: '1000' }), load('A', 4, { billed_amount: '500' })];
  const c = scorecards(rows, { min_loads: 1, billing_tolerance_pct: 2 }).cards[0];
  assert.equal(c.billing_accuracy_pct, 33.3); assert.equal(c.overbilled, 60); assert.equal(c.spend, 3460);
});

test('claims and tracking: a count or a yes/no both read, and an empty cell is unknown, not untracked', () => {
  const rows = [load('A', 1, { claim_amount: '250', tracking_updates: '4' }), load('A', 2, { tracking_updates: 'no' }), load('A', 3, { tracking_updates: 'yes' }), load('A', 4, { tracking_updates: '0' }), load('A', 5)];
  const c = scorecards(rows, { min_loads: 1 }).cards[0];
  assert.equal(c.claim_free_pct, 80); assert.equal(c.claims, 1); assert.equal(c.claim_amount, 250);
  assert.equal(c.tracking_pct, 50);
});

test('a carrier under min_loads is listed without a rank, and the ranked ones are numbered from 1', () => {
  const rows = [...[1, 2, 3, 4, 5].map((i) => load('Big', i)), load('Small', 1)];
  const r = scorecards(rows);
  assert.equal(r.ranked, 1);
  assert.deepEqual(r.cards.map((c) => [c.carrier, c.rank, c.ranked]), [['Big', 1, true], ['Small', null, false]]);
});

test('on-time delivery is trended by quarter and the change from the last quarter is given', () => {
  const rows = [load('A', 1, { delivery_planned: '2026-05-01', delivery_actual: '2026-05-01' }), load('A', 2, { delivery_planned: '2026-05-02', delivery_actual: '2026-05-02' }), load('A', 3, { delivery_planned: '2026-08-01', delivery_actual: '2026-08-03' }), load('A', 4, { delivery_planned: '2026-08-02', delivery_actual: '2026-08-02' })];
  const c = scorecards(rows, { min_loads: 1 }).cards[0];
  assert.deepEqual(c.otd_trend, [{ quarter: '2026-Q2', loads: 2, otd_pct: 100 }, { quarter: '2026-Q3', loads: 2, otd_pct: 50 }]);
  assert.equal(c.otd_change, -50); assert.deepEqual(c.late_loads, ['A3']);
  assert.deepEqual(c.below_target.map((b) => b.metric), ['otd_pct']);
});

test('cost per mile is scored against the cheapest carrier, and no miles leaves cost out of the score', () => {
  const rows = [load('Cheap', 1, { billed_amount: '1000', miles: '500' }), load('Dear', 1, { billed_amount: '1500', miles: '500' }), load('NoMiles', 1, { billed_amount: '900' })];
  const by = Object.fromEntries(scorecards(rows, { min_loads: 1 }).cards.map((c) => [c.carrier, c]));
  assert.equal(by.Cheap.cost_score, 100); assert.equal(by.Dear.cost_score, 66.7); assert.equal(by.NoMiles.cost_score, null);
  assert.ok(!by.NoMiles.score_based_on.includes('cost_score'));
});

test('the review note names the rank, the targets missed and the late loads, and leaves the contact open', () => {
  const rows = [...[1, 2, 3, 4].map((i) => load('Ridgeline Freight', i)), load('Ridgeline Freight', 5, { delivery_actual: '2026-10-04' })];
  const total = scorecards(rows);
  const txt = reviewText(total.cards[0], total, { from: 'Shipping team', period: '2026 Q4' });
  assert.match(txt, /rank 1 of 1/); assert.match(txt, /on-time delivery \(80% against 95%\)/); assert.match(txt, /Late deliveries: R5/);
  assert.match(txt, /\[TO CONFIRM Ridgeline Freight account manager\]/);
  const small = scorecards([load('Tiny', 1)]);
  assert.match(reviewText(small.cards[0], small, {}), /fewer than 5 loads you are not ranked/);
});

test('sister companies get their own scorecards; a short name joins the one longer name that fits', () => {
  const rows = [load('FedEx Freight', 1), load('FedEx Express', 2), load('Ridgeline', 3), load('Ridgeline Freight Inc.', 4), load('Ridgeline Freight Inc.', 5)];
  const r = scorecards(rows, { min_loads: 1 });
  assert.deepEqual(r.cards.map((c) => [c.carrier, c.loads]).sort(), [['FedEx Express', 1], ['FedEx Freight', 1], ['Ridgeline Freight Inc.', 3]]);
});
