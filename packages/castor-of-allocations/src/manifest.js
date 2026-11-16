import { defineManifest, MODEL_PIN, writeWorklist, refusedTools, appendRow, LIMITS, toCsv, sha256, isoDate } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { allocate, journalLines, COST_FIELDS, ORDER_LINE_FIELDS, BASES } from './allocations.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/castor';
const files = {
  costs: { type: 'string', description: 'Freight cost per shipment under --root (CSV, Excel or JSON): shipment id and cost, optionally invoice number, carrier and date' },
  order_lines: { type: 'string', description: 'Order lines per shipment: shipment id, order, customer, SKU, units, weight, cube, value, pallets, cost center, GL account' },
  basis: { type: 'string', enum: BASES, description: 'Measure to split each shipment\'s cost by (default weight)' },
  fallback: { type: 'array', items: { type: 'string', enum: BASES }, description: 'Measures to try, in order, when a line lacks the basis (default cube, value, units; equal shares last)' },
};
const req = ['costs', 'order_lines'];
const run = (a, ctx) => allocate(ctx.records(a.costs, 'costs'), ctx.records(a.order_lines, 'order_lines'), { basis: a.basis || 'weight', fallback: a.fallback || ['cube', 'value', 'units'] });
const line = (r) => `${r.shipments} shipment(s) billed ${r.billed}; ${r.allocated} split across ${r.lines} order line(s) by ${r.basis}${r.unallocated ? `, ${r.unallocated} not allocated` : ''}.${r.problems.length ? ` ${r.problems.length} problem(s) to look at.` : ''}${r.by_customer[0] ? ` Most freight: ${r.by_customer[0].customer} (${r.by_customer[0].freight}).` : ''}`;
const refused = refusedTools([{ name: 'erp_post_journal', category: 'move_money', description: 'Castor never posts to your ledger; a person posts the reviewed entry.' }, { name: 'erp_update_order_cost', category: 'production_deploy', description: 'Castor never writes landed cost back into orders or items.' }]);

