import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, toIcs, carrierKey } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { EXCEPTION_FIELDS, CLAIM_FIELDS, CLAIM_TERMS_SCHEMA, scanExceptions, trackClaims, claimText } from './claims.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/claims';
const asOf = { type: 'string', format: 'date', description: 'Date to count deadlines and ages from, YYYY-MM-DD (default today)' };
const terms = { type: 'string', description: 'Optional claim terms JSON: filing window, concealed-damage report days, expected acknowledgement and resolution days, per-carrier windows and liability limits' };
const files = {
  exceptions: { type: 'string', description: 'Exceptions under --root (OS&D log, receiving or WMS export): shipment id, carrier, delivery date, exception type, noted on POD, goods value, freight charge, salvage' },
  claims: { type: 'string', description: 'Optional claims log: claim id, shipment id, carrier, filed on, amount, acknowledged on, status, paid amount' },
  terms, as_of: asOf,
};
const loadTerms = (a, ctx) => (a.terms ? ctx.readJson(a.terms, 'claim_terms') : {});
const scan = (a, ctx) => scanExceptions(ctx.records(a.exceptions, 'exceptions'), a.claims ? ctx.records(a.claims, 'claims') : [], loadTerms(a, ctx), { asOf: a.as_of });
const track = (a, ctx) => trackClaims(ctx.records(a.claims, 'claims'), loadTerms(a, ctx), { asOf: a.as_of });
const scanLine = (r) => `As of ${r.as_of}: ${r.exceptions} exception(s); ${r.to_file} to file for ${r.claimable}${r.file_now ? ` (${r.file_now} due within 30 days)` : ''}; ${r.expired} past the filing window (${r.expired_value}); ${r.filed} already filed; ${r.review} need more data.`;
const trackLine = (r) => `As of ${r.as_of}: ${r.claims} claim(s), ${r.open} open, ${r.outstanding} outstanding, ${r.recovered} recovered; ${r.needs_chasing} need chasing.`;

