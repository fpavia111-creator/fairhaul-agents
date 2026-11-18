import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, statementText } from '../src/index.js';

const f = { source: 'Test factors', modes: { ftl: 100 } };

test('tonnes x km x g per tonne-km / 1000 gives kg, in any unit', () => {
  assert.equal(estimate([{ shipment_id: 'a', mode: 'FTL', weight: 10000, weight_unit: 'kg', distance: 100, distance_unit: 'km' }], f).kg_co2e, 100);
  const lb = estimate([{ shipment_id: 'a', mode: 'ftl', weight: 22046.226, distance: 62.137119 }], f);
  assert.equal(Math.round(lb.kg_co2e), 100);
});

test('missing data is listed, never guessed', () => {
  const r = estimate([{ shipment_id: 'a', mode: 'ftl', weight: 1000 }, { shipment_id: 'b', mode: 'barge', weight: 1000, distance: 10 }], f);
  assert.equal(r.estimated, 0); assert.deepEqual(r.rows.map((x) => x.issues), ['no distance', 'no factor for mode "barge"']);
});

test('the customer statement says it is an estimate and names the source', () => {
  const r = estimate([{ shipment_id: 'a', mode: 'ftl', customer: 'C', weight: 1000, weight_unit: 'kg', distance: 10, distance_unit: 'km' }], f);
  const t = statementText(r, 'C');
  assert.match(t, /Test factors/); assert.match(t, /not verified or assured/); assert.doesNotMatch(t, /is certified/);
});
