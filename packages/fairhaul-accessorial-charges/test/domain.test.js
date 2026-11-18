// Accessorials: what was ordered, what the contract allows, and which repeats are worth fixing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, fixText } from '../src/index.js';

const inv = (n, lines, extra = {}) => ({ invoice_number: n, carrier: 'Ridgeline Freight', ship_date: '2026-11-02', pro: n, total: lines.reduce((s, l) => s + l.amount, 0), destination: { city: 'Austin', state: 'TX', postal: '78701' }, lines, ...extra });
const L = (code, amount) => ({ code, description: code, amount });
const contract = { tolerance: 1, carriers: [{ carrier: 'Ridgeline Freight', effective: '2026-01-01', expires: '2026-12-31', lanes: [{ origin: '*', destination: '*', basis: 'flat', rate: 400 }], accessorials: { liftgate: { amount: 25 }, residential: { amount: 95 }, hazmat: { not_allowed: true } } }] };

test('a charge ordered on every load is not an address-book fix; one missed once still is', () => {
  const ship = [{ shipment_id: 'S1', pro: '1', accessorials_ordered: 'liftgate' }, { shipment_id: 'S2', pro: '2', accessorials_ordered: 'liftgate' }];
  assert.equal(analyse([inv('1', [L('liftgate', 25)]), inv('2', [L('liftgate', 25)])], ship).fixes.length, 0);
  const once = [{ ...ship[0] }, { ...ship[1], accessorials_ordered: '' }, { shipment_id: 'S3', pro: '3', accessorials_ordered: '' }];
  const r = analyse([inv('1', [L('liftgate', 25)]), inv('2', [L('liftgate', 25)]), inv('3', [L('liftgate', 25)])], once);
  assert.deepEqual(r.fixes.map((f) => [f.times, f.ordered_times]), [[3, 1]]);
  const twice = analyse([inv('1', [L('liftgate', 25)]), inv('2', [L('liftgate', 25)])], [ship[0], { ...ship[1], accessorials_ordered: '' }]);
  assert.deepEqual(twice.fixes.map((f) => [f.times, f.ordered_times]), [[2, 1]]);
});

test('a charge above the contract amount is over by the difference, beyond the tolerance', () => {
  const r = analyse([inv('1', [L('liftgate', 40), L('residential', 95.5)])], [], contract);
  assert.deepEqual(r.lines.map((l) => [l.code, l.contract_amount, l.over]), [['liftgate', 25, 15], ['residential', 95, 0]]);
  assert.equal(r.over_amount, 15);
});

test('a charge the contract does not allow is marked as such', () => {
  const r = analyse([inv('1', [L('hazmat', 60)])], [], contract);
  assert.equal(r.lines[0].not_allowed, true);
});

test('an invoice with no matching shipment is counted as not matched, never as unordered', () => {
  const r = analyse([inv('9', [L('liftgate', 25)])], [{ shipment_id: 'S1', pro: '1' }]);
  assert.equal(r.not_matched, 1); assert.equal(r.unordered, 0); assert.equal(r.lines[0].ordered, null);
});

test('the share of freight spent on accessorials and the rankings by type, place and carrier', () => {
  const r = analyse([inv('1', [L('linehaul', 400), L('liftgate', 25), L('residential', 95)]), inv('2', [L('linehaul', 380), L('liftgate', 25)], { carrier: 'Prairie Express', destination: { city: 'Waco', state: 'TX', postal: '76701' } })]);
  assert.equal(r.accessorial_share_pct, 15.7);
  assert.deepEqual(r.by_type.map((x) => [x.count, x.amount]), [[1, 95], [2, 50]]);
  assert.deepEqual(r.by_location.map((x) => x.location), ['Austin TX 78701', 'Waco TX 76701']);
  assert.deepEqual(r.by_carrier.map((x) => [x.carrier, x.amount]), [['Ridgeline Freight', 120], ['Prairie Express', 25]]);
});

test('the change list names each place once per charge and asks for a check with the site first', () => {
  const r = analyse([inv('1', [L('residential', 95), L('liftgate', 25)]), inv('2', [L('residential', 95), L('liftgate', 25)])], [], {}, { repeatAt: 2 });
  const text = fixText(r.fixes, { from: 'Logistics', system: 'Example TMS' });
  assert.match(text, /# Address book changes for Example TMS/); assert.match(text, /2 change\(s\) at 1 location\(s\)/);
  assert.match(text, /Mark the address residential/); assert.match(text, /Check each one with the customer/);
});
