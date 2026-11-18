import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicates, normInvoice } from '../src/index.js';

const p = (o) => ({ vendor: 'A Freight', invoice_number: 'X1', invoice_date: '2026-01-01', amount: 100, paid_date: '2026-01-20', ...o });

test('invoice numbers normalise prefixes, punctuation and leading zeros', () => {
  assert.equal(normInvoice('INV-00123'), '123'); assert.equal(normInvoice('inv #123'), '123'); assert.equal(normInvoice('12-3'), '123');
  assert.equal(normInvoice('CL-90402-B'), 'CL90402B');
});

test('a credit memo naming the invoice nets off the duplicate', () => {
  const r = findDuplicates([p({}), p({ paid_date: '2026-02-20' }), { vendor: 'A Freight', invoice_number: 'CM1', amount: -100, memo: 'refund of X1' }], { asOf: '2026-03-01' });
  assert.equal(r.items[0].status, 'already_credited'); assert.equal(r.to_recover_high, 0);
});

test('unpaid lines are not duplicates; a pair is reported once under its strongest rule', () => {
  assert.equal(findDuplicates([p({}), p({ paid_date: '' })]).groups, 0);
  const r = findDuplicates([p({ pro: 'P1' }), p({ pro: 'P1', paid_date: '2026-02-01' })]);
  assert.equal(r.groups, 1); assert.equal(r.items[0].rule, 'exact_duplicate');
});

test('the first payment stands; later ones are the overpayment', () => {
  const r = findDuplicates([p({ paid_date: '2026-03-01' }), p({ paid_date: '2026-01-01' }), p({ paid_date: '2026-02-01' })]);
  assert.equal(r.items[0].overpaid, 200); assert.equal(r.items[0].paid_dates[0], '2026-01-01');
});
