import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { OPEN_LOAD_FIELDS, EVENT_FIELDS, assess, noticeText } from './tracking.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/tracking';
const files = {
  loads: { type: 'string', description: 'Open loads under --root (TMS export): load id, carrier, customer, pickup and delivery appointment, status, destination' },
  events: { type: 'string', description: 'Tracking events under --root (visibility platform, carrier API dump or EDI 214 converted by Fairhaul EDI Files): load id, event time, event, location, ETA' },
  as_of: { type: 'string', description: 'Date and time to assess from, YYYY-MM-DD HH:MM in the same time zone as the files (default now, UTC)' },
  stale_hours: { type: 'number', minimum: 0.5, maximum: 72, description: 'Hours without an update before a moving load counts as stale (default 4)' },
};
const run = (a, ctx) => assess(ctx.records(a.loads, 'loads'), ctx.records(a.events, 'events'), { asOf: a.as_of, staleHours: a.stale_hours ?? 4 });
const line = (r) => `${r.open} open load(s) at ${r.as_of}: ${r.late} late, ${r.at_risk} at risk, ${r.blind} with stale or no tracking, ${r.on_track} on track${r.delivered_not_closed ? `, ${r.delivered_not_closed} delivered but still open` : ''}.`;

const pair = draftPair({
  prefix: 'tracking', noun: 'delay_notice', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/delay_notice-<customer>.md telling one customer which of their loads are late or at risk, with the appointment, latest ETA and latest event. Marked DRAFT. Sending goes through tracking_request_send (one click).',
  required: ['loads', 'events', 'customer'],
  args: { ...files, customer: { type: 'string', description: 'Customer as named in the loads file' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Customer contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const items = r.items.filter((i) => str(i.customer).toLowerCase() === String(a.customer).trim().toLowerCase() && ['late', 'at_risk'].includes(i.status)); if (!items.length) throw new Error(`no late or at-risk loads for "${a.customer}"`); return { id: a.customer, to: a.contact, text: noticeText(items, a), extra: { shipments: items.map((i) => i.shipment_id) } }; },
});
function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
const refused = refusedTools([
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Load Tracking never emails customers or carriers.' },
  { name: 'sms_send', category: 'binding_send', description: 'Fairhaul Load Tracking never texts drivers, carriers or customers.' },
  { name: 'tms_update_status', category: 'production_deploy', description: 'Fairhaul Load Tracking never changes load status in your TMS.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-load-tracking', version: pkg.version,
  description: 'Reads your open loads and their tracking events and finds the loads that are late, at risk (ETA past the appointment, delay reported), or blind (stale or no tracking, missed pickup), plus loads delivered but still open. Ranks carriers on tracking and drafts the delay notice to the customer. Messaging and TMS changes are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { loads: { label: 'Open loads', args: ['loads'], fields: OPEN_LOAD_FIELDS }, events: { label: 'Tracking events', args: ['events'], fields: EVENT_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'tracking_exceptions', title: 'Find loads that need attention', description: 'Walks the host model through a tracking review with Fairhaul Load Tracking.', arguments: [{ name: 'loads', description: 'Open loads', required: true }, { name: 'events', description: 'Tracking events', required: true }], text: `You are helping a dispatcher or customer-service lead with fairhaul-load-tracking. Loads: {{loads}}. Events: {{events}}.

Rules: Fairhaul Load Tracking never messages anyone and never changes the TMS. Times are compared as written in the files; if they come from different time zones, say so.

1. Call tracking_assess. Lead with late loads, then at-risk, then blind ones, each with the next call to make.
2. Call tracking_write_report.
3. Only when the person asks, call tracking_draft_delay_notice for one customer, then tracking_request_send after they review it.` }],
  tools: [
    { name: 'tracking_assess', kind: 'read', title: 'Find loads that need attention', description: 'For each open load: status (late, at_risk, blind, on_track, delivered_not_closed), issues (missed_pickup, no_tracking, stale, eta_past_appointment, past_appointment, delay_reported), last event and its age, ETA and appointment. Tracking compliance by carrier.', inputSchema: { type: 'object', additionalProperties: false, required: ['loads', 'events'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'tracking_write_report', kind: 'report', title: 'Write the exceptions board', description: 'Write tracking-exceptions.csv and .html (one row per open load, worst first; carriers by tracking compliance) into out_dir (default lodestar-out/tracking).', inputSchema: { type: 'object', additionalProperties: false, required: ['loads', 'events'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/tracking)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'tracking-exceptions', { title: `Open loads at ${r.as_of}`, intro: line(r), rows: r.items.map((i) => ({ ...i, issues: (i.issues || []).join(', ') })), columns: ['shipment_id', 'carrier', 'customer', 'status', 'issues', 'pickup_appt', 'delivery_appt', 'eta', 'last_event', 'last_at', 'hours_since_update', 'detail'], sections: [{ title: 'Carriers by tracking', rows: r.carriers, columns: ['carrier', 'open', 'late', 'at_risk', 'blind', 'tracking_ok_pct'] }], limits: [LIMITS.files, 'Times are compared as written; put every file in one time zone. A snapshot, not live tracking.'] });
      return { summary: `Exceptions board written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'tracking_assess', decision: 'allow' }, { tool: 'tracking_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Load Tracking allowlist.' },
  ] },
});
