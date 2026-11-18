import { defineManifest, MODEL_PIN, FREIGHT_CONTRACT_SCHEMA, INVOICE_LINE_FIELDS, INVOICE_PROFILES, SHIPMENT_FIELDS, readInvoiceLines, groupInvoices, writeWorklist, draftPair, refusedTools, appendRow, LIMITS, round2, canonicalCarrier } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { auditInvoices, disputeText } from './audit.js';
import { MEMORY, MEMORY_KINDS, withLearned } from './memory.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/bills';
const files = {
  invoices: { type: 'string', description: 'Carrier invoices under --root: CSV, Excel, JSON or an X12 210 file (.edi/.x12). One row per invoice or per charge line.' },
  contract: { type: 'string', description: 'Freight contract JSON (lanes, fuel table, accessorials, fuel_index); validated against the freight_contract schema' },
  shipments: { type: 'string', description: 'Optional shipment or BOL export: weights, quoted amounts, accessorials ordered, arrival and departure times' },
  paid: { type: 'string', description: 'Optional paid-invoice history (invoice number, carrier, PRO) to catch bills paid before' },
  tolerance: { type: 'number', minimum: 0, maximum: 1000, description: 'Difference ignored per check, in currency units (default: the contract tolerance, else 1.00)' },
};
const run = (a, ctx) => {
  const learned = withLearned(a.contract ? ctx.readJson(a.contract, 'freight_contract') : {}, ctx);
  const contract = learned.contract;
  const inv = readInvoiceLines(ctx, a.invoices);
  const invoices = groupInvoices(inv.rows, { chargeAliases: contract.charge_aliases });
  const shipments = a.shipments ? ctx.records(a.shipments, 'shipments') : [];
  const paid = a.paid ? readInvoiceLines(ctx, a.paid, 'paid').rows : [];
  const r = auditInvoices(invoices, { contract, shipments, paid, tolerance: a.tolerance });
  if (learned.used.length || learned.skipped.length) Object.defineProperty(r, 'learned', { value: { used: learned.used, skipped: learned.skipped }, enumerable: false });
  return { contract, x12: inv.x12, r };
};
const sumLine = (r) => `${r.invoices} invoice(s), ${r.billed} billed: ${r.dispute} to dispute, ${r.duplicate} duplicate(s), ${r.review} need review, ${r.ok} clean. Disputable ${r.disputable} (${r.disputable_pct}% of billed).`;

