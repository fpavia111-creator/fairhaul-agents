import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { OCEAN_LINE_FIELDS, OCEAN_CONTRACT_SCHEMA, auditOcean, disputeText } from './ocean.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/ocean';
const files = {
  invoices: { type: 'string', description: 'Ocean freight invoice lines under --root (line or forwarder export): invoice, carrier, B/L, POL, POD, sailing date, equipment, container count, charge, quantity, amount, currency' },
  contract: { type: 'string', description: 'Ocean contract JSON: per carrier, lanes with rates per container type, allowed surcharges with amounts and validity dates, included charges' },
};
const run = (a, ctx) => auditOcean(ctx.records(a.invoices, 'invoices'), ctx.readJson(a.contract, 'ocean_contract'));
const line = (r) => `${r.bills} bill(s) of lading, ${r.billed} billed: ${r.with_findings} with findings, ${r.disputable} disputable. ${Object.entries(r.by_finding).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings.'}`;

const pair = draftPair({
  prefix: 'ocean', noun: 'dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/dispute-<carrier>.md listing each ocean invoice charge above or outside the contract, by invoice and B/L. Marked DRAFT. Sending goes through ocean_request_send (one click).',
  required: ['invoices', 'contract', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Line or forwarder as named in the invoices' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Line or forwarder billing contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const is = carrierIs(r.items.map((i) => i.carrier), a.carrier); const items = r.items.filter((i) => is(i.carrier) && i.disputable > 0); if (!items.length) throw new Error(`nothing to dispute for "${a.carrier}"`); const d = disputeText(items, a); return { id: items[0].carrier, to: a.contact, text: d.text, amount: d.total, extra: { bills: items.map((i) => i.bl) } }; },
});
const refused = refusedTools([
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fairhaul Ocean Freight Audit never pays lines or forwarders.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Ocean Freight Audit never sends email.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-ocean-freight-audit', version: pkg.version,
  description: 'Audits ocean freight invoices against your service contract: base rate per container by port pair, BAF, peak season and other surcharges with their validity dates, charges included in the rate, charges not in the contract, duplicates and container counts. Drafts disputes; paying and sending are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { ocean_contract: OCEAN_CONTRACT_SCHEMA },
  sources: { invoices: { label: 'Ocean invoice lines', args: ['invoices'], fields: OCEAN_LINE_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'ocean_invoice_audit', title: 'Audit ocean invoices', description: 'Walks the host model through an ocean freight audit with Fairhaul Ocean Freight Audit.', arguments: [{ name: 'invoices', description: 'Ocean invoice lines', required: true }, { name: 'contract', description: 'Ocean contract JSON', required: true }], text: `You are helping an import or freight-audit lead with fairhaul-ocean-freight-audit. Invoices: {{invoices}}. Contract: {{contract}}.

Rules: Fairhaul Ocean Freight Audit never pays and never sends. It compares against the contract file the person gave, not the line's published tariff. Amounts in another currency are not compared until converted.

1. Call ocean_audit. Give the disputable total, then the findings by bill of lading.
2. Call ocean_write_report.
3. Only when the person asks, call ocean_draft_dispute for one line or forwarder, then ocean_request_send after they review it.` }],
  tools: [
    { name: 'ocean_audit', kind: 'read', title: 'Audit ocean invoices', description: 'For each bill of lading: billed total, findings (rate_over, surcharge_over, surcharge_not_in_contract, surcharge_included, surcharge_out_of_window, surcharge_unpriced, duplicate_charge, container_count, no_lane, no_rate_for_equipment, currency_mismatch, no_contract, contract_expired) and the disputable amount.', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'ocean_write_report', kind: 'report', title: 'Write the ocean audit', description: 'Write ocean.csv and .html (one row per finding, bills with no findings listed as clean) into out_dir (default fairhaul-out/ocean).', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default fairhaul-out/ocean)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const rows = r.items.flatMap((i) => (i.findings.length ? i.findings : [{ code: 'clean', detail: 'Matches the contract.', amount: 0 }]).map((f) => ({ invoice_number: i.invoice_number, carrier: i.carrier, bl: i.bl, lane: `${i.pol} → ${i.pod}`, sailing_date: i.sailing_date, equipment: `${i.containers ?? '?'} x ${i.equipment}`, billed: i.billed, finding: f.code, detail: f.detail, disputable: f.amount })));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'ocean', { title: 'Ocean freight audit', intro: line(r), rows, columns: ['invoice_number', 'carrier', 'bl', 'lane', 'sailing_date', 'equipment', 'billed', 'finding', 'detail', 'disputable'], limits: [LIMITS.files, 'Compared against your contract file, not the line\'s published tariff. Charges in another currency are flagged, not converted.', LIMITS.advice] });
      return { summary: `Ocean audit written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'ocean_audit', decision: 'allow' }, { tool: 'ocean_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Ocean Freight Audit allowlist.' },
  ] },
});
