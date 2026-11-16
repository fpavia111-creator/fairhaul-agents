import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['alcor_draft_pod_request'] });
  process.stdout.write(`Alcor of PODs demo (fictional loads, November 2026) in ${rt.root}\n`);
  const f = { loads: 'loads.csv', pods: 'pods.csv', as_of: '2026-11-16' };
  const r = await rt.call('alcor_match', f);
  printStep('Match every load to its proof of delivery', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.shipment_id} ${i.carrier.padEnd(18)} ${i.status.padEnd(13)} ${i.hold_invoice ? 'hold invoice' : '            '}  ${i.issues.map((x) => x.code).join(', ')}\n`);
  printStep('Write the POD worklist', await rt.call('alcor_write_report', f));
  const d = await rt.call('alcor_draft_pod_request', { ...f, carrier: 'Coastal Line Haul', from: 'Pat Kim, Example Home Goods (fictional)', contact: 'pods@coastal-linehaul.example' });
  printStep('Draft the POD request to Coastal Line Haul', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256 };
  const p = await rt.call('alcor_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Pat Kim (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('alcor_request_send', args));
  printStep('Agent tries to hold the invoice in AP itself', await rt.call('ap_hold_invoice', {}));
}
