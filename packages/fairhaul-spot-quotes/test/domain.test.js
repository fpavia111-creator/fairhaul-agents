// Spot quotes: accessorial wording, what a quote includes, ranking, history and the booking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareQuotes, bookingText } from '../src/index.js';

const AS_OF = '2026-11-16';
const load = (id, extra = {}) => ({ load_id: id, origin: 'Chicago, IL', destination: 'Dallas, TX', equipment: 'Van', pickup_date: '2026-11-18', deliver_by: '2026-11-21', miles: 1000, lane_history_avg: 2500, ...extra });
const q = (id, carrier, amount, extra = {}) => ({ load_id: id, carrier, amount, all_in: 'yes', valid_until: '2026-11-20', transit_days: 2, ...extra });
const settings = { accessorial_allowance: { liftgate: 75 } };

test('an accessorial written as "Lift Gate" is priced with the liftgate allowance', () => {
  const r = compareQuotes([load('L1', { accessorials: 'Lift Gate' })], [q('L1', 'A', 2400)], settings, { asOf: AS_OF });
  assert.equal(r.items[0].quotes[0].all_in_cost, 2475); assert.deepEqual(r.items[0].quotes[0].notes, ['75 added for lift gate']);
});

test('a quote that already includes accessorials gets nothing added and no question', () => {
  const r = compareQuotes([load('L1', { accessorials: 'liftgate; inside delivery' })], [q('L1', 'A', 2400, { accessorials_included: 'yes' }), q('L1', 'B', 2400)], settings, { asOf: AS_OF });
  const [inc, other] = [r.items[0].quotes.find((x) => x.carrier === 'A'), r.items[0].quotes.find((x) => x.carrier === 'B')];
  assert.equal(inc.all_in_cost, 2400); assert.deepEqual(inc.notes, []);
  assert.equal(other.all_in_cost, 2475); assert.match(other.notes.join(' '), /ask whether inside delivery is included/);
});

test('an expired quote ranks after usable ones however cheap it is; the spread is between usable ones', () => {
  const r = compareQuotes([load('L1')], [q('L1', 'Cheap', 1800, { valid_until: '2026-11-10' }), q('L1', 'A', 2400), q('L1', 'B', 2550)], {}, { asOf: AS_OF });
  assert.deepEqual(r.items[0].quotes.map((x) => x.carrier), ['A', 'B', 'Cheap']);
  assert.equal(r.items[0].best.carrier, 'A'); assert.equal(r.items[0].spread, 150);
});

test('the best quote well above the lane history asks for a price check', () => {
  const r = compareQuotes([load('L1')], [q('L1', 'A', 2900), q('L1', 'B', 3000)], {}, { asOf: AS_OF });
  assert.equal(r.items[0].status, 'check_price'); assert.match(r.items[0].flags[0], /16% above the lane history 2500/);
  assert.equal(r.items[0].vs_history, 400);
});

test('one usable quote is ready but flagged; a load with none asks for quotes', () => {
  const r = compareQuotes([load('L1'), load('L2')], [q('L1', 'A', 2400)], {}, { asOf: AS_OF });
  assert.deepEqual(r.items.map((i) => [i.status, i.flags]), [['ready', ['Only one usable quote.']], ['no_quotes', ['No quotes yet.']]]);
});

test('the booking confirms an all-in quote as is, and asks to confirm the total when we added to it', () => {
  const r = compareQuotes([load('L1', { accessorials: 'liftgate' })], [q('L1', 'A', 2400, { all_in: 'no' })], settings, { asOf: AS_OF });
  const text = bookingText(r.items[0], r.items[0].quotes[0], { reference: 'PO-9' });
  assert.match(text, /quote of 2400 \(we have it at 3075 all-in after linehaul only: 600 fuel added; 75 added for liftgate; please confirm the total\)/);
  const plain = compareQuotes([load('L1')], [q('L1', 'A', 2400)], {}, { asOf: AS_OF });
  assert.match(bookingText(plain.items[0], plain.items[0].quotes[0], {}), /quote of 2400 all-in/);
});
