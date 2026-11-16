import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['rigel_draft_review'] });
  process.stdout.write(`Rigel of Scorecards demo (fictional carriers, July to November 2026) in ${rt.root}\n`);
  const f = { shipments: 'shipments.csv', settings: 'scorecard.json' };
  const s = await rt.call('rigel_score', f);
  printStep('Score and rank the carriers', s);
  for (const c of s.result.cards) process.stdout.write(`    ${String(c.rank ?? '-').padStart(2)} ${c.carrier.padEnd(18)} score ${String(c.score).padStart(5)}  OTD ${String(c.otd_pct).padStart(5)}%  accept ${String(c.acceptance_pct).padStart(5)}%  ${c.below_target.map((b) => b.label).join(', ')}\n`);
  printStep('Write the scorecard', await rt.call('rigel_write_report', f));
  const d = await rt.call('rigel_draft_review', { ...f, carrier: 'Coastal Line Haul', period: 'July to November 2026', from: 'Sam Lee, Example Home Goods (fictional)', contact: 'accounts@coastal-linehaul.example' });
  printStep('Draft the review note for the carrier that slipped', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Meeting date to be agreed by phone' };
  const p = await rt.call('rigel_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Sam Lee (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('rigel_request_send', args));
  printStep('Agent tries to change the routing guide itself', await rt.call('tms_update_routing_guide', {}));
}
