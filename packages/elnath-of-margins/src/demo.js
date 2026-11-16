import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['elnath_draft_terms_change'] });
  process.stdout.write(`Elnath of Margins demo (fictional orders and freight costs) in ${rt.root}\n`);
  const f = { orders: 'orders.csv', costs: 'freight-costs.csv', threshold: 1000, alternatives: [1500, 2500] };
  const r = await rt.call('elnath_margins', f);
  printStep('Compare freight charged with freight cost', r);
  for (const c of r.result.by_customer) process.stdout.write(`    ${c.customer.padEnd(20)} cost ${String(c.freight_cost).padStart(8)}  charged ${String(c.freight_billed).padStart(6)}  ${String(c.recovery_pct).padStart(5)}%\n`);
  for (const s of r.result.scenarios) process.stdout.write(`    threshold ${s.threshold} enforced: +${s.extra_recovery_estimate} (${s.recovery_pct_estimate}% recovered)\n`);
  printStep('Write the recovery report', await rt.call('elnath_write_report', f));
  const d = await rt.call('elnath_draft_terms_change', { ...f, to: 'Sales operations (fictional)', from: 'Sam Ortiz (fictional)' });
  printStep('Draft the freight terms review', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Proposals left for the sales meeting' };
  const p = await rt.call('elnath_request_apply', args);
  printStep('Approve the review: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Priya Nair (fictional)');
  printStep('Same call after the click (recorded; a person changes terms)', await rt.call('elnath_request_apply', args));
  printStep('Agent tries to bill a customer for freight itself', await rt.call('ar_rebill_freight', {}));
}
