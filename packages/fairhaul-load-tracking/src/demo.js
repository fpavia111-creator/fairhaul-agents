import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['tracking_draft_delay_notice'] });
  process.stdout.write(`Fairhaul Load Tracking demo (fictional loads, 2026-11-16 10:00) in ${rt.root}\n`);
  const f = { loads: 'loads.csv', events: 'events.csv', as_of: '2026-11-16 10:00' };
  const r = await rt.call('tracking_assess', f);
  printStep('Find the open loads that need attention', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.shipment_id} ${i.carrier.padEnd(18)} ${i.status.padEnd(21)} ${(i.issues || []).join(', ')}\n`);
  printStep('Write the exceptions board', await rt.call('tracking_write_report', f));
  const d = await rt.call('tracking_draft_delay_notice', { ...f, customer: 'Hill Country Home', from: 'Jo Park, Example Logistics (fictional)', contact: 'receiving@hillcountry.example' });
  printStep('Draft the delay notice for Hill Country Home', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Next update time agreed by phone' };
  const p = await rt.call('tracking_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Jo Park (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('tracking_request_send', args));
  printStep('Agent tries to text the driver itself', await rt.call('sms_send', {}));
}
