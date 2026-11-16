// Nunki: spot quotes compared on one all-in basis. Pure functions.
import { isoDate, addDays, canonicalCarrier, readYesNo, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const QUOTE_LOAD_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Load', 'Shipment ID', 'Order'], { required: true }),
  origin: t(['Origin', 'From', 'Pickup City']), destination: t(['Destination', 'To', 'Delivery City']),
  equipment: t(['Equipment', 'Trailer', 'Mode']),
  pickup_date: t(['Pickup Date', 'Ready Date', 'Ship Date'], { type: 'date', required: true }),
  deliver_by: t(['Deliver By', 'Must Deliver', 'Required Delivery', 'Due Date'], { type: 'date' }),
  miles: t(['Miles', 'Distance'], { type: 'number' }),
  accessorials: t(['Accessorials', 'Services', 'Special Requirements']),
  lane_history_avg: t(['Lane Average', 'History Average', 'Typical Cost', 'Benchmark'], { type: 'money' }),
});
export const QUOTE_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Load', 'Shipment ID', 'Reference'], { required: true }),
  carrier: t(['Carrier', 'Broker', 'Provider', 'Quoted By'], { required: true }),
  amount: t(['Amount', 'Quote', 'Rate', 'Price', 'Linehaul'], { type: 'money', required: true }),
  all_in: t(['All In', 'All-In', 'Includes Fuel', 'Fuel Included'], { type: 'bool' }),
  accessorials_included: t(['Accessorials Included', 'Includes Accessorials'], { type: 'bool' }),
  valid_until: t(['Valid Until', 'Expires', 'Expiry', 'Good Through'], { type: 'date' }),
  transit_days: t(['Transit Days', 'Transit', 'Days'], { type: 'number' }),
  notes: t(['Notes', 'Comments', 'Conditions']),
});
export const QUOTE_SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string' },
    fuel_per_mile: { type: 'number', minimum: 0, maximum: 5, description: 'Fuel to add per mile when a quote is linehaul only (default 0.6)' },
    fuel_pct: { type: 'number', minimum: 0, maximum: 60, description: 'Or fuel as a percent of linehaul when miles are unknown (default 20)' },
    accessorial_allowance: { type: 'object', description: 'Amount to add per accessorial a quote does not include, e.g. {"liftgate": 75}', additionalProperties: { type: 'number', minimum: 0 } },
    above_history_pct: { type: 'number', minimum: 0, maximum: 200, description: 'Flag the best quote when it is this far above the lane history (default 15)' },
  },
});
const D = { fuel_per_mile: 0.6, fuel_pct: 20, accessorial_allowance: {}, above_history_pct: 15 };

