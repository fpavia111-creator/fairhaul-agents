import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, isoDate } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { ENTRY_FIELDS, ENTRY_PROFILES, INVOICE_FIELDS, checkEntries, correctionText } from './entries.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/entries';
const files = {
  entries: { type: 'string', description: 'Entry lines under --root from your broker or customs portal export: entry number and date, line, invoice number, SKU, tariff code, origin, quantity, entered value, exchange rate, duty rate and duty' },
  invoices: { type: 'string', description: 'Commercial invoice lines: invoice number, SKU, quantity, value, currency, origin' },
  as_of: { type: 'string', format: 'date', description: 'Date to count the days left from (default today)' },
  correction_window_days: { type: 'integer', minimum: 1, description: 'Days after the entry date during which you can still ask for a correction, as your broker advises; leave out to skip the countdown' },
  tolerance_pct: { type: 'number', minimum: 0, description: 'Percent difference in value to ignore (default 1)' },
};
const run = (a, ctx) => { if (a.as_of && !isoDate(a.as_of)) throw new Error('as_of must be a date, YYYY-MM-DD'); return checkEntries(ctx.records(a.entries, 'entries'), ctx.records(a.invoices, 'invoices'), { tolerancePct: a.tolerance_pct ?? 1, asOf: isoDate(a.as_of) || new Date().toISOString().slice(0, 10), windowDays: a.correction_window_days || null }); };
const line = (r) => `${r.entries} entr${r.entries === 1 ? 'y' : 'ies'}, ${r.lines} line(s): ${r.findings} point(s) to check. Estimated duty possibly overpaid ${r.duty_overpaid_estimate}, possibly underpaid ${r.duty_underpaid_estimate}.${r.urgent ? ` ${r.urgent} entr${r.urgent === 1 ? 'y' : 'ies'} with findings close to the correction deadline.` : ''}`;

const pair = draftPair({
  prefix: 'entries', noun: 'correction_request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'the person who deals with your broker',
  description: 'Write drafts/correction_request-<entry>.md: a note to your customs broker listing each point found on one entry and asking whether a correction is needed and by when. It asks the broker\'s view on differing codes and never proposes a classification. Marked DRAFT. Sending goes through entries_request_send (one click).',
  required: ['entries', 'invoices', 'entry_number'],
  args: { ...files, entry_number: { type: 'string', description: 'Entry to write about' }, to: { type: 'string', description: 'Broker contact email or name' }, broker: { type: 'string', description: 'Broker contact name for the greeting' }, from: { type: 'string', description: 'Your name' } },
  build: (a, ctx) => { const r = run(a, ctx); const e = r.by_entry.find((x) => x.entry_number === a.entry_number); if (!e) throw new Error(`entry ${a.entry_number} is not in the entries file`); if (!e.findings) throw new Error(`entry ${a.entry_number} has nothing to check`); return { id: a.entry_number, to: a.to, text: correctionText(r, a.entry_number, a), amount: e.duty_impact }; },
});
const refused = refusedTools([
  { name: 'customs_file_correction', category: 'binding_send', description: 'Fairhaul Customs Entries never files anything with customs. Your broker files corrections.' },
  { name: 'customs_classify_item', category: 'binding_send', description: 'Fairhaul Customs Entries never classifies goods or picks a tariff code. Ask your broker or a licensed customs professional.' },
  { name: 'ap_pay_duty', category: 'move_money', description: 'Fairhaul Customs Entries never pays duty or broker invoices.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-customs-entries', version: pkg.version,
  description: 'Checks your customs broker\'s entry lines against your commercial invoices: entered value (with the exchange rate), quantity, origin, duty arithmetic, invoice lines entered twice or not at all, and the same SKU or code entered differently across entries, with an estimate of duty possibly over or underpaid and the days left to ask for a correction. It gives no classification advice and files nothing.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { entries: { label: 'Entry lines', args: ['entries'], fields: ENTRY_FIELDS, profiles: ENTRY_PROFILES }, invoices: { label: 'Commercial invoices', args: ['invoices'], fields: INVOICE_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'entry_review', title: 'Check customs entries against invoices', description: 'Walks the host model through an entry review with Fairhaul Customs Entries.', arguments: [{ name: 'entries', description: 'Entry lines', required: true }, { name: 'invoices', description: 'Commercial invoices', required: true }], text: `You are helping an import or trade compliance coordinator with fairhaul-customs-entries. Entries: {{entries}}. Invoices: {{invoices}}.

Rules: Fairhaul Customs Entries never files with customs, never pays and never classifies. Do not suggest which tariff code is right; say the codes differ and that the broker or a licensed customs professional decides. Duty figures are estimates.

1. Call entries_check, with correction_window_days only if the person gives one. Lead with entries close to their deadline, then value and origin differences, then lines entered twice or not at all.
2. Call entries_write_report.
3. Only when the person asks, call entries_draft_correction_request for one entry, then entries_request_send after they review it.` }],
  tools: [
    { name: 'entries_check', kind: 'read', title: 'Check entries against invoices', description: 'Every point found per entry line (value, quantity, origin, duty arithmetic, entered twice, invoice line not entered, missing data) and across entries (same SKU under different codes, same code and origin at different rates), with an estimated duty impact, plus each entry\'s totals and days left to ask for a correction.', inputSchema: { type: 'object', additionalProperties: false, required: ['entries', 'invoices'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'entries_write_report', kind: 'report', title: 'Write the entry review', description: 'Write entries.csv and .html (one row per point found; entries by deadline) into out_dir (default lodestar-out/entries).', inputSchema: { type: 'object', additionalProperties: false, required: ['entries', 'invoices'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/entries)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'entries', { title: 'Customs entry review', intro: line(r), rows: r.items, columns: ['entry_number', 'line', 'invoice_number', 'sku', 'code', 'detail', 'duty_impact'], sections: [{ title: 'Entries', rows: r.by_entry, columns: ['entry_number', 'entry_date', 'lines', 'entered_value', 'duty', 'findings', 'duty_impact', 'correct_by', 'days_left', 'urgency'] }], limits: [LIMITS.files, 'Duty impact uses the rate on the entry line: positive may be owed, negative may have been overpaid. It is an estimate, not a liability figure. Fairhaul Customs Entries does not say which tariff code or origin is right; your broker or a licensed customs professional does.', LIMITS.advice] });
      return { summary: `Entry review written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'entries_check', decision: 'allow' }, { tool: 'entries_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Customs Entries allowlist.' },
  ] },
});
