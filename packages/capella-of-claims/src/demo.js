import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['capella_draft_claim'] });
  process.stdout.write(`Capella of Claims demo (fictional shipments, as of 2026-11-16) in ${rt.root}\n`);
  const f = { exceptions: 'exceptions.csv', claims: 'claims-log.csv', terms: 'terms.json', as_of: '2026-11-16' };
  const s = await rt.call('capella_scan', f);
  printStep('Find the claims to file and their deadlines', s);
  for (const i of s.result.items) process.stdout.write(`    ${i.shipment_id.padEnd(6)} ${i.type.padEnd(16)} ${String(i.amount).padStart(9)}  ${i.status.padEnd(13)} ${i.deadline || ''}\n`);
  printStep('Track the claims already filed', await rt.call('capella_track', { claims: 'claims-log.csv', terms: 'terms.json', as_of: '2026-11-16' }));
  printStep('Write the worklist and the deadline calendar', await rt.call('capella_write_report', f));
  const d = await rt.call('capella_draft_claim', { ...f, shipment_id: 'L-2004', from: 'Ana Ruiz, Example Home Goods (fictional)', contact: 'claims@ridgeline-freight.example' });
  printStep('Draft the claim letter for the most urgent shipment', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Attachments collected in the claim folder' };
  const p = await rt.call('capella_request_file', args);
  printStep('Approve filing: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Ana Ruiz (fictional)');
  printStep('Same call after the click (recorded; a person files it)', await rt.call('capella_request_file', args));
  printStep('Agent tries to file in the carrier portal itself', await rt.call('carrier_portal_submit', {}));
}
