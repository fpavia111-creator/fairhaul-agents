// Free and consumer mailboxes found in real FMCSA census records during the final pass (19 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vetCarriers } from '../src/index.js';

const carrier = (id, email) => ({ carrier_id: id, name: `Carrier ${id}`, mc: '', dot: id, phone: '', email, address: '', remit_to: '', bank_last4: '', bank_changed: '', authority_date: '2015-01-01', insurance_expiry: '2027-12-31', safety_rating: '', status: 'active' });
const free = (email) => vetCarriers([carrier('X', email)], [], { asOf: '2026-11-16' }).rows[0].signal_list.some((s) => s.code === 'free_email');

test('consumer mailboxes seen in real carrier records count as free mail', () => {
  for (const d of ['gmail.com', 'live.com', 'msn.com', 'ymail.com', 'me.com', 'comcast.net', 'att.net', 'bellsouth.net', 'verizon.net', 'sbcglobal.net', 'proton.me']) assert.ok(free(`dispatch@${d}`), d);
});

test('a company domain is not free mail', () => {
  for (const d of ['ridgeline-freight.example', 'liveoak-trucking.example', 'mettler.example']) assert.ok(!free(`dispatch@${d}`), d);
});
