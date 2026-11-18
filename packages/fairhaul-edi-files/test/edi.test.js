import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairhaul-core';
import { manifest, readAll, tables } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const text = (f) => ({ name: f, text: readFileSync(join(fixtures, f), 'utf8') });

test('tables carry the fields a person checks', () => {
  const b = readAll(['tenders-204.edi', 'status-214.edi', 'invoices-210.edi'].map(text));
  const t = tables(b.records);
  assert.equal(t.tenders[0].shipment_id, 'SH-1001'); assert.equal(t.tenders[0].amount, 450); assert.equal(t.tenders[0].pickup_at, '2026-11-01T08:00:00');
  assert.equal(t.status_events.find((e) => e.status === 'completed_unloading').at, '2026-11-03T16:10:00');
  assert.equal(t.invoice_lines.length, 6);
});

test('a file with Windows line endings and a different element separator still reads', () => {
  const src = readFileSync(join(fixtures, 'invoices-210.edi'), 'utf8').replace(/\*/g, '|').replace(/\n/g, '\r\n');
  const b = readAll([{ name: 'x.edi', text: src }]);
  assert.equal(b.files[0].ok, true, JSON.stringify(b.files[0].problems)); assert.equal(b.records.length, 3);
});

test('convert writes one CSV per kind and the reconciliation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'edi-')); cpSync(fixtures, root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('edi_convert', { files: ['tenders-204.edi', 'invoices-210.edi', 'responses-990.edi', 'ack-997.edi', 'status-214.edi'] });
  assert.equal(r.status, 'executed', r.reason);
  for (const f of ['edi-tenders.csv', 'edi-invoices.csv', 'edi-invoice-lines.csv', 'edi-status-events.csv', 'edi-responses.csv', 'edi-acknowledgements.csv', 'edi-reconcile.html']) assert.ok(existsSync(join(root, 'lodestar-out/edi', f)), f);
});

test('paths outside --root are refused', async () => {
  const r = await new AgentRuntime(manifest, { root: fixtures, audit: false }).call('edi_inspect', { files: ['../../../etc/passwd'] });
  assert.equal(r.status, 'error');
});
