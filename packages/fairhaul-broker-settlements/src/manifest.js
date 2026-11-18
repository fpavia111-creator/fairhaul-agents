import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, isoDate } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { RATECON_FIELDS, CARRIER_INVOICE_FIELDS, PAYMENT_FIELDS, NOA_FIELDS, settle, batchText } from './settlements.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/settlements';
const files = {
  ratecons: { type: 'string', description: 'Rate confirmations under --root (TMS export): load, carrier, agreed rate, approved accessorials, delivery date, POD received, pay terms in days, quick pay' },
  invoices: { type: 'string', description: 'Optional carrier invoices received: load, carrier, invoice number, amount, date received' },
  payments: { type: 'string', description: 'Optional payments made: load, payee, amount, date, reference' },
  noas: { type: 'string', description: 'Optional notices of assignment: carrier, factoring company, effective date, release date' },
  as_of: { type: 'string', format: 'date', description: 'Date to judge from (default today)' },
  quick_pay_pct: { type: 'number', minimum: 0, maximum: 20, description: 'Quick-pay fee percent taken from the carrier (default 3)' },
  default_terms_days: { type: 'integer', minimum: 0, description: 'Pay terms when the rate confirmation has none (default 30)' },
};
const run = (a, ctx) => { if (a.as_of && !isoDate(a.as_of)) throw new Error('as_of must be a date, YYYY-MM-DD'); return settle(ctx.records(a.ratecons, 'ratecons'), { invoices: a.invoices ? ctx.records(a.invoices, 'invoices') : [], payments: a.payments ? ctx.records(a.payments, 'payments') : [], noas: a.noas ? ctx.records(a.noas, 'noas') : [], asOf: a.as_of, quickPayPct: a.quick_pay_pct ?? 3, defaultTerms: a.default_terms_days ?? 30 }); };
const line = (r) => `${r.loads} load(s) as of ${r.as_of}. Next batch: ${r.batch_loads} load(s), ${r.batch_total}.${r.past_due ? ` Past due: ${r.past_due}.` : ''}${r.recoverable ? ` Overpaid or paid twice: ${r.recoverable}.` : ''}${r.wrong_party_exposure ? ` Paid to the wrong party: ${r.wrong_party_exposure}.` : ''}${r.held_back ? ` Invoiced above the rate confirmation: ${r.held_back}.` : ''}`;

const pair = draftPair({
  prefix: 'settlements', noun: 'payment_batch', verb: 'release', category: 'move_money', outDir: OUT, actor: 'the person who releases carrier payments',
  description: 'Write drafts/payment_batch-<date>.md: loads ready or past due, each capped at the rate confirmation net of quick pay and grouped by the party to pay (factor where there is a notice of assignment), plus loads held for POD and earlier payments to recover. Marked DRAFT. Releasing goes through settlements_request_release (one click); a person pays.',
  required: ['ratecons', 'invoices'],
  args: { ...files, pay_date: { type: 'string', format: 'date', description: 'Planned payment date' }, to: { type: 'string', description: 'Person who releases payments' }, from: { type: 'string', description: 'Your name' } },
  build: (a, ctx) => { const r = run(a, ctx); if (!r.batch_loads) throw new Error('no load is ready to pay'); return { id: a.pay_date || r.as_of, to: a.to, text: batchText(r, a), amount: r.batch_total }; },
});
const refused = refusedTools([
  { name: 'ap_release_payment', category: 'move_money', description: 'Fairhaul Broker Settlements never pays carriers or factors.' },
  { name: 'bank_transfer', category: 'move_money', description: 'Fairhaul Broker Settlements never moves money.' },
  { name: 'tms_update_carrier_pay', category: 'production_deploy', description: 'Fairhaul Broker Settlements never changes rates or pay records in your TMS.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-broker-settlements', version: pkg.version,
  description: 'For freight brokers: settles every carrier payment against its rate confirmation, approved accessorials, quick-pay fee, pay terms, proof of delivery and notice of assignment. Finds invoices above the rate confirmation, double and over payments, payments to the wrong party, past-due loads and invoices with no rate confirmation, and drafts the next payment batch by payee for a person to release.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { ratecons: { label: 'Rate confirmations', args: ['ratecons'], fields: RATECON_FIELDS }, invoices: { label: 'Carrier invoices', args: ['invoices'], fields: CARRIER_INVOICE_FIELDS }, payments: { label: 'Payments made', args: ['payments'], fields: PAYMENT_FIELDS }, noas: { label: 'Notices of assignment', args: ['noas'], fields: NOA_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'carrier_settlement', title: 'Settle carrier pay', description: 'Walks the host model through carrier settlement with Fairhaul Broker Settlements.', arguments: [{ name: 'ratecons', description: 'Rate confirmations', required: true }, { name: 'invoices', description: 'Carrier invoices', required: true }], text: `You are helping a freight broker's carrier pay or accounting lead with fairhaul-broker-settlements. Rate confirmations: {{ratecons}}. Invoices: {{invoices}}.

Rules: Fairhaul Broker Settlements never pays anyone or changes the TMS. Pay to the factor named on an active notice of assignment. Extra charges need written approval.

1. Call settlements_settle with every file the person has. Lead with payments to the wrong party and double payments, then past-due loads, then invoices above the rate confirmation.
2. Call settlements_write_report.
3. Only when the person asks, call settlements_draft_payment_batch, then settlements_request_release after they review it.` }],
  tools: [
    { name: 'settlements_settle', kind: 'read', title: 'Settle carrier pay', description: 'Per load: agreed amount, quick pay, owed, billed, due date, paid, party to pay and status (awaiting invoice, held for POD, ready, past due, paid); every point found with its amount; and the next payment batch by payee.', inputSchema: { type: 'object', additionalProperties: false, required: ['ratecons'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'settlements_write_report', kind: 'report', title: 'Write the settlement report', description: 'Write settlements.csv and .html (one row per load; points found; next batch by payee) into out_dir (default lodestar-out/settlements).', inputSchema: { type: 'object', additionalProperties: false, required: ['ratecons'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/settlements)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'settlements', { title: 'Carrier settlements', intro: line(r), rows: r.rows, columns: ['load_id', 'carrier', 'pay_to', 'agreed', 'quick_pay', 'owed', 'billed', 'invoice_received', 'due', 'paid', 'status', 'to_pay'], sections: [{ title: 'Points found', rows: r.items, columns: ['load_id', 'code', 'detail', 'amount'] }, { title: 'Next batch by payee', rows: r.batch_by_payee, columns: ['pay_to', 'loads', 'amount', 'load_ids'] }], limits: [LIMITS.files, 'Notices of assignment are applied by carrier name and date. Confirm a notice and any release with the factor before changing who you pay.', LIMITS.advice] });
      return { summary: `Settlement report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'settlements_settle', decision: 'allow' }, { tool: 'settlements_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Broker Settlements allowlist.' },
  ] },
});
