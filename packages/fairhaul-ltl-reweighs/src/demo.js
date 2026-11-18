import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['reweigh_draft_dispute'] });
  process.stdout.write(`Fairhaul LTL Reweighs demo (fictional LTL corrections, October 2026) in ${rt.root}\n`);
  const f = { corrections: 'corrections.csv', terms: 'terms.json' };
  const r = await rt.call('reweigh_review', f);
  printStep('Review the weight and class corrections', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.pro} ${i.product.padEnd(16)} +${String(i.amount_added).padStart(7)}  ${i.status.padEnd(19)} ${i.reasons.map((x) => x.code).join(', ')}\n`);
  printStep('Write the corrections report', await rt.call('reweigh_write_report', f));
  const d = await rt.call('reweigh_draft_dispute', { ...f, carrier: 'Prairie Express', from: 'Sam Lee, Example Home Goods (fictional)', contact: 'inspections@prairie-express.example' });
  printStep('Draft the dispute for Prairie Express', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'BOLs attached in the AP folder' };
  const p = await rt.call('reweigh_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Sam Lee (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('reweigh_request_send', args));
  printStep('Agent tries to change the item master itself', await rt.call('erp_update_item_master', {}));
}
