import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, toIcs, carrierIs } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { PARCEL_FIELDS, PARCEL_PROFILES, PARCEL_TERMS_SCHEMA, packagesFrom, auditParcels, refundText } from './parcels.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/parcels';
const files = {
  invoices: { type: 'string', description: 'Parcel invoice data under --root (UPS, FedEx, DHL or USPS billing export as CSV, Excel or JSON), one row per package or per charge' },
  terms: { type: 'string', description: 'Optional parcel terms JSON: dim_divisor, guarantee_waived, guaranteed_services, claim_window_days, commercial_addresses' },
  voids: { type: 'string', description: 'Optional list of voided label tracking numbers (CSV with a tracking column)' },
  as_of: { type: 'string', format: 'date', description: 'Date to measure claim windows from, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const terms = a.terms ? ctx.readJson(a.terms, 'parcel_terms') : {};
  const pk = packagesFrom(ctx.records(a.invoices, 'invoices'), terms.charge_aliases);
  const voids = a.voids ? ctx.records(a.voids, 'voids') : [];
  return { terms, r: auditParcels(pk, { terms, voids, asOf: a.as_of }) };
};
const line = (r) => `${r.packages} package(s), ${r.billed} billed: ${r.claim} to claim (${r.refundable_open} still in window${r.urgent.length ? `, ${r.urgent.length} due within 3 days` : ''}), ${r.window_closed} past the window (${r.refundable_lost} lost), ${r.review} to review, ${r.ok} clean.`;

const pair = draftPair({
  prefix: 'parcels', noun: 'refund_request', verb: 'submit', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/refund_request-<carrier>.md listing every package of one carrier that is still inside the claim window, with amount, reason and request-by date. Marked DRAFT. Submitting goes through parcels_request_submit (one click); a person files it in the carrier\'s billing portal.',
  required: ['invoices', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier as it appears in the invoice data (UPS, FedEx, DHL, USPS)' }, account: { type: 'string', description: 'Your shipper account number' }, from: { type: 'string', description: 'Your name and company' } },
  build: (a, ctx) => {
    const { r } = run(a, ctx);
    const is = carrierIs(r.items.map((i) => i.carrier), a.carrier); const items = r.items.filter((i) => is(i.carrier));
    if (!items.length) throw new Error(`no packages for carrier "${a.carrier}"`);
    const d = refundText(items, a);
    if (!d.tracking.length) throw new Error(`nothing to claim for ${a.carrier} inside the claim window`);
    return { id: a.carrier, text: d.text, amount: d.total, extra: { tracking: d.tracking } };
  },
});
const refused = refusedTools([
  { name: 'carrier_portal_submit', category: 'binding_send', description: 'Fairhaul Parcel Refunds never logs in to UPS, FedEx, DHL or USPS billing portals; a person files the request.' },
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fairhaul Parcel Refunds never pays carrier invoices.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-parcel-refunds', version: pkg.version,
  description: 'Audits parcel invoice data for refundable charges: late deliveries on guaranteed services, duplicate tracking numbers, voided labels billed, residential charges on business addresses, repeat address corrections and dimensional-weight overbilling. Gives a request-by date for each and drafts refund requests. Filing is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { parcel_terms: PARCEL_TERMS_SCHEMA },
  sources: { invoices: { label: 'Parcel invoice data', args: ['invoices'], fields: PARCEL_FIELDS, profiles: PARCEL_PROFILES }, voids: { label: 'Voided labels', args: ['voids'], fields: { tracking: { aliases: ['Tracking Number', 'Tracking', 'Tracking ID'], required: true } } } },
  argDocs: { tracking: 'Tracking number to explain' },
  prompts: [{
    name: 'parcel_refund_audit', title: 'Find parcel refunds before the window closes',
    description: 'Walks the host model through a parcel invoice audit with Fairhaul Parcel Refunds.',
    arguments: [{ name: 'invoices', description: 'Parcel invoice data file under --root', required: true }, { name: 'terms', description: 'Parcel terms JSON (optional)', required: false }],
    text: `You are helping a shipping or finance lead find parcel refunds with fairhaul-parcel-refunds. Invoice data: {{invoices}}. Terms: {{terms}}.

Rules: Fairhaul Parcel Refunds never files claims and never pays. carrier_portal_submit and ap_pay_invoice are blocked. Late-delivery refunds depend on the shipper's agreement; if the person says their agreement waives the guarantee, pass a terms file with guarantee_waived true.

1. Call parcels_audit. Lead with anything due within 3 days (urgent), then the open refundable total, then what was lost to closed windows.
2. Use parcels_explain for any package the person asks about.
3. Call parcels_write_report for the worklist and the claim-deadline calendar.
4. Offer parcels_draft_refund_request per carrier. Then, only when asked, parcels_request_submit with the draft path and sha256; it waits for one named click.`,
  }],
  tools: [
    { name: 'parcels_audit', kind: 'read', title: 'Audit parcel invoices',
      description: 'Check every package for refundable charges and give a request-by date for each. Returns totals still claimable, already lost, and due within 3 days.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['invoices'], properties: files },
      handler: async (a, ctx) => { const { r } = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'parcels_explain', kind: 'read', title: 'Explain one package',
      description: 'Show one package\'s charges, findings and request-by date.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'tracking'], properties: { ...files, tracking: { type: 'string' } } },
      handler: async (a, ctx) => { const { r } = run(a, ctx); const i = r.items.filter((x) => x.tracking === String(a.tracking).trim()); if (!i.length) throw new Error(`tracking ${a.tracking} not found; pass one from parcels_audit`); return { summary: i.map((x) => `${x.tracking} on ${x.invoice_number}: ${x.status}, refundable ${x.refundable}${x.claim_by ? `, request by ${x.claim_by}` : ''}. ${x.findings.map((f) => f.detail).join(' ')}`).join('\n'), packages: i }; } },
    { name: 'parcels_write_report', kind: 'report', title: 'Write the parcel worklist and deadline calendar',
      description: 'Write parcels-audit.csv and .html (one row per package with findings) and claim-deadlines.ics (one event per carrier and request-by date) into out_dir (default fairhaul-out/parcels).',
      inputSchema: { type: 'object', additionalProperties: false, required: ['invoices'], properties: { ...files, out_dir: { type: 'string' } } },
      handler: async (a, ctx) => {
        const { r } = run(a, ctx);
        const rows = r.items.map((i) => ({ tracking: i.tracking, invoice_number: i.invoice_number, carrier: i.carrier, service: i.service, billed: i.total, refundable: i.refundable, request_by: i.claim_by, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' '), decision: '' }));
        const dir = a.out_dir || OUT;
        const w = writeWorklist(ctx, dir, 'parcels-audit', { title: 'Parcel invoice audit', intro: line(r), rows, columns: Object.keys(rows[0] || { tracking: 0 }), htmlColumns: ['tracking', 'carrier', 'service', 'billed', 'refundable', 'request_by', 'status', 'reasons'], sections: [{ title: 'By finding', rows: Object.entries(r.by_finding).map(([code, v]) => ({ code, ...v })), columns: ['code', 'count', 'amount'] }], limits: [LIMITS.files, 'Late-delivery refunds depend on your agreement; set guarantee_waived when it is waived.', 'Dimensional-weight overcharges are estimates pro rata to weight; the exact figure needs the carrier rate card.', LIMITS.advice] });
        const groups = new Map(); for (const i of r.items.filter((x) => x.status === 'claim' && x.claim_by)) { const k = `${i.carrier}|${i.claim_by}`; const g = groups.get(k) || { carrier: i.carrier, date: i.claim_by, n: 0, amount: 0 }; g.n++; g.amount = Math.round((g.amount + i.refundable) * 100) / 100; groups.set(k, g); }
        const ics = toIcs([...groups.values()].map((g) => ({ uid: `parcels-${g.carrier}-${g.date}@fairhaul`, date: g.date, summary: `Parcel refund requests due: ${g.carrier} (${g.n} package(s), ${g.amount})`, description: 'Written by fairhaul-parcel-refunds. File in the carrier billing portal before this date.', reminders: [2] })), { calName: 'Parcel claim deadlines' });
        w.files.push(ctx.writeFile(ctx.outDir(dir), 'claim-deadlines.ics', ics));
        return { summary: `Parcel worklist written: ${line(r)}`, ...w };
      } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'parcels_audit', decision: 'allow' }, { tool: 'parcels_explain', decision: 'allow' }, { tool: 'parcels_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Parcel Refunds allowlist.' },
  ] },
});
