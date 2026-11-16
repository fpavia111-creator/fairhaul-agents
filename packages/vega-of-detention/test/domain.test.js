// Detention, layover and lumper: rebilled stops, loads with several stops, receipts, carrier terms, facilities and the dispute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditCharges, facilities, termsFor, disputeText } from '../src/index.js';

const stop = (load, n, arr, dep, extra = {}) => ({ load_id: load, stop: String(n), facility: 'DC North', appointment_at: arr, arrived_at: arr, departed_at: dep, ...extra });
const chg = (load, n, type, amount, extra = {}) => ({ load_id: load, stop: n === null ? '' : String(n), carrier: 'Example Linehaul', charge_type: type, amount, invoice_number: 'INV-1', ...extra });

test('detention billed again for the same stop on a second invoice gets only what is left', () => {
  const stops = [stop('L1', 2, '2026-11-02T08:00:00', '2026-11-02T13:00:00')]; // 5 h on site, 3 h chargeable = 150
  const r = auditCharges([chg('L1', 2, 'Detention', 150), chg('L1', 2, 'Detention', 150, { invoice_number: 'INV-2' })], stops);
  assert.deepEqual(r.items.map((i) => [i.allowed, i.disputable, i.status]), [[150, 0, 'ok'], [0, 150, 'dispute']]);
  assert.match(r.items[1].findings.find((f) => f.code === 'already_billed').detail, /150 of the 150/);
});

test('a charge with no stop number is checked against every stop on the load', () => {
  const stops = [stop('L2', 1, '2026-11-02T06:00:00', '2026-11-02T09:00:00'), stop('L2', 2, '2026-11-02T14:00:00', '2026-11-02T18:00:00', { facility: 'DC South' })]; // 50 + 100
  const ok = auditCharges([chg('L2', null, 'Detention', 150)], stops).items[0];
  assert.equal(ok.allowed, 150); assert.equal(ok.status, 'ok'); assert.equal(ok.facility, 'DC North, DC South');
  const over = auditCharges([chg('L2', null, 'Detention', 250)], stops).items[0];
  assert.equal(over.disputable, 100); assert.match(over.findings[0].detail, /across the load's 2 stops \(stop 1: 50, stop 2: 100\)/);
});

test('carrier terms override the defaults, matched by name with or without the legal form', () => {
  const terms = { rate_per_hour: 50, carriers: { 'Example Linehaul LLC': { free_hours: 1, rate_per_hour: 75 } } };
  assert.equal(termsFor(terms, 'Example Linehaul').rate_per_hour, 75);
  const r = auditCharges([chg('L3', 1, 'Detention', 300)], [stop('L3', 1, '2026-11-02T08:00:00', '2026-11-02T12:00:00')], terms);
  assert.equal(r.items[0].allowed, 225); assert.equal(r.items[0].disputable, 75);
});

test('layover needs the minimum hours on site, and is held to the agreed amount', () => {
  const short = auditCharges([chg('L4', 1, 'Layover', 250)], [stop('L4', 1, '2026-11-02T08:00:00', '2026-11-02T20:00:00')], { layover_amount: 200 }).items[0];
  assert.equal(short.findings[0].code, 'layover_not_earned'); assert.equal(short.disputable, 250);
  const long = auditCharges([chg('L4', 1, 'Layover', 250)], [stop('L4', 1, '2026-11-02T08:00:00', '2026-11-03T09:00:00')], { layover_amount: 200 }).items[0];
  assert.equal(long.findings[0].code, 'layover_over'); assert.equal(long.disputable, 50);
});

test('a lumper charge is held to its receipt, and with no receipt it is not paid until one arrives', () => {
  const st = [stop('L5', 1, '2026-11-02T08:00:00', '2026-11-02T09:00:00', { lumper_receipt: 'R-9', lumper_receipt_amount: '180' })];
  assert.equal(auditCharges([chg('L5', 1, 'Lumper', 220)], st).items[0].disputable, 40);
  const none = auditCharges([chg('L6', 1, 'Lumper Fee', 220)], [stop('L6', 1, '2026-11-02T08:00:00', '2026-11-02T09:00:00')]).items[0];
  assert.equal(none.findings[0].code, 'lumper_no_receipt'); assert.equal(none.status, 'dispute');
  assert.equal(auditCharges([chg('L6', 1, 'Lumper', 220)], [stop('L6', 1, '2026-11-02T08:00:00', '2026-11-02T09:00:00')], { lumper_requires_receipt: false }).items[0].status, 'ok');
});

test('facilities rank by detention billed, then dwell, and count late carriers', () => {
  const stops = [stop('A', 1, '2026-11-02T08:00:00', '2026-11-02T14:00:00'), stop('B', 1, '2026-11-02T08:00:00', '2026-11-02T09:00:00', { arrived_at: '2026-11-02T09:00:00', departed_at: '2026-11-02T10:00:00' }), stop('C', 1, '2026-11-02T08:00:00', '2026-11-02T09:00:00', { facility: 'DC East' })];
  const f = facilities(stops, [chg('A', 1, 'Detention', 200)]);
  assert.deepEqual(f.map((x) => [x.facility, x.stops, x.detention_billed, x.carriers_late, x.over_free_time]), [['DC North', 2, 200, 1, 1], ['DC East', 1, 0, 0, 0]]);
  assert.equal(f[0].avg_dwell_hours, 3.5);
});

test('the dispute lists only charges to dispute, totals them and asks for the dock log', () => {
  const r = auditCharges([chg('L1', 2, 'Detention', 300), chg('L7', 1, 'Detention', 50)], [stop('L1', 2, '2026-11-02T08:00:00', '2026-11-02T13:00:00'), stop('L7', 1, '2026-11-02T08:00:00', '2026-11-02T11:00:00')]);
  const d = disputeText(r.items, { carrier: 'Example Linehaul', from: 'Ops' });
  assert.equal(d.total, 150); assert.deepEqual(d.loads, ['L1']);
  assert.match(d.text, /\[ATTACH gate or dock log extract/); assert.match(d.text, /\[TO CONFIRM carrier billing contact\]/); assert.doesNotMatch(d.text, /\| L7 \|/);
});
