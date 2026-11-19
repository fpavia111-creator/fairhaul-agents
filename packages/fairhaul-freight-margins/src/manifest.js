import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { ORDER_FIELDS, ORDER_PROFILES, COST_FIELDS, freightMargins, termsText } from './margins.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/margins';
const files = {
  orders: { type: 'string', description: 'Orders under --root (ERP or e-commerce export): order, customer, shipment id, order value, freight charged to the customer, freight terms, and freight cost if you have it per order' },
  costs: { type: 'string', description: 'Optional freight cost per shipment (shipment id, cost); shared shipments are split across their orders by value' },
  threshold: { type: 'number', minimum: 0, description: 'Your free-shipping threshold in order value, if you have one' },
  alternatives: { type: 'array', items: { type: 'number', minimum: 0 }, description: 'Other thresholds to estimate, for comparison' },
  max_freight_pct: { type: 'number', minimum: 0, description: 'Flag orders whose freight is more than this percent of order value and not fully charged (default 10)' },
};
const run = (a, ctx) => freightMargins(ctx.records(a.orders, 'orders'), a.costs ? ctx.records(a.costs, 'costs') : [], { threshold: a.threshold ?? null, alternatives: a.alternatives || [], maxFreightPct: a.max_freight_pct ?? 10 });
const line = (r) => `${r.orders} order(s): freight cost ${r.freight_cost}, charged ${r.freight_billed}, ${r.recovery_pct}% recovered (gap ${r.gap}).${r.collect_but_we_paid ? ` Collect orders we paid: ${r.collect_but_we_paid}.` : ''}${r.prepaid_add_not_billed ? ` Prepaid-and-add not billed: ${r.prepaid_add_not_billed}.` : ''}${r.free_below_threshold ? ` Shipped free below the threshold: ${r.free_below_threshold}.` : ''}${r.by_customer[0] && r.by_customer[0].gap < 0 ? ` Largest gap: ${r.by_customer[0].customer} (${r.by_customer[0].gap}).` : ''}`;

const pair = draftPair({
  prefix: 'margins', noun: 'terms_change', verb: 'apply', category: 'production_deploy', outDir: OUT, actor: 'your sales or pricing owner',
  description: 'Write drafts/terms_change-<name>.md: the freight recovery gap, policy leaks, the customers losing the most with a proposal to decide, and the free-shipping threshold estimates. Marked DRAFT. Applying it goes through margins_request_apply (one click); a person changes customer terms.',
  required: ['orders'],
  args: { ...files, name: { type: 'string', description: 'Name for this review (default freight-terms)' }, top: { type: 'integer', minimum: 1, maximum: 50, description: 'How many customers to list (default 5)' }, to: { type: 'string', description: 'Sales or pricing owner' }, from: { type: 'string', description: 'Your name' } },
  build: (a, ctx) => { const r = run(a, ctx); if (r.gap >= 0) throw new Error('freight charged covers freight cost; nothing to change'); return { id: a.name || 'freight-terms', to: a.to, text: termsText(r, a), amount: -r.gap }; },
});
const refused = refusedTools([
  { name: 'erp_update_customer_terms', category: 'production_deploy', description: 'Fairhaul Freight Margins never changes customer freight terms or prices.' },
  { name: 'ar_rebill_freight', category: 'move_money', description: 'Fairhaul Freight Margins never invoices customers for freight.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-freight-margins', version: pkg.version,
  description: 'Compares the freight you charged each customer with what the freight actually cost: recovery by customer and freight terms, collect orders you paid for, prepaid-and-add orders with no freight on the invoice, orders shipped free below your threshold, and an estimate of how other free-shipping thresholds would change recovery. It never changes terms or bills customers.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { orders: { label: 'Orders', args: ['orders'], fields: ORDER_FIELDS, profiles: ORDER_PROFILES }, costs: { label: 'Freight cost per shipment', args: ['costs'], fields: COST_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'freight_recovery_review', title: 'Check freight recovery', description: 'Walks the host model through a freight recovery review with Fairhaul Freight Margins.', arguments: [{ name: 'orders', description: 'Orders', required: true }, { name: 'costs', description: 'Freight cost per shipment', required: false }], text: `You are helping a finance, sales ops or e-commerce lead with fairhaul-freight-margins. Orders: {{orders}}. Costs: {{costs}}.

Rules: Fairhaul Freight Margins never changes terms or bills customers. Threshold figures are estimates that assume customers do not change behaviour; say so.

1. Call margins_margins, with the free-shipping threshold if the person has one. Lead with leaks (collect orders paid, prepaid-and-add not billed, free below threshold), then the customers with the largest gap.
2. If asked, compare thresholds with alternatives.
3. Call margins_write_report.
4. Only when the person asks, call margins_draft_terms_change, then margins_request_apply after they review it.` }],
  tools: [
    { name: 'margins_margins', kind: 'read', title: 'Compare freight charged with freight cost', description: 'Per order: terms, value, freight charged and cost (split by value on shared shipments), gap, recovery and flags. Totals, policy leaks, by customer and by terms, and threshold estimates.', inputSchema: { type: 'object', additionalProperties: false, required: ['orders'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'margins_write_report', kind: 'report', title: 'Write the freight recovery report', description: 'Write margins.csv and .html (one row per order; by customer; by terms; threshold estimates) into out_dir (default fairhaul-out/margins).', inputSchema: { type: 'object', additionalProperties: false, required: ['orders'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default fairhaul-out/margins)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx); const cols = ['orders', 'order_value', 'freight_billed', 'freight_cost', 'gap', 'recovery_pct', 'freight_pct_of_value'];
      const w = writeWorklist(ctx, a.out_dir || OUT, 'margins', { title: 'Freight charged against freight cost', intro: line(r), rows: r.rows, columns: ['order_id', 'customer', 'shipment_id', 'terms', 'order_value', 'freight_billed', 'freight_cost', 'cost_basis', 'gap', 'recovery_pct', 'freight_pct_of_value', 'flags'], sections: [{ title: 'By customer', rows: r.by_customer, columns: ['customer', ...cols] }, { title: 'By freight terms', rows: r.by_terms, columns: ['terms', ...cols] }, { title: 'Free-shipping threshold, enforced (estimate)', rows: r.scenarios, columns: ['threshold', 'orders_paying', 'extra_recovery_estimate', 'recovery_pct_estimate'] }], limits: [LIMITS.files, `Terms are read from your text (prepaid, prepaid and add, collect). Threshold estimates charge ${r.billed_rate_pct}% of order value, the average of orders that paid freight, and assume no customer changes behaviour.`, LIMITS.advice] });
      return { summary: `Recovery report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'margins_margins', decision: 'allow' }, { tool: 'margins_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Freight Margins allowlist.' },
  ] },
});
