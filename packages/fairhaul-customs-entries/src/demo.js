import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['entries_draft_correction_request'] });
  process.stdout.write(`Fairhaul Customs Entries demo (fictional entries and invoices, as of 2026-11-16) in ${rt.root}\n`);
  const f = { entries: 'entries.csv', invoices: 'commercial-invoices.csv', as_of: '2026-11-16', correction_window_days: 300 };
  const r = await rt.call('entries_check', f);
  printStep('Check three entries against the commercial invoices', r);
  for (const x of r.result.items) process.stdout.write(`    ${(x.entry_number || '-').padEnd(28)} ${x.sku.padEnd(14)} ${x.code.padEnd(24)} ${x.duty_impact ?? ''}\n`);
  printStep('Write the entry review', await rt.call('entries_write_report', f));
  const d = await rt.call('entries_draft_correction_request', { ...f, entry_number: 'ABC-1003003-3', to: 'entries@harborline-brokers.example', broker: 'Lee', from: 'Ana Ruiz (fictional)' });
  printStep('Draft the note to the broker for entry ABC-1003003-3', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, to: 'entries@harborline-brokers.example' };
  const p = await rt.call('entries_request_send', args);
  printStep('Approve sending it: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Ana Ruiz (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('entries_request_send', args));
  printStep('Agent tries to pick a tariff code itself', await rt.call('customs_classify_item', {}));
}
