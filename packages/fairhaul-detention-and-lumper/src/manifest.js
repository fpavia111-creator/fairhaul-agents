import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierIs } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { CHARGE_FIELDS, STOP_FIELDS, DETENTION_TERMS_SCHEMA, auditCharges, facilities, disputeText } from './detention.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/detention';
const files = {
  charges: { type: 'string', description: 'Detention, layover and lumper charges under --root (CSV, Excel or JSON): load id, stop, charge type, amount, hours billed' },
  stops: { type: 'string', description: 'Dock or yard log under --root: load id, stop, facility, appointment, arrived, departed, lumper receipt' },
  terms: { type: 'string', description: 'Optional detention terms JSON: free_hours, rate_per_hour, grace_minutes, bill_increment_minutes, max_per_stop, layover rules, per-carrier overrides' },
};
const run = (a, ctx) => { const terms = a.terms ? ctx.readJson(a.terms, 'detention_terms') : {}; const charges = ctx.records(a.charges, 'charges'); const stops = ctx.records(a.stops, 'stops'); return { terms, charges, stops, r: auditCharges(charges, stops, terms) }; };
const line = (r) => `${r.charges} charge(s), ${r.billed} billed: ${r.dispute} to dispute (${r.disputable}), ${r.review} need dock times, ${r.ok} supported.`;

