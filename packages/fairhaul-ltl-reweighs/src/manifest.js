import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { CORRECTION_FIELDS, REWEIGH_TERMS_SCHEMA, reviewCorrections, disputeText } from './reweighs.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/reweigh';
const files = {
  corrections: { type: 'string', description: 'Weight and class corrections under --root (carrier W&I notices or rebilled invoices): PRO, carrier, product, handling units, dimensions, declared and corrected weight and class, amount added, certificate on file' },
  terms: { type: 'string', description: 'Optional settings JSON: weight tolerance, density scale, how many repeats mean your own data is wrong' },
};
const run = (a, ctx) => reviewCorrections(ctx.records(a.corrections, 'corrections'), a.terms ? ctx.readJson(a.terms, 'reweigh_terms') : {});
const line = (r) => `${r.corrections} correction(s) added ${r.amount_added}: ${r.challenge} worth challenging (${r.challenge_amount}), ${r.ask_for_certificate} need the certificate first (${r.certificate_amount}), ${r.fix_our_data} point to your own product data, ${r.accepted} look right.`;

const pair = draftPair({
  prefix: 'reweigh', noun: 'dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/dispute-<carrier>.md listing each correction worth challenging or missing its certificate, with the reason (within scale tolerance, class not supported by density, no certificate). Marked DRAFT. Sending goes through reweigh_request_send (one click).',
  required: ['corrections', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier as named in the corrections file' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Carrier billing or inspection contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const is = carrierIs(r.items.map((i) => i.carrier), a.carrier); const items = r.items.filter((i) => is(i.carrier) && ['challenge', 'ask_for_certificate'].includes(i.status)); if (!items.length) throw new Error(`nothing to dispute for "${a.carrier}"`); const d = disputeText(items, a); return { id: items[0].carrier, to: a.contact, text: d.text, amount: d.total, extra: { pros: d.pros } }; },
});
const refused = refusedTools([
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fairhaul LTL Reweighs never pays or short-pays carriers.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul LTL Reweighs never sends email.' },
  { name: 'erp_update_item_master', category: 'production_deploy', description: 'Fairhaul LTL Reweighs never changes your item master; a person does.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-ltl-reweighs', version: pkg.version,
  description: 'Checks LTL weight and class corrections against your declared dimensions, the density scale, scale tolerance and the inspection certificate; separates the ones worth challenging from the ones that mean your own product data is wrong; and drafts disputes. Paying, sending and item-master changes are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { reweigh_terms: REWEIGH_TERMS_SCHEMA },
  sources: { corrections: { label: 'Weight and class corrections', args: ['corrections'], fields: CORRECTION_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'reweigh_review', title: 'Review reweighs and reclasses', description: 'Walks the host model through LTL corrections with Fairhaul LTL Reweighs.', arguments: [{ name: 'corrections', description: 'Corrections file', required: true }], text: `You are helping a shipping or freight-audit lead with fairhaul-ltl-reweighs. Corrections: {{corrections}}.

Rules: Fairhaul LTL Reweighs never pays, sends or edits the item master. It does not decide an item's NMFC class; the density check matters only for density-rated items, and the scale it uses is recalled, not checked against the current tariff. Say so.

1. Call reweigh_review. Lead with the amount worth challenging, then the products whose own data needs fixing.
2. Call reweigh_write_report.
3. Only when the person asks, call reweigh_draft_dispute for one carrier, then reweigh_request_send after they review it.` }],
  tools: [
    { name: 'reweigh_review', kind: 'read', title: 'Review weight and class corrections', description: 'For each correction: weight change, density and density class from your dimensions, the reasons to challenge (within_tolerance, class_not_supported, no_certificate) and a status (challenge, ask_for_certificate, fix_our_data, accept). Products corrected repeatedly with the carrier\'s figures standing are listed as item-master fixes.', inputSchema: { type: 'object', additionalProperties: false, required: ['corrections'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'reweigh_write_report', kind: 'report', title: 'Write the corrections report', description: 'Write reweigh-corrections.csv and .html (one row per correction with status and reasons; item-master fixes; totals by carrier) into out_dir (default lodestar-out/reweigh).', inputSchema: { type: 'object', additionalProperties: false, required: ['corrections'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/reweigh)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx); const order = { challenge: 0, ask_for_certificate: 1, fix_our_data: 2, accept: 3 };
      const rows = [...r.items].sort((x, y) => order[x.status] - order[y.status]).map((i) => ({ ...i, reasons: i.reasons.map((x) => x.detail).join(' '), notes: i.notes.join(' ') }));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'reweigh-corrections', { title: 'LTL weight and class corrections', intro: line(r), rows, columns: ['pro', 'carrier', 'date', 'product', 'declared_weight', 'corrected_weight', 'declared_class', 'corrected_class', 'density', 'density_class', 'amount_added', 'certificate', 'status', 'reasons', 'notes'], sections: [{ title: 'Fix your own product data', rows: r.fixes, columns: ['product', 'corrections', 'amount_added', 'weight_factor', 'corrected_classes', 'fix'] }, { title: 'By carrier', rows: r.carriers, columns: ['carrier', 'corrections', 'amount_added', 'challenge', 'without_certificate'] }], limits: [LIMITS.files, `Density classes use the ${r.density_scale} scale as recalled, not checked against the current tariff, and apply only to density-rated items. Fairhaul LTL Reweighs does not assign NMFC items.`, LIMITS.advice] });
      return { summary: `Corrections report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'reweigh_review', decision: 'allow' }, { tool: 'reweigh_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul LTL Reweighs allowlist.' },
  ] },
});
