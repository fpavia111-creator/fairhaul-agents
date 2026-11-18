// Air invoices against weight-break rate sheets: terms, minimums, surcharges, services.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditAir, disputeText } from '../src/index.js';

const rates = { tolerance: 1, forwarders: [
  { forwarder: 'Skyline Logistics', aliases: ['SKY'], currency: 'USD', effective: '2026-01-01', expires: '2026-12-31', lanes: [{ origin: 'PVG', destination: 'LAX', minimum: 150, breaks: { '-45': 5, '+45': 4, '+100': 3.6 } }, { origin: 'PVG', destination: 'LAX', service: 'Express', breaks: { '-45': 8, '+45': 7 } }], surcharges: { FSC: { per_kg: 0.95 }, SSC: { per_kg: 0.15, on: 'actual', minimum: 10 }, AWB: { flat: 35 } } },
  { forwarder: 'Skyline Logistics', currency: 'USD', effective: '2027-01-01', expires: '2027-12-31', lanes: [{ origin: 'PVG', destination: 'LAX', breaks: { '-45': 6 } }] },
] };
const row = (code, amount, extra = {}) => ({ invoice_number: 'I-1', forwarder: 'SKY', awb: '176-1', origin: 'PVG', destination: 'LAX', flight_date: '2026-10-05', actual_kg: 120, volume_cbm: 0.3, billed_kg: 120, charge_code: code, amount, currency: 'USD', ...extra });

test('an alias holds for every rate sheet term of the forwarder', () => {
  const r = auditAir([row('Air Freight', 120 * 6, { flight_date: '2027-03-01' })], rates);
  assert.deepEqual(r.items[0].findings, []);
});

test('a small shipment is billed the lane minimum, not its weight times the rate', () => {
  const r = auditAir([row('Air Freight', 150, { actual_kg: 10, volume_cbm: 0, billed_kg: 10 })], rates);
  assert.deepEqual(r.items[0].findings, []);
  assert.equal(auditAir([row('Air Freight', 170, { actual_kg: 10, volume_cbm: 0, billed_kg: 10 })], rates).disputable, 20);
});

test('a surcharge on actual weight uses actual kg and its minimum; one on chargeable uses chargeable kg', () => {
  const ok = auditAir([row('AF', 432), row('Security', 18), row('Fuel surcharge', 114)], rates);
  assert.deepEqual(ok.items[0].findings, []);
  const small = auditAir([row('AF', 150, { actual_kg: 20, volume_cbm: 0, billed_kg: 20 }), row('SSC', 12)], rates);
  assert.deepEqual(small.items[0].findings.map((f) => [f.code, f.amount]), [['surcharge_over', 2]]);
});

test('billing on more kilos than chargeable is flagged; half a step of rounding is not', () => {
  assert.deepEqual(auditAir([row('AF', 432, { billed_kg: 120.2 })], rates).items[0].findings, []);
  const r = auditAir([row('AF', 432, { billed_kg: 150 })], rates);
  assert.equal(r.items[0].findings[0].code, 'weight_over'); assert.match(r.items[0].findings[0].detail, /120 kg chargeable/);
});

test('an Express shipment is priced on the Express lane, a standard one on the general lane', () => {
  assert.deepEqual(auditAir([row('AF', 840, { service: 'Express' })], rates).items[0].findings, []);
  assert.equal(auditAir([row('AF', 840, { service: '' })], rates).disputable, 408);
});

test('a bill in another currency is reported and not compared', () => {
  const r = auditAir([row('AF', 9999, { currency: 'CNY' })], rates);
  assert.deepEqual(r.items[0].findings.map((f) => f.code), ['currency_mismatch']); assert.equal(r.disputable, 0);
});

test('the dispute shows each weight and every finding with money on it, plus weight overbilling', () => {
  const r = auditAir([row('AF', 500, { billed_kg: 140 }), row('AWB fee', 50), row('Handling', 20)], rates);
  const d = disputeText(r.items, { from: 'Import desk' });
  assert.equal(d.total, 103); assert.match(d.text, /120 \/ 50 \/ 120/);
  assert.match(d.text, /Billed on 140 kg/); assert.match(d.text, /Handling \(20\) is not on the rate sheet/);
});
