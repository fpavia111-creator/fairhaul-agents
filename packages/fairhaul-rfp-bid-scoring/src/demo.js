import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['bids_draft_award'] });
  process.stdout.write(`Fairhaul RFP Bid Scoring demo (fictional RFP, six lanes) in ${rt.root}\n`);
  const f = { lanes: 'lanes.csv', bids: 'bids.csv' };
  printStep('Award every lane to the lowest bid, no rules', await rt.call('bids_award', f));
  const r = await rt.call('bids_award', { ...f, rules: 'rules.json' });
  printStep('Award with a 40% share cap, incumbent preference and backups', r);
  for (const x of r.result.results) process.stdout.write(`    ${x.lane_id} ${x.lane.padEnd(26)} ${x.awards.map((s) => `${s.carrier} ${s.loads}@${s.rate}`).join(' + ').padEnd(48)} ${x.status}\n`);
  printStep('Write the award scenario', await rt.call('bids_write_report', { ...f, rules: 'rules.json' }));
  const d = await rt.call('bids_draft_award', { ...f, rules: 'rules.json', carrier: 'Summit Carriers', rfp: '2027 dry van RFP (fictional)', start: '2027-01-04', from: 'Lee Brown, Example Home Goods (fictional)', contact: 'pricing@summit-carriers.example' });
  printStep('Draft the award letter to Summit Carriers', d);
  const args = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'Reply date and agreement reference to be filled by procurement' };
  const p = await rt.call('bids_request_send', args);
  printStep('Approve sending: waits for a named person even in Auto', p);
  rt.approvals.approve(p.approval_id, 'Lee Brown (fictional)');
  printStep('Same call after the click (recorded; a person sends it)', await rt.call('bids_request_send', args));
  printStep('Agent tries to load the new rates into the TMS itself', await rt.call('tms_load_rates', {}));
}
