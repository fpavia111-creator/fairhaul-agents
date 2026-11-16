// Open loads against tracking: failed deliveries, missed pickups, silence, ETAs and the notice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, noticeText } from '../src/index.js';

const NOW = '2026-11-16T10:00';
const load = (id, extra = {}) => ({ shipment_id: id, carrier: 'Ridgeline Freight', customer: 'Acme', pickup_appt: '2026-11-15T08:00', delivery_appt: '2026-11-17T08:00', ...extra });
const ev = (id, at, event, extra = {}) => ({ shipment_id: id, at, event, ...extra });

test('a failed delivery attempt is a delay, not a delivery', () => {
  const r = assess([load('L1')], [ev('L1', '2026-11-15T09:00', 'Picked up'), ev('L1', '2026-11-16T09:30', 'Delivery attempted - not delivered, receiver closed')], { asOf: NOW });
  assert.equal(r.items[0].status, 'at_risk'); assert.match(r.items[0].detail, /Carrier reported: Delivery attempted/);
  assert.equal(assess([load('L1')], [ev('L1', '2026-11-16T09:00', 'Delivered, POD signed')], { asOf: NOW }).items[0].status, 'delivered_not_closed');
});

test('no pickup event two hours after the pickup time is a missed pickup', () => {
  const r = assess([load('L1', { pickup_appt: '2026-11-16T07:30' })], [ev('L1', '2026-11-16T07:00', 'Dispatched')], { asOf: NOW });
  assert.equal(r.items[0].status, 'late'); assert.deepEqual(r.items[0].issues, ['missed_pickup']);
  assert.equal(assess([load('L1', { pickup_appt: '2026-11-16T08:30' })], [ev('L1', '2026-11-16T07:00', 'Dispatched')], { asOf: NOW }).items[0].status, 'on_track');
});

test('a load with no events at all after its pickup time is reported as having no tracking', () => {
  const r = assess([load('L1', { pickup_appt: '2026-11-16T09:00' })], [], { asOf: NOW });
  assert.deepEqual(r.items[0].issues, ['no_tracking']); assert.equal(r.items[0].status, 'blind');
});

test('an ETA past the appointment is a risk only beyond the minutes allowed', () => {
  const evs = [ev('L1', '2026-11-15T09:00', 'Picked up'), ev('L1', '2026-11-16T09:00', 'In transit', { eta: '2026-11-17T08:20' })];
  assert.equal(assess([load('L1')], evs, { asOf: NOW, riskMinutes: 30 }).items[0].status, 'on_track');
  assert.equal(assess([load('L1')], evs, { asOf: NOW, riskMinutes: 15 }).items[0].status, 'at_risk');
});

test('the worst loads come first and carriers are ranked by how well they track', () => {
  const r = assess([load('A'), load('B', { carrier: 'Prairie Express' }), load('C', { delivery_appt: '2026-11-16T06:00' })], [ev('A', '2026-11-15T09:00', 'Picked up'), ev('B', '2026-11-16T09:00', 'Picked up'), ev('C', '2026-11-16T09:30', 'In transit')], { asOf: NOW });
  assert.deepEqual(r.items.map((i) => [i.shipment_id, i.status]), [['C', 'late'], ['A', 'blind'], ['B', 'on_track']]);
  assert.deepEqual(r.carriers.map((c) => [c.carrier, c.tracking_ok_pct]), [['Ridgeline Freight', 50], ['Prairie Express', 100]]);
});

test('loads closed in the TMS are skipped even when their events say otherwise', () => {
  const r = assess([load('L1', { status: 'Delivered' }), load('L2', { status: 'Cancelled' })], [ev('L1', '2026-11-16T09:00', 'In transit')], { asOf: NOW });
  assert.equal(r.open, 0);
});

test('the customer notice asks for a new estimate where the carrier gave none', () => {
  const r = assess([load('L1', { delivery_appt: '2026-11-16T06:00' }), load('L2')], [ev('L1', '2026-11-16T09:00', 'Weather delay', { location: 'Joplin, MO' }), ev('L2', '2026-11-16T09:00', 'In transit', { eta: '2026-11-17T12:00' })], { asOf: NOW });
  const text = noticeText(r.items.filter((i) => i.status !== 'on_track'), { customer: 'Acme' });
  assert.match(text, /# Delivery update for Acme/); assert.match(text, /\| L1 \| 2026-11-16T06:00 \| \[TO CONFIRM new estimate with the carrier\] \| Weather delay \(2026-11-16T09:00\) \|/);
  assert.match(text, /\| L2 \| 2026-11-17T08:00 \| 2026-11-17T12:00 \|/);
});
