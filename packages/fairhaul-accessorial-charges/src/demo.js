import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['accessorials_draft_address_update'] });
  process.stdout.write(`Fairhaul Accessorial Charges demo (fictional loads, October 2026) in ${rt.root}\n`);
  const f = { invoices: 'invoices.csv', shipments: 'shipments.csv', contract: 'contract.json' };
  const r = await rt.call('accessorials_analyse', f);
  printStep('Find where the accessorial charges come from', r);
  for (const x of r.result.fixes) process.stdout.write(`    ${x.location.padEnd(16)} ${x.label.padEnd(22)} x${x.times} (ordered ${x.ordered_times})  ${x.amount}\n`);
  printStep('Write the accessorial report', await rt.call('accessorials_write_report', f));
  const d = await rt.call('accessorials_draft_address_update', { ...f, from: 'Sam Lee (fictional)', system: 'the TMS' });
  printStep('Draft the address-book changes', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'TMS admin to be named' };
  const p = await rt.call('accessorials_request_apply', args);
  printStep('Approve the change list: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Sam Lee (fictional)');
  printStep('Same call after the click (recorded; a person changes the TMS)', await rt.call('accessorials_request_apply', args));
  printStep('Agent tries to change the TMS address book itself', await rt.call('tms_update_address', {}));
}
