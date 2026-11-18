// Freight bill audit: duplicates under two names, arithmetic, dock times, orders, BOL and quotes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { groupInvoices } from 'fairhaul-core';
import { auditInvoices } from '../src/index.js';

const contract = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/contract.json', import.meta.url)), 'utf8'));
const bill = (n, lines, extra = {}) => lines.map(([d, a]) => ({ invoice_number: n, carrier: 'EXLT', pro: `PRO-${n}`, ship_date: '2026-11-01', weight: 1200, origin_state: 'IL', origin_postal: '60607', dest_state: 'TX', dest_postal: '75201', charge_description: d, charge_amount: a, ...extra }));
const clean = [['Linehaul', 360], ['Fuel', 54]];

test('the same invoice billed under the SCAC and under the carrier name is a duplicate', () => {
  const r = auditInvoices(groupInvoices([...bill('A1', clean), ...bill('A1', clean, { carrier: 'Example Linehaul LLC' })]), { contract });
  assert.deepEqual(r.items.map((i) => i.status), ['ok', 'duplicate']);
  const paid = auditInvoices(groupInvoices(bill('A2', clean)), { contract, paid: [{ carrier: 'Example Linehaul', invoice_number: 'a2' }] });
  assert.equal(paid.items[0].findings[0].code, 'already_paid');
});

test('a stated total above its charge lines is disputable by the difference', () => {
  const r = auditInvoices(groupInvoices(bill('A1', clean, { amount: 434 })), { contract });
  const f = r.items[0].findings.find((x) => x.code === 'lines_do_not_add_up');
  assert.equal(f.amount, 20); assert.equal(r.items[0].status, 'dispute');
});

test('detention is priced from the dock times after the free hours, up to the cap', () => {
  const ship = [{ shipment_id: 'S1', pro: 'PRO-A1', arrived_at: '2026-11-01T08:00:00', departed_at: '2026-11-01T12:00:00' }];
  const r = auditInvoices(groupInvoices(bill('A1', [...clean, ['Detention', 150]])), { contract, shipments: ship });
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['accessorial_over', 50]]);
});

test('a liftgate the shipment record never ordered is disputed in full; one that was ordered is priced', () => {
  const lines = [...clean, ['Liftgate', 25]];
  const not = auditInvoices(groupInvoices(bill('A1', lines)), { contract, shipments: [{ shipment_id: 'S1', pro: 'PRO-A1', accessorials_ordered: '' }] });
  assert.deepEqual(not.items[0].findings.map((f) => [f.code, f.amount]), [['accessorial_not_ordered', 25]]);
  const ok = auditInvoices(groupInvoices(bill('A1', lines)), { contract, shipments: [{ shipment_id: 'S1', pro: 'PRO-A1', accessorials_ordered: 'Lift gate' }] });
  assert.equal(ok.items[0].status, 'ok');
});

test('weight far over the BOL and a total over the quote ask for review without guessing an amount', () => {
  const r = auditInvoices(groupInvoices(bill('A1', clean, { weight: 1400 })), { contract, shipments: [{ shipment_id: 'S1', pro: 'PRO-A1', weight: 1200, quoted_amount: 400 }] });
  const codes = r.items[0].findings.map((f) => [f.code, f.amount]);
  assert.ok(codes.some(([c, a]) => c === 'weight_over_bol' && a === null)); assert.ok(codes.some(([c, a]) => c === 'quote_exceeded' && a === null));
  assert.equal(r.items[0].status, 'review');
});

test('a carrier whose contract has ended is reported with its dates', () => {
  const r = auditInvoices(groupInvoices(bill('T1', [['Linehaul', 300]], { carrier: 'TSTC' })), { contract });
  assert.equal(r.items[0].findings[0].code, 'contract_expired'); assert.match(r.items[0].findings[0].detail, /2025-01-01 to 2025-12-31/);
});
