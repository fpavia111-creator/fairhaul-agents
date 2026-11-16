// Demurrage and detention: line names, repeat invoices, line LFDs, warnings and exposure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clocks, checkCharges, summary, disputeText } from '../src/index.js';

const terms = { start_offset_days: 1, warn_days: 2, lines: { 'MAERSK': { demurrage: { free_days: 4, tiers: [{ days: 3, rate: 100 }, { rate: 200 }] }, detention: { free_days: 5, tiers: [{ rate: 50 }] } } } };
const box = (id, extra = {}) => ({ container: id, line: 'Maersk A/S', bl: 'BL-1', size: '40HC', discharged: '2026-11-01', ...extra });

test('line terms are found whatever legal suffix the container file adds to the line name', () => {
  const [c] = clocks([box('C1', { gate_out: '2026-11-08' })], terms, { asOf: '2026-11-16' });
  assert.equal(c.dem_lfd, '2026-11-05'); assert.equal(c.dem_charge_days, 3); assert.equal(c.dem_cost, 300);
});

test('a second invoice for the same container is over by everything the first already covered', () => {
  const items = clocks([box('C1', { gate_out: '2026-11-08', empty_returned: '2026-11-10' })], terms, { asOf: '2026-11-16' });
  const r = checkCharges([{ container: 'C1', invoice_number: 'D-1', charge_type: 'Demurrage', amount: 300 }, { container: 'c1', invoice_number: 'D-2', charge_type: 'Demurrage', amount: 300 }], items);
  assert.deepEqual(r.map((x) => [x.status, x.difference]), [['ok', 0], ['over', 300]]);
  assert.match(r[1].detail, /Already billed 300 on D-1/);
  const split = checkCharges([{ container: 'C1', invoice_number: 'D-1', charge_type: 'Demurrage', amount: 200 }, { container: 'C1', invoice_number: 'D-2', charge_type: 'Demurrage', amount: 150 }], items);
  assert.deepEqual(split.map((x) => [x.status, x.difference]), [['ok', -100], ['over', 50]]);
});

test('a last free day from the line earlier than your terms is noted in the dispute detail', () => {
  const items = clocks([box('C1', { gate_out: '2026-11-08', last_free_day: '2026-11-04' })], terms, { asOf: '2026-11-16' });
  const [c] = checkCharges([{ container: 'C1', invoice_number: 'D-1', charge_type: 'Demurrage', days_billed: 4, amount: 400 }], items);
  assert.equal(c.status, 'over'); assert.match(c.detail, /line shows last free day 2026-11-04; your terms give 2026-11-05/);
  const d = disputeText([c], items, {});
  assert.equal(d.total, 100); assert.match(d.text, /# Demurrage and detention dispute: Maersk A\/S/);
});

test('a box near its last free day says act now, and on the day says pick up today', () => {
  assert.equal(clocks([box('C1')], terms, { asOf: '2026-11-03' })[0].status, 'act_now');
  assert.match(clocks([box('C1')], terms, { asOf: '2026-11-05' })[0].detail, /Today is the last free day/);
  assert.equal(clocks([box('C1')], terms, { asOf: '2026-11-02' })[0].status, 'in_free_time');
});

test('per diem is read as detention, and a line with no terms is not checked', () => {
  const items = clocks([box('C1', { gate_out: '2026-11-03', empty_returned: '2026-11-10' }), box('C2', { line: 'Other Line' })], terms, { asOf: '2026-11-16' });
  const r = checkCharges([{ container: 'C1', charge_type: 'Per Diem', amount: 150 }, { container: 'C2', charge_type: 'Demurrage', amount: 10 }], items);
  assert.deepEqual(r.map((x) => [x.type, x.status, x.expected]), [['detention', 'ok', 150], ['demurrage', 'not_checked', null]]);
});

test('open exposure leaves out returned containers and is split by line', () => {
  const items = clocks([box('C1', { gate_out: '2026-11-08', empty_returned: '2026-11-10' }), box('C2', { gate_out: '2026-11-03' })], terms, { asOf: '2026-11-16' });
  const s = summary(items);
  assert.equal(s.closed, 1); assert.equal(s.accruing, 1); assert.equal(s.exposure_open, items[1].exposure);
  assert.equal(items[1].det_cost, 450);
});