const pair = draftPair({
  prefix: 'bills', noun: 'dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/dispute-<carrier>.md: one dispute letter to one carrier listing every disputed invoice with the amount and the contract reason. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through bills_request_send (one click).',
  required: ['invoices', 'contract', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier name or SCAC as it appears on the invoices' }, from: { type: 'string', description: 'Your name and company for the letter' }, contact: { type: 'string', description: 'Carrier billing contact (email or name)' }, reference: { type: 'string', description: 'Your account number with the carrier' } },
  build: (a, ctx) => {
    const { r, contract } = run(a, ctx);
    const want = canonicalCarrier(contract, a.carrier); const items = r.items.filter((i) => i.carrier === want);
    if (!items.length) throw new Error(`no invoices for carrier "${a.carrier}"; carriers in the file: ${Object.keys(r.by_carrier).join(', ')}`);
    const d = disputeText(items, a);
    if (!d.invoices.length) throw new Error(`nothing to dispute for ${a.carrier}: every invoice is clean or needs review first`);
    return { id: want, to: a.contact, text: d.text, amount: d.total, extra: { invoices: d.invoices } };
  },
});
const refused = refusedTools([
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fairhaul Freight Bill Audit never pays carriers; your AP team pays the approved amount.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Freight Bill Audit never sends email; a person sends the approved dispute.' },
  { name: 'carrier_portal_submit', category: 'binding_send', description: 'Fairhaul Freight Bill Audit never logs in to carrier portals.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-freight-bill-audit', version: pkg.version,
  description: 'Audits truckload and LTL freight bills against your own contract: lane rates, minimums, discounts, fuel table, accessorial terms, duplicates, paid history, math errors and BOL weights. Writes an audit worklist and dispute drafts. Paying and sending are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { freight_contract: FREIGHT_CONTRACT_SCHEMA },
  memory: { prefix: 'bills', kinds: MEMORY_KINDS },
  sources: {
    invoices: { label: 'Carrier invoices or freight bills', args: ['invoices'], fields: INVOICE_LINE_FIELDS, profiles: INVOICE_PROFILES },
    paid: { label: 'Paid invoice history', args: ['paid'], fields: INVOICE_LINE_FIELDS, profiles: INVOICE_PROFILES },
    shipments: { label: 'Shipments or BOLs', args: ['shipments'], fields: SHIPMENT_FIELDS },
  },
  argDocs: { invoice_number: 'Invoice number to explain, as it appears in the audit', amount: 'Amount to approve for payment, in invoice currency; at most the invoice total' },
  prompts: [{
    name: 'freight_bill_audit', title: 'Audit freight bills against the contract',
    description: 'Walks the host model through a freight bill audit with Fairhaul Freight Bill Audit: audit, explain, report, dispute drafts, and pay approvals that wait for a person.',
    arguments: [{ name: 'invoices', description: 'Carrier invoice file under --root', required: true }, { name: 'contract', description: 'Freight contract JSON', required: true }, { name: 'shipments', description: 'Shipment/BOL export (optional)', required: false }],
    text: `You are helping a logistics or AP lead audit carrier freight bills with fairhaul-freight-bill-audit. Invoices: {{invoices}}. Contract: {{contract}}. Shipments: {{shipments}}.

0. Call bills_recall to see what Fairhaul Freight Bill Audit has learned about this shipper's carriers. Accepted facts (charge wording, carrier names) apply automatically and are listed under "learned_facts"; waiting facts do not apply. If the person tells you something Fairhaul Freight Bill Audit should remember ("Ridgeline bills detention as WAIT TIME"), call bills_learn and say it waits for a named person to accept it (bills_accept_learning always asks). Rates, fuel prices, allowances and tolerances are never learned.

Rules: Fairhaul Freight Bill Audit never pays and never sends. ap_pay_invoice, email_send and carrier_portal_submit are blocked; do not call them. Findings compare the bills with the person's own contract file; they are not a tariff ruling.

1. Call bills_audit. If the contract fails its schema, show the error and ask the person to fix the file. Report totals, the disputable amount and percentage, and the top finding codes.
2. For each invoice with status review, call bills_explain and say exactly what data is missing (a lane, miles, a fuel price, a contract block).
3. Call bills_write_report and share the CSV and HTML paths.
4. For each carrier with disputable amounts, offer bills_draft_dispute. Show the draft path and any [TO CONFIRM] markers for the person to fill.
5. Only when the person asks, call bills_request_send for a reviewed draft, or bills_request_pay for an approved amount. Both return needs_approval: show the approval id and how to approve, and wait.`,
  }],
  tools: [
    { name: 'bills_audit', kind: 'read', title: 'Audit freight bills',
      description: 'Check every invoice against the contract and flag duplicates, paid-before bills, linehaul over contract, fuel over table, accessorials not allowed, unpriced or not ordered, math errors and weights over the BOL. Returns the disputable amount per invoice.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract'], properties: files },
      handler: async (a, ctx) => { const { r, x12 } = run(a, ctx); return { summary: sumLine(r) + (r.learned && r.learned.used.length ? ` ${r.learned.used.length} learned fact(s) used.` : ''), ...r, ...(x12 ? { x12 } : {}), ...(r.learned ? { learned_facts: r.learned } : {}) }; } },
    { name: 'bills_explain', kind: 'read', title: 'Explain one invoice',
      description: 'Show one invoice\'s charge lines, the contract amounts they were checked against, and every finding with its reason.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract', 'invoice_number'], properties: { ...files, invoice_number: { type: 'string' } } },
      handler: async (a, ctx) => {
        const { r } = run(a, ctx); const i = r.items.find((x) => x.invoice_number === String(a.invoice_number).trim());
        if (!i) throw new Error(`invoice ${a.invoice_number} not found; pass an invoice_number from bills_audit`);
        return { summary: `${i.invoice_number} (${i.carrier}): ${i.status}, billed ${i.total}, disputable ${i.disputable}. ${i.findings.map((f) => f.detail).join(' ')}`.trim(), invoice: i };
      } },
    { name: 'bills_write_report', kind: 'report', title: 'Write the audit worklist',
      description: 'Write bills-audit.csv (one row per invoice with blank decision columns) and bills-audit.html (totals by carrier and finding) into out_dir (default lodestar-out/bills).',
      inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract'], properties: { ...files, out_dir: { type: 'string' } } },
      handler: async (a, ctx) => {
        const { r } = run(a, ctx);
        const rows = r.items.map((i) => ({ invoice_number: i.invoice_number, carrier: i.carrier, pro: i.pro, ship_date: i.ship_date, lane: i.lane, billed: i.total, contract_linehaul: i.contract_linehaul, disputable: i.disputable, approved_to_pay: i.approved_to_pay, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' '), decision: '', decided_by: '' }));
        const w = writeWorklist(ctx, a.out_dir || OUT, 'bills-audit', {
          title: 'Freight bill audit', intro: sumLine(r), rows,
          columns: Object.keys(rows[0] || { invoice_number: 0 }),
          htmlColumns: ['invoice_number', 'carrier', 'pro', 'lane', 'billed', 'disputable', 'status', 'reasons'],
          sections: [
            { title: 'By carrier', rows: Object.entries(r.by_carrier).map(([carrier, v]) => ({ carrier, ...v })), columns: ['carrier', 'invoices', 'billed', 'disputable'] },
            { title: 'By finding', rows: Object.entries(r.by_finding).map(([code, v]) => ({ code, ...v })), columns: ['code', 'count', 'amount'] },
          ],
          limits: [LIMITS.files, LIMITS.contract, LIMITS.advice, 'Accessorial and fuel checks need the matching contract entries and fuel_index prices; when they are missing the invoice is marked review, not clean.'],
        });
        return { summary: `Audit worklist written: ${sumLine(r)}`, ...w };
      } },
    ...pair.tools,
    { name: 'bills_request_pay', kind: 'action', category: 'move_money', title: 'Approve an amount to pay (one click)',
      description: 'After one named human click (even in Auto), record in pay-approvals.csv the amount AP may pay on one invoice (usually the undisputed balance). Fairhaul Freight Bill Audit never pays.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract', 'invoice_number', 'amount'], properties: { ...files, invoice_number: { type: 'string' }, amount: { type: 'number', minimum: 0 }, note: { type: 'string' }, out_dir: { type: 'string' } } },
      handler: async (a, ctx) => {
        const { r } = run(a, ctx); const i = r.items.find((x) => x.invoice_number === String(a.invoice_number).trim());
        if (!i) throw new Error(`invoice ${a.invoice_number} not found`);
        if (a.amount > i.total + 0.005) throw new Error(`amount ${a.amount} is more than the invoice total ${i.total}`);
        if (i.status === 'duplicate' && a.amount > 0) throw new Error(`invoice ${i.invoice_number} is flagged ${i.findings[0].code}; approve 0 or resolve the duplicate first`);
        const f = appendRow(ctx.outDir(a.out_dir || OUT), 'pay-approvals.csv', { approved_at: new Date().toISOString(), invoice_number: i.invoice_number, carrier: i.carrier, billed: i.total, approved_amount: round2(a.amount), withheld: round2(i.total - a.amount), note: a.note || '', status: 'approved - AP pays it' }, ['approved_at', 'invoice_number', 'carrier', 'billed', 'approved_amount', 'withheld', 'note', 'status']);
        return { summary: `Pay approval recorded for ${i.invoice_number}: ${round2(a.amount)} of ${i.total}. No money moved.`, file: relative(ctx.root, f).split('\\').join('/') };
      } },
    ...MEMORY.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'bills_audit', decision: 'allow' },
    { tool: 'bills_explain', decision: 'allow' },
    { tool: 'bills_write_report', decision: 'allow' },
    ...pair.rules,
    { tool: 'bills_request_pay', decision: 'ask', reason: 'move_money: one named human click, even in Auto.' },
    ...MEMORY.rules,
    ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Freight Bill Audit allowlist.' },
  ] },
});
