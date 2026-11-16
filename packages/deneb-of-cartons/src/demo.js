import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['deneb_draft_carton_change'] });
  process.stdout.write(`Deneb of Cartons demo (fictional parcels and cartons) in ${rt.root}\n`);
  const f = { packages: 'packages.csv', cartons: 'cartons.json' };
  const r = await rt.call('deneb_check', f);
  printStep('Check every carton against its contents', r);
  for (const i of r.result.items) process.stdout.write(`    ${i.package_id} ${String(i.sku).padEnd(14)} ${String(i.carton_used).padEnd(7)} -> ${String(i.best_carton ?? 'none').padEnd(5)} ${String(i.billable_now).padStart(3)} -> ${String(i.billable_best ?? '-').padStart(3)} lb  ${i.status}\n`);
  printStep('Write the carton report', await rt.call('deneb_write_report', f));
  const d = await rt.call('deneb_draft_carton_change', { ...f, from: 'Ana Ruiz (fictional)', system: 'the WMS' });
  printStep('Draft the carton and packing rule changes', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Drop test booked for next week' };
  const p = await rt.call('deneb_request_apply', args);
  printStep('Approve the change: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Ana Ruiz (fictional)');
  printStep('Same call after the click (recorded; a person changes the WMS)', await rt.call('deneb_request_apply', args));
  printStep('Agent tries to change the WMS packing rules itself', await rt.call('wms_update_cartonization', {}));
}
