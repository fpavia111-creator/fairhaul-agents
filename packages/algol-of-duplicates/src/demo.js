import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['algol_draft_recovery'] });
  process.stdout.write(`Algol of Duplicates demo (fictional payments, 2025 to 2026) in ${rt.root}\n`);
  const f = { payments: 'payments.csv', as_of: '2026-11-16' };
  const r = await rt.call('algol_search', f);
  printStep('Search the payment history for invoices paid twice', r);
  for (const g of r.result.items) process.stdout.write(`    ${g.confidence.padEnd(6)} ${g.rule.padEnd(23)} ${g.invoice_numbers.join(' / ').padEnd(24)} ${String(g.to_recover).padStart(8)}  ${g.status}\n`);
  printStep('Write the report', await rt.call('algol_write_report', f));
  const d = await rt.call('algol_draft_recovery', { ...f, vendor: 'Ridgeline Freight', from: 'Pat Kim, Example Home Goods (fictional)', contact: 'ar@ridgeline-freight.example' });
  printStep('Draft the refund request to Ridgeline Freight', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Remittances attached from the bank portal' };
  const p = await rt.call('algol_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Pat Kim (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('algol_request_send', args));
  printStep('Agent tries to void a payment itself', await rt.call('ap_void_payment', {}));
}