/** Compare quotes per load as of a date. */
export function compareQuotes(loads, quotes, settings = {}, { asOf } = {}) {
  const s = { ...D, ...settings }; const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const byLoad = groupBy(quotes, (q) => str(q.load_id).toLowerCase());
  // "Lift Gate", "lift-gate" and "liftgate" are one accessorial.
  const akey = (x) => str(x).toLowerCase().replace(/[^a-z0-9]/g, '');
  const allow = Object.fromEntries(Object.entries(s.accessorial_allowance || {}).map(([k, v]) => [akey(k), v]));
  const items = loads.map((l) => {
    const miles = num(l.miles); const accs = str(l.accessorials).split(/[;,|/]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const qs = (byLoad.get(str(l.load_id).toLowerCase()) || []).map((q) => {
      const amount = num(q.amount) || 0; const allIn = readYesNo(q.all_in) === true; const notes = [];
      const fuel = allIn ? 0 : round2(miles ? s.fuel_per_mile * miles : (amount * s.fuel_pct) / 100); if (!allIn) notes.push(`linehaul only: ${fuel} fuel added`);
      const accAdd = readYesNo(q.accessorials_included) === true ? 0 : round2(accs.reduce((x, a) => x + (allow[akey(a)] ?? 0), 0)); if (accAdd) notes.push(`${accAdd} added for ${accs.join(', ')}`);
      const unknownAcc = readYesNo(q.accessorials_included) === true ? [] : accs.filter((a) => allow[akey(a)] === undefined); if (unknownAcc.length) notes.push(`ask whether ${unknownAcc.join(', ')} is included`);
      const valid = isoDate(q.valid_until); const expired = valid ? valid < today : false;
      const transit = num(q.transit_days); const arrives = transit !== null && isoDate(l.pickup_date) ? addDays(isoDate(l.pickup_date), transit) : null; const late = arrives && isoDate(l.deliver_by) ? arrives > isoDate(l.deliver_by) : false;
      if (expired) notes.push(`expired ${valid}`); if (late) notes.push(`arrives ${arrives}, after ${isoDate(l.deliver_by)}`);
      return { carrier: canonicalCarrier({}, q.carrier), quoted: amount, all_in_cost: round2(amount + fuel + accAdd), per_mile: miles ? round2((amount + fuel + accAdd) / miles) : null, valid_until: valid, arrives, usable: !expired && !late && amount > 0, notes, quote_notes: str(q.notes) };
    }).sort((a, b) => (b.usable - a.usable) || a.all_in_cost - b.all_in_cost);
    const usable = qs.filter((q) => q.usable); const best = usable[0] || null; const hist = num(l.lane_history_avg);
    const flags = [];
    if (!qs.length) flags.push('No quotes yet.'); else if (!usable.length) flags.push('Every quote is expired or misses the delivery date; ask again.');
    if (best && hist && best.all_in_cost > hist * (1 + s.above_history_pct / 100)) flags.push(`Best quote ${best.all_in_cost} is ${Math.round((best.all_in_cost / hist - 1) * 1000) / 10}% above the lane history ${hist}; ask more carriers or move the date.`);
    if (usable.length === 1) flags.push('Only one usable quote.');
    const status = !qs.length ? 'no_quotes' : !usable.length ? 'requote' : flags.some((f) => /above the lane history/.test(f)) ? 'check_price' : 'ready';
    return { load_id: str(l.load_id), lane: `${str(l.origin)} → ${str(l.destination)}`, equipment: str(l.equipment) || null, pickup_date: isoDate(l.pickup_date), deliver_by: isoDate(l.deliver_by), miles, history_avg: hist, quotes: qs, best: best ? { carrier: best.carrier, all_in_cost: best.all_in_cost, quoted: best.quoted, valid_until: best.valid_until } : null, spread: usable.length > 1 ? round2(usable.at(-1).all_in_cost - usable[0].all_in_cost) : null, vs_history: best && hist ? round2(best.all_in_cost - hist) : null, status, flags };
  });
  const c = (st) => items.filter((i) => i.status === st).length;
  return { as_of: today, loads: items.length, ready: c('ready'), check_price: c('check_price'), requote: c('requote'), no_quotes: c('no_quotes'), best_total: round2(items.reduce((x, i) => x + (i.best ? i.best.all_in_cost : 0), 0)), vs_history_total: round2(items.reduce((x, i) => x + (i.vs_history || 0), 0)), items };
}

export function bookingText(item, q, { from, contact, reference }) {
  return [
    `# Load confirmation: ${item.load_id} with ${q.carrier}`, '',
    `**To:** ${contact || `[TO CONFIRM ${q.carrier} dispatch contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `We accept your quote of ${q.quoted}${q.all_in_cost !== q.quoted ? ` (we have it at ${q.all_in_cost} all-in after ${q.notes.filter((n) => /added/.test(n)).join('; ')}; please confirm the total)` : ' all-in'} for the load below.`, '',
    '| Load | Route | Equipment | Pickup | Deliver by | Our reference |', '| --- | --- | --- | --- | --- | --- |',
    `| ${item.load_id} | ${item.lane} | ${item.equipment || ''} | ${item.pickup_date || ''} | ${item.deliver_by || ''} | ${reference || item.load_id} |`, '',
    'Pickup address, hours and contact: [TO CONFIRM pickup details]', 'Delivery address, hours and contact: [TO CONFIRM delivery details]', '',
    'Please send your signed rate confirmation, driver name and truck number. Terms are as in our agreement: [TO CONFIRM agreement or broker-carrier contract reference].',
  ].join('\n');
}
