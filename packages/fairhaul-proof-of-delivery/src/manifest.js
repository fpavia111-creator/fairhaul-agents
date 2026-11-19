import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { LOAD_FIELDS, POD_FIELDS, matchPods, requestText } from './pods.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/pod';
const files = {
  loads: { type: 'string', description: 'Delivered or invoiced loads under --root (TMS or AP export): shipment id, PRO, carrier, delivery date, pieces, invoice number, amount and billed delivery date, whether the customer requires a POD' },
  pods: { type: 'string', description: 'POD log under --root (document system or carrier portal export): PRO or shipment id, date received, delivery date on the POD, signed by, pieces delivered, exceptions noted, file name' },
  as_of: { type: 'string', format: 'date', description: 'Date to count ages from, YYYY-MM-DD (default today)' },
  chase_after_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Days after delivery before a missing POD is chased (default 3)' },
};
const run = (a, ctx) => matchPods(ctx.records(a.loads, 'loads'), ctx.records(a.pods, 'pods'), { asOf: a.as_of, chaseAfterDays: a.chase_after_days ?? 3 });
const line = (r) => `${r.loads} load(s) as of ${r.as_of}: ${r.ok} clean POD(s), ${r.chase} to chase, ${r.waiting} still within the wait period, ${r.claim_review} with shortage or damage noted, ${r.fix} to fix. ${r.invoices_to_hold} invoice(s) to hold for review (${r.held_amount}).`;

const pair = draftPair({
  prefix: 'pod', noun: 'pod_request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/pod_request-<carrier>.md asking one carrier for each missing or unsigned POD, with shipment, PRO, delivery date and invoice. Marked DRAFT. Sending goes through pod_request_send (one click).',
  required: ['loads', 'pods', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier as named in the loads file' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Carrier POD or billing contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const is = carrierIs(r.items.map((i) => i.carrier), a.carrier); const items = r.items.filter((i) => is(i.carrier) && (i.status === 'chase' || (i.status === 'fix' && i.issues.some((x) => x.code === 'unsigned')))); if (!items.length) throw new Error(`no missing or unsigned PODs for "${a.carrier}"`); return { id: items[0].carrier, to: a.contact, text: requestText(items, a), extra: { shipments: items.map((i) => i.shipment_id) } }; },
});
const refused = refusedTools([
  { name: 'ap_hold_invoice', category: 'move_money', description: 'Fairhaul Proof of Delivery never holds or releases invoices in your AP system; it lists them for a person.' },
  { name: 'ap_release_payment', category: 'move_money', description: 'Fairhaul Proof of Delivery never releases payments.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Proof of Delivery never sends email.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-proof-of-delivery', version: pkg.version,
  description: 'Matches every delivered or invoiced load to its proof of delivery, flags missing, unsigned, short and exception-noted PODs and delivery dates that disagree with the invoice, lists the invoices to hold, scores carriers on POD turnaround and drafts POD requests. Holding, paying and sending are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { loads: { label: 'Delivered or invoiced loads', args: ['loads'], fields: LOAD_FIELDS }, pods: { label: 'POD log', args: ['pods'], fields: POD_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'pod_review', title: 'Check proofs of delivery', description: 'Walks the host model through a POD review with Fairhaul Proof of Delivery.', arguments: [{ name: 'loads', description: 'Loads file', required: true }, { name: 'pods', description: 'POD log', required: true }], text: `You are helping an AP or customer-service lead with fairhaul-proof-of-delivery. Loads: {{loads}}. PODs: {{pods}}.

Rules: Fairhaul Proof of Delivery never holds, releases or pays invoices and never sends. Shortage and damage noted on a POD go to a claims review (Fairhaul Freight Claims), not a POD request.

1. Call pod_match. Lead with the invoices to hold and why, then the PODs to chase by carrier.
2. Call pod_write_report.
3. Only when the person asks, call pod_draft_pod_request for one carrier, then pod_request_send after they review it.` }],
  tools: [
    { name: 'pod_match', kind: 'read', title: 'Match loads to PODs', description: 'For each load: the POD found (by PRO or shipment id), issues (missing_pod, unsigned, date_mismatch, short, exception_noted), a status (ok, chase, waiting, claim_review, fix) and whether to hold the invoice for review. POD rate, clean rate and days to POD by carrier.', inputSchema: { type: 'object', additionalProperties: false, required: ['loads', 'pods'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'pod_write_report', kind: 'report', title: 'Write the POD worklist', description: 'Write pods.csv and .html (one row per load with issues, the invoices to hold, and POD performance by carrier) into out_dir (default fairhaul-out/pod).', inputSchema: { type: 'object', additionalProperties: false, required: ['loads', 'pods'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default fairhaul-out/pod)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx); const order = { chase: 0, claim_review: 1, fix: 2, waiting: 3, ok: 4 };
      const rows = [...r.items].sort((x, y) => order[x.status] - order[y.status] || (y.age_days ?? 0) - (x.age_days ?? 0)).map((i) => ({ ...i, issues: i.issues.map((x) => x.detail).join(' ') }));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'pods', { title: `Proof of delivery as of ${r.as_of}`, intro: line(r), rows, columns: ['shipment_id', 'pro', 'carrier', 'delivered', 'age_days', 'invoice_number', 'invoice_amount', 'pod_document', 'status', 'hold_invoice', 'issues'], sections: [{ title: 'By carrier', rows: r.carriers, columns: ['carrier', 'loads', 'with_pod', 'pod_pct', 'clean_pct', 'avg_days_to_pod', 'missing'] }], limits: [LIMITS.files, 'Fairhaul Proof of Delivery reads the POD log, not the images; a person should look at any POD before an invoice is released or disputed.'] });
      return { summary: `POD worklist written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'pod_match', decision: 'allow' }, { tool: 'pod_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Proof of Delivery allowlist.' },
  ] },
});
