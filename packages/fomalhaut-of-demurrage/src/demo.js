import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['fomalhaut_draft_dispute'] });
  process.stdout.write(`Fomalhaut of Demurrage demo (fictional containers, as of 2026-11-16) in ${rt.root}\n`);
  const f = { containers: 'containers.csv', terms: 'terms.json', charges: 'charges.csv', as_of: '2026-11-16' };
  const r = await rt.call('fomalhaut_clocks', f);
  printStep('Count free time and charges for every container', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.container} ${i.status.padEnd(13)} ${String(i.exposure ?? '').padStart(7)}  ${i.detail}\n`);
  printStep('Write the free time board and calendar', await rt.call('fomalhaut_write_report', f));
  const d = await rt.call('fomalhaut_draft_dispute', { ...f, line: 'Blue Meridian Line', from: 'Jo Park, Example Imports (fictional)', contact: 'dd-disputes@bluemeridian.example' });
  printStep('Draft the dispute to Blue Meridian Line', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Gate records attached from the terminal portal' };
  const p = await rt.call('fomalhaut_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Jo Park (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('fomalhaut_request_send', args));
  printStep('Agent tries to book a terminal appointment itself', await rt.call('terminal_book_appointment', {}));
}