const pair = draftPair({
  prefix: 'claims', noun: 'claim', verb: 'file', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/claim-<shipment>.md: a freight claim letter for one exception with the amount worked out (goods value plus freight, less salvage, capped by any liability limit in your terms), the filing deadline and a list of documents to attach. Marked DRAFT. Filing goes through claims_request_file (one click).',
  required: ['exceptions', 'shipment_id'],
  args: { ...files, shipment_id: { type: 'string', description: 'Shipment id as in the exceptions file' }, from: { type: 'string', description: 'Claimant name and company' }, contact: { type: 'string', description: 'Carrier claims contact or address' }, reference: { type: 'string', description: 'Your own claim reference' } },
  build: (a, ctx) => {
    const r = scan(a, ctx); const i = r.items.find((x) => x.shipment_id.toLowerCase() === String(a.shipment_id).trim().toLowerCase());
    if (!i) throw new Error(`no exception for shipment "${a.shipment_id}"`);
    if (!['file', 'file_now'].includes(i.status)) throw new Error(`shipment ${i.shipment_id} is "${i.status}": ${i.action}`);
    return { id: i.shipment_id, to: a.contact, text: claimText(i, a), amount: i.amount, extra: { deadline: i.deadline, days_left: i.days_left, notes: i.notes } };
  },
});
const refused = refusedTools([
  { name: 'carrier_portal_submit', category: 'binding_send', description: 'Fairhaul Freight Claims never files a claim in a carrier portal; a person files it.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Freight Claims never sends email.' },
  { name: 'ap_offset_invoice', category: 'move_money', description: 'Fairhaul Freight Claims never short-pays or offsets a carrier invoice against a claim.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-freight-claims', version: pkg.version,
  description: 'Finds loss, shortage and damage on delivered shipments, works out each claim amount and filing deadline from your terms, tracks filed claims for acknowledgement, payment and short payment, and drafts claim letters. Filing is a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { claim_terms: CLAIM_TERMS_SCHEMA },
  sources: { exceptions: { label: 'Exceptions (OS&D)', args: ['exceptions'], fields: EXCEPTION_FIELDS }, claims: { label: 'Claims log', args: ['claims'], fields: CLAIM_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'freight_claims_review', title: 'Review freight claims', description: 'Walks the host model through claims with Fairhaul Freight Claims.', arguments: [{ name: 'exceptions', description: 'Exceptions file', required: true }, { name: 'claims', description: 'Claims log', required: false }], text: `You are helping a logistics or claims lead with fairhaul-freight-claims. Exceptions: {{exceptions}}. Claims log: {{claims}}.

Rules: Fairhaul Freight Claims never files, sends or offsets; carrier_portal_submit, email_send and ap_offset_invoice are blocked. Deadlines come from the terms file the person gives; say so, and do not give legal advice on claim rights.

1. Call claims_scan. Lead with the claims due within 30 days, then the claimable total and anything already past the window.
2. If a claims log was given, call claims_track and list claims to chase: no acknowledgement, overdue, short paid or declined.
3. Call claims_write_report. It writes the worklist and a calendar of filing deadlines.
4. Only when the person asks, call claims_draft_claim for one shipment, then claims_request_file after they review it.` }],
  tools: [
    { name: 'claims_scan', kind: 'read', title: 'Find claims to file and their deadlines', description: 'For each exception: type (loss, shortage, damage, concealed damage, overage), claim amount, filing deadline, days left, status (file_now, file, filed, expired, below_minimum, review, not_a_claim) and evidence notes such as a clean POD or late concealed-damage report.', inputSchema: { type: 'object', additionalProperties: false, required: ['exceptions'], properties: files }, handler: async (a, ctx) => { const r = scan(a, ctx); return { summary: scanLine(r), ...r }; } },
    { name: 'claims_track', kind: 'read', title: 'Track filed claims', description: 'For each filed claim: age, outstanding amount and what to chase: no acknowledgement, past the expected resolution time, short paid, or declined.', inputSchema: { type: 'object', additionalProperties: false, required: ['claims'], properties: { claims: { ...files.claims, description: 'Claims log under --root: claim id, shipment id, carrier, filed on, amount, acknowledged on, status, paid amount' }, terms, as_of: asOf } }, handler: async (a, ctx) => { const r = track(a, ctx); return { summary: trackLine(r), ...r }; } },
    { name: 'claims_write_report', kind: 'report', title: 'Write the claims worklist and deadline calendar', description: 'Write claims.csv and .html (one row per exception with amount, deadline and action, plus the open claims to chase) and claim-deadlines.ics (one event per claim to file, reminders 14 and 3 days before) into out_dir (default fairhaul-out/claims).', inputSchema: { type: 'object', additionalProperties: false, required: ['exceptions'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default fairhaul-out/claims)' } } }, handler: async (a, ctx) => {
      const r = scan(a, ctx); const t = a.claims ? track(a, ctx) : null; const dir = a.out_dir || OUT;
      const order = { file_now: 0, file: 1, review: 2, filed: 3, below_minimum: 4, expired: 5, not_a_claim: 6 };
      const rows = [...r.items].sort((x, y) => order[x.status] - order[y.status] || (x.days_left ?? 1e9) - (y.days_left ?? 1e9)).map((i) => ({ ...i, notes: i.notes.join(' ') }));
      const chase = t ? t.items.filter((c) => c.findings.length).map((c) => ({ claim_id: c.claim_id, shipment_id: c.shipment_id, carrier: c.carrier, age_days: c.age_days, amount: c.amount, outstanding: c.outstanding, findings: c.findings.map((f) => f.detail).join(' ') })) : [];
      const w = writeWorklist(ctx, dir, 'claims', { title: `Freight claims as of ${r.as_of}`, intro: scanLine(r) + (t ? ` ${trackLine(t)}` : ''), rows, columns: ['shipment_id', 'pro', 'carrier', 'type', 'delivered', 'deadline', 'days_left', 'amount', 'status', 'action', 'notes'], sections: t ? [{ title: 'Filed claims to chase', rows: chase, columns: ['claim_id', 'shipment_id', 'carrier', 'age_days', 'amount', 'outstanding', 'findings'] }] : [], limits: [LIMITS.files, `Deadlines use the ${r.terms.filing_window_days}-day window from your terms file (or the default). The window that binds you is the one in your bill of lading, contract or the law that applies; check it.`, LIMITS.advice] });
      const due = r.items.filter((i) => ['file', 'file_now'].includes(i.status));
      w.files.push(ctx.writeFile(ctx.outDir(dir), 'claim-deadlines.ics', toIcs(due.map((i) => ({ uid: `claims-${i.shipment_id}-${i.deadline}@fairhaul`, date: i.deadline, summary: `File freight claim: ${i.carrier}, ${i.shipment_id} (${i.amount})`, description: 'Written by fairhaul-freight-claims from your terms file. Check the deadline in your bill of lading or contract.', reminders: [14, 3] })), { calName: 'Freight claim deadlines' })));
      return { summary: `Claims report written. ${scanLine(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'claims_scan', decision: 'allow' }, { tool: 'claims_track', decision: 'allow' }, { tool: 'claims_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Freight Claims allowlist.' },
  ] },
});
