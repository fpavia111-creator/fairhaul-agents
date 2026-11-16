// Entry lines against commercial invoices: splits, currencies, double entries and deadlines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEntries, correctionText } from '../src/index.js';

const e = (entry, line, extra = {}) => ({ entry_number: entry, line: String(line), entry_date: '2026-01-15', invoice_number: 'CI-1', sku: 'SKU-A', hts: '8471.30.0100', origin: 'CN', quantity: 10, entered_value: 1000, duty_rate: '5%', duty: 50, ...extra });
const ci = (extra = {}) => ({ invoice_number: 'CI-1', sku: 'SKU-A', quantity: 10, value: 1000, origin: 'CN', ...extra });

test('one invoice line split over two entry lines is compared as a total', () => {
  const r = checkEntries([e('E1', 1, { entered_value: 600, quantity: 6, duty: 30 }), e('E1', 2, { entered_value: 400, quantity: 4, duty: 20 })], [ci()]);
  assert.equal(r.findings, 0, JSON.stringify(r.items));
  const short = checkEntries([e('E1', 1, { entered_value: 600, quantity: 6, duty: 30 }), e('E1', 2, { entered_value: 300, quantity: 4, duty: 15 })], [ci()]);
  assert.deepEqual(short.items.map((f) => [f.code, f.duty_impact]), [['value_below_invoice', 5]]);
  assert.match(short.items[0].detail, /900 \(2 entry lines together\)/);
});

test('a foreign-currency invoice is converted at the entry\'s rate before comparing', () => {
  const r = checkEntries([e('E1', 1, { entered_value: 1100, duty: 55, exchange_rate: 1.1 })], [ci({ currency: 'EUR' })]);
  assert.equal(r.findings, 0);
  const off = checkEntries([e('E1', 1, { entered_value: 1000, duty: 50, exchange_rate: 1.1 })], [ci({ currency: 'EUR' })]);
  assert.match(off.items[0].detail, /invoice says 1100 \(EUR at 1\.1\)/);
});

test('the same invoice line on a second entry is flagged with the duty possibly paid twice', () => {
  const r = checkEntries([e('E1', 1), e('E2', 1)], [ci()]);
  const f = r.items.find((x) => x.code === 'entered_twice');
  assert.equal(f.entry_number, 'E2'); assert.equal(f.duty_impact, -50); assert.equal(r.duty_overpaid_estimate, 50);
});

test('duty that does not match value times rate is flagged; half a unit of rounding is not', () => {
  assert.equal(checkEntries([e('E1', 1, { duty: 50.4 })], [ci()]).findings, 0);
  const r = checkEntries([e('E1', 1, { duty: 45 })], [ci()]);
  assert.deepEqual(r.items.map((f) => [f.code, f.duty_impact]), [['duty_math', 5]]);
});

test('invoice lines with no entry line are listed only for invoices that were entered', () => {
  const r = checkEntries([e('E1', 1)], [ci(), ci({ sku: 'SKU-B', value: 250 }), ci({ invoice_number: 'CI-9', sku: 'SKU-Z' })]);
  assert.deepEqual(r.items.map((f) => [f.code, f.sku]), [['invoice_line_not_entered', 'SKU-B']]);
});

test('one tariff code from one origin at two rates is reported without saying which is right', () => {
  const r = checkEntries([e('E1', 1), e('E2', 1, { sku: 'SKU-B', invoice_number: 'CI-2', duty_rate: '7.5%', duty: 75 })], [ci(), ci({ invoice_number: 'CI-2', sku: 'SKU-B' })]);
  const f = r.items.find((x) => x.code === 'rate_inconsistent');
  assert.match(f.detail, /5% and 7\.5%/); assert.match(f.detail, /ask your broker/); assert.equal(f.duty_impact, null);
});

test('entries closest to their correction deadline come first, and the request names it', () => {
  const r = checkEntries([e('E1', 1, { entry_date: '2026-01-10', duty: 1 }), e('E2', 1, { entry_date: '2026-03-01', invoice_number: 'CI-2' }), e('E3', 1, { entry_date: '2025-06-01', invoice_number: 'CI-3', sku: 'SKU-C' })], [ci(), ci({ invoice_number: 'CI-2' })], { asOf: '2026-10-20', windowDays: 300 });
  assert.deepEqual(r.by_entry.map((x) => [x.entry_number, x.urgency]), [['E3', 'window_passed'], ['E1', 'urgent'], ['E2', 'open']]);
  assert.equal(r.urgent, 1);
  const text = correctionText(r, 'E1', { broker: 'Harbor Customs' });
  assert.match(text, /Hello Harbor Customs,/); assert.match(text, /before 2026-11-06/); assert.match(text, /not asking you to change any tariff classification/);
});

test('a rate written with a percent sign is read, and 0.5% is half a percent', () => {
  const r = checkEntries([e('E1', 1, { duty_rate: '0.5%', duty: 5 }), e('E1', 2, { sku: 'SKU-B', hts: '8504.40.9580', duty_rate: '5 %', duty: 50 })], [ci(), ci({ sku: 'SKU-B' })]);
  assert.equal(r.findings, 0, JSON.stringify(r.items));
});
