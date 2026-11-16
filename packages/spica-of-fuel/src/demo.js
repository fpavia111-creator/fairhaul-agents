import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['spica_draft_dispute'] });
  process.stdout.write(`Spica of Fuel demo (fictional carriers and diesel prices, autumn 2026) in ${rt.root}\n`);
  const f = { invoices: 'invoices.csv', contract: 'contract.json' };
  const c = await rt.call('spica_check', f);
  printStep('Check every fuel surcharge against the table and the diesel week', c);
  for (const i of c.result.items) process.stdout.write(`    ${i.invoice_number} ${i.carrier.padEnd(18)} billed ${String(i.billed).padStart(6)}  table ${String(i.expected ?? '-').padStart(6)}  ${i.status}\n`);
  printStep('Compare the fuel tables at today\'s diesel', await rt.call('spica_compare', { contract: 'contract.json' }));
  printStep('What a 10-cent diesel rise costs', await rt.call('spica_sensitivity', f));
  printStep('Write the fuel report', await rt.call('spica_write_report', f));
  const d = await rt.call('spica_draft_dispute', { ...f, carrier: 'Prairie Express', from: 'Sam Lee, Example Home Goods (fictional)', contact: 'billing@prairie-express.example' });
  printStep('Draft the dispute for the carrier billing on the wrong week', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Index name checked against the agreement' };
  const p = await rt.call('spica_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Sam Lee (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('spica_request_send', args));
  printStep('Agent tries to short-pay the invoice itself', await rt.call('ap_pay_invoice', {}));
}
