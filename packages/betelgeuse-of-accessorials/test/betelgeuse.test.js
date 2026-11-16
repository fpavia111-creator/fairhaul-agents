import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse } from '../src/index.js';

const inv = (n, lines, dest = { city: 'Austin', state: 'TX', postal: '78701' }) => ({ invoice_number: n, carrier: 'A', pro: n, total: lines.reduce((s, l) => s + l.amount, 0), destination: dest, lines, by_code: {} });
const L = (code, amount) => ({ code, description: code, amount });

test('linehaul, fuel and discount are not accessorials', () => {
  const r = analyse([inv('1', [L('linehaul', 100), L('fuel', 20), L('discount', -10), L('liftgate', 30)])]);
  assert.equal(r.accessorial_total, 30); assert.equal(r.lines.length, 1);
});

test('detention is never counted as unordered; liftgate is', () => {
  const r = analyse([inv('1', [L('detention', 50), L('liftgate', 30)])], [{ shipment_id: 'S', pro: '1', accessorials_ordered: '' }]);
  assert.equal(r.unordered, 1); assert.equal(r.unordered_amount, 30);
});

test('ordered accessorials are read from free text with aliases', () => {
  const r = analyse([inv('1', [L('liftgate', 30)])], [{ shipment_id: 'S', pro: '1', accessorials_ordered: 'Lift Gate; Residential' }]);
  assert.equal(r.lines[0].ordered, true);
});

test('two invoices at the same place make a repeat; two places do not', () => {
  assert.equal(analyse([inv('1', [L('residential', 90)]), inv('2', [L('residential', 90)])]).fixes.length, 1);
  assert.equal(analyse([inv('1', [L('residential', 90)]), inv('2', [L('residential', 90)], { city: 'Waco', state: 'TX', postal: '76701' })]).fixes.length, 0);
});
