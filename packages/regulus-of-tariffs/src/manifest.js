import { defineManifest, MODEL_PIN, FREIGHT_CONTRACT_SCHEMA, writeWorklist, draftPair, refusedTools, LIMITS } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { HISTORY_FIELDS, rerate, routingText } from './tariffs.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/regulus';
const files = {
  history: { type: 'string', description: 'Shipment history under --root: shipment id, carrier used, ship date, mode, origin and destination state and postal code, weight, pallets, miles, class, accessorials, amount paid' },
  contracts: { type: 'string', description: 'Freight contract JSON with every carrier you hold a contract with (the Lodestar contract format): lanes, minimums, discounts, fuel tables, fuel index, accessorials' },
};
const run = (a, ctx) => rerate(ctx.records(a.history, 'history'), ctx.readJson(a.contracts, 'freight_contract'));
const line = (r) => `${r.shipments} shipment(s), ${r.paid} paid. Re-rated under every contract: ${r.left_on_table} more than the cheapest contract on the day. ${r.lanes_to_change} lane(s) where another carrier is cheaper overall (${r.lane_savings}). ${r.not_rateable} shipment(s) no contract can price.`;

const pair = draftPair({
  prefix: 'regulus', noun: 'routing_change', verb: 'apply', category: 'production_deploy', outDir: OUT, actor: 'the person who owns your routing guide',
  description: 'Write drafts/routing_change-<name>.md: for each lane where another contract is cheaper on your history, the current and proposed first-choice carrier with the totals. Marked DRAFT. Applying it goes through regulus_request_apply (one click); a person changes the routing guide.',
  required: ['history', 'contracts'],
  args: { ...files, name: { type: 'string', description: 'Name for this proposal (default routing-guide)' }, from: { type: 'string', description: 'Your name' }, system: { type: 'string', description: 'TMS whose routing guide this is' } },
  build: (a, ctx) => { const r = run(a, ctx); if (!r.lanes.some((l) => l.change && l.savings > 0)) throw new Error('no lane where another contract is cheaper; nothing to change'); return { id: a.name || 'routing-guide', text: routingText(r.lanes, a), amount: r.lane_savings, extra: { lanes: r.lanes_to_change } }; },
});
const refused = refusedTools([
  { name: 'tms_update_routing_guide', category: 'production_deploy', description: 'Regulus never changes your routing guide; a person does.' },
  { name: 'email_send', category: 'binding_send', description: 'Regulus never sends email.' },
]);

export const manifest = defineManifest({
  name: 'regulus-of-tariffs', version: pkg.version,
  description: 'Re-rates your shipment history under every carrier contract you hold (linehaul, minimums, discounts, fuel and accessorials) to show what each carrier would have cost, the cheapest carrier by lane and what you paid above it, and drafts routing guide changes. Changing the routing guide is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { freight_contract: FREIGHT_CONTRACT_SCHEMA },
  sources: { history: { label: 'Shipment history', args: ['history'], fields: HISTORY_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'rerate_history', title: 'Re-rate history under every contract', description: 'Walks the host model through a what-if with Regulus.', arguments: [{ name: 'history', description: 'Shipment history', required: true }, { name: 'contracts', description: 'Contracts JSON', required: true }], text: `You are helping a transportation or procurement lead with regulus-of-tariffs. History: {{history}}. Contracts: {{contracts}}.

Rules: Regulus never changes the routing guide. Cheaper on paper is not cheaper in service; point to carrier scorecards before any change. Shipments a contract cannot fully price (missing lane, measure or accessorial) are left out of that carrier's comparison.

1. Call regulus_rerate. Lead with the lanes where another carrier is cheaper and by how much.
2. Call regulus_write_report.
3. Only when the person asks, call regulus_draft_routing_change, then regulus_request_apply after they review it.` }],
  tools: [
    { name: 'regulus_rerate', kind: 'read', title: 'Re-rate history under every contract', description: 'Each shipment priced under every carrier contract in force on its ship date (linehaul, fuel at that week\'s diesel, accessorials), the cheapest carrier and what was paid above it; each lane\'s carrier ranking and savings; per carrier, how many shipments it can price and is cheapest on.', inputSchema: { type: 'object', additionalProperties: false, required: ['history', 'contracts'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'regulus_write_report', kind: 'report', title: 'Write the re-rating report', description: 'Write regulus-rerate.csv and .html (one row per shipment with each carrier\'s price; lanes ranked by savings; carriers) into out_dir (default lodestar-out/regulus).', inputSchema: { type: 'object', additionalProperties: false, required: ['history', 'contracts'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/regulus)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx); const names = r.carriers.map((c) => c.carrier);
      const rows = r.items.map((i) => ({ ...Object.fromEntries(['shipment_id', 'ship_date', 'lane', 'mode', 'weight', 'carrier', 'paid', 'contract_cost', 'best_carrier', 'best_cost', 'left_on_table'].map((k) => [k, i[k]])), ...Object.fromEntries(i.quotes.map((q) => [q.carrier, q.total ?? `n/a: ${q.why}`])) }));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'regulus-rerate', { title: 'Shipment history re-rated under every contract', intro: line(r), rows, columns: ['shipment_id', 'ship_date', 'lane', 'mode', 'weight', 'carrier', 'paid', 'contract_cost', 'best_carrier', 'best_cost', 'left_on_table', ...names], sections: [{ title: 'Lanes', rows: r.lanes, columns: ['lane', 'mode', 'shipments', 'current_carrier', 'paid', 'best_carrier', 'best_total', 'savings', 'ranking'] }, { title: 'Carriers', rows: r.carriers, columns: ['carrier', 'can_rate', 'cheapest_on', 'total_if_all'] }], limits: [LIMITS.files, LIMITS.contract, 'Price is not service: check carrier performance before moving freight.'] });
      return { summary: `Re-rating report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'regulus_rerate', decision: 'allow' }, { tool: 'regulus_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Regulus allowlist.' },
  ] },
});
