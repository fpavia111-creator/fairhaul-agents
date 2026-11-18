import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['rerate_draft_routing_change'] });
  process.stdout.write(`Fairhaul Contract Rerating demo (fictional contracts and history, October 2026) in ${rt.root}\n`);
  const f = { history: 'history.csv', contracts: 'contracts.json' };
  const r = await rt.call('rerate_rerate', f);
  printStep('Re-rate every past shipment under every contract', r);
  for (const l of r.result.lanes) process.stdout.write(`    ${l.lane.padEnd(9)} now ${String(l.current_carrier).padEnd(18)} best ${String(l.best_carrier).padEnd(18)} saves ${l.savings ?? '-'}\n`);
  printStep('Write the re-rating report', await rt.call('rerate_write_report', f));
  const d = await rt.call('rerate_draft_routing_change', { ...f, from: 'Lee Brown (fictional)', system: 'the TMS' });
  printStep('Draft the routing guide changes', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Owner named in the change ticket' };
  const p = await rt.call('rerate_request_apply', args);
  printStep('Approve the change: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Lee Brown (fictional)');
  printStep('Same call after the click (recorded; a person changes the routing guide)', await rt.call('rerate_request_apply', args));
  printStep('Agent tries to change the routing guide itself', await rt.call('tms_update_routing_guide', {}));
}
