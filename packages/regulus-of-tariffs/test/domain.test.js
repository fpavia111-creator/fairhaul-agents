// Re-rating history: contract terms, accessorials, what was paid, lanes and the routing change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rerate, routingText } from '../src/index.js';

const lane = (rate, extra = {}) => ({ origin: 'IL', destination: 'TX', basis: 'flat', rate, ...extra });
const contract = { carriers: [
  { carrier: 'Ridgeline', effective: '2026-01-01', expires: '2026-06-30', lanes: [lane(500)], accessorials: { liftgate: { amount: 40 } } },
  { carrier: 'Ridgeline', effective: '2026-07-01', expires: '2026-12-31', lanes: [lane(450)], accessorials: { liftgate: { amount: 40 } } },
  { carrier: 'Prairie', effective: '2026-01-01', expires: '2026-12-31', lanes: [lane(470)], accessorials: { liftgate: { amount: 90 } } },
  { carrier: 'Old Co', effective: '2025-01-01', expires: '2025-12-31', lanes: [lane(100)] },
] };
const s = (id, extra = {}) => ({ shipment_id: id, carrier: 'Prairie', ship_date: '2026-10-01', origin_state: 'IL', dest_state: 'TX', mode: 'LTL', paid: 470, ...extra });

test('a carrier with two contract terms is rated once, under the term in force on the ship date', () => {
  const r = rerate([s('A'), s('B', { ship_date: '2026-03-01', paid: 470 })], contract);
  assert.deepEqual(r.carriers.map((c) => c.carrier), ['Ridgeline', 'Prairie', 'Old Co']);
  assert.deepEqual(r.items.map((i) => [i.best_carrier, i.best_cost, i.left_on_table]), [['Ridgeline', 450, 20], ['Prairie', 470, 0]]);
});

test('a contract out of force on the ship date says so and is never the cheapest', () => {
  const r = rerate([s('A')], contract);
  assert.equal(r.items[0].quotes.find((q) => q.carrier === 'Old Co').why, 'contract not in force on the ship date');
});

test('ordered accessorials are priced into each carrier\'s total, which can change the winner', () => {
  const r = rerate([s('A', { accessorials: 'Liftgate', paid: 560 })], contract);
  assert.deepEqual(r.items[0].quotes.filter((q) => q.total !== null).map((q) => [q.carrier, q.total, q.accessorials]), [['Ridgeline', 490, 40], ['Prairie', 560, 90]]);
});

test('with no paid amount, the contract cost of the carrier used is the baseline', () => {
  const r = rerate([s('A', { paid: '' })], contract);
  assert.equal(r.items[0].contract_cost, 470); assert.equal(r.items[0].left_on_table, 20);
});

test('a lane already on its cheapest carrier is not a change', () => {
  const r = rerate([s('A', { carrier: 'Ridgeline', paid: 450 }), s('B', { carrier: 'Ridgeline', paid: 450 })], contract);
  assert.equal(r.lanes[0].change, false); assert.equal(r.lanes_to_change, 0); assert.match(r.lanes[0].ranking, /^Ridgeline 900 < Prairie 940/);
});

test('the routing change lists only lanes to change with a saving, and asks for a service check first', () => {
  const r = rerate([s('A'), s('B'), s('C', { origin_state: 'OH', carrier: 'Ridgeline', paid: 450 })], contract);
  const text = routingText(r.lanes, { system: 'Example TMS' });
  assert.match(text, /Re-rating 2 past shipment\(s\).*1 lane\(s\).*40 in total/);
  assert.match(text, /\| IL → TX \| LTL \| 2 \| Prairie \| Ridgeline \| 940 \| 900 \|/); assert.doesNotMatch(text, /OH →/);
  assert.match(text, /Rigel of Scorecards/);
});
