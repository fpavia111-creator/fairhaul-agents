import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { LANE_SHIPMENT_FIELDS, LANE_SETTINGS_SCHEMA, analyseLanes, planText } from './lanes.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/mizar';
const files = {
  shipments: { type: 'string', description: 'Shipment history under --root: shipment id, ship date, mode, carrier, origin and destination city, state and postal code, weight, pallets, miles, cost' },
  settings: { type: 'string', description: 'Optional settings JSON: lane level, days apart that can combine, truckload rate per mile and minimum, truckload weight and pallet thresholds, truck capacity' },
  window_days: { type: 'integer', minimum: 0, maximum: 6, description: 'Override: shipments this many days apart on one lane can combine' },
  tl_rate_per_mile: { type: 'number', minimum: 0, description: 'Override: your typical truckload rate per mile' },
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'lane_settings') : {}; if (a.window_days !== undefined) s.window_days = a.window_days; if (a.tl_rate_per_mile !== undefined) s.tl_rate_per_mile = a.tl_rate_per_mile; return analyseLanes(ctx.records(a.shipments, 'shipments'), s); };
const line = (r) => `${r.shipments} shipment(s), ${r.spend} spend on ${r.lanes_count} lane(s); the top three carry ${r.top_lanes_share_pct}% of spend. ${r.consolidation_groups} group(s) of LTL could have shared a truck (about ${r.consolidation_saving} less); ${r.heavy_ltl} heavy LTL shipment(s) should be quoted as truckload (about ${r.heavy_ltl_saving} less).`;

const pair = draftPair({
  prefix: 'mizar', noun: 'consolidation_plan', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/consolidation_plan-<name>.md for your shipping team: the LTL groups that could share a truck, heavy LTL to quote as truckload, the estimated saving and a proposed rule to fill in. Marked DRAFT. Sending goes through mizar_request_send (one click).',
  required: ['shipments'],
  args: { ...files, name: { type: 'string', description: 'Name for this plan (default consolidation)' }, from: { type: 'string', description: 'Your name' }, team: { type: 'string', description: 'Team or planner it goes to' } },
  build: (a, ctx) => { const r = run(a, ctx); if (!r.consolidation_groups && !r.heavy_ltl) throw new Error('no consolidation or truckload opportunity at these settings'); return { id: a.name || 'consolidation', to: a.team, text: planText(r, a), amount: Math.round((r.consolidation_saving + r.heavy_ltl_saving) * 100) / 100 }; },
});
const refused = refusedTools([
  { name: 'erp_hold_orders', category: 'production_deploy', description: 'Mizar never holds, moves or changes orders.' },
  { name: 'tms_tender_load', category: 'binding_send', description: 'Mizar never tenders or books loads.' },
]);

export const manifest = defineManifest({
  name: 'mizar-of-lanes', version: pkg.version,
  description: 'Maps your freight spend by lane and mode, tracks cost per hundredweight and per mile month by month, finds LTL shipments on one lane that could have shared a truck and heavy LTL that should be quoted as truckload, and drafts the consolidation plan for your shipping team. Changing orders and bookings is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { lane_settings: LANE_SETTINGS_SCHEMA },
  sources: { shipments: { label: 'Shipment history', args: ['shipments'], fields: LANE_SHIPMENT_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'lane_review', title: 'Review lanes and consolidation', description: 'Walks the host model through a lane review with Mizar.', arguments: [{ name: 'shipments', description: 'Shipment history', required: true }], text: `You are helping a transportation or supply chain lead with mizar-of-lanes. Shipments: {{shipments}}.

Rules: Mizar never holds orders or books loads. Truckload costs are estimates from the person's own per-mile rate; ask for it if the default (2.75) does not fit. Holding orders to consolidate can break customer promises; say so.

1. Call mizar_analyse. Give the top lanes by spend and any lane whose cost per hundredweight is rising.
2. Then the consolidation groups and heavy LTL, with the estimated saving.
3. Call mizar_write_report.
4. Only when the person asks, call mizar_draft_consolidation_plan, then mizar_request_send after they review it.` }],
  tools: [
    { name: 'mizar_analyse', kind: 'read', title: 'Analyse lanes and consolidation', description: 'Spend, share, weight, cost per hundredweight and per mile, modes and carriers by lane; cost per hundredweight by lane and month; LTL groups on one lane within the window that fit one truck, with a truckload estimate; heavy LTL shipments to quote as truckload.', inputSchema: { type: 'object', additionalProperties: false, required: ['shipments'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'mizar_write_report', kind: 'report', title: 'Write the lane report', description: 'Write mizar-lanes.csv and .html (one row per lane; consolidation groups; heavy LTL; monthly trend) into out_dir (default lodestar-out/mizar).', inputSchema: { type: 'object', additionalProperties: false, required: ['shipments'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/mizar)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'mizar-lanes', { title: 'Lanes and consolidation', intro: line(r), rows: r.lanes, columns: ['lane', 'shipments', 'spend', 'share_pct', 'weight', 'cost_per_cwt', 'cwt_change_pct', 'cost_per_mile', 'modes', 'carriers'], sections: [{ title: 'Could have shared a truck', rows: r.groups.map((g) => ({ ...g, shipments: g.shipments.join(', ') })), columns: ['lane', 'from', 'to', 'count', 'shipments', 'weight', 'pallets', 'current_cost', 'truckload_estimate', 'saving', 'worth_it'] }, { title: 'Heavy LTL to quote as truckload', rows: r.heavy, columns: ['shipment_id', 'lane', 'date', 'weight', 'pallets', 'cost', 'truckload_estimate', 'saving'] }, { title: 'Cost per hundredweight by month', rows: r.trend, columns: ['lane', 'month', 'shipments', 'cost_per_cwt'] }], limits: [LIMITS.files, `Truckload costs are estimates at ${r.settings.tl_rate_per_mile} per mile with a ${r.settings.tl_minimum} minimum; multi-stop and different delivery addresses on one lane cost more. Cost per hundredweight moves with shipment size as well as price.`] });
      return { summary: `Lane report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'mizar_analyse', decision: 'allow' }, { tool: 'mizar_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Mizar allowlist.' },
  ] },
});
