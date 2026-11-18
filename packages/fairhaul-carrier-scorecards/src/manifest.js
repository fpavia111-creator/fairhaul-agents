import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { SCORE_FIELDS, SCORECARD_SCHEMA, METRIC_LABELS, scorecards, reviewText } from './scorecards.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/scorecards';
const files = {
  shipments: { type: 'string', description: 'Shipment history under --root (TMS export, CSV, Excel or JSON): load id, carrier, tender response, planned and actual pickup and delivery, expected and billed amount, claim amount, tracking updates, miles' },
  settings: { type: 'string', description: 'Optional scorecard settings JSON: weights, targets, grace minutes, billing tolerance, minimum loads to rank' },
};
const run = (a, ctx) => scorecards(ctx.records(a.shipments, 'shipments'), a.settings ? ctx.readJson(a.settings, 'scorecard') : {});
const line = (r) => `${r.carriers} carrier(s), ${r.loads} load(s), ${r.spend} billed. ${r.ranked ? `${r.ranked} ranked: ${r.cards.filter((c) => c.rank).map((c) => `${c.rank}. ${c.carrier} ${c.score}`).join(', ')}.` : 'None ranked.'}${r.cards.some((c) => !c.ranked) ? ` Not ranked (under ${r.min_loads} loads): ${r.cards.filter((c) => !c.ranked).map((c) => c.carrier).join(', ')}.` : ''}`;
const COLS = ['rank', 'carrier', 'score', 'loads', 'spend', 'otd_pct', 'otp_pct', 'acceptance_pct', 'billing_accuracy_pct', 'overbilled', 'claim_free_pct', 'tracking_pct', 'cost_per_mile', 'otd_change', 'below'];

const pair = draftPair({
  prefix: 'scorecards', noun: 'review', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/review-<carrier>.md: a review note for one carrier with its results against your targets, its rank, its late loads and any billing above the agreed amount. Marked DRAFT. Sending goes through scorecards_request_send (one click).',
  required: ['shipments', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier as named in the shipments file' }, period: { type: 'string', description: 'Period the review covers, e.g. "Q4 2026"' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Carrier account manager' } },
  build: (a, ctx) => { const r = run(a, ctx); const is = carrierIs(r.cards.map((x) => x.carrier), a.carrier); const c = r.cards.find((x) => is(x.carrier)); if (!c) throw new Error(`no loads for carrier "${a.carrier}"`); return { id: c.carrier, to: a.contact, text: reviewText(c, r, a), extra: { score: c.score, rank: c.rank } }; },
});
const refused = refusedTools([
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Carrier Scorecards never sends email.' },
  { name: 'tms_update_routing_guide', category: 'production_deploy', description: 'Fairhaul Carrier Scorecards never changes your routing guide or carrier awards; a person decides.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-carrier-scorecards', version: pkg.version,
  description: 'Scores each carrier from your own shipment history on on-time delivery and pickup, tender acceptance, billing accuracy, claims, tracking and cost per mile, with your weights and targets, ranks them, shows the on-time trend by quarter and drafts the review note. Sending and routing changes are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { scorecard: SCORECARD_SCHEMA },
  sources: { shipments: { label: 'Shipment history', args: ['shipments'], fields: SCORE_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'carrier_scorecard_review', title: 'Score our carriers', description: 'Walks the host model through carrier scorecards with Fairhaul Carrier Scorecards.', arguments: [{ name: 'shipments', description: 'Shipment history', required: true }], text: `You are helping a transportation manager score carriers with fairhaul-carrier-scorecards. Shipments: {{shipments}}.

Rules: Fairhaul Carrier Scorecards never sends and never changes the routing guide. Scores come only from the person's own data; say which measures each score used.

1. Call scorecards_score. Give the ranking, then each carrier below a target and any carrier whose on-time delivery fell quarter on quarter.
2. Call scorecards_write_report.
3. Only when the person asks, call scorecards_draft_review for one carrier, then scorecards_request_send after they review it.` }],
  tools: [
    { name: 'scorecards_score', kind: 'read', title: 'Score and rank carriers', description: 'Per carrier: loads, spend, on-time delivery and pickup, tender acceptance, billing accuracy and amount over agreed, claim-free loads, tracking, cost per mile, the weighted score (measures with no data drop out), rank, targets missed and on-time delivery by quarter.', inputSchema: { type: 'object', additionalProperties: false, required: ['shipments'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'scorecards_write_report', kind: 'report', title: 'Write the scorecard', description: 'Write scorecards-scorecard.csv and .html (one row per carrier, plus the on-time trend by quarter) into out_dir (default lodestar-out/scorecards).', inputSchema: { type: 'object', additionalProperties: false, required: ['shipments'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/scorecards)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const rows = r.cards.map((c) => ({ ...c, rank: c.rank ?? `not ranked (<${r.min_loads} loads)`, below: c.below_target.map((b) => b.label).join(', ') }));
      const trend = r.cards.flatMap((c) => c.otd_trend.map((q) => ({ carrier: c.carrier, ...q })));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'scorecards-scorecard', { title: 'Carrier scorecard', intro: line(r), rows, columns: COLS, labels: Object.fromEntries(Object.entries(METRIC_LABELS).map(([k, v]) => [k, `${v} %`])), sections: [{ title: 'On-time delivery by quarter', rows: trend, columns: ['carrier', 'quarter', 'loads', 'otd_pct'] }, { title: 'Weights used', rows: Object.entries(r.weights).map(([k, v]) => ({ measure: METRIC_LABELS[k], weight: v, target: r.targets[k] ?? '' })), columns: ['measure', 'weight', 'target'] }], limits: [LIMITS.files, 'Scores use only the measures with data for that carrier; the weights are renormalised over them. A day-late delivery counts late when only dates are known.', 'Cost per mile is relative to the cheapest ranked carrier and ignores lane mix.'] });
      return { summary: `Scorecard written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'scorecards_score', decision: 'allow' }, { tool: 'scorecards_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Carrier Scorecards allowlist.' },
  ] },
});
