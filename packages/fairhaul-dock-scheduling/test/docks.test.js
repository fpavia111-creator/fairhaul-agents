import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDay, reviewHistory, duration } from '../src/index.js';

const cfg = { doors: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], open: '06:00', close: '10:00', crews: 2 };
const req = (id, o = {}) => ({ load_id: id, pallets: 10, window_start: '06:00', window_end: '06:30', ...o });

test('floor loads take longer than palletised ones', () => {
  assert.equal(duration({ pallets: 10 }), 35); assert.equal(duration({ pallets: 10, floor_loaded: true }), 75);
});

test('crews cap loads worked at once even when doors are free', () => {
  const p = planDay([req('1'), req('2'), req('3')], cfg);
  assert.equal(p.scheduled, 2); assert.match(p.schedule.find((x) => x.status === 'no_slot').reason, /busy/);
});

test('the earliest window end goes first', () => {
  const p = planDay([req('late', { window_end: '09:00' }), req('tight', { window_end: '06:00' })], { ...cfg, doors: [{ name: 'A' }], crews: 1 });
  assert.equal(p.schedule.find((x) => x.load_id === 'tight').start, '06:00'); assert.equal(p.schedule.find((x) => x.load_id === 'late').start, '06:45');
});

test('no arrival is a no-show; arrival past grace is late', () => {
  const r = reviewHistory([{ load_id: 'a', appointment_at: '2026-11-01T07:00' }, { load_id: 'b', appointment_at: '2026-11-01T07:00', arrived_at: '2026-11-01T07:20' }], { graceMinutes: 15 });
  assert.deepEqual(r.items.map((x) => x.status), ['no_show', 'late']);
});
