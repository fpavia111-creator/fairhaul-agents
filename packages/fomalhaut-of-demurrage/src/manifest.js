import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, toIcs } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { CONTAINER_FIELDS, DD_CHARGE_FIELDS, DD_TERMS_SCHEMA, clocks, checkCharges, summary, disputeText } from './demurrage.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/fomalhaut';
const files = {
  containers: { type: 'string', description: 'Import containers under --root (forwarder, line or terminal export): container, line, B/L, size, discharge date, line\'s last free day, gate out, empty returned' },
  terms: { type: 'string', description: 'Free time terms JSON per line: demurrage and detention free days, calendar or business days, tiered daily rates, excluded dates' },
  charges: { type: 'string', description: 'Optional demurrage, detention or per diem invoices: container, invoice, charge type, days billed, amount' },
  as_of: { type: 'string', format: 'date', description: 'Date to count to, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => { const terms = ctx.readJson(a.terms, 'dd_terms'); const items = clocks(ctx.records(a.containers, 'containers'), terms, { asOf: a.as_of }); const checks = a.charges ? checkCharges(ctx.records(a.charges, 'charges'), items) : []; return { items, checks, s: summary(items, checks) }; };
const line = (s) => `${s.containers} container(s): ${s.act_now} to move now, ${s.accruing} accruing charges, ${s.in_free_time} in free time, ${s.closed} returned${s.no_terms ? `, ${s.no_terms} with no terms on file` : ''}. Open exposure ${s.exposure_open}.${s.charges_checked ? ` ${s.charges_checked} charge(s) checked: ${s.over} above your terms (${s.disputable}).` : ''}`;

const pair = draftPair({
  prefix: 'fomalhaut', noun: 'dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/dispute-<line>.md listing each demurrage or detention charge above your free time and rates, with the dates and the days your terms give. Marked DRAFT. Sending goes through fomalhaut_request_send (one click).',
  required: ['containers', 'terms', 'charges', 'line'],
  args: { ...files, line: { type: 'string', description: 'Ocean line as named in the containers file' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Line D&D dispute contact' } },
  build: (a, ctx) => { const { items, checks } = run(a, ctx); const mine = new Set(items.filter((i) => i.line.toLowerCase() === String(a.line).trim().toLowerCase()).map((i) => i.container)); const list = checks.filter((c) => c.status === 'over' && mine.has(c.container)); if (!list.length) throw new Error(`no charges above your terms for "${a.line}"`); const d = disputeText(list, items, a); return { id: a.line, to: a.contact, text: d.text, amount: d.total, extra: { containers: list.map((c) => c.container) } }; },
});
const refused = refusedTools([
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fomalhaut never pays the line or terminal.' },
  { name: 'terminal_book_appointment', category: 'binding_send', description: 'Fomalhaut never books terminal or return appointments.' },
  { name: 'email_send', category: 'binding_send', description: 'Fomalhaut never sends email.' },
]);

export const manifest = defineManifest({
  name: 'fomalhaut-of-demurrage', version: pkg.version,
  description: 'Tracks each import container\'s free time at the port (demurrage) and with the line (detention or per diem) from your terms, counts the days left, prices what is accruing through your rate tiers, checks the line\'s invoices and drafts disputes. Paying and booking are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { dd_terms: DD_TERMS_SCHEMA },
  sources: { containers: { label: 'Import containers', args: ['containers'], fields: CONTAINER_FIELDS }, charges: { label: 'D&D charges', args: ['charges'], fields: DD_CHARGE_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'container_free_time', title: 'Check container free time', description: 'Walks the host model through demurrage and detention with Fomalhaut.', arguments: [{ name: 'containers', description: 'Containers file', required: true }, { name: 'terms', description: 'Free time terms', required: true }], text: `You are helping an import or logistics coordinator with fomalhaut-of-demurrage. Containers: {{containers}}. Terms: {{terms}}.

Rules: Fomalhaut never pays and never books appointments. Free time comes from the terms file the person gave; where the line's last free day differs, say so and do not decide who is right.

1. Call fomalhaut_clocks. Lead with containers to move today, then those accruing, with the cost so far.
2. If charges were given, report the ones above the terms.
3. Call fomalhaut_write_report. It writes a calendar of last free days and return-by dates.
4. Only when the person asks, call fomalhaut_draft_dispute for one line, then fomalhaut_request_send after they review it.` }],
  tools: [
    { name: 'fomalhaut_clocks', kind: 'read', title: 'Count free time and charges', description: 'For each container: last free day at the port and days left, return-by date for the empty, chargeable days and cost so far for demurrage and detention, status (act_now, accruing, in_free_time, closed, no_terms), and any difference from the line\'s last free day. With charges, each charge checked against your terms (ok, over, not_checked).', inputSchema: { type: 'object', additionalProperties: false, required: ['containers', 'terms'], properties: files }, handler: async (a, ctx) => { const { items, checks, s } = run(a, ctx); return { summary: line(s), ...s, items, charges: checks }; } },
    { name: 'fomalhaut_write_report', kind: 'report', title: 'Write the free time board and calendar', description: 'Write fomalhaut-containers.csv and .html (one row per container, worst first; charges checked; totals by line) and free-time.ics (last free days and return-by dates, reminder the day before) into out_dir (default lodestar-out/fomalhaut).', inputSchema: { type: 'object', additionalProperties: false, required: ['containers', 'terms'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/fomalhaut)' } } }, handler: async (a, ctx) => {
      const { items, checks, s } = run(a, ctx); const dir = a.out_dir || OUT; const order = { accruing: 0, act_now: 1, no_terms: 2, in_free_time: 3, closed: 4 };
      const rows = [...items].sort((x, y) => order[x.status] - order[y.status] || (y.exposure || 0) - (x.exposure || 0));
      const w = writeWorklist(ctx, dir, 'fomalhaut-containers', { title: 'Container free time', intro: line(s), rows, columns: ['container', 'line', 'size', 'status', 'discharged', 'dem_lfd', 'dem_lfd_line', 'dem_days_left', 'gate_out', 'det_return_by', 'empty_returned', 'dem_charge_days', 'dem_cost', 'det_charge_days', 'det_cost', 'exposure', 'detail'], sections: [...(checks.length ? [{ title: 'Charges checked', rows: checks, columns: ['container', 'invoice_number', 'type', 'days_billed', 'billed', 'expected_days', 'expected', 'difference', 'status', 'detail'] }] : []), { title: 'By line', rows: s.by_line, columns: ['line', 'containers', 'accruing', 'exposure'] }], limits: [LIMITS.files, 'Free time and rates come from your terms file, not the line\'s live tariff. Free time starts the day after discharge unless your terms set another offset.', LIMITS.advice] });
      const ev = [...items.filter((i) => i.status !== 'closed' && !i.gate_out && i.dem_lfd).map((i) => ({ uid: `fomalhaut-${i.container}-lfd@lodestar`, date: i.dem_lfd, summary: `Last free day: ${i.container} (${i.line})`, description: 'Written by fomalhaut-of-demurrage from your terms file.', reminders: [1] })), ...items.filter((i) => i.status !== 'closed' && i.gate_out && i.det_return_by).map((i) => ({ uid: `fomalhaut-${i.container}-return@lodestar`, date: i.det_return_by, summary: `Return empty by: ${i.container} (${i.line})`, description: 'Written by fomalhaut-of-demurrage from your terms file.', reminders: [1] }))];
      w.files.push(ctx.writeFile(ctx.outDir(dir), 'free-time.ics', toIcs(ev, { calName: 'Container free time' })));
      return { summary: `Free time board written. ${line(s)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'fomalhaut_clocks', decision: 'allow' }, { tool: 'fomalhaut_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fomalhaut allowlist.' },
  ] },
});
