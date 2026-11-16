import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { ITEM_FIELDS, ACTUAL_FIELDS, compareStandards, updateText } from './costing.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/pollux';
const files = {
  items: { type: 'string', description: 'Item master under --root: SKU, standard freight per unit, optionally description, units on hand and standard cost' },
  actuals: { type: 'string', description: 'Actual freight by SKU: SKU, units, freight, optionally ship date and shipment id (castor-allocation.csv from Castor of Allocations works as is)' },
  threshold_pct: { type: 'number', minimum: 0, description: 'Percent difference from standard that counts as stale (default 10)' },
  min_units: { type: 'integer', minimum: 1, description: 'Fewest units shipped before Pollux proposes a new standard (default 20)' },
};
const run = (a, ctx) => compareStandards(ctx.records(a.items, 'items'), ctx.records(a.actuals, 'actuals'), { thresholdPct: a.threshold_pct ?? 10, minUnits: a.min_units ?? 20 });
const line = (r) => `${r.skus} SKU(s), ${r.units} units: actual freight ${r.actual_freight} vs ${r.standard_freight} at standard (net ${r.net_variance >= 0 ? '+' : ''}${r.net_variance}). ${r.standard_too_low} standard(s) too low, ${r.standard_too_high} too high, ${r.no_standard} with no standard; ${r.to_change} to change, inventory revaluation about ${r.revaluation_estimate}.`;

const pair = draftPair({
  prefix: 'pollux', noun: 'standard_update', verb: 'apply', category: 'production_deploy', outDir: OUT, actor: 'your cost accountant',
  description: 'Write drafts/standard_update-<name>.md: the items whose freight standard moved past the threshold, the proposed standard and its basis, units on hand and the revaluation estimate. Marked DRAFT. Loading it goes through pollux_request_apply (one click); a person changes the ERP.',
  required: ['items', 'actuals'],
  args: { ...files, name: { type: 'string', description: 'Name for this update (default freight-standards)' }, effective: { type: 'string', format: 'date', description: 'Date the new standards take effect' }, to: { type: 'string', description: 'Who loads the standards' }, from: { type: 'string', description: 'Your name' }, system: { type: 'string', description: 'ERP or costing system' } },
  build: (a, ctx) => { const r = run(a, ctx); if (!r.to_change) throw new Error('no standard moved past the threshold on enough units; nothing to update'); return { id: a.name || 'freight-standards', to: a.to, text: updateText(r, a), amount: r.revaluation_estimate }; },
});
const refused = refusedTools([
  { name: 'erp_update_item_cost', category: 'production_deploy', description: 'Pollux never changes standard costs in your ERP.' },
  { name: 'erp_revalue_inventory', category: 'move_money', description: 'Pollux never revalues inventory or posts the variance.' },
]);

export const manifest = defineManifest({
  name: 'pollux-of-costing', version: pkg.version,
  description: 'Compares the standard freight built into each item\'s cost with what freight actually cost per unit, month by month. Finds the SKUs whose standard is too low (margins look better than they are) or too high, proposes new standards with their basis, estimates the inventory revaluation, and drafts the update for a person to load.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { items: { label: 'Item master', args: ['items'], fields: ITEM_FIELDS }, actuals: { label: 'Actual freight by SKU', args: ['actuals'], fields: ACTUAL_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'freight_standard_review', title: 'Check freight standards', description: 'Walks the host model through a freight standard cost review with Pollux.', arguments: [{ name: 'items', description: 'Item master', required: true }, { name: 'actuals', description: 'Actual freight by SKU', required: true }], text: `You are helping a cost accountant with pollux-of-costing. Items: {{items}}. Actual freight: {{actuals}}.

Rules: Pollux never changes item costs or revalues inventory. A proposed standard is a suggestion with its basis; the person decides.

1. Call pollux_compare. Lead with the standards that are too low (margins overstated), then too high, then items with no standard.
2. Call pollux_write_report.
3. Only when the person asks, call pollux_draft_standard_update, then pollux_request_apply after they review it.` }],
  tools: [
    { name: 'pollux_compare', kind: 'read', title: 'Compare freight standards with actual', description: 'Per SKU: units, actual freight, standard, actual per unit, variance in money and percent, month-by-month per unit and trend, status, proposed standard with basis, and inventory revaluation estimate.', inputSchema: { type: 'object', additionalProperties: false, required: ['items', 'actuals'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'pollux_write_report', kind: 'report', title: 'Write the freight standard report', description: 'Write pollux-standards.csv and .html (one row per SKU) into out_dir (default lodestar-out/pollux).', inputSchema: { type: 'object', additionalProperties: false, required: ['items', 'actuals'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/pollux)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'pollux-standards', { title: 'Freight standards against actual', intro: line(r), rows: r.rows, columns: ['sku', 'description', 'units', 'freight', 'standard', 'actual_per_unit', 'variance', 'variance_pct', 'months', 'trend_pct', 'status', 'proposed_standard', 'proposed_basis', 'on_hand', 'revaluation_estimate'], limits: [LIMITS.files, `Stale means more than ${r.settings.threshold_pct}% from standard on at least ${r.settings.min_units} units. When the per-unit cost moved more than that across the months, the proposal uses the latest month; otherwise the period average. Revaluation is proposed minus standard times units on hand, an estimate.`, LIMITS.advice] });
      return { summary: `Standards report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'pollux_compare', decision: 'allow' }, { tool: 'pollux_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Pollux allowlist.' },
  ] },
});
