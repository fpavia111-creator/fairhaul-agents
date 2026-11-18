import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { SHIPMENT_FIELDS, FACTOR_SCHEMA, estimate, statementText } from './emissions.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/emissions';
const files = {
  shipments: { type: 'string', description: 'Shipments under --root: shipment id, mode, carrier, customer, origin, destination, weight and unit, distance and unit, and where the distance came from' },
  factors: { type: 'string', description: 'Emission factors JSON you choose: source name, grams CO2e per tonne-km by mode, mode aliases, default units and an optional mode-shift what-if' },
};
const run = (a, ctx) => estimate(ctx.records(a.shipments, 'shipments'), ctx.readJson(a.factors, 'emission_factors'));
const line = (r) => `Estimate: ${r.tonnes_co2e} t CO2e for ${r.estimated} of ${r.shipments} shipment(s) (${r.tonne_km} tonne-km, ${r.g_per_tonne_km} g per tonne-km); ${r.not_estimated} not estimated; ${r.measured_distance_pct}% with measured distance.${r.by_mode[0] ? ` Largest: ${r.by_mode[0].mode} (${r.by_mode[0].kg_co2e} kg).` : ''}${r.shift && r.shift.shipments ? ` Moving ${r.shift.shipments} ${r.shift.from} shipment(s) to ${r.shift.to} would save about ${r.shift.kg_saved} kg.` : ''} Factors: ${r.factor_source}`;

const pair = draftPair({
  prefix: 'emissions', noun: 'emissions_statement', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'your sustainability or account lead',
  description: 'Write drafts/emissions_statement-<customer>.md: estimated emissions of one customer\'s shipments, line by line, with the method, the factor source and a plain statement that the figures are estimates and not verified. Marked DRAFT. Sending goes through emissions_request_send (one click).',
  required: ['shipments', 'factors', 'customer'],
  args: { ...files, customer: { type: 'string', description: 'Customer to write the statement for' }, period: { type: 'string', description: 'Period covered, for the title' }, to: { type: 'string', description: 'Customer contact' }, from: { type: 'string', description: 'Your name' } },
  build: (a, ctx) => { const r = run(a, ctx); if (!r.by_customer.find((x) => x.customer === a.customer)) throw new Error(`no estimated shipments for ${a.customer}`); return { id: a.customer, to: a.to, text: statementText(r, a.customer, a) }; },
});
const refused = refusedTools([
  { name: 'esg_portal_submit', category: 'binding_send', description: 'Fairhaul Freight Emissions never submits figures to a reporting portal, customer survey or regulator.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Freight Emissions never emails anyone.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-freight-emissions', version: pkg.version,
  description: 'Estimates the greenhouse gas emissions of your shipments from weight, distance and mode, using emission factors you choose and name. Totals by mode, carrier, lane and customer, a data quality score, a labelled mode-shift what-if, and a draft statement for a customer who asks. Every figure is an estimate; nothing is submitted anywhere.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { emission_factors: FACTOR_SCHEMA },
  sources: { shipments: { label: 'Shipments', args: ['shipments'], fields: SHIPMENT_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'shipment_emissions', title: 'Estimate shipping emissions', description: 'Walks the host model through an emissions estimate with Fairhaul Freight Emissions.', arguments: [{ name: 'shipments', description: 'Shipments', required: true }, { name: 'factors', description: 'Emission factors JSON', required: true }], text: `You are helping a sustainability, logistics or account lead with fairhaul-freight-emissions. Shipments: {{shipments}}. Factors: {{factors}}.

Rules: every figure is an estimate; always say so and name the factor source. Never call a figure verified, certified or compliant with any standard. Fairhaul Freight Emissions submits nothing.

1. Call emissions_estimate. Report the total, the largest modes and lanes, what was not estimated and why, and the share with measured distance.
2. If a mode-shift what-if is set, report it as a what-if.
3. Call emissions_write_report.
4. Only when the person asks, call emissions_draft_emissions_statement for one customer, then emissions_request_send after they review it.` }],
  tools: [
    { name: 'emissions_estimate', kind: 'read', title: 'Estimate shipment emissions', description: 'Per shipment: mode, tonnes, km, tonne-km, factor, kg CO2e estimate and data quality. Totals and intensity by mode, carrier, lane and customer, and the mode-shift what-if.', inputSchema: { type: 'object', additionalProperties: false, required: ['shipments', 'factors'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'emissions_write_report', kind: 'report', title: 'Write the emissions estimate', description: 'Write emissions.csv and .html (one row per shipment; by mode, carrier, lane and customer; mode-shift what-if) into out_dir (default lodestar-out/emissions).', inputSchema: { type: 'object', additionalProperties: false, required: ['shipments', 'factors'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/emissions)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx); const cols = ['shipments', 'tonne_km', 'kg_co2e', 'g_per_tonne_km'];
      const w = writeWorklist(ctx, a.out_dir || OUT, 'emissions', { title: 'Shipment emissions (estimate)', intro: line(r), rows: r.rows, columns: ['shipment_id', 'mode', 'carrier', 'customer', 'lane', 'tonnes', 'km', 'tonne_km', 'factor', 'kg_co2e', 'quality', 'issues'], sections: [{ title: 'By mode', rows: r.by_mode, columns: ['mode', ...cols] }, { title: 'By carrier', rows: r.by_carrier, columns: ['carrier', ...cols] }, { title: 'By lane', rows: r.by_lane, columns: ['lane', ...cols] }, { title: 'By customer', rows: r.by_customer, columns: ['customer', ...cols] }, { title: 'Mode-shift what-if', rows: r.shift ? [r.shift] : [], columns: ['from', 'to', 'min_km', 'extra_km_pct', 'shipments', 'kg_before', 'kg_after', 'kg_saved'] }], limits: [LIMITS.files, `Estimates only: tonnes times km times a factor per mode. Factor source: ${r.factor_source}. Not verified, not assured, and not a certified footprint. Empty running, warehousing and packaging are excluded unless your factors include them.`] });
      return { summary: `Emissions estimate written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'emissions_estimate', decision: 'allow' }, { tool: 'emissions_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Freight Emissions allowlist.' },
  ] },
});
