import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['mizar_draft_consolidation_plan'] });
  process.stdout.write(`Mizar of Lanes demo (fictional shipments, September and October 2026) in ${rt.root}\n`);
  const f = { shipments: 'shipments.csv' };
  const r = await rt.call('mizar_analyse', f);
  printStep('Map spend by lane and find consolidation', r);
  for (const l of r.result.lanes) process.stdout.write(`    ${l.lane.padEnd(18)} ${String(l.spend).padStart(7)} (${l.share_pct}%)  ${l.cost_per_cwt}/cwt\n`);
  printStep('Same with a 2.50 per mile truckload rate', await rt.call('mizar_analyse', { ...f, tl_rate_per_mile: 2.5 }));
  printStep('Write the lane report', await rt.call('mizar_write_report', f));
  const d = await rt.call('mizar_draft_consolidation_plan', { ...f, from: 'Lee Brown (fictional)', team: 'Chicago shipping team' });
  printStep('Draft the consolidation plan', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Rule to be agreed at the Monday meeting' };
  const p = await rt.call('mizar_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Lee Brown (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('mizar_request_send', args));
  printStep('Agent tries to hold orders itself', await rt.call('erp_hold_orders', {}));
}
