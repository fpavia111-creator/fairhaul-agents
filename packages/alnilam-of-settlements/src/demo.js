import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['alnilam_draft_payment_batch'] });
  process.stdout.write(`Alnilam of Settlements demo (fictional broker loads, as of 2026-11-16) in ${rt.root}\n`);
  const f = { ratecons: 'ratecons.csv', invoices: 'carrier-invoices.csv', payments: 'payments.csv', noas: 'noas.csv', as_of: '2026-11-16' };
  const r = await rt.call('alnilam_settle', f);
  printStep('Settle eight loads against rate confirmations, payments and notices', r);
  for (const x of r.result.rows) process.stdout.write(`    ${x.load_id} ${x.carrier.padEnd(19)} pay to ${x.pay_to.padEnd(20)} ${x.status.padEnd(17)} ${x.to_pay || ''}\n`);
  printStep('Write the settlement report', await rt.call('alnilam_write_report', f));
  const d = await rt.call('alnilam_draft_payment_batch', { ...f, pay_date: '2026-11-17', to: 'Controller (fictional)', from: 'Carrier pay desk (fictional)' });
  printStep('Draft the next payment batch', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256 };
  const p = await rt.call('alnilam_request_release', args);
  printStep('Approve releasing it: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Dana Controller (fictional)');
  printStep('Same call after the click (recorded; a person pays)', await rt.call('alnilam_request_release', args));
  printStep('Agent tries to release a payment itself', await rt.call('ap_release_payment', {}));
}
