import { defineManifest, MODEL_PIN, FREIGHT_CONTRACT_SCHEMA, INVOICE_LINE_FIELDS, INVOICE_PROFILES, SHIPMENT_FIELDS, readInvoiceLines, groupInvoices, writeWorklist, refusedTools, appendRow, LIMITS, toCsv, sha256 } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { buildAccrual, journalLines } from './accruals.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/accruals';
const files = {
  shipments: { type: 'string', description: 'Shipments under --root (TMS or ERP export): shipment id, carrier, ship date, quote, lane, cost center, GL account, status' },
  invoices: { type: 'string', description: 'Carrier invoices received (CSV, Excel, JSON or X12 210), with invoice dates' },
  period_end: { type: 'string', format: 'date', description: 'Last day of the period being closed, YYYY-MM-DD' },
  contract: { type: 'string', description: 'Optional freight contract JSON used to estimate shipments with no quote' },
  prior: { type: 'string', description: 'Optional last-period accrual (shipment_id, amount) to reverse and measure accuracy' },
};
const req = ['shipments', 'invoices', 'period_end'];
const run = (a, ctx) => { const contract = a.contract ? ctx.readJson(a.contract, 'freight_contract') : {}; const invoices = groupInvoices(readInvoiceLines(ctx, a.invoices).rows, { chargeAliases: contract.charge_aliases }); return buildAccrual(ctx.records(a.shipments, 'shipments'), invoices, { periodEnd: a.period_end, contract, prior: a.prior ? ctx.records(a.prior, 'prior') : [] }); };
const line = (r) => `Period ending ${r.period_end}: ${r.shipments_in_period} shipment(s) shipped, ${r.billed_in_period} billed in period, ${r.accrued} to accrue for ${r.total}${r.without_estimate ? ` (${r.without_estimate} with no estimate)` : ''}${r.over_60_days ? `, ${r.over_60_days} older than 60 days` : ''}.${r.accuracy ? ` Last accrual: ${r.accuracy.accrued} accrued vs ${r.accuracy.actual} billed (mean error ${r.accuracy.mean_abs_error_pct}%).` : ''}`;
const refused = refusedTools([{ name: 'erp_post_journal', category: 'move_money', description: 'Fairhaul Freight Accruals never posts to your ledger; a person posts the reviewed entry.' }]);

