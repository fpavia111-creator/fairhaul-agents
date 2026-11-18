import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['ocean_draft_dispute'] });
  process.stdout.write(`Fairhaul Ocean Freight Audit demo (fictional lines and contracts, 2026) in ${rt.root}\n`);
  const f = { invoices: 'ocean-invoices.csv', contract: 'contract.json' };
  const r = await rt.call('ocean_audit', f);
  printStep('Audit the ocean invoices against the contract', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.bl.padEnd(11)} ${String(i.disputable).padStart(7)}  ${i.findings.map((x) => x.code).join(', ') || 'clean'}\n`);
  printStep('Write the ocean audit', await rt.call('ocean_write_report', f));
  const d = await rt.call('ocean_draft_dispute', { ...f, carrier: 'Blue Meridian Line', from: 'Jo Park, Example Imports (fictional)', contact: 'billing@bluemeridian.example' });
  printStep('Draft the dispute to Blue Meridian Line', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Rate sheet pages attached' };
  const p = await rt.call('ocean_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Jo Park (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('ocean_request_send', args));
  printStep('Agent tries to pay the line itself', await rt.call('ap_pay_invoice', {}));
}
