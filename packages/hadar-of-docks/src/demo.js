import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['hadar_draft_schedule'] });
  process.stdout.write(`Hadar of Docks demo (fictional distribution center) in ${rt.root}\n`);
  printStep('Review two weeks of past appointments', await rt.call('hadar_review', { history: 'history.csv' }));
  const f = { requests: 'requests.csv', dock: 'dock.json', date: '2026-11-18' };
  const p = await rt.call('hadar_plan', f);
  printStep('Plan Wednesday\'s appointments', p);
  for (const x of p.result.schedule) process.stdout.write(`    ${x.load_id} ${x.carrier.padEnd(20)} ${(x.door || '--').padEnd(3)} ${(x.start || '--:--')}-${(x.end || '--:--')} ${x.status}${x.reason ? `: ${x.reason}` : ''}\n`);
  printStep('Write the dock report', await rt.call('hadar_write_report', { ...f, history: 'history.csv' }));
  const d = await rt.call('hadar_draft_schedule', { ...f, to: 'Carriers booked for 2026-11-18', from: 'Receiving desk (fictional)' });
  printStep('Draft the schedule for carriers', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256 };
  const r = await rt.call('hadar_request_publish', args);
  printStep('Approve publishing it: waits for a named person even in Auto', r);
  rt.approvals.approve(r.approval_id, 'Jo Park (fictional)');
  printStep('Same call after the click (recorded; a person books them)', await rt.call('hadar_request_publish', args));
  printStep('Agent tries to book an appointment itself', await rt.call('yms_book_appointment', {}));
}
