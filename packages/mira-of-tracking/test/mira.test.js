import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess } from '../src/index.js';

const load = (o) => ({ shipment_id: 'L1', carrier: 'A', customer: 'C', pickup_appt: '2026-11-16 06:00', delivery_appt: '2026-11-17 12:00', status: 'In Transit', ...o });
const ev = (at, event, eta = '') => ({ shipment_id: 'L1', at, event, eta });

test('fresh updates and an ETA before the appointment are on track', () => {
  assert.equal(assess([load({})], [ev('2026-11-16 06:30', 'Picked up', '2026-11-17 10:00'), ev('2026-11-16 09:00', 'In transit')], { asOf: '2026-11-16 10:00' }).items[0].status, 'on_track');
});

test('stale is measured from the last event, only once the load is moving', () => {
  const r = assess([load({})], [ev('2026-11-16 06:30', 'Picked up')], { asOf: '2026-11-16 12:00', staleHours: 4 }).items[0];
  assert.equal(r.status, 'blind'); assert.deepEqual(r.issues, ['stale']);
});

test('the latest ETA wins over earlier ones', () => {
  const r = assess([load({})], [ev('2026-11-16 06:30', 'Picked up', '2026-11-17 18:00'), ev('2026-11-16 09:00', 'In transit', '2026-11-17 11:00')], { asOf: '2026-11-16 10:00' }).items[0];
  assert.equal(r.status, 'on_track'); assert.equal(r.eta, '2026-11-17 11:00');
});

test('closed and cancelled loads are left out', () => {
  assert.equal(assess([load({ status: 'Delivered' }), load({ shipment_id: 'L2', status: 'Cancelled' })], [], { asOf: '2026-11-16 10:00' }).open, 0);
});
