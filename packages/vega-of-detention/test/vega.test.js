import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earned, termsFor, auditCharges } from '../src/index.js';

const tm = termsFor({}, '');
test('the clock starts at the appointment when the truck is early', () => {
  const e = earned({ appointment_at: '2026-11-02T08:00:00', arrived_at: '2026-11-02T06:00:00', departed_at: '2026-11-02T11:00:00' }, tm);
  assert.equal(e.hours, 3); assert.equal(e.payable, 50);
});
test('a late truck earns no detention', () => {
  const e = earned({ appointment_at: '2026-11-02T08:00:00', arrived_at: '2026-11-02T08:20:00', departed_at: '2026-11-02T14:00:00' }, tm);
  assert.equal(e.payable, 0); assert.equal(e.late, true);
});
test('time is rounded up to the billing increment, and the cap applies', () => {
  assert.equal(earned({ arrived_at: '2026-11-02T08:00:00', departed_at: '2026-11-02T10:01:00' }, tm).payable, 12.5);
  assert.equal(earned({ arrived_at: '2026-11-02T08:00:00', departed_at: '2026-11-03T08:00:00' }, { ...tm, max_per_stop: 300 }).payable, 300);
});
test('departure before arrival is not trusted', () => {
  assert.equal(earned({ arrived_at: '2026-11-02T10:00:00', departed_at: '2026-11-02T09:00:00' }, tm).payable, null);
});
test('other charges are ignored, and a matching stop without a stop number is found', () => {
  const r = auditCharges([{ load_id: 'A', charge_type: 'Fuel', amount: 10 }, { load_id: 'A', charge_type: 'Detention', amount: 50 }], [{ load_id: 'a', arrived_at: '2026-11-02T08:00:00', departed_at: '2026-11-02T11:00:00' }]);
  assert.equal(r.charges, 1); assert.equal(r.items[0].status, 'ok');
});
