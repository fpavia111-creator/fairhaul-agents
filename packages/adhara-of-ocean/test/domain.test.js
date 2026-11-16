// Ocean invoices against the service contract: terms, currencies, counts and surcharges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditOcean, disputeText } from '../src/index.js';

const lane = { pol: 'CNSHA', pod: 'USLAX', rates: { '40HC': 2200, '20GP': 1650 } };
const cfg = { tolerance: 1, contracts: [
  { carrier: 'Blue Meridian Line', aliases: ['BML'], reference: 'SC-2026', currency: 'USD', effective: '2026-01-01', expires: '2026-12-31', lanes: [lane], surcharges: { BAF: { per_container: { '40HC': 560 } }, DOC: { flat: 75 }, THC_O: { included: true }, PSS: { flat: 300, valid_from: '2026-07-01', valid_to: '2026-09-30' } } },
  { carrier: 'Blue Meridian Line', reference: 'SC-2027', currency: 'USD', effective: '2027-01-01', expires: '2027-12-31', lanes: [{ ...lane, rates: { '40HC': 2500 } }] },
] };
const line = (code, amount, extra = {}) => ({ invoice_number: 'INV-1', carrier: 'BML', bl: 'BL-1', pol: 'CN SHA', pod: 'US-LAX', sailing_date: '2026-11-02', equipment: '40HC', containers: 1, charge_code: code, amount, currency: 'USD', ...extra });

test('the contract in force on the sailing date is used, found by a carrier alias', () => {
  const r = auditOcean([line('Ocean Freight', 2500, { sailing_date: '2027-02-01' })], cfg);
  assert.equal(r.items[0].contract, 'SC-2027'); assert.equal(r.disputable, 0);
  const r26 = auditOcean([line('Ocean Freight', 2500)], cfg);
  assert.equal(r26.items[0].contract, 'SC-2026'); assert.equal(r26.disputable, 300);
});

test('a sailing outside every term is contract_expired, a stranger line is no_contract', () => {
  assert.equal(auditOcean([line('OFR', 2200, { sailing_date: '2025-06-01' })], cfg).items[0].findings[0].code, 'contract_expired');
  assert.equal(auditOcean([line('OFR', 2200, { carrier: 'Unknown Line' })], cfg).items[0].findings[0].code, 'no_contract');
});

test('a bill in another currency is flagged and its amounts are not compared', () => {
  const r = auditOcean([line('OFR', 9999, { currency: 'EUR' }), line('BAF', 9999, { currency: 'EUR' })], cfg);
  assert.deepEqual(r.items[0].findings.map((f) => f.code), ['currency_mismatch']); assert.equal(r.disputable, 0);
});

test('freight billed on more boxes than the B/L counts the extra box once, not again as a rate overcharge', () => {
  const r = auditOcean([line('OFR', 6600, { containers: 2, quantity: 3 })], cfg);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['container_count', 2200]]);
});

test('flat, included and seasonal surcharges are each priced their own way', () => {
  const r = auditOcean([line('OFR', 2200), line('B/L fee', 100), line('Origin THC', 180), line('Peak season', 300), line('Bunker', 560.5)], cfg);
  const got = Object.fromEntries(r.items[0].findings.map((f) => [f.code, f.amount]));
  assert.deepEqual(got, { surcharge_over: 25, surcharge_included: 180, surcharge_out_of_window: 300 });
});

test('a charge the contract never mentions is disputable in full, under a code made from its wording', () => {
  const r = auditOcean([line('OFR', 2200), line('Weird admin fee', 40)], cfg);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['surcharge_not_in_contract', 40]]);
  assert.match(r.items[0].findings[0].detail, /WEIRD_ADMIN_FEE/);
});

test('the dispute lists only findings with money on them and totals them', () => {
  const r = auditOcean([line('OFR', 2300), line('OFR', 1650, { bl: 'BL-2', equipment: '20GP' }), line('BAF', 560, { bl: 'BL-2', equipment: '20GP' })], cfg);
  assert.equal(r.items[1].findings.find((f) => f.code === 'surcharge_unpriced').amount, 0);
  const d = disputeText(r.items.filter((i) => i.disputable > 0), { from: 'Import team' });
  assert.equal(d.total, 100);
  assert.match(d.text, /SC-2026/); assert.doesNotMatch(d.text, /BL-2/); assert.match(d.text, /\[TO CONFIRM BML billing contact\]/);
});
