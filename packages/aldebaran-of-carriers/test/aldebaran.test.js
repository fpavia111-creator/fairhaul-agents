import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vetCarriers, verificationText } from '../src/index.js';

const c = (o) => ({ carrier_id: 'A', name: 'Alpha Freight', mc: '1', phone: '(312) 555-0100', email: 'ops@alpha.example', ...o });

test('the same phone in different formats on two carriers is shared; on one carrier twice it is not', () => {
  const r = vetCarriers([c(), c({ carrier_id: 'B', name: 'Beta Haul', phone: '+1 312.555.0100' })], [], { asOf: '2026-11-16' });
  assert.ok(r.rows.every((x) => x.signals.includes('shared_phone')));
  const same = vetCarriers([c(), c({ carrier_id: 'A2', name: 'Alpha Freight LLC' })], [], { asOf: '2026-11-16' });
  assert.ok(same.rows.every((x) => !x.signals.includes('shared_phone')));
});

test('insurance that ends before pickup flags the load even when the carrier is otherwise clean', () => {
  const r = vetCarriers([c({ insurance_expiry: '2027-01-10' })], [{ load_id: 'L1', carrier_id: 'a', pickup_date: '2027-01-12' }], { asOf: '2026-11-16' });
  assert.equal(r.rows[0].level, 'none'); assert.equal(r.load_rows[0].action, 'verify before pickup');
  assert.match(r.load_rows[0].reasons, /before pickup/);
});

test('the verification request asks for documents and keeps signals in an internal note', () => {
  const r = vetCarriers([c({ remit_to: 'Bluewater Factoring', bank_changed: '2026-11-10' })], [], { asOf: '2026-11-16' });
  const t = verificationText(r, 'A');
  assert.match(t, /notice of assignment/); assert.match(t, /call you on the number we already hold/); assert.match(t, /Internal note, remove before sending/);
  assert.doesNotMatch(t.split('Internal note')[0], /fraud/i);
});
