import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['shaula_draft_emissions_statement'] });
  process.stdout.write(`Shaula of Emissions demo (fictional shipments, example factors only) in ${rt.root}\n`);
  const f = { shipments: 'shipments.csv', factors: 'factors.json' };
  const r = await rt.call('shaula_estimate', f);
  printStep('Estimate emissions for nine shipments', r);
  for (const m of r.result.by_mode) process.stdout.write(`    ${m.mode.padEnd(8)} ${String(m.kg_co2e).padStart(9)} kg CO2e  ${String(m.g_per_tonne_km).padStart(4)} g/tkm\n`);
  printStep('Write the emissions report', await rt.call('shaula_write_report', f));
  const d = await rt.call('shaula_draft_emissions_statement', { ...f, customer: 'Front Range Supply', period: 'October 2026', to: 'sustainability@frontrange.example', from: 'Ana Ruiz (fictional)' });
  printStep('Draft a statement for Front Range Supply', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, to: 'sustainability@frontrange.example' };
  const p = await rt.call('shaula_request_send', args);
  printStep('Approve sending it: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Ana Ruiz (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('shaula_request_send', args));
  printStep('Agent tries to submit figures to a reporting portal itself', await rt.call('esg_portal_submit', {}));
}
