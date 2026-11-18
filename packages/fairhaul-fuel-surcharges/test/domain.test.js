// Fuel surcharges: contract terms, per-mile tables, stale index weeks, carrier totals, table comparison, sensitivity and the dispute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFuel, compareTables, sensitivity, disputeText } from '../src/index.js';

const pct = (rows) => ({ basis: 'pct_of_linehaul', table: rows });
const index = [{ week_of: '2026-09-28', price: 3.3 }, { week_of: '2026-10-05', price: 3.4 }, { week_of: '2026-10-12', price: 3.6 }];
const contract = { tolerance: 1, fuel_index: index, carriers: [
  { carrier: 'Northbound Freight', scac: 'NBFX', effective: '2026-01-01', expires: '2026-10-09', fuel: pct([{ min: 3, max: 3.5, value: 10 }, { min: 3.5, max: 4, value: 12 }]) },
  { carrier: 'Northbound Freight', effective: '2026-10-10', expires: '2026-12-31', fuel: pct([{ min: 3, max: 3.5, value: 9 }, { min: 3.5, max: 4, value: 11 }]) },
  { carrier: 'Milepost Carriers', fuel: { basis: 'per_mile', table: [{ min: 3, max: 3.5, value: 0.4 }, { min: 3.5, max: 4, value: 0.45 }] } },
  { carrier: 'No Table Inc', lanes: [] },
] };
const inv = (o) => ({ invoice_number: 'I1', carrier: 'NBFX', ship_date: '2026-10-07', miles: 500, by_code: { linehaul: 1000, fuel: 100 }, ...o });

test('the fuel table in force on the ship date is used, and the SCAC finds it in every term', () => {
  const r = checkFuel([inv({}), inv({ invoice_number: 'I2', ship_date: '2026-10-13', by_code: { linehaul: 1000, fuel: 110 } })], contract);
  assert.deepEqual(r.items.map((i) => [i.carrier, i.expected, i.status]), [['Northbound Freight', 100, 'ok'], ['Northbound Freight', 110, 'ok']]);
});

test('a per-mile table needs miles, and a carrier with no table is flagged only when it bills fuel', () => {
  const r = checkFuel([inv({ carrier: 'Milepost Carriers', by_code: { linehaul: 1000, fuel: 200 } }), inv({ carrier: 'Milepost Carriers', miles: null }), inv({ carrier: 'No Table Inc' }), inv({ carrier: 'No Table Inc', by_code: { linehaul: 1000 } })], contract);
  assert.deepEqual(r.items.map((i) => i.status), ['ok', 'not_checked', 'fuel_not_in_contract', 'ok']);
  assert.match(r.items[1].detail, /per mile and the invoice has no miles/);
});

test('fuel above the table at the right week is fuel_over, and an index with a gap says so', () => {
  const r = checkFuel([inv({ by_code: { linehaul: 1000, fuel: 107 } })], contract).items[0];
  assert.equal(r.status, 'fuel_over'); assert.equal(r.difference, 7);
  const gap = checkFuel([inv({ ship_date: '2026-10-09', by_code: { linehaul: 1000, fuel: 100 } })], { ...contract, fuel_index: [index[0]] }).items[0];
  assert.equal(gap.status, 'index_stale'); assert.match(gap.detail, /latest 2026-09-28/);
});

test('fuel under the table and fuel not billed are noted but never disputed', () => {
  const r = checkFuel([inv({ by_code: { linehaul: 1000, fuel: 80 } }), inv({ invoice_number: 'I2', by_code: { linehaul: 1000 } })], contract);
  assert.deepEqual(r.items.map((i) => i.status), ['fuel_under', 'fuel_not_billed']); assert.equal(r.disputable, 0);
});

test('totals by carrier show fuel as a percent of linehaul and the amount over', () => {
  const r = checkFuel([inv({ by_code: { linehaul: 1000, fuel: 107 } }), inv({ invoice_number: 'I2' })], contract);
  assert.deepEqual(r.carriers.map((c) => [c.carrier, c.fuel_billed, c.over, c.avg_pct_of_linehaul]), [['Northbound Freight', 207, 7, 10.4]]);
});

test('the comparison shows one row per carrier, the terms in force at the latest index week', () => {
  const c = compareTables(contract, { prices: [3.6], linehaul: 1000, miles: 500 });
  assert.deepEqual(c.carriers.map((r) => [r.carrier, r.cells[0].fuel]), [['Northbound Freight', 110], ['Milepost Carriers', 225]]);
  assert.equal(c.carriers[0].terms, '2026-10-10 to 2026-12-31'); assert.equal(c.highest_at_middle_price, 'Milepost Carriers');
  assert.equal(compareTables(contract, { prices: [3.6], date: '2026-10-01' }).carriers[0].cells[0].fuel, 120);
});

test('sensitivity moves only invoices whose table steps; the dispute lists only overcharges for one carrier', () => {
  const s = sensitivity([inv({ ship_date: '2026-10-07' })], contract, { step: 0.1 });
  assert.equal(s.change, 20); assert.deepEqual(s.by_carrier, [{ carrier: 'Northbound Freight', change: 20 }]);
  assert.equal(sensitivity([inv({ ship_date: '2026-09-29' })], contract, { step: 0.1 }).change, 0);
  const r = checkFuel([inv({ by_code: { linehaul: 1000, fuel: 120 } }), inv({ invoice_number: 'I2' })], contract);
  const d = disputeText(r.items, { from: 'AP team' });
  assert.equal(d.total, 20); assert.deepEqual(d.invoices, ['I1']);
  assert.match(d.text, /matches the week of 2026-10-12/); assert.match(d.text, /\[TO CONFIRM index name and source\]/); assert.match(d.text, /\[TO CONFIRM Northbound Freight billing contact\]/);
});
