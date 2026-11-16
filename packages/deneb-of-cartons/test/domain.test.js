// Carton fit: catalog names, divisors, padding, cartons to add and oversize risk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCartons, changeText } from '../src/index.js';

const cartons = [{ name: 'S', l: 10, w: 8, h: 6 }, { name: 'M', l: 14, w: 12, h: 10 }, { name: 'L', l: 20, w: 16, h: 14 }];
const pkg = (id, extra = {}) => ({ package_id: id, sku: 'SKU-1', carton: 'L', contents_l: 8, contents_w: 6, contents_h: 4, weight: 3, ...extra });

test('a carton named in the file takes its size from the catalog', () => {
  const r = checkCartons([pkg('P1')], { cartons });
  assert.deepEqual([r.items[0].used_dims, r.items[0].best_carton, r.items[0].billable_now, r.items[0].billable_best], ['20x16x14', 'S', 33, 4]);
  assert.equal(r.est_saving, 31.9);
});

test('a larger divisor lowers dimensional weight and the saving with it', () => {
  const r = checkCartons([pkg('P1')], { cartons, divisor: 166 });
  assert.deepEqual([r.items[0].billable_now, r.items[0].billable_best, r.billable_lbs_saved], [27, 3, 24]);
});

test('without padding the contents can go in a tighter carton', () => {
  const tight = pkg('P1', { contents_l: 10, contents_w: 8, contents_h: 6 });
  assert.equal(checkCartons([tight], { cartons }).items[0].best_carton, 'M');
  assert.equal(checkCartons([tight], { cartons, padding_in: 0 }).items[0].best_carton, 'S');
});

test('contents that fit no carton suggest new sizes, each listed once', () => {
  const r = checkCartons([pkg('P1', { contents_l: 30, contents_w: 10, contents_h: 10 }), pkg('P2', { contents_l: 10, contents_w: 30, contents_h: 10 })], { cartons });
  assert.equal(r.no_fit, 2); assert.deepEqual(r.suggested_new_cartons, ['32x12x12']);
  const text = changeText(r, { from: 'Packing lead' });
  assert.match(text, /## Add cartons/); assert.match(text, /32x12x12/);
  assert.doesNotMatch(changeText(checkCartons([pkg('P1')], { cartons }), {}), /## Add cartons/);
});

test('a long carton is flagged for oversize handling by its longest side', () => {
  const r = checkCartons([pkg('P1', { carton: '', carton_l: 50, carton_w: 6, carton_h: 6 })], { cartons });
  assert.match(r.items[0].flags.join(' '), /longest side 50 in/); assert.equal(r.oversize_risk, 1);
});

test('a recorded carton smaller than its contents is a data problem, not a saving', () => {
  const r = checkCartons([pkg('P1', { carton: 'S', contents_l: 12, contents_w: 9, contents_h: 7 })], { cartons });
  assert.match(r.items[0].flags.join(' '), /do not fit the carton recorded/); assert.equal(r.items[0].billable_lbs_saved, 0);
});

test('a heavy package already billed on actual weight saves nothing in a smaller carton', () => {
  const r = checkCartons([pkg('P1', { weight: 40 })], { cartons });
  assert.equal(r.items[0].status, 'ok'); assert.equal(r.smaller_carton, 0);
});
