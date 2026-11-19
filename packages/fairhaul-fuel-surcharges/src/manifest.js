import { defineManifest, MODEL_PIN, FREIGHT_CONTRACT_SCHEMA, INVOICE_LINE_FIELDS, INVOICE_PROFILES, readInvoiceLines, groupInvoices, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { checkFuel, compareTables, sensitivity, disputeText } from './fuel.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/fuel';
const files = {
  invoices: { type: 'string', description: 'Carrier invoices under --root (CSV, Excel, JSON or X12 210) with linehaul and fuel lines, ship date and miles' },
  contract: { type: 'string', description: 'Freight contract JSON with each carrier\'s fuel table and fuel_index (weekly diesel prices you copied from your index source)' },
};
const load = (a, ctx) => { const contract = ctx.readJson(a.contract, 'freight_contract'); return { contract, invoices: groupInvoices(readInvoiceLines(ctx, a.invoices).rows, { chargeAliases: contract.charge_aliases }) }; };
const line = (r) => `${r.invoices} invoice(s), ${r.fuel_billed} fuel billed: ${r.over} over the table for ${r.disputable}${r.wrong_week ? ` (${r.wrong_week} priced on the wrong diesel week)` : ''}; ${r.not_checked} could not be checked.${r.latest_index_week ? ` Latest index week ${r.latest_index_week.week_of} (${r.latest_index_week.price}).` : ' No fuel index in the contract.'}`;

const pair = draftPair({
  prefix: 'fuel', noun: 'dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/dispute-<carrier>.md listing each invoice whose fuel surcharge is above the carrier\'s table at the diesel price for the week it shipped, including invoices priced on a later week. Marked DRAFT. Sending goes through fuel_request_send (one click).',
  required: ['invoices', 'contract', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier as named in the contract or invoices' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Carrier billing contact' } },
  build: (a, ctx) => { const { contract, invoices } = load(a, ctx); const r = checkFuel(invoices, contract); const is = carrierIs(r.items.map((i) => i.carrier), a.carrier); const items = r.items.filter((i) => is(i.carrier) && ['fuel_over', 'wrong_week'].includes(i.status)); if (!items.length) throw new Error(`no fuel over the table for "${a.carrier}"`); const d = disputeText(items, a); return { id: items[0].carrier, to: a.contact, text: d.text, amount: d.total, extra: { invoices: d.invoices } }; },
});
const refused = refusedTools([
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fairhaul Fuel Surcharges never pays or short-pays carriers.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Fuel Surcharges never sends email.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-fuel-surcharges', version: pkg.version,
  description: 'Checks every fuel surcharge against the carrier\'s fuel table and the diesel price for the week the load shipped, spots invoices priced on the wrong week, compares carriers\' fuel tables side by side and shows what a diesel move would cost. Drafts disputes; paying and sending are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { freight_contract: FREIGHT_CONTRACT_SCHEMA },
  sources: { invoices: { label: 'Carrier invoices', args: ['invoices'], fields: INVOICE_LINE_FIELDS, profiles: INVOICE_PROFILES } },
  argDocs: {},
  prompts: [{ name: 'fuel_surcharge_check', title: 'Check fuel surcharges', description: 'Walks the host model through a fuel surcharge review with Fairhaul Fuel Surcharges.', arguments: [{ name: 'invoices', description: 'Invoices file', required: true }, { name: 'contract', description: 'Contract with fuel tables and index', required: true }], text: `You are helping a freight payables or transportation lead check fuel surcharges with fairhaul-fuel-surcharges. Invoices: {{invoices}}. Contract: {{contract}}.

Rules: Fairhaul Fuel Surcharges never pays and never sends. The diesel prices are the ones the person copied into fuel_index; if the index is missing weeks, say so before anything else.

1. Call fuel_check. Report the amount over the table, the wrong-week invoices and anything not checked.
2. Call fuel_compare to show which carrier's table costs most at today's diesel, and fuel_sensitivity for what a 10-cent move costs.
3. Call fuel_write_report.
4. Only when the person asks, call fuel_draft_dispute for one carrier, then fuel_request_send after they review it.` }],
  tools: [
    { name: 'fuel_check', kind: 'read', title: 'Check fuel surcharges', description: 'For each invoice: billed fuel, the table amount at the diesel price for the week it shipped, the difference and a status (ok, fuel_over, wrong_week, fuel_under, fuel_not_billed, fuel_not_in_contract, index_stale, not_checked, no_index, no_contract, contract_expired, no_date). Totals by carrier with fuel as a percent of linehaul.', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract'], properties: files }, handler: async (a, ctx) => { const { contract, invoices } = load(a, ctx); const r = checkFuel(invoices, contract); return { summary: line(r), ...r }; } },
    { name: 'fuel_compare', kind: 'read', title: 'Compare fuel tables', description: 'Each carrier\'s fuel surcharge at several diesel prices for one reference load, so tables with different bases (percent of linehaul or per mile) can be compared.', inputSchema: { type: 'object', additionalProperties: false, required: ['contract'], properties: { contract: files.contract, prices: { type: 'array', items: { type: 'number', minimum: 0 }, maxItems: 12, description: 'Diesel prices to compare at (default: latest index price and 50 cents either side)' }, linehaul: { type: 'number', minimum: 0, description: 'Reference linehaul (default 1000)' }, miles: { type: 'number', minimum: 0, description: 'Reference miles (default 500)' } } }, handler: async (a, ctx) => { const r = compareTables(ctx.readJson(a.contract, 'freight_contract'), a); return { summary: `At diesel ${r.prices[Math.floor(r.prices.length / 2)]} on a ${r.reference.linehaul} linehaul, ${r.reference.miles}-mile load, the highest fuel table is ${r.highest_at_middle_price} and the lowest is ${r.lowest_at_middle_price}.`, ...r }; } },
    { name: 'fuel_sensitivity', kind: 'read', title: 'What a diesel move costs', description: 'Reprice the fuel on these invoices with diesel moved by step dollars per gallon and report the change, by carrier.', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract'], properties: { ...files, step: { type: 'number', minimum: -5, maximum: 5, description: 'Diesel change in currency per gallon (default 0.10)' } } }, handler: async (a, ctx) => { const { contract, invoices } = load(a, ctx); const r = sensitivity(invoices, contract, { step: a.step ?? 0.1 }); return { summary: `A ${r.step} move in diesel would have changed fuel on ${r.invoices} invoice(s) by ${r.change} (from ${r.fuel_at_index} to ${r.fuel_if_moved}). Tables move in steps, so small moves can change nothing.`, ...r }; } },
    { name: 'fuel_write_report', kind: 'report', title: 'Write the fuel report', description: 'Write fuel.csv and .html (one row per invoice with the table amount and status, totals by carrier, the table comparison) into out_dir (default fairhaul-out/fuel).', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'contract'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default fairhaul-out/fuel)' } } }, handler: async (a, ctx) => {
      const { contract, invoices } = load(a, ctx); const r = checkFuel(invoices, contract); const cmp = compareTables(contract);
      const rank = { wrong_week: 0, fuel_over: 1, fuel_not_in_contract: 2, not_checked: 3, no_index: 3, no_date: 3, no_contract: 4, contract_expired: 4, index_stale: 5, fuel_not_billed: 6, fuel_under: 7, ok: 8 };
      const rows = [...r.items].sort((x, y) => rank[x.status] - rank[y.status]);
      const tbl = cmp.carriers.map((c) => ({ carrier: c.carrier, basis: c.basis, ...Object.fromEntries(c.cells.map((x) => [`at ${x.diesel}`, x.fuel === null ? 'outside table' : `${x.fuel} (${x.pct_of_linehaul}%)`])) }));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'fuel', { title: 'Fuel surcharge check', intro: line(r), rows, columns: ['invoice_number', 'carrier', 'ship_date', 'index_week', 'diesel', 'linehaul', 'miles', 'billed', 'expected', 'difference', 'pct_of_linehaul', 'status', 'detail'], sections: [{ title: 'By carrier', rows: r.carriers, columns: ['carrier', 'invoices', 'fuel_billed', 'fuel_expected', 'over', 'wrong_week', 'avg_pct_of_linehaul'] }, { title: `Fuel tables on a ${cmp.reference.linehaul} linehaul, ${cmp.reference.miles}-mile load`, rows: tbl, columns: Object.keys(tbl[0] || { carrier: 1 }) }], limits: [LIMITS.files, 'Diesel prices are the ones in your contract file\'s fuel_index; Fairhaul Fuel Surcharges does not fetch an index. The week used is the latest index week on or before the ship date.', LIMITS.contract] });
      return { summary: `Fuel report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'fuel_check', decision: 'allow' }, { tool: 'fuel_compare', decision: 'allow' }, { tool: 'fuel_sensitivity', decision: 'allow' }, { tool: 'fuel_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Fuel Surcharges allowlist.' },
  ] },
});
