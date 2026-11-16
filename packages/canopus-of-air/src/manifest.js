import { defineManifest, MODEL_PIN, writeWorklist, draftPair, refusedTools, LIMITS, carrierKey } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { AIR_FIELDS, AIR_RATES_SCHEMA, auditAir, disputeText, chargeableKg, breakRate } from './air.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/canopus';
const files = {
  invoices: { type: 'string', description: 'Air freight invoice lines under --root: invoice, forwarder, AWB, origin and destination airport, flight date, pieces, actual kg, volume m³, billed chargeable kg, charge, amount, currency' },
  rates: { type: 'string', description: 'Rate sheet JSON: per forwarder, lanes with weight-break rates per kg and a minimum, surcharges per kg or flat, volumetric factor' },
};
const run = (a, ctx) => auditAir(ctx.records(a.invoices, 'invoices'), ctx.readJson(a.rates, 'air_rates'));
const line = (r) => `${r.shipments} air waybill(s), ${r.billed} billed: ${r.with_findings} with findings, ${r.disputable} disputable. ${Object.entries(r.by_finding).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings.'}`;

const pair = draftPair({
  prefix: 'canopus', noun: 'dispute', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/dispute-<forwarder>.md listing each air waybill charged above the rate sheet, with actual, volumetric and chargeable weight. Marked DRAFT. Sending goes through canopus_request_send (one click).',
  required: ['invoices', 'rates', 'forwarder'],
  args: { ...files, forwarder: { type: 'string', description: 'Forwarder as named in the invoices' }, from: { type: 'string', description: 'Your name and company' }, contact: { type: 'string', description: 'Forwarder billing contact' } },
  build: (a, ctx) => { const r = run(a, ctx); const items = r.items.filter((i) => carrierKey(i.forwarder) === carrierKey(a.forwarder) && i.disputable > 0); if (!items.length) throw new Error(`nothing to dispute for "${a.forwarder}"`); const d = disputeText(items, a); return { id: items[0].forwarder, to: a.contact, text: d.text, amount: d.total, extra: { awbs: items.map((i) => i.awb) } }; },
});
const refused = refusedTools([
  { name: 'ap_pay_invoice', category: 'move_money', description: 'Canopus never pays forwarders or airlines.' },
  { name: 'email_send', category: 'binding_send', description: 'Canopus never sends email.' },
]);

