// Duplicate freight payments: what counts, how sure we are, and what is left to recover.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicates, recoveryText } from '../src/index.js';

const AS_OF = '2026-11-16';
const p = (vendor, inv, amount, extra = {}) => ({ vendor, invoice_number: inv, amount, invoice_date: '2026-10-01', paid_date: '2026-10-15', ...extra });

test('same carrier, same amount, close dates but two different PROs are two real loads', () => {
  const r = findDuplicates([p('Ridgeline', 'A-1', 500, { pro: 'P1' }), p('Ridgeline', 'A-2', 500, { pro: 'P2', invoice_date: '2026-10-02' })], { asOf: AS_OF });
  assert.equal(r.groups, 0);
  const noPro = findDuplicates([p('Ridgeline', 'A-1', 500), p('Ridgeline', 'A-2', 500, { invoice_date: '2026-10-02' })], { asOf: AS_OF });
  assert.equal(noPro.items[0].rule, 'same_amount_and_date'); assert.equal(noPro.to_recover_low, 500);
  assert.equal(findDuplicates([p('Ridgeline', 'A-1', 500), p('Ridgeline', 'A-2', 500, { invoice_date: '2026-10-09' })], { asOf: AS_OF, dateWindowDays: 3 }).groups, 0);
});

test('the same PRO paid at two amounts is medium, worded as a possible balance-due bill', () => {
  const r = findDuplicates([p('Ridgeline', 'A-1', 500, { pro: 'P1' }), p('Ridgeline', 'A-1B', 120, { pro: 'p-1', paid_date: '2026-10-20' })], { asOf: AS_OF });
  assert.equal(r.items[0].confidence, 'medium'); assert.match(r.items[0].why, /balance-due/);
  assert.equal(r.to_recover_medium, 120); assert.equal(r.to_recover_high, 0);
});

test('a partial credit leaves the rest to recover; a full one closes the group', () => {
  const rows = [p('Ridgeline', 'INV-0042', 800), p('Ridgeline', '42', 800, { paid_date: '2026-10-30' })];
  const part = findDuplicates([...rows, p('Ridgeline', 'CM-9', -300, { memo: 'credit for 42', paid_date: '' })], { asOf: AS_OF });
  assert.deepEqual([part.items[0].credited, part.items[0].to_recover, part.items[0].status], [300, 500, 'recover']);
  const full = findDuplicates([...rows, p('Ridgeline', '42', -800, { paid_date: '' })], { asOf: AS_OF });
  assert.equal(full.items[0].status, 'already_credited'); assert.equal(full.already_credited, 1); assert.equal(full.to_recover_high, 0);
});

test('one carrier under two vendor ids is a high-confidence pair with advice to merge the records', () => {
  const r = findDuplicates([p('Ridgeline Freight', 'R-100', 950, { vendor_id: 'V1' }), p('Ridgeline Freight', 'R-100', 950, { vendor_id: 'V7', paid_date: '2026-11-01' })], { asOf: AS_OF });
  assert.equal(r.items[0].rule, 'two_vendor_records'); assert.match(r.items[0].why, /Merge or block/);
  assert.equal(r.items[0].age_days, 15);
});

test('a short invoice number is not matched across two different carriers', () => {
  assert.equal(findDuplicates([p('Ridgeline', '12', 100), p('Prairie', '12', 100, { invoice_date: '2026-03-01' })], { asOf: AS_OF }).groups, 0);
  assert.equal(findDuplicates([p('Ridgeline', 'RX-1234', 100), p('Prairie', 'RX1234', 100, { invoice_date: '2026-03-01' })], { asOf: AS_OF }).items[0].rule, 'two_vendor_records');
});

test('vendors are ranked by what is left to recover, with the high-confidence part shown', () => {
  const r = findDuplicates([p('A', 'X-1001', 100), p('A', 'X-1001', 100), p('B', 'Y-2001', 900), p('B', 'Y-2001', 900), p('B', 'Y-2002', 50, { pro: 'Q' }), p('B', 'Y-2003', 60, { pro: 'Q' })], { asOf: AS_OF });
  assert.deepEqual(r.vendors.map((v) => [v.vendor, v.to_recover, v.high]), [['B', 960, 900], ['A', 100, 100]]);
});

test('the refund request lists only the confidence levels asked for', () => {
  const r = findDuplicates([p('B', 'Y-2001', 900), p('B', 'Y-2001', 900), p('B', 'Y-2002', 50, { pro: 'Q' }), p('B', 'Y-2003', 60, { pro: 'Q' })], { asOf: AS_OF });
  assert.equal(recoveryText(r.items, {}).total, 900);
  const both = recoveryText(r.items, { confidence: ['high', 'medium'], contact: 'ar@b.example' });
  assert.equal(both.total, 960); assert.match(both.text, /\*\*To:\*\* ar@b\.example/); assert.match(both.text, /ATTACH remittance/);
});
