import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['quotes_draft_booking'] });
  process.stdout.write(`Fairhaul Spot Quotes demo (fictional loads and quotes, as of 2026-11-16) in ${rt.root}\n`);
  const f = { loads: 'loads.csv', quotes: 'quotes.csv', settings: 'settings.json', as_of: '2026-11-16' };
  const r = await rt.call('quotes_compare', f);
  printStep('Compare the quotes on one all-in basis', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.load_id} ${i.status.padEnd(12)} ${i.best ? `${i.best.carrier} ${i.best.all_in_cost}` : '-'}\n`);
  printStep('Write the quote board', await rt.call('quotes_write_report', f));
  const d = await rt.call('quotes_draft_booking', { ...f, load_id: 'Q-701', from: 'Sam Lee, Example Home Goods (fictional)', contact: 'dispatch@ridgeline-freight.example' });
  printStep('Draft the booking for Q-701', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Addresses go on the rate confirmation' };
  const p = await rt.call('quotes_request_tender', args);
  printStep('Approve tendering: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Sam Lee (fictional)');
  printStep('Same call after the click (recorded; a person tenders it)', await rt.call('quotes_request_tender', args));
  printStep('Agent tries to tender the load itself', await rt.call('tms_tender_load', {}));
}
