import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['bills_draft_dispute'] });
  process.stdout.write(`Fairhaul Freight Bill Audit demo (fictional carriers, lanes and invoices) in ${rt.root}, Auto mode on\n`);
  const f = { invoices: 'invoices.csv', contract: 'contract.json', shipments: 'shipments.csv', paid: 'paid.csv' };
  const a = await rt.call('bills_audit', f);
  printStep('Audit eleven freight bills against the contract', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.invoice_number.padEnd(9)} ${i.carrier.padEnd(19)} ${String(i.total).padStart(8)}  ${i.status.padEnd(9)} ${String(i.disputable).padStart(7)}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain INV-8101 (truckload: linehaul, detention, lumper)', await rt.call('bills_explain', { ...f, invoice_number: 'INV-8101' }));
  printStep('Read the same carrier bills from an X12 210 file', await rt.call('bills_audit', { invoices: 'invoices-210.edi', contract: 'contract.json' }));
  printStep('Write the audit worklist', await rt.call('bills_write_report', f));
  const d = await rt.call('bills_draft_dispute', { ...f, carrier: 'EXLT', from: 'Dana Logistics Lead, Example Supply Co (fictional)', contact: 'billing@example.test', reference: 'ACCT-0001' });
  printStep('Draft a dispute letter to Example Linehaul (Auto is opted in for drafts here)', d);
  const send = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, to: 'billing@example.test', accept_open_issues: true, note: 'Contract pages attached by hand' };
  const s = await rt.call('bills_request_send', send);
  printStep('Auto: approve sending the dispute, which stays one click', s);
  rt.approvals.approve(s.approval_id, 'Dana Logistics Lead (fictional)');
  printStep('Same call after the human click (recorded; a person sends it)', await rt.call('bills_request_send', send));
  printStep('Agent tries to pay the carrier itself', await rt.call('ap_pay_invoice', {}));
  process.stdout.write(`\nAudit log: ${rt.stateDir}/audit.jsonl\n`);
}
