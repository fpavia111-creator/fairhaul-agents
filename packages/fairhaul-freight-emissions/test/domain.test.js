// Emissions estimates: units, data quality, roll-ups, the mode-shift what-if and the customer statement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, statementText } from '../src/index.js';

const f = { source: 'Test factors v1', modes: { ftl: 100, rail: 25, ltl: 150 }, aliases: { truckload: 'ftl', 'less than truckload': 'ltl' } };
const s = (id, extra = {}) => ({ shipment_id: id, mode: 'FTL', weight: 10000, weight_unit: 'kg', distance: 1000, distance_unit: 'km', ...extra });

test('tonnes and metric tons are read as 1000 kg, and a ton of unknown size is not guessed', () => {
  assert.equal(estimate([s('a', { weight: 10, weight_unit: 't' })], f).kg_co2e, 1000);
  assert.equal(estimate([s('a', { weight: 10, weight_unit: 'MT' })], f).kg_co2e, 1000);
  const r = estimate([s('a', { weight: 10, weight_unit: 'tons' }), s('b', { distance_unit: 'leagues' })], f);
  assert.equal(r.estimated, 0);
  assert.deepEqual(r.rows.map((x) => x.issues), ['weight unit "tons" not understood', 'distance unit "leagues" not understood']);
});

test('the file\'s default units apply when a row has none, and spelled-out units read the same', () => {
  const fx = { ...f, default_weight_unit: 'kg', default_distance_unit: 'km' };
  assert.equal(estimate([s('a', { weight_unit: '', distance_unit: '' })], fx).kg_co2e, 1000);
  assert.equal(estimate([s('a', { weight_unit: 'Kilograms', distance_unit: 'kilometres' })], f).kg_co2e, 1000);
  assert.equal(Math.round(estimate([s('a', { weight: 22046.226, weight_unit: 'lbs', distance: 621.37119, distance_unit: 'Miles' })], f).kg_co2e), 1000);
});

test('your own mode names are mapped through the aliases, case and all', () => {
  const r = estimate([s('a', { mode: 'Truckload' }), s('b', { mode: 'Less Than Truckload' })], f);
  assert.deepEqual(r.rows.map((x) => [x.mode, x.kg_co2e]), [['ftl', 1000], ['ltl', 1500]]);
});

test('measured distances are counted, and totals roll up by mode, carrier, lane and customer', () => {
  const r = estimate([s('a', { distance_source: 'Telematics', carrier: 'A', customer: 'X', origin: 'P', destination: 'Q' }), s('b', { carrier: 'A', customer: 'Y', origin: 'P', destination: 'Q' }), s('c', { mode: 'rail', carrier: 'B', customer: 'X' })], f);
  assert.equal(r.measured_distance_pct, 33); assert.equal(r.kg_co2e, 2250); assert.equal(r.tonne_km, 30000); assert.equal(r.g_per_tonne_km, 75);
  assert.deepEqual(r.by_mode.map((x) => [x.mode, x.kg_co2e]), [['ftl', 2000], ['rail', 250]]);
  assert.deepEqual(r.by_carrier.map((x) => [x.carrier, x.shipments]), [['A', 2], ['B', 1]]);
  assert.deepEqual(r.by_customer.map((x) => [x.customer, x.kg_co2e]), [['X', 1250], ['Y', 1000]]);
  assert.equal(r.by_lane[0].lane, 'P > Q');
});

test('the mode-shift what-if takes long hauls only, adds the extra distance, and accepts your own mode names', () => {
  const fx = { ...f, shift: { from: ['Truckload'], to: 'rail', min_km: 800, extra_km_pct: 20 } };
  const r = estimate([s('long'), s('short', { distance: 300 })], fx);
  assert.equal(r.shift.shipments, 1); assert.equal(r.shift.shipment_ids, 'long');
  assert.equal(r.shift.kg_before, 1000); assert.equal(r.shift.kg_after, 300); assert.equal(r.shift.kg_saved, 700);
  assert.equal(estimate([s('a')], { ...f, shift: { from: ['ftl'], to: 'barge' } }).shift, null);
});

test('the statement covers one customer, lists what was not estimated and says it is an estimate', () => {
  const r = estimate([s('a', { customer: 'Acme' }), s('b', { customer: 'Acme', distance: '' }), s('c', { customer: 'Other' })], f);
  const t = statementText(r, 'Acme', { period: '2026 Q3' });
  assert.match(t, /\*\*1000 kg CO2e\*\* across 1 shipment/); assert.match(t, /Not estimated for lack of data: b \(no distance\)/);
  assert.doesNotMatch(t, /\| c \|/); assert.match(t, /\[TO CONFIRM: customer contact\]/); assert.match(t, /planned route distances, not measured/);
  assert.match(t, /Test factors v1/); assert.match(t, /not a certified carbon footprint/);
});
