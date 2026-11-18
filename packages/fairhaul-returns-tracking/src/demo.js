import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['returns_draft_carrier_dispute'] });
  process.stdout.write(`Fairhaul Returns Tracking demo (fictional returns, as of 2026-11-16) in ${rt.root}\n`);
  const f = { rmas: 'rmas.csv', receipts: 'receipts.csv', credits: 'credits.csv', charges: 'return-freight.csv', as_of: '2026-11-16' };
  const r = await rt.call('returns_track', f);
  printStep('Follow every return from label to credit', r);
  for (const x of r.result.items) process.stdout.write(`    ${(x.rma || '-').padEnd(9)} ${x.code.padEnd(22)} ${x.amount ?? ''}\n`);
  printStep('Write the returns report', await rt.call('returns_write_report', f));
  const d = await rt.call('returns_draft_carrier_dispute', { ...f, carrier: 'Parcel Co', to: 'billing@parcelco.example', from: 'Ana Ruiz (fictional)' });
  printStep('Draft the return freight dispute to Parcel Co', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, to: 'billing@parcelco.example' };
  const p = await rt.call('returns_request_send', args);
  printStep('Approve sending it: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Ana Ruiz (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('returns_request_send', args));
  printStep('Agent tries to issue a customer credit itself', await rt.call('erp_issue_credit', {}));
}
