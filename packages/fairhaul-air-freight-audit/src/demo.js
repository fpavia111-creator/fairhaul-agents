import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['air_draft_dispute'] });
  process.stdout.write(`Fairhaul Air Freight Audit demo (fictional forwarder and rates, autumn 2026) in ${rt.root}\n`);
  const f = { invoices: 'air-invoices.csv', rates: 'rates.json' };
  const r = await rt.call('air_audit', f);
  printStep('Audit the air freight invoices', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.awb} ${String(i.chargeable_kg).padStart(5)} kg  ${String(i.disputable).padStart(6)}  ${i.findings.map((x) => x.code).join(', ') || 'clean'}\n`);
  printStep('Price a 90 kg shipment from Frankfurt to Chicago', await rt.call('air_quote', { rates: 'rates.json', forwarder: 'Skyline Logistics', origin: 'FRA', destination: 'ORD', actual_kg: 90, volume_cbm: 0.3 }));
  printStep('Write the air audit', await rt.call('air_write_report', f));
  const d = await rt.call('air_draft_dispute', { ...f, forwarder: 'Skyline Logistics', from: 'Jo Park, Example Imports (fictional)', contact: 'billing@skyline.example' });
  printStep('Draft the dispute to the forwarder', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Rate sheet and AWBs attached' };
  const p = await rt.call('air_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Jo Park (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('air_request_send', args));
  printStep('Agent tries to pay the forwarder itself', await rt.call('ap_pay_invoice', {}));
}
