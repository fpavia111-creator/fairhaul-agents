import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freightMargins, termsOf, termsText } from '../src/index.js';

test('freight terms are read from common wordings', () => {
  assert.deepEqual(['Prepaid', 'PPD', 'Prepaid & Add', 'PP&A', 'Collect', 'FOB Origin', 'EXW', 'DDP', 'Third Party', ''].map(termsOf), ['prepaid', 'prepaid', 'prepaid_add', 'prepaid_add', 'collect', 'collect', 'collect', 'prepaid', 'collect', 'unknown']);
});

test('a shared shipment splits by order value and the parts add up', () => {
  const r = freightMargins([{ order_id: 'a', shipment_id: 's', order_value: 300 }, { order_id: 'b', shipment_id: 'S', order_value: 100 }], [{ shipment_id: 's', cost: 40 }]);
  assert.deepEqual(r.rows.map((x) => x.freight_cost).sort(), [10, 30]); assert.equal(r.freight_cost, 40);
});

test('a collect order counts as a leak of its whole cost', () => {
  const r = freightMargins([{ order_id: 'a', order_value: 500, terms: 'collect', freight_cost: 25 }]);
  assert.equal(r.collect_but_we_paid, 25);
});

test('the draft leaves each proposal for a person to decide', () => {
  const r = freightMargins([{ order_id: 'a', customer: 'X', order_value: 500, terms: 'prepaid', freight_cost: 25 }]);
  assert.match(termsText(r), /TO DECIDE/);
});
