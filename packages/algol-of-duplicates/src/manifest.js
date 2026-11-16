import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierKey } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { PAYMENT_FIELDS, findDuplicates, recoveryText } from './duplicates.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/algol';
const files = {
  payments: { type: 'string', description: 'AP payment history under --root (CSV, Excel or JSON), any number of years: vendor, vendor id, invoice number and date, amount, paid date, payment ref, PRO; credit memos as negative amounts' },
  date_window_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Same carrier and amount with invoice dates this close counts as a low-confidence look-alike (default 3)' },
  as_of: { type: 'string', format: 'date', description: 'Date to count ages from, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => findDuplicates(ctx.records(a.payments, 'payments'), { dateWindowDays: a.date_window_days ?? 3, asOf: a.as_of });
const line = (r) => `${r.payments} payment(s), ${r.paid_total} paid: ${r.groups} possible duplicate group(s). To recover: ${r.to_recover_high} high confidence, ${r.to_recover_medium} medium, ${r.to_recover_low} low.${r.already_credited ? ` ${r.already_credited} already credited.` : ''}`;
const conf = { type: 'array', items: { type: 'string', enum: ['high', 'medium', 'low'] }, description: 'Which confidence levels to include in the request (default high only)' };

const pair = draftPair({
  prefix: 'algol', noun: 'recovery', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/recovery-<vendor>.md: a refund request listing each invoice the vendor was paid twice, with payment refs and dates. Includes only high-confidence groups unless confidence says otherwise. Marked DRAFT. Sending goes through algol_request_send (one click).',
  required: ['payments', 'vendor'],
  args: { ...files, vendor: { type: 'string', description: 'Vendor as named in the payments file' }, confidence: conf, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Vendor accounts receivable contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const c = a.confidence && a.confidence.length ? a.confidence : ['high']; const g = r.items.filter((x) => x.vendors.some((v) => carrierKey(v) === carrierKey(a.vendor)) && x.status === 'recover' && c.includes(x.confidence)); if (!g.length) throw new Error(`nothing to recover from "${a.vendor}" at confidence ${c.join(', ')}`); const d = recoveryText(g, { ...a, confidence: c }); return { id: g[0].vendor, to: a.contact, text: d.text, amount: d.total, extra: { groups: g.length } }; },
});
const refused = refusedTools([
  { name: 'ap_void_payment', category: 'move_money', description: 'Algol never voids, reverses or offsets payments.' },
  { name: 'email_send', category: 'binding_send', description: 'Algol never sends email.' },
  { name: 'erp_block_vendor', category: 'production_deploy', description: 'Algol never changes vendor records; a person merges or blocks them.' },
]);

export const manifest = defineManifest({
  name: 'algol-of-duplicates', version: pkg.version,
  description: 'Searches your freight payment history for invoices paid twice: the same invoice in another number format, the same invoice under two vendor records, the same PRO billed twice, and same-amount look-alikes. Nets off credits already received, grades each by confidence and drafts refund requests. Moving money and changing vendor records are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { payments: { label: 'AP payment history', args: ['payments'], fields: PAYMENT_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'duplicate_payment_search', title: 'Find freight invoices paid twice', description: 'Walks the host model through a duplicate payment search with Algol.', arguments: [{ name: 'payments', description: 'Payment history', required: true }], text: `You are helping an AP or recovery-audit lead with algol-of-duplicates. Payments: {{payments}}.

Rules: Algol never moves money or changes vendor records. Low and medium confidence groups need the bills pulled before anyone asks for money back; say so.

1. Call algol_search. Give the high-confidence amount first, then medium and low, then any duplicate vendor records to merge.
2. Call algol_write_report.
3. Only when the person asks, call algol_draft_recovery for one vendor, then algol_request_send after they review it.` }],
  tools: [
    { name: 'algol_search', kind: 'read', title: 'Find invoices paid twice', description: 'Groups of payments that look like one invoice paid more than once, each with a rule (exact_duplicate, invoice_number_variant, two_vendor_records, same_pro, same_amount_and_date), a confidence, the amount paid twice, credits already received and the amount left to recover.', inputSchema: { type: 'object', additionalProperties: false, required: ['payments'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'algol_write_report', kind: 'report', title: 'Write the duplicate payment report', description: 'Write algol-duplicates.csv and .html (one row per group, by confidence, totals by vendor) into out_dir (default lodestar-out/algol).', inputSchema: { type: 'object', additionalProperties: false, required: ['payments'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/algol)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const rows = r.items.map((g) => ({ ...g, vendors: g.vendors.join(' / '), invoice_numbers: g.invoice_numbers.join(' / '), amounts: g.amounts.join(' / '), paid_dates: g.paid_dates.join(' / '), payment_refs: g.payment_refs.join(' / '), rows: g.rows.join(' ') }));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'algol-duplicates', { title: 'Freight invoices paid twice', intro: line(r), rows, columns: ['confidence', 'rule', 'vendors', 'invoice_numbers', 'pro', 'amounts', 'paid_dates', 'payment_refs', 'overpaid', 'credited', 'to_recover', 'age_days', 'status', 'why', 'rows'], sections: [{ title: 'By vendor', rows: r.vendors, columns: ['vendor', 'groups', 'to_recover', 'high'] }], limits: [LIMITS.files, 'Medium and low confidence groups can be two real loads; pull both bills before asking for money back.', 'How far back you can recover depends on your agreements and the law that applies; Algol does not decide that.'] });
      return { summary: `Duplicate payment report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'algol_search', decision: 'allow' }, { tool: 'algol_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Algol allowlist.' },
  ] },
});
