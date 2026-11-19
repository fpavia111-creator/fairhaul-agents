import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, isoDate } from 'fairhaul-core';
import { readFileSync } from 'node:fs';
import { REQUEST_FIELDS, HISTORY_FIELDS, DOCK_SCHEMA, planDay, reviewHistory, scheduleText } from './docks.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'fairhaul-out/docks';
const planArgs = {
  requests: { type: 'string', description: 'Appointment requests for one day under --root: load id, carrier, direction, door type, pallets, floor loaded, window start and end (HH:MM), priority' },
  dock: { type: 'string', description: 'Dock settings JSON: doors and the trailer types each takes, hours, crews, minutes per pallet' },
  date: { type: 'string', format: 'date', description: 'The day being planned, YYYY-MM-DD' },
};
const reviewArgs = {
  history: { type: 'string', description: 'Past appointments under --root: load id, carrier, load type, pallets, appointment time, arrived, at door, departed' },
  grace_minutes: { type: 'number', minimum: 0, description: 'Arrival within this many minutes counts as on time (default 15)' },
  as_of: { type: 'string', format: 'date', description: 'Ignore appointments after this date' },
};
const plan = (a, ctx) => { if (a.date && !isoDate(a.date)) throw new Error('date must be YYYY-MM-DD'); return planDay(ctx.records(a.requests, 'requests'), ctx.readJson(a.dock, 'dock_settings')); };
const review = (a, ctx) => reviewHistory(ctx.records(a.history, 'history'), { graceMinutes: a.grace_minutes ?? 15, asOf: a.as_of });
const pline = (p, d) => `${d ? `${d}: ` : ''}${p.scheduled} of ${p.requests} appointment(s) placed on ${p.doors} door(s), ${p.dock_hours}, dock use ${p.utilisation_pct}%.${p.no_slot ? ` ${p.no_slot} could not be placed.` : ''}`;
const rline = (r) => `${r.appointments} past appointment(s): ${r.on_time_pct}% on time, ${r.late} late, ${r.no_show} no-show(s); average wait for a door ${r.avg_wait} min${r.worst_hour ? `, worst at ${r.worst_hour.hour} (${r.worst_hour.avg_wait} min)` : ''}.${r.by_load_type.length ? ` Unload takes ${r.by_load_type.map((x) => `${x.load_type} ${x.minutes_per_pallet} min/pallet`).join(', ')}.` : ''}`;

const pair = draftPair({
  prefix: 'docks', noun: 'schedule', verb: 'publish', category: 'binding_send', outDir: OUT, actor: 'your receiving or transport lead',
  description: 'Write drafts/schedule-<date>.md: the day\'s appointments by load, carrier, door and time, and the requests that need another window. Marked DRAFT. Publishing to carriers goes through docks_request_publish (one click); a person books them in your scheduling system.',
  required: ['requests', 'dock', 'date'],
  args: { ...planArgs, to: { type: 'string', description: 'Who receives the schedule' }, from: { type: 'string', description: 'Your name' } },
  build: (a, ctx) => { const p = plan(a, ctx); if (!p.scheduled) throw new Error('nothing could be scheduled'); return { id: a.date, to: a.to, text: scheduleText(p, a) }; },
});
const refused = refusedTools([
  { name: 'yms_book_appointment', category: 'binding_send', description: 'Fairhaul Dock Scheduling never books, moves or cancels appointments in your scheduling or yard system.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairhaul Dock Scheduling never emails carriers.' },
]);

