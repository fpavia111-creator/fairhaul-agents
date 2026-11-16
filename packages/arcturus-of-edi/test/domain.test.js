// Reconciling tenders, responses, status and invoices, on records as the X12 reader returns them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, tenderStats, tables } from '../src/index.js';

const tender = (id, amount, extra = {}) => ({ set: '204', file: 't.edi', control: '1', scac: 'EXLT', shipment_id: id, purpose: '00', stops: [], weight: 1000, amount, ...extra });
const resp = (id, scac, code) => ({ set: '990', file: 'r.edi', scac, shipment_id: id, date: '2026-11-01', action_code: code, action: { A: 'accepted', D: 'declined' }[code] });
const inv = (n, id, amount, extra = {}) => ({ set: '210', file: 'i.edi', control: '1', invoice_number: n, scac: 'EXLT', shipment_id: `PRO-${n}`, references: { BM: id }, invoice_date: '2026-11-04', delivery_date: '2026-11-03', amount, charges: [{ line: '1', code: '400', amount }], ...extra });
const ev = (id, status) => ({ set: '214', file: 's.edi', pro: '', shipment_id: id, scac: 'EXLT', events: [{ stop: '2', status_code: 'D1', status, at: '2026-11-03T10:00:00', place: null }] });

test('a clean load raises nothing: tendered, accepted, delivered, invoiced at the tender amount', () => {
  const r = reconcile([tender('S1', 450), resp('S1', 'EXLT', 'A'), ev('S1', 'completed_unloading'), inv('I1', 'S1', 450)]);
  assert.deepEqual(r.findings, []);
});

test('an invoice on a cancelled tender is held, and a cancelled tender needs no response', () => {
  const r = reconcile([tender('S1', 450), tender('S1', null, { purpose: '01' }), inv('I1', 'S1', 150)]);
  assert.deepEqual(r.findings.map((f) => [f.code, f.amount]), [['invoice_on_cancelled_tender', 150]]);
});

test('a changed tender replaces the original amount', () => {
  const r = reconcile([tender('S1', 450), tender('S1', 520, { purpose: '04' }), resp('S1', 'EXLT', 'A'), ev('S1', 'arrived_delivery'), inv('I1', 'S1', 520)]);
  assert.deepEqual(r.findings, []);
});

test('an invoice from a carrier other than the one that accepted is reported in full', () => {
  const r = reconcile([tender('S1', 450), resp('S1', 'SMPF', 'A'), resp('S1', 'EXLT', 'D'), ev('S1', 'completed_unloading'), inv('I1', 'S1', 450)]);
  assert.deepEqual(r.findings.map((f) => [f.code, f.amount]), [['invoice_from_other_carrier', 450]]);
});

test('charge lines that do not add up to the invoice total are flagged without an amount', () => {
  const r = reconcile([tender('S1', 450), resp('S1', 'EXLT', 'A'), ev('S1', 'completed_unloading'), inv('I1', 'S1', 450, { charges: [{ line: '1', code: '400', amount: 400 }, { line: '2', code: 'FUE', amount: 40 }] })]);
  assert.deepEqual(r.findings.map((f) => [f.code, f.amount]), [['invoice_lines_mismatch', null]]);
});

test('every carrier declining leaves the load uncovered; a response for an unknown tender is reported', () => {
  const r = reconcile([tender('S1', 450), resp('S1', 'EXLT', 'D'), resp('S1', 'SMPF', 'D'), resp('S9', 'EXLT', 'A')]);
  assert.deepEqual(r.findings.map((f) => f.code).sort(), ['response_without_tender', 'tender_declined']);
});

test('acceptance is counted per carrier, lowest first, and partner rejections read from the 997', () => {
  const recs = [resp('S1', 'EXLT', 'A'), resp('S2', 'EXLT', 'D'), resp('S3', 'SMPF', 'A'), { set: '997', file: 'a.edi', acknowledges_group: '210', functional: 'IM', group_status: 'partially_accepted', sets: [{ set: '210', control: '0001', status: 'A' }, { set: '210', control: '0002', status: 'E' }] }];
  assert.deepEqual(tenderStats(recs).map((x) => [x.scac, x.acceptance_pct]), [['EXLT', 50], ['SMPF', 100]]);
  const r = reconcile(recs);
  assert.match(r.findings.find((f) => f.code === 'rejected_by_partner').detail, /210 control 0002 as accepted with errors/);
  assert.equal(tables(recs).acknowledgements.length, 2);
});
