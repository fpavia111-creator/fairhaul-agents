import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime, groupInvoices } from 'lodestar-core';
import { manifest, auditInvoices } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const f = { invoices: 'invoices.csv', contract: 'contract.json', shipments: 'shipments.csv', paid: 'paid.csv' };
const contract = JSON.parse(readFileSync(join(fixtures, 'contract.json'), 'utf8'));
const one = (lines, extra = {}) => groupInvoices(lines.map(([d, a]) => ({ invoice_number: 'X1', carrier: 'EXLT', ship_date: '2026-11-01', weight: 1200, origin_state: 'IL', origin_postal: '60607', dest_state: 'TX', dest_postal: '75201', charge_description: d, charge_amount: a, ...extra })));

test('a clean bill is clean', () => {
  const r = auditInvoices(one([['Linehaul', 360], ['Fuel', 54]]), { contract });
  assert.equal(r.items[0].status, 'ok'); assert.equal(r.disputable, 0);
});

test('tolerance absorbs rounding', () => {
  const r = auditInvoices(one([['Linehaul', 360.6], ['Fuel', 54]]), { contract });
  assert.equal(r.items[0].status, 'ok');
  assert.equal(auditInvoices(one([['Linehaul', 360.6], ['Fuel', 54]]), { contract, tolerance: 0.1 }).items[0].status, 'dispute');
});

test('an unpriced accessorial needs review, it is not called clean', () => {
  const r = auditInvoices(one([['Linehaul', 360], ['Fuel', 54], ['Hazmat fee', 40]]), { contract });
  assert.equal(r.items[0].status, 'review');
  assert.equal(r.items[0].findings[0].code, 'accessorial_unpriced');
});

test('fuel with no index price is not checked, and says so', () => {
  const c = { ...contract, fuel_index: [] };
  const r = auditInvoices(one([['Linehaul', 360], ['Fuel', 90]]), { contract: c });
  assert.equal(r.items[0].findings[0].code, 'fuel_not_checked');
});

test('disputable never exceeds the invoice total', () => {
  const r = auditInvoices(one([['Linehaul', 360], ['Residential', 85]], { amount: 400 }), { contract });
  assert.ok(r.items[0].disputable <= r.items[0].total);
});

test('the dispute letter covers every name the carrier billed under', async () => {
  const root = mkdtempSync(join(tmpdir(), 'polaris-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false, mode: 'auto', autoActions: ['polaris_draft_dispute'] });
  const d = await rt.call('polaris_draft_dispute', { ...f, carrier: 'EXLT' });
  assert.equal(d.status, 'executed', d.reason);
  assert.deepEqual(d.result.invoices, ['INV-7001', 'INV-7002', 'INV-7004', 'INV-7005', 'INV-7006']);
  assert.match(readFileSync(join(root, d.result.draft), 'utf8'), /DRAFT\. Not sent\./);
});

test('a changed draft cannot be approved under its old hash', async () => {
  const root = mkdtempSync(join(tmpdir(), 'polaris-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false, mode: 'auto', autoActions: ['polaris_draft_dispute'] });
  const d = await rt.call('polaris_draft_dispute', { ...f, carrier: 'SMPF', contact: 'ap@example.test' });
  writeFileSync(join(root, d.result.draft), readFileSync(join(root, d.result.draft), 'utf8') + '\nextra line');
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'test' };
  const ask = await rt.call('polaris_request_send', args);
  rt.approvals.approve(ask.approval_id, 'Tester');
  const r = await rt.call('polaris_request_send', args);
  assert.equal(r.status, 'error'); assert.match(r.reason, /does not match the draft/);
});

test('open markers block approval unless accepted with a note', async () => {
  const root = mkdtempSync(join(tmpdir(), 'polaris-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false, mode: 'auto', autoActions: ['polaris_draft_dispute'] });
  const d = await rt.call('polaris_draft_dispute', { ...f, carrier: 'SMPF' });
  assert.ok(d.result.open_markers >= 3, 'To, From, Reference and attachments are open');
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256 };
  const ask = await rt.call('polaris_request_send', args); rt.approvals.approve(ask.approval_id, 'Tester');
  const r = await rt.call('polaris_request_send', args);
  assert.equal(r.status, 'error'); assert.match(r.reason, /open markers/);
});

test('pay approval refuses more than the invoice and a duplicate', async () => {
  const root = mkdtempSync(join(tmpdir(), 'polaris-')); cpSync(fixtures, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, audit: false });
  for (const [inv, amount, re] of [['INV-7001', 9999, /more than the invoice total/], ['INV-7004', 10, /duplicate_pro/]]) {
    const args = { ...f, invoice_number: inv, amount };
    const ask = await rt.call('polaris_request_pay', args); rt.approvals.approve(ask.approval_id, 'Tester');
    const r = await rt.call('polaris_request_pay', args);
    assert.equal(r.status, 'error'); assert.match(r.reason, re);
  }
});

test('report files are written with a hash', async () => {
  const root = mkdtempSync(join(tmpdir(), 'polaris-')); cpSync(fixtures, root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('polaris_write_report', f);
  assert.equal(r.status, 'executed'); assert.equal(r.result.files.length, 2); assert.match(r.result.output_sha256, /^[0-9a-f]{64}$/);
  assert.match(readFileSync(r.result.files[0], 'utf8'), /^invoice_number,carrier,/);
});
