import { defineManifest, MODEL_PIN, FREIGHT_CONTRACT_SCHEMA, INVOICE_LINE_FIELDS, INVOICE_PROFILES, SHIPMENT_FIELDS, readInvoiceLines, groupInvoices, writeWorklist, draftPair, refusedTools, LIMITS } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { analyse, fixText } from './accessorials.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/accessorials';
const files = {
  invoices: { type: 'string', description: 'Carrier invoices under --root (CSV, Excel, JSON or X12 210) with charge lines and destination' },
  shipments: { type: 'string', description: 'Optional shipments with the accessorials ordered on each (TMS or BOL export), matched by shipment id, PRO, BOL or PO' },
  contract: { type: 'string', description: 'Optional freight contract JSON with accessorial rates, to find charges above the agreed amount' },
  repeat_at: { type: 'integer', minimum: 2, maximum: 50, description: 'Same charge at the same location on this many invoices counts as a repeat (default 2)' },
};
const load = (a, ctx) => { const contract = a.contract ? ctx.readJson(a.contract, 'freight_contract') : {}; const invoices = groupInvoices(readInvoiceLines(ctx, a.invoices).rows, { chargeAliases: contract.charge_aliases }); return analyse(invoices, a.shipments ? ctx.records(a.shipments, 'shipments') : [], contract, { repeatAt: a.repeat_at || 2 }); };
const line = (r) => `${r.invoices} invoice(s): accessorials ${r.accessorial_total} of ${r.freight_total} freight (${r.accessorial_share_pct}%). ${r.unordered} charge(s) billed but not ordered (${r.unordered_amount}); ${r.over_contract} above contract (${r.over_amount}); ${r.fixes.length} repeat(s) to fix at the source.${r.not_matched ? ` ${r.not_matched} line(s) not matched to a shipment.` : ''}`;

const pair = draftPair({
  prefix: 'accessorials', noun: 'address_update', verb: 'apply', category: 'production_deploy', outDir: OUT, actor: 'the person who maintains your TMS',
  description: 'Write drafts/address_update-<name>.md: the address-book changes (residential, liftgate, appointment and similar flags) for every location with repeat accessorials. Marked DRAFT. Applying it goes through accessorials_request_apply (one click); a person makes the change in the TMS.',
  required: ['invoices'],
  args: { ...files, name: { type: 'string', description: 'Name for this change list (default address-book)' }, from: { type: 'string', description: 'Your name' }, system: { type: 'string', description: 'TMS or ERP whose address book this is' } },
  build: (a, ctx) => { const r = load(a, ctx); if (!r.fixes.length) throw new Error('no repeat accessorials at any location; nothing to change'); return { id: a.name || 'address-book', text: fixText(r.fixes, a), amount: round(r.fixes), extra: { changes: r.fixes.length } }; },
});
function round(f) { return Math.round(f.reduce((a, x) => a + x.amount, 0) * 100) / 100; }
const refused = refusedTools([
  { name: 'tms_update_address', category: 'production_deploy', description: 'Fairhaul Accessorial Charges never changes your TMS or ERP address book; a person does.' },
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fairhaul Accessorial Charges never pays or short-pays carriers.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-accessorial-charges', version: pkg.version,
  description: 'Shows where your accessorial charges come from by type, location and carrier, flags charges nobody ordered and charges above your contract, and drafts the address-book changes that stop the same surprises repeating. Changing the TMS is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { freight_contract: FREIGHT_CONTRACT_SCHEMA },
  sources: { invoices: { label: 'Carrier invoices', args: ['invoices'], fields: INVOICE_LINE_FIELDS, profiles: INVOICE_PROFILES }, shipments: { label: 'Shipments with accessorials ordered', args: ['shipments'], fields: SHIPMENT_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'accessorial_review', title: 'Find where accessorials come from', description: 'Walks the host model through an accessorial review with Fairhaul Accessorial Charges.', arguments: [{ name: 'invoices', description: 'Invoices file', required: true }, { name: 'shipments', description: 'Shipments with accessorials ordered', required: false }], text: `You are helping a transportation or customer-service lead with fairhaul-accessorial-charges. Invoices: {{invoices}}. Shipments: {{shipments}}.

Rules: Fairhaul Accessorial Charges never changes the TMS and never pays. An unordered charge is not automatically wrong; a residential or liftgate charge at a home with no dock is usually real. Say so.

1. Call accessorials_analyse. Give the accessorial share of freight, the top types and locations, and the repeats to fix.
2. Call accessorials_write_report.
3. Only when the person asks, call accessorials_draft_address_update, then accessorials_request_apply after they review it. Disputes for charges above contract belong in Fairhaul Freight Bill Audit.` }],
  tools: [
    { name: 'accessorials_analyse', kind: 'read', title: 'Find where accessorials come from', description: 'Accessorial charges by type, location and carrier; charges a shipper could have ordered but did not; charges above the contract; and repeats at the same location with the address-book change that stops them.', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices'], properties: files }, handler: async (a, ctx) => { const r = load(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'accessorials_write_report', kind: 'report', title: 'Write the accessorial report', description: 'Write accessorials.csv and .html (one row per accessorial charge; repeats to fix; totals by type, location and carrier) into out_dir (default fairhaul-out/accessorials).', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default fairhaul-out/accessorials)' } } }, handler: async (a, ctx) => {
      const r = load(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'accessorials', { title: 'Accessorial charges', intro: line(r), rows: r.lines, columns: ['invoice_number', 'carrier', 'ship_date', 'location', 'label', 'description', 'amount', 'ordered', 'contract_amount', 'over'], sections: [{ title: 'Repeats to fix at the source', rows: r.fixes, columns: ['location', 'label', 'times', 'ordered_times', 'amount', 'carriers', 'fix'] }, { title: 'By type', rows: r.by_type, columns: ['type', 'count', 'amount'] }, { title: 'By location', rows: r.by_location, columns: ['location', 'count', 'amount'] }, { title: 'By carrier', rows: r.by_carrier, columns: ['carrier', 'count', 'amount'] }], limits: [LIMITS.files, 'A charge that was not ordered is not automatically wrong; check before disputing.', LIMITS.contract] });
      return { summary: `Accessorial report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'accessorials_analyse', decision: 'allow' }, { tool: 'accessorials_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Accessorial Charges allowlist.' },
  ] },
});
