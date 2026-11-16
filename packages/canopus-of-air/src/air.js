// Canopus: air freight invoices against weight-break rate sheets. Pure functions.
import { isoDate, round2, str, num, carrierKey } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const AIR_FIELDS = Object.freeze({
  invoice_number: t(['Invoice Number', 'Invoice', 'Invoice #'], { required: true }),
  forwarder: t(['Forwarder', 'Carrier', 'Airline', 'Vendor'], { required: true }),
  awb: t(['AWB', 'Air Waybill', 'HAWB', 'MAWB'], { required: true }),
  origin: t(['Origin', 'Origin Airport', 'From'], { required: true }),
  destination: t(['Destination', 'Destination Airport', 'To'], { required: true }),
  flight_date: t(['Flight Date', 'Departure', 'ETD', 'Ship Date'], { type: 'date' }),
  service: t(['Service', 'Service Level', 'Product']),
  pieces: t(['Pieces', 'Pcs'], { type: 'number' }),
  actual_kg: t(['Actual Weight', 'Gross Weight', 'Actual kg', 'Gross kg'], { type: 'number' }),
  volume_cbm: t(['Volume', 'CBM', 'Volume m3', 'Cubic Meters'], { type: 'number' }),
  billed_kg: t(['Chargeable Weight', 'Billed Weight', 'Chargeable kg'], { type: 'number' }),
  charge_code: t(['Charge', 'Charge Code', 'Description'], { required: true }),
  amount: t(['Amount', 'Charge Amount'], { type: 'money', required: true }),
  currency: t(['Currency', 'Curr', 'CCY']),
});
const breaks = { type: 'object', description: 'Rate per chargeable kg by weight break: keys like "-45", "+45", "+100", "+300", "+500", "+1000"', additionalProperties: { type: 'number', minimum: 0 } };
export const AIR_RATES_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['forwarders'],
  properties: {
    note: { type: 'string' }, tolerance: { type: 'number', minimum: 0 },
    volumetric_factor: { type: 'number', minimum: 1000, maximum: 10000, description: 'cm³ per kg for volumetric weight (default 6000, so 1 m³ = 166.67 kg)' },
    round_up_to: { type: 'number', enum: [0.5, 1], description: 'Round chargeable weight up to this step (default 0.5 kg)' },
    forwarders: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['forwarder', 'lanes'], properties: {
      forwarder: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' } }, currency: { type: 'string' }, effective: { type: 'string', format: 'date' }, expires: { type: 'string', format: 'date' },
      lanes: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['origin', 'destination', 'breaks'], properties: { origin: { type: 'string' }, destination: { type: 'string' }, service: { type: 'string' }, minimum: { type: 'number', minimum: 0 }, breaks } } },
      surcharges: { type: 'object', description: 'Per-kg or flat surcharges by code (FSC fuel, SSC security, SCREENING, AWB, HANDLING, PICKUP, DELIVERY)', additionalProperties: { type: 'object', additionalProperties: false, properties: { per_kg: { type: 'number', minimum: 0 }, on: { type: 'string', enum: ['chargeable', 'actual'] }, flat: { type: 'number', minimum: 0 }, minimum: { type: 'number', minimum: 0 } } } },
    } } },
  },
});
const CODES = [['AF', /air ?freight|^af$|freight charge|weight charge/], ['FSC', /fuel|^fsc$|^myc$/], ['SSC', /security|^ssc$|war risk/], ['SCREENING', /screen|x-?ray/], ['AWB', /awb|air ?waybill|documentation/], ['HANDLING', /handling|terminal/], ['PICKUP', /pick ?up|collection/], ['DELIVERY', /deliver/]];
export const airCode = (s) => { const x = str(s).toLowerCase(); for (const [c, re] of CODES) if (re.test(x)) return c; return x.toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'OTHER'; };
const ap = (v) => str(v).toUpperCase().replace(/[^A-Z]/g, '');

/** Chargeable weight: the larger of actual and volumetric, rounded up. */
export function chargeableKg(actual, cbm, { factor = 6000, step = 0.5 } = {}) {
  const vol = cbm ? (cbm * 1e6) / factor : 0; const w = Math.max(num(actual) || 0, vol);
  return { volumetric_kg: round2(vol), chargeable_kg: w ? Math.ceil(w / step - 1e-9) * step : null };
}
/** Best rate for a weight: the break the weight falls in, or a higher break if cheaper ("break point"). */
export function breakRate(kg, brk, minimum = 0) {
  const list = Object.entries(brk).map(([k, r]) => ({ from: k.startsWith('-') ? 0 : Number(k.replace('+', '')), rate: r, key: k })).sort((a, b) => a.from - b.from);
  let best = null;
  for (const b of list) { const w = Math.max(kg, b.from); const cost = w * b.rate; if (b.from > kg && cost >= (best ? best.cost : Infinity)) continue; if (!best || cost < best.cost) best = { key: b.key, rate: b.rate, kg_charged: w, cost: round2(cost) }; }
  if (best && best.cost < minimum) return { key: 'minimum', rate: null, kg_charged: kg, cost: round2(minimum) };
  return best;
}

