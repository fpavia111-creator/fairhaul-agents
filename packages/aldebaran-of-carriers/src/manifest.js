import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, isoDate } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { CARRIER_FIELDS, LOAD_FIELDS, vetCarriers, verificationText } from './carriers.js';
import { MEMORY, MEMORY_KINDS, watchList } from './memory.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/aldebaran';
const files = {
  carriers: { type: 'string', description: 'Carrier master under --root (TMS or AP vendor export): id, name, MC, DOT, phone, email, address, remit-to, bank last 4, date payment details changed, authority date, insurance expiry, safety rating, status' },
  loads: { type: 'string', description: 'Optional booked loads: load id, carrier id, pickup date, cargo value, and the dispatch phone and email used for this load' },
  as_of: { type: 'string', format: 'date', description: 'Date to judge from (default today)' },
  new_authority_days: { type: 'integer', minimum: 1, description: 'Authority younger than this many days is a signal (default 180)' },
};
const run = (a, ctx) => { if (a.as_of && !isoDate(a.as_of)) throw new Error('as_of must be a date, YYYY-MM-DD'); return vetCarriers(ctx.records(a.carriers, 'carriers'), a.loads ? ctx.records(a.loads, 'loads') : [], { asOf: a.as_of, newAuthorityDays: a.new_authority_days || 180, watch: watchList(ctx) }); };
const line = (r) => `${r.carriers} carrier(s) as of ${r.as_of}: ${r.high} high, ${r.medium} medium, ${r.low} low on warning signs.${r.loads ? ` Of ${r.loads} booked load(s), ${r.loads_to_hold} to hold until verified and ${r.loads_to_verify} to verify before pickup.` : ''}`;

const pair = draftPair({
  prefix: 'aldebaran', noun: 'verification_request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'your carrier relations or compliance person',
  description: 'Write drafts/verification_request-<carrier>.md: a polite request to one carrier for the documents that would clear its warning signs (insurance certificate from the agent, notice of assignment, payment detail confirmation), with an internal note to remove before sending. Marked DRAFT. Sending goes through aldebaran_request_send (one click).',
  required: ['carriers', 'carrier_id'],
  args: { ...files, carrier_id: { type: 'string', description: 'Carrier to write to' }, to: { type: 'string', description: 'Contact you already held for this carrier, not one from a change request' }, from: { type: 'string', description: 'Your name' } },
  build: (a, ctx) => { const r = run(a, ctx); const c = r.rows.find((x) => x.carrier_id === a.carrier_id); if (!c) throw new Error(`carrier ${a.carrier_id} is not in the carrier master`); if (!c.score) throw new Error(`carrier ${a.carrier_id} shows no warning signs`); return { id: a.carrier_id, to: a.to, text: verificationText(r, a.carrier_id, a) }; },
});
const refused = refusedTools([
  { name: 'tms_block_carrier', category: 'production_deploy', description: 'Aldebaran never blocks or deactivates a carrier. A person decides after verifying.' },
  { name: 'ap_change_remit_to', category: 'move_money', description: 'Aldebaran never changes payment details.' },
  { name: 'email_send', category: 'binding_send', description: 'Aldebaran never emails carriers.' },
]);

export const manifest = defineManifest({
  name: 'aldebaran-of-carriers', version: pkg.version,
  memory: { prefix: 'aldebaran', kinds: MEMORY_KINDS },
  description: 'Checks your carrier master and booked loads for warning signs of fraud and double brokering: bank accounts, phones, emails or MC numbers shared across carriers, new authority, lapsed insurance, recent payment detail changes, free-mail contacts, and dispatch contacts on a load that differ from the master. It scores each carrier, lists loads to hold or verify, and drafts a verification request. A person verifies and decides.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { carriers: { label: 'Carrier master', args: ['carriers'], fields: CARRIER_FIELDS }, loads: { label: 'Booked loads', args: ['loads'], fields: LOAD_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'carrier_vetting', title: 'Check carriers for warning signs', description: 'Walks the host model through a carrier vetting pass with Aldebaran.', arguments: [{ name: 'carriers', description: 'Carrier master', required: true }, { name: 'loads', description: 'Booked loads', required: false }], text: `You are helping a broker or shipper's carrier compliance lead with aldebaran-of-carriers. Carriers: {{carriers}}. Loads: {{loads}}.

Rules: Aldebaran never blocks a carrier, changes payment details or emails anyone. A warning sign is not proof of fraud; never call a carrier fraudulent. Verification uses contact details already on file, never ones from a change request.

0. Call aldebaran_recall to see what Aldebaran has learned (a watch-listed phone, email, email domain, MC, DOT, bank account ending or address). Accepted facts apply automatically and are listed under memory_applied; waiting facts do not. If the person tells you something to remember ("that 312 number called us last month pretending to be Ridgeline"), call aldebaran_learn and say it waits for a named person to accept it (aldebaran_accept_learning always asks). Nothing learned can clear a warning sign.
1. Call aldebaran_vet. Lead with loads to hold before pickup, then high-scoring carriers and why.
2. Call aldebaran_write_report.
3. Only when the person asks, call aldebaran_draft_verification_request for one carrier, then aldebaran_request_send after they review it.` }],
  tools: [
    { name: 'aldebaran_vet', kind: 'read', title: 'Check carriers for warning signs', description: 'Score each carrier on weighted warning signs with the detail behind each, and list booked loads with the action to take before pickup (hold, verify or none).', inputSchema: { type: 'object', additionalProperties: false, required: ['carriers'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'aldebaran_write_report', kind: 'report', title: 'Write the carrier vetting report', description: 'Write aldebaran-carriers.csv and .html (one row per carrier with its signals; loads to hold and verify) into out_dir (default lodestar-out/aldebaran).', inputSchema: { type: 'object', additionalProperties: false, required: ['carriers'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/aldebaran)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || OUT, 'aldebaran-carriers', { title: 'Carrier warning signs', intro: line(r), rows: r.rows.map(({ signal_list, ...x }) => ({ ...x, details: x.details.join(' ') })), columns: ['carrier_id', 'name', 'mc', 'status', 'score', 'level', 'signals', 'details'], sections: [{ title: 'Booked loads', rows: r.load_rows, columns: ['load_id', 'carrier_id', 'carrier', 'pickup_date', 'level', 'action', 'reasons'] }], limits: [LIMITS.files, 'These are warning signs, not findings of fraud; each has innocent explanations. Aldebaran reads only your files and does not look anything up with government registries or insurers. Verify by calling a number you already had.'] });
      return { summary: `Carrier report written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
    ...MEMORY.tools,
  ],
  policy: { rules: [
    { tool: 'aldebaran_vet', decision: 'allow' }, { tool: 'aldebaran_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    ...MEMORY.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Aldebaran allowlist.' },
  ] },
});
