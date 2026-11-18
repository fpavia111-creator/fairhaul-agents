import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairhaul Freight Accruals demo (fictional shipments, period ending 2026-10-31) in ${rt.root}\n`);
  const f = { shipments: 'shipments.csv', invoices: 'invoices.csv', period_end: '2026-10-31', contract: 'contract.json', prior: 'prior-accrual.csv' };
  const a = await rt.call('accruals_accrue', f);
  printStep('Build the October freight accrual', a);
  for (const l of a.result.lines) process.stdout.write(`    ${l.shipment_id.padEnd(5)} ${l.carrier.padEnd(19)} ${String(l.amount ?? '-').padStart(8)}  ${l.basis}\n`);
  const w = await rt.call('accruals_write_report', f);
  printStep('Write the accrual detail and the journal entry draft', w);
  const args = { journal: w.result.journal, journal_sha256: w.result.journal_sha256 };
  const p = await rt.call('accruals_request_post', args);
  printStep('Approve the journal for posting: waits for a named person', p);
  rt.approvals.approve(p.approval_id, 'Dana Controller (fictional)');
  printStep('Same call after the click (recorded; a person posts it)', await rt.call('accruals_request_post', args));
  printStep('Agent tries to post to the ledger itself', await rt.call('erp_post_journal', {}));
}
