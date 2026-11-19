// Behaviour ported in the final pass (19 Nov 2026): personal-data masking, the long-path guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PiiMasker, piiKindOf, safePath } from '../src/index.js';

test('masking: recipients, signers and contacts become pseudonyms or placeholders; text is scrubbed', () => {
  const m = new PiiMasker({ mode: 'mask' });
  const out = m.maskResult({ signed_by: 'J. Ortiz', recipient_address: '9 Example Ave, Springfield', dispatch_email: 'ops@carrier.example', dispatch_phone: '(312) 555-0140', driver: 'Sam Rivera', detail: 'Signed by J. Ortiz; call (312) 555-0140' });
  assert.match(out.signed_by, /^CU-[0-9a-f]{8}$/);
  assert.equal(out.recipient_address, '[ADDRESS]');
  assert.equal(out.dispatch_email, '[EMAIL]');
  assert.equal(out.dispatch_phone, '[PHONE]');
  assert.match(out.driver, /^ST-[0-9a-f]{8}$/);
  assert.doesNotMatch(out.detail, /Ortiz|555-0140/);
});

test('masking: customer, consignee and shipper columns hold companies and stay clear unless strict', () => {
  for (const k of ['customer', 'consignee', 'shipper']) { assert.equal(piiKindOf(k, 'mask'), null); assert.equal(piiKindOf(k, 'strict'), 'company'); }
  assert.equal(new PiiMasker({ mode: 'mask' }).maskResult({ customer: 'Hill Country Home' }).customer, 'Hill Country Home');
  assert.match(new PiiMasker({ mode: 'strict' }).maskResult({ customer: 'Hill Country Home' }).customer, /^CO-[0-9a-f]{8}$/);
  assert.equal(piiKindOf('carrier'), null, 'carrier names are sent as they are');
});

test('masking: the same value gets the same pseudonym, and off leaves values alone', () => {
  const m = new PiiMasker({ mode: 'mask' });
  assert.equal(m.maskResult({ signed_by: 'M. Chen' }).signed_by, m.maskResult({ signed_by: 'M. Chen' }).signed_by);
  assert.equal(new PiiMasker({ mode: 'off' }).maskResult({ signed_by: 'M. Chen' }).signed_by, 'M. Chen');
});

test('safePath refuses over-long paths before the file system sees them (a long mkdir never returns on Windows)', () => {
  const root = mkdtempSync(join(tmpdir(), 'fh-path-'));
  assert.throws(() => safePath(root, 'x'.repeat(300)), /path is too long/);
  assert.throws(() => safePath(root, 'a/'.repeat(600)), /path is too long/);
});
