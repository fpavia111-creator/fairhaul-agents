import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEntries, correctionText } from '../src/index.js';

const e = (o) => ({ entry_number: 'E1', entry_date: '2026-10-01', line: '1', invoice_number: 'CI-1', sku: 'A', hts: '1111.11', origin: 'VN', quantity: 10, entered_value: 1000, duty_rate: 5, duty: 50, ...o });
const i = (o) => ({ invoice_number: 'ci-1', sku: 'a', quantity: 10, value: 1000, origin: 'vn', ...o });
const codes = (r) => r.items.map((x) => x.code);

test('a clean line raises nothing; matching ignores case', () => {
  assert.deepEqual(codes(checkEntries([e()], [i()])), []);
});

test('value below invoice estimates duty owed; a rate of 0.05 and 5 mean the same', () => {
  const r = checkEntries([e({ entered_value: 800, duty: 40, duty_rate: 0.05 })], [i()]);
  assert.deepEqual(codes(r), ['value_below_invoice']); assert.equal(r.items[0].duty_impact, 10); assert.equal(r.duty_underpaid_estimate, 10);
});

test('the deadline counts from the entry date only when a window is given', () => {
  assert.equal(checkEntries([e()], [i()], { asOf: '2026-10-11' }).by_entry[0].days_left, null);
  const r = checkEntries([e()], [i()], { asOf: '2026-10-11', windowDays: 30 }).by_entry[0];
  assert.equal(r.correct_by, '2026-10-31'); assert.equal(r.days_left, 20); assert.equal(r.urgency, 'urgent');
});

test('different codes are reported, and the draft never proposes one', () => {
  const r = checkEntries([e(), e({ entry_number: 'E2', invoice_number: 'CI-2', hts: '2222.22' })], [i(), i({ invoice_number: 'CI-2' })]);
  assert.ok(codes(r).includes('code_inconsistent'));
  const t = correctionText(r, 'E2');
  assert.match(t, /not asking you to change any tariff classification/); assert.match(t, /TO CONFIRM: broker contact/);
});