export function auditAir(rows, rates) {
  const factor = rates.volumetric_factor || 6000, step = rates.round_up_to || 0.5, tol = rates.tolerance ?? 1;
  const groups = new Map(); for (const r of rows) { const k = `${carrierKey(r.forwarder)}|${str(r.awb)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const items = [...groups.values()].map((ls) => {
    const r0 = ls[0]; const date = isoDate(r0.flight_date); const findings = []; const add = (code, detail, amount = 0) => findings.push({ code, detail, amount: round2(amount) });
    const { volumetric_kg, chargeable_kg } = chargeableKg(r0.actual_kg, num(r0.volume_cbm), { factor, step });
    const billedKg = num(r0.billed_kg); const lines = ls.map((r) => ({ code: airCode(r.charge_code), description: str(r.charge_code), amount: num(r.amount) || 0, currency: str(r.currency).toUpperCase() || null }));
    const base = { invoice_number: str(r0.invoice_number), forwarder: str(r0.forwarder), awb: str(r0.awb), lane: `${ap(r0.origin)}-${ap(r0.destination)}`, flight_date: date, actual_kg: num(r0.actual_kg), volumetric_kg, chargeable_kg, billed_kg: billedKg, billed: round2(lines.reduce((s, l) => s + l.amount, 0)) };
    const fw = rates.forwarders.filter((f) => [f.forwarder, ...(f.aliases || [])].some((n) => carrierKey(n) === carrierKey(r0.forwarder))).find((f) => !date || ((!f.effective || date >= f.effective) && (!f.expires || date <= f.expires)));
    if (!fw) { add('no_rate_sheet', `No rate sheet in force for ${r0.forwarder} on ${date || 'an unknown date'}.`); return { ...base, findings, disputable: 0 }; }
    if (fw.currency && lines.some((l) => l.currency && l.currency !== fw.currency.toUpperCase())) { add('currency_mismatch', `Billed in another currency than the rate sheet (${fw.currency}); not compared.`); return { ...base, findings, disputable: 0 }; }
    if (billedKg !== null && chargeable_kg !== null && billedKg - chargeable_kg > step / 2) add('weight_over', `Billed on ${billedKg} kg; actual ${base.actual_kg} kg and volumetric ${volumetric_kg} kg give ${chargeable_kg} kg chargeable.`);
    const lane = fw.lanes.find((l) => ap(l.origin) === ap(r0.origin) && ap(l.destination) === ap(r0.destination) && (!l.service || !str(r0.service) || l.service.toLowerCase() === str(r0.service).toLowerCase()));
    for (const l of lines) {
      if (l.code === 'AF') {
        if (!lane) { add('no_lane', `No rate for ${base.lane}.`); continue; }
        if (chargeable_kg === null) { add('no_weight', 'No weight or volume; cannot price the air freight.'); continue; }
        const b = breakRate(chargeable_kg, lane.breaks, lane.minimum || 0); if (l.amount - b.cost > tol) add('rate_over', `Air freight ${l.amount}; ${chargeable_kg} kg at the ${b.key} break${b.rate !== null ? ` (${b.rate}/kg on ${b.kg_charged} kg)` : ''} is ${b.cost}.`, l.amount - b.cost);
        continue;
      }
      const s = (fw.surcharges || {})[l.code];
      if (!s) { add('charge_not_on_rate_sheet', `${l.description} (${l.amount}) is not on the rate sheet.`, l.amount); continue; }
      const kg = s.on === 'actual' ? base.actual_kg : chargeable_kg;
      const exp = s.per_kg !== undefined ? (kg === null ? null : round2(Math.max(s.per_kg * kg, s.minimum || 0))) : s.flat ?? null;
      if (exp !== null && l.amount - exp > tol) add('surcharge_over', `${l.code} ${l.amount}; the rate sheet gives ${exp}${s.per_kg !== undefined ? ` (${s.per_kg}/kg on ${kg} kg ${s.on || 'chargeable'})` : ''}.`, l.amount - exp);
    }
    return { ...base, findings, disputable: round2(findings.reduce((s, f) => s + f.amount, 0)) };
  });
  const by = {}; for (const i of items) for (const f of i.findings) by[f.code] = (by[f.code] || 0) + 1;
  return { shipments: items.length, billed: round2(items.reduce((s, i) => s + i.billed, 0)), disputable: round2(items.reduce((s, i) => s + i.disputable, 0)), with_findings: items.filter((i) => i.findings.length).length, by_finding: by, items };
}

export function disputeText(items, { from, contact }) {
  const total = round2(items.reduce((s, i) => s + i.disputable, 0));
  return { total, text: [
    `# Air freight invoice dispute: ${items[0].forwarder}`, '',
    `**To:** ${contact || `[TO CONFIRM ${items[0].forwarder} billing contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `These charges are above our agreed rate sheet. We ask for credit notes totalling ${total}.`, '',
    '| Invoice | AWB | Lane | Actual / volumetric / chargeable kg | Issue | Amount |', '| --- | --- | --- | --- | --- | --- |',
    ...items.flatMap((i) => i.findings.filter((f) => f.amount > 0 || f.code === 'weight_over').map((f) => `| ${i.invoice_number} | ${i.awb} | ${i.lane} | ${i.actual_kg} / ${i.volumetric_kg} / ${i.chargeable_kg} | ${f.detail} | ${f.amount} |`)), '',
    '[ATTACH the rate sheet and the AWB with dimensions]',
  ].join('\n') };
}
