import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Castor of Allocations demo (fictional October shipments) in ${rt.root}\n`);
  const f = { costs: 'freight-costs.csv', order_lines: 'order-lines.csv' };
  const a = await rt.call('castor_allocate', f);
  printStep('Split October freight across order lines by weight', a);
  for (const c of a.result.by_customer) process.stdout.write(`    ${c.customer.padEnd(22)} ${String(c.freight).padStart(9)}  ${String(c.freight_pct_of_value ?? '-').padStart(6)}% of value\n`);
  printStep('Same split by cube, to compare', await rt.call('castor_allocate', { ...f, basis: 'cube' }));
  const w = await rt.call('castor_write_report', { ...f, journal_date: '2026-10-31' });
  printStep('Write the allocation detail and the reclass journal draft', w);
  const args = { journal: w.result.journal, journal_sha256: w.result.journal_sha256 };
  const p = await rt.call('castor_request_post', args);
  printStep('Approve the journal for posting: waits for a named person', p);
  rt.approvals.approve(p.approval_id, 'Dana Controller (fictional)');
  printStep('Same call after the click (recorded; a person posts it)', await rt.call('castor_request_post', args));
  printStep('Agent tries to post to the ledger itself', await rt.call('erp_post_journal', {}));
}
