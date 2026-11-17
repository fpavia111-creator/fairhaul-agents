import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { QUOTE_LOAD_FIELDS, QUOTE_FIELDS, QUOTE_SETTINGS_SCHEMA, compareQuotes, bookingText } from './quotes.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/nunki';
const files = {
  loads: { type: 'string', description: 'Loads needing a truck under --root: load id, origin, destination, equipment, pickup date, deliver-by date, miles, accessorials, lane history average' },
  quotes: { type: 'string', description: 'Quotes collected under --root: load id, carrier or broker, amount, all-in or linehaul only, accessorials included, valid until, transit days, notes' },
  settings: { type: 'string', description: 'Optional settings JSON: fuel per mile or percent for linehaul-only quotes, allowances per accessorial, history threshold' },
  as_of: { type: 'string', format: 'date', description: 'Date to judge expiry from, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => compareQuotes(ctx.records(a.loads, 'loads'), ctx.records(a.quotes, 'quotes'), a.settings ? ctx.readJson(a.settings, 'quote_settings') : {}, { asOf: a.as_of });
const line = (r) => `${r.loads} load(s) as of ${r.as_of}: ${r.ready} ready to book, ${r.check_price} priced well above history, ${r.requote} need new quotes, ${r.no_quotes} with none. Best usable quotes total ${r.best_total} all-in (${r.vs_history_total >= 0 ? '+' : ''}${r.vs_history_total} against lane history).`;

const pair = draftPair({
  prefix: 'nunki', noun: 'booking', verb: 'tender', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/booking-<load>.md: the confirmation accepting one carrier\'s quote for one load, with the all-in amount and what still needs filling in. Uses the best usable quote unless carrier is given. Marked DRAFT. Tendering goes through nunki_request_tender (one click).',
  required: ['loads', 'quotes', 'load_id'],
  args: { ...files, load_id: { type: 'string', description: 'Load to book' }, carrier: { type: 'string', description: 'Carrier to book (default the best usable quote)' }, reference: { type: 'string', description: 'Your reference for the carrier' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Carrier dispatch contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const i = r.items.find((x) => x.load_id.toLowerCase() === String(a.load_id).trim().toLowerCase()); if (!i) throw new Error(`no load "${a.load_id}"`); const q = a.carrier ? i.quotes.find((x) => carrierIs(i.quotes.map((y) => y.carrier), a.carrier)(x.carrier)) : i.quotes.find((x) => x.usable); if (!q) throw new Error(`no usable quote for ${i.load_id}${a.carrier ? ` from ${a.carrier}` : ''}`); if (!q.usable) throw new Error(`the ${q.carrier} quote is not usable: ${q.notes.join('; ')}`); return { id: i.load_id, to: a.contact, text: bookingText(i, q, a), amount: q.all_in_cost, extra: { carrier: q.carrier } }; },
});
const refused = refusedTools([
  { name: 'tms_tender_load', category: 'binding_send', description: 'Nunki never tenders or books loads in your TMS or a load board.' },
  { name: 'email_send', category: 'binding_send', description: 'Nunki never sends email.' },
]);

export const manifest = defineManifest({
  name: 'nunki-of-quotes', version: pkg.version,
  description: 'Lines up the spot quotes you collected for each load on one all-in basis (adding fuel and accessorials a quote leaves out), drops expired quotes and ones that miss the delivery date, compares the best with what the lane usually costs, and drafts the booking confirmation. Tendering is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { quote_settings: QUOTE_SETTINGS_SCHEMA },
  sources: { loads: { label: 'Loads needing a truck', args: ['loads'], fields: QUOTE_LOAD_FIELDS }, quotes: { label: 'Quotes collected', args: ['quotes'], fields: QUOTE_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'spot_quote_compare', title: 'Compare spot quotes', description: 'Walks the host model through spot quotes with Nunki.', arguments: [{ name: 'loads', description: 'Loads file', required: true }, { name: 'quotes', description: 'Quotes file', required: true }], text: `You are helping a shipper or broker desk with nunki-of-quotes. Loads: {{loads}}. Quotes: {{quotes}}.

Rules: Nunki never books. Fuel and accessorial additions are the person's own allowances, not the carrier's numbers; say so when a quote needed them. Check a new carrier's authority and insurance before booking (Aldebaran of Carriers).

1. Call nunki_compare. For each load give the best usable all-in quote, the spread and anything flagged.
2. Call nunki_write_report.
3. Only when the person asks, call nunki_draft_booking for one load, then nunki_request_tender after they review it.` }],
  tools: [
    { name: 'nunki_compare', kind: 'read', title: 'Compare spot quotes', description: 'For each load: every quote on an all-in basis with what was added, whether it is usable (not expired, arrives by the deliver-by date), the best usable quote, the spread, the difference from lane history, flags and a status (ready, check_price, requote, no_quotes).', inputSchema: { type: 'object', additionalProperties: false, required: ['loads', 'quotes'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'nunki_write_report', kind: 'report', title: 'Write the quote board', description: 'Write nunki-quotes.csv and .html (one row per quote, best first within each load) into out_dir (default lodestar-out/nunki).', inputSchema: { type: 'object', additionalProperties: false, required: ['loads', 'quotes'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/nunki)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const rows = r.items.flatMap((i) => (i.quotes.length ? i.quotes : [{ carrier: '(none)', notes: [] }]).map((q, n) => ({ load_id: i.load_id, lane: i.lane, pickup_date: i.pickup_date, deliver_by: i.deliver_by, status: i.status, rank: q.usable ? n + 1 : '', carrier: q.carrier, quoted: q.quoted, all_in_cost: q.all_in_cost, per_mile: q.per_mile, history_avg: i.history_avg, usable: q.usable, notes: [...(q.notes || []), q.quote_notes].filter(Boolean).join('; '), flags: n === 0 ? i.flags.join(' ') : '' })));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'nunki-quotes', { title: `Spot quotes as of ${r.as_of}`, intro: line(r), rows, columns: ['load_id', 'lane', 'pickup_date', 'deliver_by', 'status', 'rank', 'carrier', 'quoted', 'all_in_cost', 'per_mile', 'history_avg', 'usable', 'notes', 'flags'], limits: [LIMITS.files, 'Fuel and accessorial additions are your own allowances from the settings file; confirm the real total with the carrier before booking.'] });
      return { summary: `Quote board written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'nunki_compare', decision: 'allow' }, { tool: 'nunki_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Nunki allowlist.' },
  ] },
});
