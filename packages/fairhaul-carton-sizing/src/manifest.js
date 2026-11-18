import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { PACKAGE_FIELDS, CARTON_SETTINGS_SCHEMA, checkCartons, changeText } from './cartons.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/cartons';
const files = {
  packages: { type: 'string', description: 'Shipped parcels under --root (WMS or shipping system export): package id, SKU, carton code or carton dimensions, contents dimensions in inches, actual weight in lb, billed amount' },
  cartons: { type: 'string', description: 'Carton catalog JSON: carton names and inside dimensions in inches, plus divisor, padding and average cost per billable lb' },
};
const run = (a, ctx) => checkCartons(ctx.records(a.packages, 'packages'), ctx.readJson(a.cartons, 'carton_settings'));
const line = (r) => `${r.packages} package(s), average fill ${r.avg_fill_pct}%: ${r.smaller_carton} could use a smaller carton (${r.billable_lbs_saved} billable lb, about ${r.est_saving}); ${r.no_fit} fit no carton in the catalog; ${r.oversize_risk} at risk of an oversize charge.`;

const pair = draftPair({
  prefix: 'cartons', noun: 'carton_change', verb: 'apply', category: 'production_deploy', outDir: OUT, actor: 'the person who owns your WMS packing rules',
  description: 'Write drafts/carton_change-<name>.md: packing rules by SKU (from carton, to carton, saving), cartons to add for packages nothing fits, and carton usage. Marked DRAFT. Applying it goes through cartons_request_apply (one click); a person changes the WMS.',
  required: ['packages', 'cartons'],
  args: { ...files, name: { type: 'string', description: 'Name for this change (default cartons)' }, from: { type: 'string', description: 'Your name' }, system: { type: 'string', description: 'WMS or packing system' } },
  build: (a, ctx) => { const r = run(a, ctx); if (!r.smaller_carton && !r.no_fit) throw new Error('every package already uses the smallest carton that fits'); return { id: a.name || 'cartons', text: changeText(r, a), amount: r.est_saving }; },
});
const refused = refusedTools([
  { name: 'wms_update_cartonization', category: 'production_deploy', description: 'Fairhaul Carton Sizing never changes packing rules or the carton catalog in your WMS.' },
  { name: 'purchase_order_create', category: 'move_money', description: 'Fairhaul Carton Sizing never orders cartons.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-carton-sizing', version: pkg.version,
  description: 'Checks every parcel\'s carton against what was inside, finds the smallest carton in your catalog that fits, works out the dimensional weight and freight a better fit would save, flags packages heading for oversize charges and sizes your catalog lacks, and drafts carton and packing rule changes. Changing the WMS is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { carton_settings: CARTON_SETTINGS_SCHEMA },
  sources: { packages: { label: 'Shipped parcels', args: ['packages'], fields: PACKAGE_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'carton_fit_review', title: 'Check carton fit', description: 'Walks the host model through a packaging review with Fairhaul Carton Sizing.', arguments: [{ name: 'packages', description: 'Packages file', required: true }, { name: 'cartons', description: 'Carton catalog JSON', required: true }], text: `You are helping a warehouse or e-commerce operations lead with fairhaul-carton-sizing. Packages: {{packages}}. Cartons: {{cartons}}.

Rules: Fairhaul Carton Sizing never changes the WMS and never orders cartons. Savings use the person's average cost per billable lb; smaller cartons need a damage test first.

1. Call cartons_check. Lead with the SKUs packed in cartons that are too big and the saving, then packages nothing fits and oversize risks.
2. Call cartons_write_report.
3. Only when the person asks, call cartons_draft_carton_change, then cartons_request_apply after they review it.` }],
  tools: [
    { name: 'cartons_check', kind: 'read', title: 'Check carton fit', description: 'For each package: carton used, fill, dimensional and billable weight now, the smallest catalog carton that fits (any orientation, with padding) and its billable weight, the lb and money saved, oversize risk and data problems. Totals, savings by SKU, carton usage and carton sizes to add.', inputSchema: { type: 'object', additionalProperties: false, required: ['packages', 'cartons'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'cartons_write_report', kind: 'report', title: 'Write the carton report', description: 'Write cartons.csv and .html (one row per package; savings by SKU; carton usage) into out_dir (default lodestar-out/cartons).', inputSchema: { type: 'object', additionalProperties: false, required: ['packages', 'cartons'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/cartons)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'cartons', { title: 'Carton fit', intro: line(r), rows: r.items.map((i) => ({ ...i, flags: i.flags.join(' ') })), columns: ['package_id', 'sku', 'carton_used', 'used_dims', 'fill_pct', 'weight', 'dim_weight_now', 'billable_now', 'best_carton', 'billable_best', 'billable_lbs_saved', 'est_saving', 'status', 'flags'], sections: [{ title: 'Savings by SKU', rows: r.by_sku, columns: ['sku', 'packages', 'from', 'to', 'est_saving'] }, { title: 'Carton use', rows: r.usage, columns: ['carton', 'dims', 'used', 'best_fit_for'] }], limits: [LIMITS.files, `Dimensional weight uses a ${r.settings.divisor} divisor and ${r.settings.padding_in} in of padding per side; savings use ${r.settings.rate_per_lb} per billable lb. Carrier rules on rounding and oversize vary; check yours.`] });
      return { summary: `Carton report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'cartons_check', decision: 'allow' }, { tool: 'cartons_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Carton Sizing allowlist.' },
  ] },
});
