import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditOcean, oceanCode } from '../src/index.js';

const contract = { contracts: [{ carrier: 'L', lanes: [{ pol: 'CNSHA', pod: 'USLAX', rates: { '40HC': 2000 } }], surcharges: { BAF: { per_container: { '40HC': 500 } } } }] };
const row = (o) => ({ invoice_number: 'I', carrier: 'L', bl: 'B', pol: 'CN SHA', pod: 'USLAX', equipment: '40HQ', containers: 1, charge_code: 'Ocean Freight', quantity: 1, amount: 2000, ...o });

test('charge wording maps to codes, with your aliases first', () => {
  assert.equal(oceanCode('Bunker Adjustment Factor'), 'BAF'); assert.equal(oceanCode('Peak Season Surcharge'), 'PSS');
  assert.equal(oceanCode('Fuel recovery', { 'fuel recovery': 'lss' }), 'LSS');
});

test('ports and equipment are normalised before matching (40HQ is 40HC)', () => {
  assert.equal(auditOcean([row({})], contract).items[0].findings.length, 0);
});

test('rates are per container', () => {
  const r = auditOcean([row({ containers: 2, quantity: 2, amount: 4100 })], contract).items[0];
  assert.equal(r.findings[0].code, 'rate_over'); assert.equal(r.disputable, 100);
});

test('a surcharge the contract does not list is disputable in full', () => {
  const r = auditOcean([row({}), row({ charge_code: 'Congestion', amount: 300 })], contract).items[0];
  assert.equal(r.disputable, 300);
});
