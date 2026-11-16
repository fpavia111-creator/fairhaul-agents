// Carrier warning signs: what raises a carrier, what does not, and what the request says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vetCarriers, verificationText } from '../src/index.js';
import { OPEN_MARKER } from 'lodestar-core';

const AS_OF = '2026-11-16';
const c = (id, extra = {}) => ({ carrier_id: id, name: `Carrier ${id}`, mc: `MC-${id.length}${id.charCodeAt(0)}`, dot: '1', phone: `555-010-${id.charCodeAt(0)}`, email: `${id}@carrier-${id}.example`, authority_date: '2019-01-01', insurance_expiry: '2027-06-30', ...extra });

test('a blocked carrier\'s bank account turning up on a new name raises the new carrier only', () => {
  const r = vetCarriers([c('OLD', { status: 'Blocked', bank_last4: '****4321' }), c('NEW', { bank_last4: '4321' })], [], { asOf: AS_OF });
  const nw = r.rows.find((x) => x.carrier_id === 'NEW'); const old = r.rows.find((x) => x.carrier_id === 'OLD');
  assert.equal(nw.level, 'high'); assert.match(nw.details[0], /Carrier OLD \(OLD, blocked\)/);
  assert.equal(old.level, 'inactive'); assert.equal(old.signals, '');
});

test('a +1 country code and dashes do not hide a shared phone', () => {
  const r = vetCarriers([c('A', { phone: '+1 (555) 010-7777' }), c('B', { phone: '555.010.7777' })], [], { asOf: AS_OF });
  assert.deepEqual(r.rows.map((x) => x.signals), ['shared_phone', 'shared_phone']);
});

test('remitting to a factor is a low sign; the same name in other punctuation is none', () => {
  const r = vetCarriers([c('A', { remit_to: 'Apex Factoring LLC' }), c('B', { remit_to: 'CARRIER B.' })], [], { asOf: AS_OF });
  assert.deepEqual(r.rows.map((x) => [x.carrier_id, x.level]), [['A', 'low'], ['B', 'none']]);
});

test('new authority plus a free mailbox is medium; the authority window is configurable', () => {
  const r = vetCarriers([c('A', { authority_date: '2026-09-01', email: 'dispatch@gmail.com' })], [], { asOf: AS_OF });
  assert.equal(r.rows[0].level, 'medium'); assert.equal(r.rows[0].score, 3);
  assert.equal(vetCarriers([c('A', { authority_date: '2026-09-01' })], [], { asOf: AS_OF, newAuthorityDays: 60 }).rows[0].level, 'none');
});

test('expired insurance outranks insurance about to expire, and a payment change counts for 30 days', () => {
  const r = vetCarriers([c('A', { insurance_expiry: '2026-11-01' }), c('B', { insurance_expiry: '2026-12-01' }), c('C', { bank_changed: '2026-10-20' }), c('D', { bank_changed: '2026-10-10' })], [], { asOf: AS_OF });
  const got = Object.fromEntries(r.rows.map((x) => [x.carrier_id, x.signals]));
  assert.deepEqual(got, { A: 'insurance_expired', B: 'insurance_expiring', C: 'bank_changed_recently', D: '' });
});

test('a load on a carrier missing from the master is held, ahead of verified ones', () => {
  const r = vetCarriers([c('A')], [{ load_id: 'L2', carrier_id: 'a' }, { load_id: 'L1', carrier_id: 'ZZZ' }], { asOf: AS_OF });
  assert.deepEqual(r.load_rows.map((l) => [l.load_id, l.level, l.action]), [['L1', 'unknown', 'carrier not in the master; vet before pickup'], ['L2', 'none', 'none']]);
  assert.equal(r.loads_to_hold, 1);
});

test('the internal note is an open marker, so the request cannot be approved with it still in', () => {
  const r = vetCarriers([c('A', { bank_changed: '2026-11-10', remit_to: 'Apex Factoring' })], [], { asOf: AS_OF });
  const text = verificationText(r, 'A', { to: 'dispatch@carrier-a.example' });
  assert.ok((text.match(OPEN_MARKER) || []).some((m) => /internal note/.test(m)));
  const outward = text.split('[CHECK: internal note')[0];
  assert.match(outward, /notice of assignment/); assert.match(outward, /call you on the number we already hold/); assert.doesNotMatch(outward, /changed 2026-11-10/);
});
