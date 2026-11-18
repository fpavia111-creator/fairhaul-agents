import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCartons } from '../src/index.js';

const cfg = { cartons: [{ name: 'A', l: 10, w: 8, h: 6 }, { name: 'B', l: 20, w: 16, h: 12 }] };
const p = (o) => ({ package_id: 'P', carton: 'B', contents_l: 7, contents_w: 5, contents_h: 3, weight: 2, ...o });

test('contents fit in any orientation, with padding', () => {
  assert.equal(checkCartons([p({ contents_l: 4, contents_w: 8, contents_h: 6 })], { ...cfg, padding_in: 0 }).items[0].best_carton, 'A');
  assert.equal(checkCartons([p({ contents_l: 4, contents_w: 8, contents_h: 6 })], cfg).items[0].best_carton, 'A');
  assert.equal(checkCartons([p({ contents_l: 4, contents_w: 8, contents_h: 6 })], { ...cfg, padding_in: 2 }).items[0].best_carton, 'B');
});

test('saving is the drop in billable weight times the rate', () => {
  const r = checkCartons([p({})], { ...cfg, rate_per_lb: 2 }).items[0];
  assert.equal(r.billable_now, 28); assert.equal(r.billable_best, 4); assert.equal(r.est_saving, 48);
});

test('a heavy item gains nothing from a smaller box', () => {
  assert.equal(checkCartons([p({ weight: 40 })], cfg).items[0].status, 'ok');
});
