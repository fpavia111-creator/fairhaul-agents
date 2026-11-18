import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackReturns } from '../src/index.js';

const rma = (o) => ({ rma: 'R1', units: 10, value: 100, authorised_at: '2026-10-01', tracking: 'T1', ...o });
const codes = (r) => r.items.map((x) => x.code);

test('a receipt found by tracking alone closes the loop', () => {
  const r = trackReturns([rma()], { receipts: [{ tracking: 't1', received_at: '2026-10-05', units_received: 10 }], credits: [{ rma: 'r1', credit: 100 }], asOf: '2026-11-16' });
  assert.deepEqual(codes(r), []); assert.equal(r.rmas_detail[0].stage, 'closed');
});

test('a short receipt caps the credit at the share received', () => {
  const r = trackReturns([rma()], { receipts: [{ rma: 'R1', received_at: '2026-10-05', units_received: 5 }], credits: [{ rma: 'R1', credit: 80 }], asOf: '2026-11-16' });
  assert.deepEqual(codes(r), ['short_received', 'over_credited']); assert.equal(r.items[1].amount, 30);
});

test('an old RMA with nothing back is an unused label; a young one is still awaited', () => {
  assert.deepEqual(codes(trackReturns([rma()], { asOf: '2026-11-16' })), ['label_unused']);
  assert.deepEqual(codes(trackReturns([rma()], { asOf: '2026-10-20' })), []);
});
