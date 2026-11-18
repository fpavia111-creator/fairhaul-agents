import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['parcels_draft_refund_request'] });
  process.stdout.write(`Fairhaul Parcel Refunds demo (fictional packages, as of 2026-11-16) in ${rt.root}, Auto mode on\n`);
  const f = { invoices: 'parcel-invoices.csv', terms: 'terms.json', voids: 'voids.csv', as_of: '2026-11-16' };
  const a = await rt.call('parcels_audit', f);
  printStep('Audit eleven parcel charges', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.tracking.padEnd(19)} ${i.carrier.padEnd(6)} ${i.status.padEnd(14)} ${String(i.refundable).padStart(6)}  by ${i.claim_by}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Same data when the agreement waives the delivery guarantee', await rt.call('parcels_audit', { ...f, terms: 'terms-waived.json' }));
  printStep('Write the worklist and the claim-deadline calendar', await rt.call('parcels_write_report', f));
  const d = await rt.call('parcels_draft_refund_request', { ...f, carrier: 'UPS', account: 'EX-0001', from: 'Dana Shipping Lead (fictional)' });
  printStep('Draft the UPS refund request', d);
  const s = await rt.call('parcels_request_submit', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 });
  printStep('Auto: approve submitting it, which stays one click (and the draft still has an open To line)', s);
  printStep('Agent tries to file in the carrier portal itself', await rt.call('carrier_portal_submit', {}));
}