export const manifest = defineManifest({
  name: 'fairhaul-freight-accruals', version: pkg.version,
  description: 'Builds the month-end freight accrual from your shipments and carrier invoices: what shipped but was not billed by period end, estimated from the quote, your contract or lane history, by GL account and cost center, with a draft journal entry and an accuracy check on last period\'s accrual. Posting is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { freight_contract: FREIGHT_CONTRACT_SCHEMA },
  sources: { shipments: { label: 'Shipments', args: ['shipments'], fields: SHIPMENT_FIELDS }, invoices: { label: 'Carrier invoices', args: ['invoices'], fields: INVOICE_LINE_FIELDS, profiles: INVOICE_PROFILES }, prior: { label: 'Last period accrual', args: ['prior'], fields: { shipment_id: { aliases: ['Shipment ID', 'Load ID', 'Load Number'], required: true }, amount: { aliases: ['Amount', 'Accrued', 'Accrual'], type: 'money', required: true } } } },
  argDocs: { journal: 'Path of journal-entry-draft.csv written by accruals_write_report', journal_sha256: 'sha256 returned by accruals_write_report for the journal file' },
  prompts: [{ name: 'freight_accrual_close', title: 'Close the month: freight accrual', description: 'Walks the host model through the freight accrual with Fairhaul Freight Accruals.', arguments: [{ name: 'shipments', description: 'Shipments export', required: true }, { name: 'invoices', description: 'Invoices received', required: true }, { name: 'period_end', description: 'Period end date', required: true }], text: `You are helping a controller or AP lead close the month with fairhaul-freight-accruals. Shipments: {{shipments}}. Invoices: {{invoices}}. Period end: {{period_end}}.

Rules: Fairhaul Freight Accruals never posts; erp_post_journal is blocked. Estimates are estimates; say which basis each used.

1. Call accruals_accrue. Report the total, the split by basis (quote, contract, invoice after period end, lane or carrier average) and any shipment with no estimate or older than 60 days.
2. If a prior accrual file was given, report its accuracy and anything still unbilled.
3. Call accruals_write_report. It writes the accrual detail and journal-entry-draft.csv.
4. Only when the person asks, call accruals_request_post with the journal path and sha256; it waits for one named click and records the approval for the person who posts.` }],
  tools: [
    { name: 'accruals_accrue', kind: 'read', title: 'Build the freight accrual', description: 'List shipments shipped by period end with no invoice dated by period end, each with an estimate and its basis; totals by GL account and cost center; reversal and accuracy of the prior accrual.', inputSchema: { type: 'object', additionalProperties: false, required: req, properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'accruals_write_report', kind: 'report', title: 'Write the accrual detail and journal draft', description: 'Write accruals-accrual.csv and .html (one row per shipment accrued, by cost center and the prior-period reversal) and journal-entry-draft.csv (debits by GL and cost center, one credit to accrued freight) into out_dir (default fairhaul-out/accruals). Returns the journal sha256.', inputSchema: { type: 'object', additionalProperties: false, required: req, properties: { ...files, liability_account: { type: 'string', description: 'Account to credit (default accrued_freight)' }, out_dir: { type: 'string' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx); const dir = a.out_dir || OUT;
      const rows = r.lines.map((l) => ({ ...l, invoices_after: l.invoices_after.join(' ') }));
      const w = writeWorklist(ctx, dir, 'accruals-accrual', { title: `Freight accrual, period ending ${r.period_end}`, intro: line(r), rows, columns: ['shipment_id', 'carrier', 'ship_date', 'age_days', 'gl_account', 'cost_center', 'amount', 'basis', 'invoices_after'], sections: [{ title: 'By GL account and cost center', rows: r.by_cost_center, columns: ['gl_account', 'cost_center', 'shipments', 'amount'] }, { title: 'Last period accrual', rows: r.reversals, columns: ['shipment_id', 'accrued', 'actual', 'variance', 'status'] }], limits: [LIMITS.files, 'Estimates use the quote first, then your contract, then the average of at least two invoices on the same lane, then at least three for the carrier. Shipments with none are listed with no amount.', LIMITS.advice] });
      const jl = journalLines(r, { liability: a.liability_account || 'accrued_freight' });
      const jcsv = toCsv(jl, ['date', 'account', 'cost_center', 'debit', 'credit', 'memo']);
      const jf = ctx.writeFile(ctx.outDir(dir), 'journal-entry-draft.csv', jcsv);
      return { summary: `Accrual written: ${line(r)} Journal draft has ${jl.length} line(s).`, files: [...w.files, jf], journal: relative(ctx.root, jf).split('\\').join('/'), journal_sha256: sha256(readFileSync(jf)), output_sha256: w.output_sha256 };
    } },
    { name: 'accruals_request_post', kind: 'action', title: 'Approve the journal for posting (one click)', description: 'After one named human click, record in post-approvals.csv that the reviewed journal-entry-draft.csv (by sha256) may be posted. Fairhaul Freight Accruals never posts.', inputSchema: { type: 'object', additionalProperties: false, required: ['journal', 'journal_sha256'], properties: { journal: { type: 'string' }, journal_sha256: { type: 'string' }, note: { type: 'string' }, out_dir: { type: 'string' } } }, handler: async (a, ctx) => {
      const buf = readFileSync(ctx.path(a.journal)); if (sha256(buf) !== a.journal_sha256) throw new Error('journal_sha256 does not match the file on disk; rerun accruals_write_report and review it again');
      const lines = buf.toString('utf8').trim().split(/\r?\n/).length - 1;
      const f = appendRow(ctx.outDir(a.out_dir || OUT), 'post-approvals.csv', { approved_at: new Date().toISOString(), journal: a.journal, journal_sha256: a.journal_sha256, lines, note: a.note || '', status: 'approved - a person posts it' }, ['approved_at', 'journal', 'journal_sha256', 'lines', 'note', 'status']);
      return { summary: `Journal approved for posting (${lines} line(s)). Nothing was posted by the agent.`, file: relative(ctx.root, f).split('\\').join('/') };
    } },
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'accruals_accrue', decision: 'allow' }, { tool: 'accruals_write_report', decision: 'allow' },
    { tool: 'accruals_request_post', decision: 'ask', reason: 'Posting to the ledger needs a named person\'s click.' },
    ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Freight Accruals allowlist.' },
  ] },
});
