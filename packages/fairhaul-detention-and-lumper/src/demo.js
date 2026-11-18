import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['detention_draft_dispute'] });
  process.stdout.write(`Fairhaul Detention and Lumper demo (fictional loads and docks) in ${rt.root}, Auto mode on\n`);
  const f = { charges: 'charges.csv', stops: 'stops.csv', terms: 'terms.json' };
  const a = await rt.call('detention_audit', f);
  printStep('Check nine detention, layover and lumper charges against the dock log', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.load_id.padEnd(6)} ${i.type.padEnd(10)} billed ${String(i.billed).padStart(5)} allowed ${String(i.allowed ?? '?').padStart(6)}  ${i.status.padEnd(8)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain L-101 (billed six hours, on site four)', await rt.call('detention_explain', { ...f, load_id: 'L-101' }));
  printStep('Which of your own facilities cause detention', await rt.call('detention_facilities', f));
  printStep('Write the worklist', await rt.call('detention_write_report', f));
  const d = await rt.call('detention_draft_dispute', { ...f, carrier: 'Sample Freightways', from: 'Dana Transport Lead (fictional)', contact: 'billing@example.test' });
  printStep('Draft the dispute to Sample Freightways', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('detention_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to pay the lumper service itself', await rt.call('ap_pay_invoice', {}));
}