export const manifest = defineManifest({
  name: 'fairhaul-dock-scheduling', version: pkg.version,
  description: 'Plans a day of dock appointments across your doors, trailer types, crews and hours, sizing each by pallets and whether it is floor loaded, and lists requests that need another window. Reviews past appointments for no-shows, late arrivals, waits by hour and how long each kind of load really takes, to set slot lengths. It never books or confirms an appointment.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { dock_settings: DOCK_SCHEMA },
  sources: { requests: { label: 'Appointment requests', args: ['requests'], fields: REQUEST_FIELDS }, history: { label: 'Past appointments', args: ['history'], fields: HISTORY_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'dock_day_plan', title: 'Plan the dock day', description: 'Walks the host model through dock scheduling with Fairhaul Dock Scheduling.', arguments: [{ name: 'requests', description: 'Appointment requests', required: true }, { name: 'dock', description: 'Dock settings JSON', required: true }, { name: 'history', description: 'Past appointments', required: false }], text: `You are helping a receiving or warehouse lead with fairhaul-dock-scheduling. Requests: {{requests}}. Dock: {{dock}}. History: {{history}}.

Rules: Fairhaul Dock Scheduling never books appointments or emails carriers. Durations come from the dock settings; if the review shows loads take longer, say so and suggest new settings.

1. If history is given, call docks_review first. Report on-time %, no-shows, the worst hour for waits and the real minutes per pallet.
2. Call docks_plan. Report what was placed, door use, and each request that needs another window and why.
3. Call docks_write_report.
4. Only when the person asks, call docks_draft_schedule, then docks_request_publish after they review it.` }],
  tools: [
    { name: 'docks_plan', kind: 'read', title: 'Plan a day of dock appointments', description: 'Place each request on the earliest fitting door within its window and dock hours without exceeding crews (earliest window end first, then priority). Returns the schedule, requests with no slot and why, use by door and loads working by hour.', inputSchema: { type: 'object', additionalProperties: false, required: ['requests', 'dock'], properties: planArgs }, handler: async (a, ctx) => { const p = plan(a, ctx); return { summary: pline(p, a.date), ...p }; } },
    { name: 'docks_review', kind: 'read', title: 'Review past appointments', description: 'Arrival against appointment (on time, late, early, no-show), wait for a door, work and turn minutes per load; by carrier, by appointment hour and by load type with minutes per pallet and the 80th percentile work time.', inputSchema: { type: 'object', additionalProperties: false, required: ['history'], properties: reviewArgs }, handler: async (a, ctx) => { const r = review(a, ctx); return { summary: rline(r), ...r }; } },
    { name: 'docks_write_report', kind: 'report', title: 'Write the dock report', description: 'Write docks-plan.csv and .html (the day\'s schedule, door use, loads by hour) and, with history, docks-review.csv and .html into out_dir (default fairhaul-out/docks).', inputSchema: { type: 'object', additionalProperties: false, required: ['requests', 'dock'], properties: { ...planArgs, ...reviewArgs, out_dir: { type: 'string', description: 'Folder under --root for the report (default fairhaul-out/docks)' } } }, handler: async (a, ctx) => {
      const dir = a.out_dir || OUT; const p = plan(a, ctx);
      const w = writeWorklist(ctx, dir, 'docks-plan', { title: `Dock plan${a.date ? `, ${a.date}` : ''}`, intro: pline(p, a.date), rows: p.schedule, columns: ['load_id', 'carrier', 'direction', 'door_type', 'pallets', 'minutes', 'window', 'door', 'start', 'end', 'status', 'reason'], sections: [{ title: 'Doors', rows: p.by_door, columns: ['door', 'types', 'appointments', 'minutes_used', 'utilisation_pct'] }, { title: 'Loads working by hour', rows: p.by_hour, columns: ['hour', 'working', 'crews'] }], limits: [LIMITS.files, 'Durations are setup plus pallets times the minutes in your dock settings. The plan is a first fit, not an optimum; move loads by hand where it helps.'] });
      const files = [...w.files]; let extra = '';
      if (a.history) { const r = review(a, ctx); const v = writeWorklist(ctx, dir, 'docks-review', { title: 'Past appointments', intro: rline(r), rows: r.items, columns: ['load_id', 'carrier', 'load_type', 'pallets', 'appointment_at', 'status', 'minutes_late', 'wait_minutes', 'work_minutes', 'turn_minutes'], sections: [{ title: 'By carrier', rows: r.by_carrier, columns: ['carrier', 'appointments', 'on_time', 'late', 'no_show', 'on_time_pct', 'avg_minutes_late'] }, { title: 'Wait by appointment hour', rows: r.by_hour, columns: ['hour', 'appointments', 'avg_wait', 'max_wait'] }, { title: 'By load type', rows: r.by_load_type, columns: ['load_type', 'loads', 'avg_work_minutes', 'p80_work_minutes', 'minutes_per_pallet'] }], limits: [LIMITS.files] }); files.push(...v.files); extra = ` ${rline(r)}`; }
      return { summary: `Dock report written. ${pline(p, a.date)}${extra}`, files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'docks_plan', decision: 'allow' }, { tool: 'docks_review', decision: 'allow' }, { tool: 'docks_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Fairhaul Dock Scheduling allowlist.' },
  ] },
});
