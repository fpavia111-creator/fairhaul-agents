// Dock planning and history: times as people write them, door types, limits, priorities, waits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDay, reviewHistory, scheduleText } from '../src/index.js';

const dock = { doors: [{ name: 'D1' }, { name: 'D2', types: ['reefer'] }], open: '06:00', close: '14:00' };
const req = (id, extra = {}) => ({ load_id: id, carrier: 'Ridgeline', pallets: 10, ...extra });

test('windows written in 12-hour time are read as the afternoon they mean', () => {
  const p = planDay([req('L1', { window_start: '1:00 PM', window_end: '1:30 PM' }), req('L2', { window_start: '12:00 am', window_end: '7:00 am' })], dock);
  assert.deepEqual(p.schedule.map((x) => [x.load_id, x.start, x.window]), [['L2', '06:00', '00:00-07:00'], ['L1', '13:00', '13:00-13:30']]);
});

test('a reefer load goes only to a reefer door, and a type no door takes is refused with a reason', () => {
  const p = planDay([req('R1', { door_type: 'Reefer' }), req('F1', { door_type: 'flatbed' })], { ...dock, doors: [{ name: 'D1', types: ['dry'] }, { name: 'D2', types: ['reefer'] }] });
  assert.equal(p.schedule.find((x) => x.load_id === 'R1').door, 'D2');
  assert.equal(p.schedule.find((x) => x.load_id === 'F1').reason, 'no door takes flatbed');
});

test('a load that cannot finish before close is refused with the reason, not squeezed in', () => {
  const p = planDay([req('L1', { pallets: 30, floor_loaded: 'yes', window_start: '12:00' })], dock);
  assert.equal(p.schedule[0].status, 'no_slot'); assert.match(p.schedule[0].reason, /needs 195 minutes; the dock closes before it could finish/);
  assert.equal(planDay([req('L1', { pallets: 100, floor_loaded: 'yes' })], dock).schedule[0].reason, 'longer than the dock day');
});

test('with one slot left in a window, the higher priority load gets it', () => {
  const one = { doors: [{ name: 'D1' }], open: '06:00', close: '14:00' };
  const p = planDay([req('LOW', { window_start: '06:00', window_end: '06:00', priority: 1 }), req('HOT', { window_start: '06:00', window_end: '06:00', priority: 5 })], one);
  assert.deepEqual(p.schedule.map((x) => [x.load_id, x.status]), [['HOT', 'scheduled'], ['LOW', 'no_slot']]);
});

test('door use and the hourly load are reported for the day', () => {
  const p = planDay([req('L1'), req('L2'), req('L3', { door_type: 'reefer' })], dock);
  assert.deepEqual(p.by_door.map((d) => [d.door, d.appointments, d.minutes_used]), [['D1', 2, 70], ['D2', 1, 35]]);
  assert.equal(p.by_hour[0].working, 3); assert.equal(p.utilisation_pct, 11);
});

test('history after the as-of date is left out; carriers are ranked worst first; the worst hour is named', () => {
  const h = [
    { load_id: '1', carrier: 'A', appointment_at: '2026-11-10T08:00:00', arrived_at: '2026-11-10T08:05:00', door_at: '2026-11-10T08:50:00', departed_at: '2026-11-10T09:30:00' },
    { load_id: '2', carrier: 'B', appointment_at: '2026-11-10T10:00:00', arrived_at: '2026-11-10T10:40:00', door_at: '2026-11-10T10:50:00', departed_at: '2026-11-10T11:30:00' },
    { load_id: '3', carrier: 'B', appointment_at: '2026-11-11T08:00:00' },
    { load_id: '4', carrier: 'A', appointment_at: '2026-11-20T08:00:00' },
  ];
  const r = reviewHistory(h, { asOf: '2026-11-16' });
  assert.equal(r.appointments, 3); assert.deepEqual([r.late, r.no_show], [1, 1]);
  assert.deepEqual(r.by_carrier.map((c) => [c.carrier, c.on_time_pct]), [['B', 0], ['A', 100]]);
  assert.deepEqual(r.worst_hour, { hour: '08:00', appointments: 1, avg_wait: 45, max_wait: 45 });
});

test('the confirmation lists placed loads and asks the others to propose another time', () => {
  const p = planDay([req('L1'), req('F1', { door_type: 'flatbed' })], { ...dock, doors: [{ name: 'D1', types: ['dry'] }] });
  const text = scheduleText(p, { date: '2026-11-18', grace: 10 });
  assert.match(text, /# Dock appointments, 2026-11-18/); assert.match(text, /more than 10 minutes late/);
  assert.match(text, /\| L1 \| Ridgeline \| D1 \| 06:00 \|/); assert.match(text, /- F1 \(Ridgeline\), asked 06:00-14:00: no door takes flatbed/);
});
