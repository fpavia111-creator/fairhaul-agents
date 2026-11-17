import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, isoDate } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { RMA_FIELDS, RECEIPT_FIELDS, CREDIT_FIELDS, CHARGE_FIELDS, trackReturns, disputeText } from './returns.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/achernar';
const files = {
  rmas: { type: 'string', description: 'Return authorisations under --root: RMA, customer, SKU, units, value, reason, date authorised, return label tracking, status' },
  receipts: { type: 'string', description: 'Optional returns received at the warehouse: RMA or tracking, date received, units received, condition' },
  credits: { type: 'string', description: 'Optional credits or refunds issued: RMA, amount, date, credit memo number' },
  charges: { type: 'string', description: 'Optional return freight billed by carriers: tracking, carrier, amount, invoice number, invoice date' },
  as_of: { type: 'string', format: 'date', description: 'Date to judge ages from (default today)' },
  unused_days: { type: 'integer', minimum: 1, description: 'Days after authorisation with nothing received before the label counts as unused (default 30)' },
  credit_days: { type: 'integer', minimum: 0, description: 'Days after receipt by which a credit is expected (default 7)' },
};
const run = (a, ctx) => { if (a.as_of && !isoDate(a.as_of)) throw new Error('as_of must be a date, YYYY-MM-DD'); return trackReturns(ctx.records(a.rmas, 'rmas'), { receipts: a.receipts ? ctx.records(a.receipts, 'receipts') : [], credits: a.credits ? ctx.records(a.credits, 'credits') : [], charges: a.charges ? ctx.records(a.charges, 'charges') : [], asOf: a.as_of, unusedDays: a.unused_days || 30, creditDays: a.credit_days ?? 7 }); };
const line = (r) => `${r.rmas} return(s) worth ${r.return_value}, return freight ${r.return_freight}. ${r.findings} point(s): credits owed to customers ${r.credits_owed}, credit given without goods or over value ${r.credit_at_risk}, return freight to dispute ${r.freight_disputable}.${r.by_reason[0] && r.by_reason[0].freight > 0 ? ` Costliest reason for freight: ${r.by_reason[0].reason} (${r.by_reason[0].freight}).` : ''}`;

const pair = draftPair({
  prefix: 'achernar', noun: 'carrier_dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'your returns or freight audit person',
  description: 'Write drafts/carrier_dispute-<carrier>.md: return freight charges from one carrier billed twice or on tracking numbers with no return authorised, with the total to credit. Marked DRAFT. Sending goes through achernar_request_send (one click).',
  required: ['rmas', 'charges', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier to dispute with, as named in the charges file' }, to: { type: 'string', description: 'Carrier billing contact' }, from: { type: 'string', description: 'Your name' } },
  build: (a, ctx) => { const r = run(a, ctx); const d = disputeText(r, a.carrier, ctx.records(a.charges, 'charges'), a); if (!d.count) throw new Error(`nothing to dispute with ${a.carrier}`); return { id: a.carrier, to: a.to, text: d.text, amount: d.amount }; },
});
const refused = refusedTools([
  { name: 'erp_issue_credit', category: 'move_money', description: 'Achernar never issues, reverses or changes customer credits.' },
  { name: 'carrier_void_label', category: 'binding_send', description: 'Achernar never voids labels with carriers.' },
  { name: 'email_send', category: 'binding_send', description: 'Achernar never emails carriers or customers.' },
]);

export const manifest = defineManifest({
  name: 'achernar-of-returns', version: pkg.version,
  description: 'Follows every return from authorisation to credit: labels never used, returns received but not credited, credits issued for goods that never came back or for more than came back, return freight billed twice or with no return authorised, and which reasons, customers and SKUs cost the most freight to bring back. It never issues credits or voids labels.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { rmas: { label: 'Return authorisations', args: ['rmas'], fields: RMA_FIELDS }, receipts: { label: 'Returns received', args: ['receipts'], fields: RECEIPT_FIELDS }, credits: { label: 'Credits issued', args: ['credits'], fields: CREDIT_FIELDS }, charges: { label: 'Return freight billed', args: ['charges'], fields: CHARGE_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'returns_review', title: 'Check returns from label to credit', description: 'Walks the host model through a returns review with Achernar.', arguments: [{ name: 'rmas', description: 'Return authorisations', required: true }], text: `You are helping a customer service, returns or AR lead with achernar-of-returns. Returns: {{rmas}}.

Rules: Achernar never issues credits, voids labels or emails anyone. A credit without goods can be a deliberate goodwill credit; ask before calling it a mistake.

1. Call achernar_track with every file the person has. Lead with customers waiting for a credit, then credit given without goods or over value, then return freight to dispute and labels never used.
2. Say which return reasons cost the most freight.
3. Call achernar_write_report.
4. Only when the person asks, call achernar_draft_carrier_dispute for one carrier, then achernar_request_send after they review it.` }],
  tools: [
    { name: 'achernar_track', kind: 'read', title: 'Follow returns from label to credit', description: 'Each RMA\'s stage (awaiting return, label unused, received not credited, credited not received, closed), every point found with its amount, and return value and freight by reason, customer and SKU.', inputSchema: { type: 'object', additionalProperties: false, required: ['rmas'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'achernar_write_report', kind: 'report', title: 'Write the returns report', description: 'Write achernar-returns.csv and .html (points found; every RMA with its stage; by reason, customer and SKU) into out_dir (default lodestar-out/achernar).', inputSchema: { type: 'object', additionalProperties: false, required: ['rmas'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/achernar)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const roll = ['returns', 'value', 'freight', 'freight_pct_of_value'];
      const w = writeWorklist(ctx, a.out_dir || OUT, 'achernar-returns', { title: 'Returns from label to credit', intro: line(r), rows: r.items, columns: ['rma', 'code', 'detail', 'amount'], sections: [{ title: 'Every return', rows: r.rmas_detail, columns: ['rma', 'customer', 'sku', 'reason', 'units', 'value', 'authorised_at', 'received_at', 'units_received', 'condition', 'credited', 'freight', 'stage'] }, { title: 'By reason', rows: r.by_reason, columns: ['reason', ...roll] }, { title: 'By customer', rows: r.by_customer, columns: ['customer', ...roll] }, { title: 'By SKU', rows: r.by_sku, columns: ['sku', ...roll] }], limits: [LIMITS.files, 'Receipts match by RMA or return tracking; credits by RMA; freight by tracking. A credit before receipt may be intended; check before reversing anything.'] });
      return { summary: `Returns report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'achernar_track', decision: 'allow' }, { tool: 'achernar_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Achernar allowlist.' },
  ] },
});
