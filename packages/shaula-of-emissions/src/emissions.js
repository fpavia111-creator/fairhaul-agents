// Shaula: shipment emissions estimates from weight, distance and mode. Pure functions.
// Factors always come from the user's file; Shaula ships no official values.
import { round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const SHIPMENT_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'Tracking'], { required: true }),
  mode: t(['Mode', 'Service', 'Transport Mode'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name']),
  customer: t(['Customer', 'Customer Name', 'Ship To']),
  origin: t(['Origin', 'Origin City', 'From']),
  destination: t(['Destination', 'Destination City', 'To']),
  weight: t(['Weight', 'Weight (lb)', 'Gross Weight', 'Billed Weight'], { type: 'number', unit: false, translate: false }),
  weight_unit: t(['Weight Unit', 'UOM']),
  distance: t(['Distance', 'Miles', 'Mileage', 'Km', 'Distance (mi)'], { type: 'number', translate: false }),
  distance_unit: t(['Distance Unit']),
  distance_source: t(['Distance Source']),
});
export const FACTOR_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['source', 'modes'],
  properties: {
    source: { type: 'string', minLength: 3, description: 'Where the factors come from, printed on every report (for example the framework and version you chose)' },
    note: { type: 'string' },
    unit: { type: 'string', enum: ['g_co2e_per_tonne_km'], description: 'Unit of every factor' },
    modes: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Factor per mode, for example ftl, ltl, parcel, intermodal, rail, ocean, air' },
    aliases: { type: 'object', additionalProperties: { type: 'string' }, description: 'Your mode names mapped to the keys in modes' },
    default_weight_unit: { type: 'string', enum: ['lb', 'kg'] },
    default_distance_unit: { type: 'string', enum: ['mi', 'km'] },
    shift: { type: 'object', additionalProperties: false, properties: { from: { type: 'array', items: { type: 'string' } }, to: { type: 'string' }, min_km: { type: 'number', minimum: 0 }, extra_km_pct: { type: 'number', minimum: 0 } }, description: 'Mode-shift what-if: shipments in these modes over min_km, moved to another mode with extra distance' },
  },
});
const LB = 0.45359237, MI = 1.609344;

