import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { LANE_FIELDS, BID_FIELDS, AWARD_RULES_SCHEMA, award, awardText } from './bids.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/altair';
const files = {
  lanes: { type: 'string', description: 'RFP lanes under --root: lane id, origin, destination, annual loads, incumbent carrier and rate' },
  bids: { type: 'string', description: 'Carrier bids under --root: lane id, carrier, rate per load, optional annual capacity and notes' },
  rules: { type: 'string', description: 'Optional award rules JSON: max share per carrier, incumbent preference, backup carriers, carriers to exclude, outlier threshold' },
};
const run = (a, ctx) => award(ctx.records(a.lanes, 'lanes'), ctx.records(a.bids, 'bids'), a.rules ? ctx.readJson(a.rules, 'award_rules') : {});
const line = (r) => `${r.lanes} lane(s), ${r.annual_loads} annual loads: ${r.awarded} awarded, ${r.partly_covered} partly covered, ${r.no_bids} with no award. Scenario cost ${r.annual_cost} against ${r.baseline_cost} at incumbent rates (savings ${r.savings}). ${r.incumbents_kept} incumbent(s) kept; ${r.outlier_bids} bid(s) flagged as possible errors.`;

const pair = draftPair({
  prefix: 'altair', noun: 'award', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/award-<carrier>.md: the award letter for one carrier listing its lanes, estimated loads and rates, and lanes where it is backup. Marked DRAFT. Sending goes through altair_request_send (one click).',
  required: ['lanes', 'bids', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier as named in the bids' }, rfp: { type: 'string', description: 'RFP name' }, start: { type: 'string', description: 'Start date of the award' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Carrier pricing contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const is = carrierIs(r.carriers.map((x) => x.carrier), a.carrier); const c = r.carriers.find((x) => is(x.carrier)); if (!c) throw new Error(`"${a.carrier}" wins no lanes in this scenario`); return { id: c.carrier, to: a.contact, text: awardText(c.carrier, r.results, a), amount: c.spend, extra: { lanes: c.lanes, loads: c.loads } }; },
});
const refused = refusedTools([
  { name: 'tms_load_rates', category: 'production_deploy', description: 'Altair never loads rates or routing guides into your TMS.' },
  { name: 'email_send', category: 'binding_send', description: 'Altair never sends awards or regrets.' },
]);

export const manifest = defineManifest({
  name: 'altair-of-bids', version: pkg.version,
  description: 'Scores carrier bids from a freight RFP lane by lane against your incumbent rates and volumes, builds an award scenario with your rules (share caps, incumbent preference, backups, capacity, exclusions), flags bids that look like errors, shows savings and uncovered lanes, and drafts award letters. Loading rates and sending awards are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { award_rules: AWARD_RULES_SCHEMA },
  sources: { lanes: { label: 'RFP lanes', args: ['lanes'], fields: LANE_FIELDS }, bids: { label: 'Carrier bids', args: ['bids'], fields: BID_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'rfp_award', title: 'Analyse RFP bids and build an award', description: 'Walks the host model through bid analysis with Altair.', arguments: [{ name: 'lanes', description: 'Lanes file', required: true }, { name: 'bids', description: 'Bids file', required: true }], text: `You are helping a procurement or transportation lead with altair-of-bids. Lanes: {{lanes}}. Bids: {{bids}}.

Rules: Altair never loads rates and never sends awards. Volumes in award letters are estimates. Savings assume the estimated volumes move at the bid rates.

1. Call altair_award with no rules, then with the person's rules, and compare cost, savings and carrier shares.
2. Name the lanes with no bids or partial cover and any bid flagged as a possible error.
3. Call altair_write_report.
4. Only when the person asks, call altair_draft_award for one carrier, then altair_request_send after they review it.` }],
  tools: [
    { name: 'altair_award', kind: 'read', title: 'Build an award scenario', description: 'For each lane: bids, best and median rate, awarded carrier(s) with loads and rate, backup, uncovered loads, cost against the incumbent baseline and notes (incumbent kept, share cap reached, possible bid error). Totals and carrier shares.', inputSchema: { type: 'object', additionalProperties: false, required: ['lanes', 'bids'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'altair_write_report', kind: 'report', title: 'Write the award scenario', description: 'Write altair-award.csv and .html (one row per lane with award, backup and savings; carrier shares; rules used) into out_dir (default lodestar-out/altair).', inputSchema: { type: 'object', additionalProperties: false, required: ['lanes', 'bids'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/altair)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const rows = r.results.map((x) => ({ ...x, awards: x.awards.map((s) => `${s.carrier} ${s.loads} @ ${s.rate}`).join('; '), backup: x.backup ? `${x.backup.carrier} @ ${x.backup.rate}` : '', notes: x.notes.join(' ') }));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'altair-award', { title: 'RFP award scenario', intro: line(r), rows, columns: ['lane_id', 'lane', 'annual_loads', 'bids', 'best_rate', 'median_rate', 'incumbent', 'incumbent_rate', 'awards', 'backup', 'uncovered_loads', 'annual_cost', 'baseline_cost', 'savings', 'change_pct', 'status', 'notes'], sections: [{ title: 'Carrier shares', rows: r.carriers, columns: ['carrier', 'lanes', 'loads', 'share_pct', 'spend'] }, { title: 'Rules used', rows: Object.entries(r.rules).filter(([k]) => k !== 'note').map(([rule, value]) => ({ rule, value: Array.isArray(value) ? value.join(', ') : value })), columns: ['rule', 'value'] }], limits: [LIMITS.files, 'Savings assume the estimated volumes move at the bid rates. Lanes are awarded largest savings first, so the share cap falls on later lanes.', LIMITS.advice] });
      return { summary: `Award scenario written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'altair_award', decision: 'allow' }, { tool: 'altair_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Altair allowlist.' },
  ] },
});
