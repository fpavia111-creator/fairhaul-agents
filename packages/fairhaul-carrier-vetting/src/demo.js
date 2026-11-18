import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['vetting_draft_verification_request'] });
  process.stdout.write(`Fairhaul Carrier Vetting demo (fictional carriers and loads, as of 2026-11-16) in ${rt.root}\n`);
  const f = { carriers: 'carriers.csv', loads: 'loads.csv', as_of: '2026-11-16' };
  const r = await rt.call('vetting_vet', f);
  printStep('Check carriers and booked loads for warning signs', r);
  for (const l of r.result.load_rows) process.stdout.write(`    ${l.load_id} ${String(l.carrier || l.carrier_id).padEnd(22)} ${String(l.level).padEnd(8)} ${l.action}\n`);
  printStep('Write the carrier report', await rt.call('vetting_write_report', f));
  const d = await rt.call('vetting_draft_verification_request', { ...f, carrier_id: 'SWFT', to: '(469) 555-0199 from the original onboarding file', from: 'Ana Ruiz (fictional)' });
  printStep('Draft a verification request to Swift Lane Logistics', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256 };
  const p = await rt.call('vetting_request_send', args);
  printStep('Approve sending it: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Ana Ruiz (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('vetting_request_send', args));
  printStep('Agent tries to change a carrier\'s bank details itself', await rt.call('ap_change_remit_to', {}));
}