export const manifest = defineManifest({
  name: 'castor-of-allocations', version: pkg.version,
  description: 'Splits each shipment\'s freight bill across the orders, customers, SKUs and cost centers that rode on it, by weight, cube, value, pallets or units, with a fallback when a line lacks the measure. Shows freight per unit and as a percent of value, and drafts the reclass journal. Posting is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { costs: { label: 'Freight cost per shipment', args: ['costs'], fields: COST_FIELDS }, order_lines: { label: 'Order lines', args: ['order_lines'], fields: ORDER_LINE_FIELDS } },
  argDocs: { journal: 'Path of allocation-journal-draft.csv written by castor_write_report', journal_sha256: 'sha256 returned by castor_write_report for the journal file', journal_date: 'Date for the journal lines, YYYY-MM-DD', clearing_account: 'Account the freight bills were first booked to, credited by the reclass (default freight_clearing)', note: 'Optional note kept with the approval', out_dir: 'Folder under --root for the output files' },
  prompts: [{ name: 'freight_cost_allocation', title: 'Split freight to orders and customers', description: 'Walks the host model through a freight allocation with Castor.', arguments: [{ name: 'costs', description: 'Freight cost per shipment', required: true }, { name: 'order_lines', description: 'Order lines per shipment', required: true }], text: `You are helping a cost accountant or FP&A analyst split freight with castor-of-allocations. Costs: {{costs}}. Order lines: {{order_lines}}.

Rules: Castor never posts; erp_post_journal and erp_update_order_cost are blocked. The split is a method choice, not a fact; say which basis each shipment used.

1. Call castor_allocate. Report the total billed and allocated, anything not allocated and why, and the customers and SKUs carrying the most freight per unit and as a percent of value.
2. If the person wants another basis, call it again with basis set and compare.
3. Call castor_write_report. It writes the allocation detail and allocation-journal-draft.csv.
4. Only when the person asks, call castor_request_post with the journal path and sha256; it waits for one named click and records the approval for the person who posts.` }],
  tools: [
    { name: 'castor_allocate', kind: 'read', title: 'Split freight across order lines', description: 'Allocate each shipment\'s cost to its order lines by the chosen basis (falling back when a line lacks it), with totals by customer, SKU and GL account plus cost center, freight per unit and freight as a percent of value.', inputSchema: { type: 'object', additionalProperties: false, required: req, properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'castor_write_report', kind: 'report', title: 'Write the allocation and journal draft', description: 'Write castor-allocation.csv and .html (one row per order line, by customer, SKU and cost center, and the problems) and allocation-journal-draft.csv (debits by GL and cost center, one credit to the clearing account) into out_dir (default lodestar-out/castor). Returns the journal sha256.', inputSchema: { type: 'object', additionalProperties: false, required: req, properties: { ...files, journal_date: { type: 'string', format: 'date' }, clearing_account: { type: 'string' }, out_dir: { type: 'string' } } }, handler: async (a, ctx) => {
      if (a.journal_date && !isoDate(a.journal_date)) throw new Error('journal_date must be a date, YYYY-MM-DD');
      const r = run(a, ctx); const dir = a.out_dir || OUT;
      const w = writeWorklist(ctx, dir, 'castor-allocation', { title: 'Freight allocation', intro: line(r), rows: r.allocations, columns: ['shipment_id', 'invoice_number', 'carrier', 'order_id', 'customer', 'sku', 'units', 'basis', 'share_pct', 'freight', 'per_unit', 'freight_pct_of_value', 'gl_account', 'cost_center'], sections: [{ title: 'By customer', rows: r.by_customer, columns: ['customer', 'lines', 'freight', 'units', 'per_unit', 'freight_pct_of_value'] }, { title: 'By SKU', rows: r.by_sku, columns: ['sku', 'lines', 'freight', 'units', 'per_unit', 'freight_pct_of_value'] }, { title: 'By GL account and cost center', rows: r.by_cost_center, columns: ['gl_account', 'cost_center', 'freight'] }, { title: 'Problems', rows: r.problems, columns: ['shipment_id', 'cost', 'problem'] }], limits: [LIMITS.files, 'An allocation is a method choice. Weight, cube, value and units give different answers; the basis is shown on every line. The last line on each shipment takes the rounding cent.', LIMITS.advice] });
      const jl = journalLines(r, { clearing: a.clearing_account || 'freight_clearing', date: isoDate(a.journal_date) || '' });
      const jf = ctx.writeFile(ctx.outDir(dir), 'allocation-journal-draft.csv', toCsv(jl, ['date', 'account', 'cost_center', 'debit', 'credit', 'memo']));
      return { summary: `Allocation written: ${line(r)} Journal draft has ${jl.length} line(s).`, files: [...w.files, jf], journal: relative(ctx.root, jf).split('\\').join('/'), journal_sha256: sha256(readFileSync(jf)), output_sha256: w.output_sha256 };
    } },
    { name: 'castor_request_post', kind: 'action', title: 'Approve the journal for posting (one click)', description: 'After one named human click, record in post-approvals.csv that the reviewed allocation-journal-draft.csv (by sha256) may be posted. Castor never posts.', inputSchema: { type: 'object', additionalProperties: false, required: ['journal', 'journal_sha256'], properties: { journal: { type: 'string' }, journal_sha256: { type: 'string' }, note: { type: 'string' }, out_dir: { type: 'string' } } }, handler: async (a, ctx) => {
      const buf = readFileSync(ctx.path(a.journal)); if (sha256(buf) !== a.journal_sha256) throw new Error('journal_sha256 does not match the file on disk; rerun castor_write_report and review it again');
      const lines = buf.toString('utf8').trim().split(/\r?\n/).length - 1;
      const f = appendRow(ctx.outDir(a.out_dir || OUT), 'post-approvals.csv', { approved_at: new Date().toISOString(), journal: a.journal, journal_sha256: a.journal_sha256, lines, note: a.note || '', status: 'approved - a person posts it' }, ['approved_at', 'journal', 'journal_sha256', 'lines', 'note', 'status']);
      return { summary: `Journal approved for posting (${lines} line(s)). Nothing was posted by the agent.`, file: relative(ctx.root, f).split('\\').join('/') };
    } },
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'castor_allocate', decision: 'allow' }, { tool: 'castor_write_report', decision: 'allow' },
    { tool: 'castor_request_post', decision: 'ask', reason: 'Posting to the ledger needs a named person\'s click.' },
    ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Castor allowlist.' },
  ] },
});
