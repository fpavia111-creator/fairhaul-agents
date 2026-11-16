import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['pollux_draft_standard_update'] });
  process.stdout.write(`Pollux of Costing demo (fictional items, August to October freight) in ${rt.root}\n`);
  const f = { items: 'items.csv', actuals: 'actual-freight.csv' };
  const r = await rt.call('pollux_compare', f);
  printStep('Compare standard freight per unit with actual', r);
  for (const x of r.result.rows) process.stdout.write(`    ${x.sku.padEnd(14)} ${String(x.standard ?? '-').padStart(6)} -> ${String(x.actual_per_unit ?? '-').padStart(8)}  ${x.status.padEnd(18)} ${x.proposed_standard ?? ''}\n`);
  printStep('Write the standards report', await rt.call('pollux_write_report', f));
  const d = await rt.call('pollux_draft_standard_update', { ...f, effective: '2026-12-01', to: 'Priya Nair (fictional)', from: 'Sam Ortiz (fictional)', system: 'the ERP item cost table' });
  printStep('Draft the standard update', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256 };
  const p = await rt.call('pollux_request_apply', args);
  printStep('Approve the update: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Priya Nair (fictional)');
  printStep('Same call after the click (recorded; a person loads it)', await rt.call('pollux_request_apply', args));
  printStep('Agent tries to change item costs itself', await rt.call('erp_update_item_cost', {}));
}
