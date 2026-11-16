import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareQuotes } from '../src/index.js';

const load = (o) => ({ load_id: 'L', pickup_date: '2026-11-18', deliver_by: '2026-11-20', miles: 500, ...o });
const q = (o) => ({ load_id: 'L', carrier: 'A', amount: 1000, all_in: 'yes', valid_until: '2026-11-17', transit_days: 1, ...o });

test('linehaul-only quotes get fuel per mile, or a percent with no miles', () => {
  assert.equal(compareQuotes([load({})], [q({ all_in: 'no' })], {}, { asOf: '2026-11-16' }).items[0].quotes[0].all_in_cost, 1300);
  assert.equal(compareQuotes([load({ miles: '' })], [q({ all_in: 'no' })], {}, { asOf: '2026-11-16' }).items[0].quotes[0].all_in_cost, 1200);
});

test('a quote valid through today is usable; yesterday is not', () => {
  assert.equal(compareQuotes([load({})], [q({ valid_until: '2026-11-16' })], {}, { asOf: '2026-11-16' }).items[0].status, 'ready');
  assert.equal(compareQuotes([load({})], [q({ valid_until: '2026-11-15' })], {}, { asOf: '2026-11-16' }).items[0].status, 'requote');
});

test('transit that misses the deliver-by date makes a quote unusable', () => {
  assert.equal(compareQuotes([load({})], [q({ transit_days: 3 })], {}, { asOf: '2026-11-16' }).items[0].quotes[0].usable, false);
});