const pair = draftPair({
  prefix: 'detention', noun: 'dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/dispute-<carrier>.md listing every disputed detention, layover and lumper charge for one carrier with billed, allowed and the dock-time reason. Marked DRAFT. Sending goes through detention_request_send (one click).',
  required: ['charges', 'stops', 'carrier'],
  args: { ...files, carrier: { type: 'string', description: 'Carrier as named in the charges file' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Carrier billing contact' } },
  build: (a, ctx) => { const { r } = run(a, ctx); const is = carrierIs(r.items.map((i) => i.carrier), a.carrier); const items = r.items.filter((i) => is(i.carrier)); if (!items.length) throw new Error(`no charges for carrier "${a.carrier}"`); const d = disputeText(items, a); if (!d.loads.length) throw new Error(`nothing to dispute for ${a.carrier}`); return { id: a.carrier, to: a.contact, text: d.text, amount: d.total, extra: { loads: d.loads } }; },
});
const refused = refusedTools([
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Fairhaul Detention and Lumper never pays carriers or lumper services.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Detention and Lumper never sends email.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-detention-and-lumper', version: pkg.version,
  description: 'Checks detention, layover and lumper charges against your dock times, appointments, free time and lumper receipts, ranks your facilities by dwell and detention cost, and drafts disputes. Paying and sending are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { detention_terms: DETENTION_TERMS_SCHEMA },
  sources: { charges: { label: 'Detention, layover and lumper charges', args: ['charges'], fields: CHARGE_FIELDS }, stops: { label: 'Dock or yard log', args: ['stops'], fields: STOP_FIELDS } },
  argDocs: { load_id: 'Load id to explain, as in the charges file' },
  prompts: [{ name: 'detention_review', title: 'Check detention against dock times', description: 'Walks the host model through a detention review with Fairhaul Detention and Lumper.', arguments: [{ name: 'charges', description: 'Charges file', required: true }, { name: 'stops', description: 'Dock log', required: true }], text: `You are helping a transportation lead check detention charges with fairhaul-detention-and-lumper. Charges: {{charges}}. Dock log: {{stops}}.

Rules: Fairhaul Detention and Lumper never pays and never sends; ap_pay_invoice and email_send are blocked.

1. Call detention_audit. Report the disputable total and the charges that need dock times.
2. Call detention_facilities. Name the facilities with the most detention and the longest dwell; those are the shipper's own fixes.
3. Call detention_write_report.
4. Offer detention_draft_dispute per carrier; detention_request_send only when the person asks, and it waits for one named click.` }],
  tools: [
    { name: 'detention_audit', kind: 'read', title: 'Check detention charges', description: 'Check each detention, layover and lumper charge against dock times, appointment grace, free time, billing increment, caps and receipts. Returns the allowed and disputable amount per charge.', inputSchema: { type: 'object', additionalProperties: false, required: ['charges', 'stops'], properties: files }, handler: async (a, ctx) => { const { r } = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'detention_explain', kind: 'read', title: 'Explain one load', description: 'Show every detention, layover and lumper charge on one load with the dock times and the reasoning.', inputSchema: { type: 'object', additionalProperties: false, required: ['charges', 'stops', 'load_id'], properties: { ...files, load_id: { type: 'string' } } }, handler: async (a, ctx) => { const { r, stops } = run(a, ctx); const i = r.items.filter((x) => x.load_id.toLowerCase() === String(a.load_id).trim().toLowerCase()); if (!i.length) throw new Error(`load ${a.load_id} has no detention, layover or lumper charges`); return { summary: i.map((x) => `${x.load_id} stop ${x.stop || '?'} ${x.type}: billed ${x.billed}, allowed ${x.allowed ?? 'unknown'}. ${x.findings.map((f) => f.detail).join(' ')}`).join('\n'), charges: i, stops: stops.filter((s) => String(s.load_id).toLowerCase() === String(a.load_id).trim().toLowerCase()).map((s) => Object.fromEntries(Object.keys(STOP_FIELDS).map((k) => [k, s[k] ?? '']))) }; } },
    { name: 'detention_facilities', kind: 'read', title: 'Rank facilities by dwell and detention', description: 'Average and longest dwell, share of stops over free time, late carrier arrivals and detention billed, per facility, worst first.', inputSchema: { type: 'object', additionalProperties: false, required: ['stops'], properties: { stops: files.stops, charges: { ...files.charges, description: 'Optional charges file, to add detention billed per facility' }, terms: files.terms } }, handler: async (a, ctx) => { const terms = a.terms ? ctx.readJson(a.terms, 'detention_terms') : {}; const fac = facilities(ctx.records(a.stops, 'stops'), a.charges ? ctx.records(a.charges, 'charges') : [], terms); return { summary: fac.slice(0, 5).map((f) => `${f.facility}: ${f.stops} stop(s), avg dwell ${f.avg_dwell_hours} h, ${f.over_free_time_pct}% over free time, detention ${f.detention_billed}`).join('\n') || 'No stops.', facilities: fac }; } },
    { name: 'detention_write_report', kind: 'report', title: 'Write the detention worklist', description: 'Write detention-audit.csv and .html (charges with allowed and disputable amounts, plus the facility ranking) into out_dir (default lodestar-out/detention).', inputSchema: { type: 'object', additionalProperties: false, required: ['charges', 'stops'], properties: { ...files, out_dir: { type: 'string' } } }, handler: async (a, ctx) => { const { r, stops, charges, terms } = run(a, ctx); const rows = r.items.map((i) => ({ load_id: i.load_id, stop: i.stop, facility: i.facility, carrier: i.carrier, type: i.type, billed: i.billed, allowed: i.allowed, disputable: i.disputable, status: i.status, reasons: i.findings.map((f) => f.detail).join(' '), decision: '' })); const w = writeWorklist(ctx, a.out_dir || OUT, 'detention-audit', { title: 'Detention, layover and lumper review', intro: line(r), rows, columns: Object.keys(rows[0] || { load_id: 0 }), sections: [{ title: 'Facilities, worst first', rows: facilities(stops, charges, terms), columns: ['facility', 'stops', 'avg_dwell_hours', 'max_dwell_hours', 'over_free_time_pct', 'carriers_late', 'detention_billed'] }], limits: [LIMITS.files, 'Allowed amounts follow the terms file (or the defaults it states: 2 free hours, 50 per hour, 15-minute grace and increments). Your carrier contract may differ.', LIMITS.advice] }); return { summary: `Detention worklist written: ${line(r)}`, ...w }; } },
    ...pair.tools, ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'detention_audit', decision: 'allow' }, { tool: 'detention_explain', decision: 'allow' }, { tool: 'detention_facilities', decision: 'allow' }, { tool: 'detention_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Detention and Lumper allowlist.' },
  ] },
});