/** Estimate kg CO2e per shipment: tonnes x km x factor (g per tonne-km) / 1000. */
export function estimate(shipments, f) {
  const modeKey = (m) => { const s = str(m).toLowerCase(); return (f.aliases && (f.aliases[s] || f.aliases[str(m)])) || s; };
  const rows = shipments.map((s) => {
    const mk = modeKey(s.mode); const factor = f.modes[mk];
    const wu = (str(s.weight_unit) || f.default_weight_unit || 'lb').toLowerCase(); const du = (str(s.distance_unit) || f.default_distance_unit || 'mi').toLowerCase();
    const w = num(s.weight); const d = num(s.distance);
    const tonnes = w === null ? null : (wu.startsWith('k') ? w : w * LB) / 1000; const km = d === null ? null : du.startsWith('k') ? d : d * MI;
    const issues = [];
    if (factor === undefined) issues.push(`no factor for mode "${s.mode}"`); if (tonnes === null || tonnes <= 0) issues.push('no weight'); if (km === null || km <= 0) issues.push('no distance');
    const tkm = tonnes && km ? tonnes * km : null; const kg = tkm !== null && factor !== undefined ? (tkm * factor) / 1000 : null;
    const quality = issues.length ? 'not_estimated' : /actual|measured|gps|telematics/i.test(str(s.distance_source)) ? 'measured_distance' : 'planned_distance';
    return { shipment_id: str(s.shipment_id), mode: mk, carrier: str(s.carrier) || '(none)', customer: str(s.customer) || '(none)', lane: `${str(s.origin)} > ${str(s.destination)}`, tonnes: tonnes === null ? null : Math.round(tonnes * 1000) / 1000, km: km === null ? null : Math.round(km), tonne_km: tkm === null ? null : Math.round(tkm * 10) / 10, factor: factor ?? null, kg_co2e: kg === null ? null : round2(kg), quality, issues: issues.join('; ') };
  });
  const ok = rows.filter((r) => r.kg_co2e !== null);
  const roll = (fn) => [...groupBy(ok, fn)].map(([k, l]) => { const kg = l.reduce((a, x) => a + x.kg_co2e, 0), tk = l.reduce((a, x) => a + x.tonne_km, 0); return { key: k, shipments: l.length, tonne_km: Math.round(tk), kg_co2e: round2(kg), g_per_tonne_km: tk ? Math.round((kg * 1000) / tk) : null }; }).sort((a, b) => b.kg_co2e - a.kg_co2e);
  const tk = ok.reduce((a, x) => a + x.tonne_km, 0); const kg = ok.reduce((a, x) => a + x.kg_co2e, 0);
  let shift = null;
  if (f.shift && f.shift.to && f.modes[f.shift.to] !== undefined) {
    const from = (f.shift.from || []).map((x) => x.toLowerCase()); const minKm = f.shift.min_km ?? 800; const extra = 1 + (f.shift.extra_km_pct ?? 10) / 100;
    const cand = ok.filter((r) => from.includes(r.mode) && r.km >= minKm);
    const after = cand.reduce((a, r) => a + (r.tonne_km * extra * f.modes[f.shift.to]) / 1000, 0); const before = cand.reduce((a, r) => a + r.kg_co2e, 0);
    shift = { to: f.shift.to, from: from.join(', '), min_km: minKm, extra_km_pct: f.shift.extra_km_pct ?? 10, shipments: cand.length, kg_before: round2(before), kg_after: round2(after), kg_saved: round2(before - after), shipment_ids: cand.map((r) => r.shipment_id).join(' ') };
  }
  return { factor_source: f.source, shipments: rows.length, estimated: ok.length, not_estimated: rows.length - ok.length, measured_distance_pct: rows.length ? Math.round((rows.filter((r) => r.quality === 'measured_distance').length / rows.length) * 100) : 0, tonne_km: Math.round(tk), kg_co2e: round2(kg), tonnes_co2e: Math.round(kg) / 1000, g_per_tonne_km: tk ? Math.round((kg * 1000) / tk) : null, by_mode: roll((r) => r.mode).map(({ key, ...x }) => ({ mode: key, ...x })), by_carrier: roll((r) => r.carrier).map(({ key, ...x }) => ({ carrier: key, ...x })), by_lane: roll((r) => r.lane).map(({ key, ...x }) => ({ lane: key, ...x })), by_customer: roll((r) => r.customer).map(({ key, ...x }) => ({ customer: key, ...x })), shift, rows };
}

/** Markdown statement of estimated emissions for one customer's shipments. */
export function statementText(r, customer, a = {}) {
  const c = r.by_customer.find((x) => x.customer === customer);
  const mine = r.rows.filter((x) => x.customer === customer);
  const L = [`# Estimated shipping emissions for ${customer}${a.period ? `, ${a.period}` : ''}`, '', `**To:** ${a.to || '[TO CONFIRM: customer contact]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', `Estimated emissions from our shipments to you: **${c.kg_co2e} kg CO2e** across ${c.shipments} shipment(s) and ${c.tonne_km} tonne-km.`, '', '| Shipment | Mode | Lane | Tonne-km | kg CO2e (estimate) |', '|---|---|---|---|---|'];
  for (const x of mine.filter((m) => m.kg_co2e !== null)) L.push(`| ${x.shipment_id} | ${x.mode} | ${x.lane} | ${x.tonne_km} | ${x.kg_co2e} |`);
  const missing = mine.filter((m) => m.kg_co2e === null);
  if (missing.length) L.push('', `Not estimated for lack of data: ${missing.map((m) => `${m.shipment_id} (${m.issues})`).join(', ')}.`);
  L.push('', '## Method', '', `Each shipment's weight in tonnes times its distance in km gives tonne-km, multiplied by an emission factor per mode. Factors: ${r.factor_source}. Distances are ${mine.some((m) => m.quality === 'planned_distance') ? 'planned route distances, not measured' : 'as measured'}. Empty running, warehouse and packaging emissions are not included unless your factors include them.`, '', 'These are estimates for information. They are not verified or assured, and are not a certified carbon footprint.');
  return L.join('\n');
}
