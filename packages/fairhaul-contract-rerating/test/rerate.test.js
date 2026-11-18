import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rerate, priceUnder } from '../src/index.js';

const contract = { carriers: [{ carrier: 'A', lanes: [{ origin: 'IL', destination: 'TX', basis: 'per_cwt', rate: 20, minimum: 100 }] }, { carrier: 'B', lanes: [{ origin: 'IL', destination: 'TX', basis: 'flat', rate: 250 }], accessorials: { liftgate: { amount: 30 } } }] };
const s = (o) => ({ shipment_id: 'S', carrier: 'A', ship_date: '2026-10-01', origin_state: 'IL', dest_state: 'TX', weight: 1000, paid: 210, ...o });

test('minimums apply and the cheapest contract wins', () => {
  assert.equal(priceUnder(contract.carriers[0], s({ weight: 100 }), contract).total, 100);
  const r = rerate([s({})], contract); assert.equal(r.items[0].best_carrier, 'A'); assert.equal(r.items[0].left_on_table, 10);
});

test('a contract that cannot price an ordered accessorial is not counted as cheapest', () => {
  const r = rerate([s({ weight: 2000, accessorials: 'Liftgate', paid: 500 })], contract);
  assert.equal(r.items[0].best_carrier, 'B'); assert.equal(r.items[0].best_cost, 280);
});

test('a lane is compared only across carriers that can price every shipment on it', () => {
  const r = rerate([s({}), s({ shipment_id: 'T', weight: null })], contract);
  assert.equal(r.lanes[0].ranking.includes('A'), false);
});