export const manifest = defineManifest({
  name: 'canopus-of-air', version: pkg.version,
  description: 'Audits air freight invoices: chargeable weight from actual and volumetric weight, the rate for the right weight break (including the cheaper higher break), the minimum charge, fuel and security surcharges per kilo, and charges your rate sheet does not have. Drafts disputes; paying and sending are a person\'s job.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { air_rates: AIR_RATES_SCHEMA },
  sources: { invoices: { label: 'Air invoice lines', args: ['invoices'], fields: AIR_FIELDS } },
  argDocs: {},
  prompts: [{ name: 'air_invoice_audit', title: 'Audit air freight invoices', description: 'Walks the host model through an air freight audit with Canopus.', arguments: [{ name: 'invoices', description: 'Air invoice lines', required: true }, { name: 'rates', description: 'Rate sheet JSON', required: true }], text: `You are helping an import, export or freight-audit lead with canopus-of-air. Invoices: {{invoices}}. Rates: {{rates}}.

Rules: Canopus never pays and never sends. It compares against the rate sheet the person gave.

1. Call canopus_audit. Give the disputable total, then each air waybill with its chargeable weight and findings.
2. Use canopus_quote when the person asks what a shipment should cost.
3. Call canopus_write_report.
4. Only when the person asks, call canopus_draft_dispute for one forwarder, then canopus_request_send after they review it.` }],
  tools: [
    { name: 'canopus_audit', kind: 'read', title: 'Audit air invoices', description: 'For each air waybill: actual, volumetric and chargeable kg, billed total, findings (rate_over, weight_over, surcharge_over, charge_not_on_rate_sheet, no_lane, no_weight, no_rate_sheet, currency_mismatch) and the disputable amount.', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'rates'], properties: files }, handler: async (a, ctx) => { const r = run(a, ctx); return { summary: line(r), ...r }; } },
    { name: 'canopus_quote', kind: 'read', title: 'Price one air shipment', description: 'Chargeable weight and air freight cost for one shipment on a lane in the rate sheet, using the cheapest valid weight break.', inputSchema: { type: 'object', additionalProperties: false, required: ['rates', 'forwarder', 'origin', 'destination', 'actual_kg'], properties: { rates: files.rates, forwarder: { type: 'string', description: 'Forwarder in the rate sheet' }, origin: { type: 'string', description: 'Origin airport code' }, destination: { type: 'string', description: 'Destination airport code' }, actual_kg: { type: 'number', minimum: 0, description: 'Actual gross weight in kg' }, volume_cbm: { type: 'number', minimum: 0, description: 'Volume in cubic metres' } } }, handler: async (a, ctx) => {
      const rates = ctx.readJson(a.rates, 'air_rates'); const fw = rates.forwarders.find((f) => [f.forwarder, ...(f.aliases || [])].some((n) => carrierKey(n) === carrierKey(a.forwarder))); if (!fw) throw new Error(`no rate sheet for "${a.forwarder}"`);
      const lane = fw.lanes.find((l) => l.origin.toUpperCase() === String(a.origin).toUpperCase() && l.destination.toUpperCase() === String(a.destination).toUpperCase()); if (!lane) throw new Error(`no lane ${a.origin}-${a.destination}`);
      const w = chargeableKg(a.actual_kg, a.volume_cbm, { factor: rates.volumetric_factor || 6000, step: rates.round_up_to || 0.5 }); const b = breakRate(w.chargeable_kg, lane.breaks, lane.minimum || 0);
      const sur = Object.entries(fw.surcharges || {}).map(([code, s]) => ({ code, amount: s.per_kg !== undefined ? Math.round(Math.max(s.per_kg * (s.on === 'actual' ? a.actual_kg : w.chargeable_kg), s.minimum || 0) * 100) / 100 : s.flat ?? null }));
      return { summary: `${w.chargeable_kg} kg chargeable (actual ${a.actual_kg}, volumetric ${w.volumetric_kg}): air freight ${b.cost} at the ${b.key} break, plus surcharges ${sur.map((s) => `${s.code} ${s.amount}`).join(', ')}.`, ...w, air_freight: b, surcharges: sur, total: Math.round((b.cost + sur.reduce((x, s) => x + (s.amount || 0), 0)) * 100) / 100 };
    } },
    { name: 'canopus_write_report', kind: 'report', title: 'Write the air audit', description: 'Write canopus-air.csv and .html (one row per finding; clean waybills listed) into out_dir (default lodestar-out/canopus).', inputSchema: { type: 'object', additionalProperties: false, required: ['invoices', 'rates'], properties: { ...files, out_dir: { type: 'string', description: 'Folder under --root for the report (default lodestar-out/canopus)' } } }, handler: async (a, ctx) => {
      const r = run(a, ctx);
      const rows = r.items.flatMap((i) => (i.findings.length ? i.findings : [{ code: 'clean', detail: 'Matches the rate sheet.', amount: 0 }]).map((f) => ({ invoice_number: i.invoice_number, forwarder: i.forwarder, awb: i.awb, lane: i.lane, flight_date: i.flight_date, actual_kg: i.actual_kg, volumetric_kg: i.volumetric_kg, chargeable_kg: i.chargeable_kg, billed_kg: i.billed_kg, billed: i.billed, finding: f.code, detail: f.detail, disputable: f.amount })));
      const w = writeWorklist(ctx, a.out_dir || OUT, 'canopus-air', { title: 'Air freight audit', intro: line(r), rows, columns: ['invoice_number', 'forwarder', 'awb', 'lane', 'flight_date', 'actual_kg', 'volumetric_kg', 'chargeable_kg', 'billed_kg', 'billed', 'finding', 'detail', 'disputable'], limits: [LIMITS.files, 'Volumetric weight uses your factor (default 6000 cm³ per kg). Compared against your rate sheet, not an airline tariff.', LIMITS.advice] });
      return { summary: `Air audit written. ${line(r)}`, files: w.files, output_sha256: w.output_sha256 };
    } },
    ...pair.tools,
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'canopus_audit', decision: 'allow' }, { tool: 'canopus_quote', decision: 'allow' }, { tool: 'canopus_write_report', decision: 'allow' },
    ...pair.rules, ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Canopus allowlist.' },
  ] },
});
