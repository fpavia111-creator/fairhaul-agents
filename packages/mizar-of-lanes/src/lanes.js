// Mizar: lane spend, trends and consolidation. Pure functions.
import { zoneOf, isoDate, addDays, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const LANE_SHIPMENT_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'PRO'], { required: true }),
  ship_date: t(['Ship Date', 'Pickup Date', 'Date'], { type: 'date', required: true }),
  mode: t(['Mode', 'Service', 'Mode of Transport']),
  carrier: t(['Carrier', 'Carrier Name']),
  origin_city: t(['Origin City', 'Ship From City']), origin_state: t(['Origin State', 'Ship From State']), origin_postal: t(['Origin Zip', 'Origin Postal']),
  dest_city: t(['Destination City', 'Dest City', 'Ship To City']), dest_state: t(['Destination State', 'Dest State', 'Ship To State']), dest_postal: t(['Destination Zip', 'Dest Zip', 'Destination Postal']),
  weight: t(['Weight', 'Weight (lb)', 'Billed Weight'], { type: 'number' }),
  pallets: t(['Pallets', 'Handling Units'], { type: 'number' }),
  miles: t(['Miles', 'Distance'], { type: 'number' }),
  cost: t(['Cost', 'Total Cost', 'Freight Cost', 'Paid', 'Amount'], { type: 'money', required: true }),
});
export const LANE_SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string' },
    lane_level: { type: 'string', enum: ['state', 'zip3', 'city'], description: 'How to group places into lanes (default zip3, falling back to state)' },
    window_days: { type: 'integer', minimum: 0, maximum: 6, description: 'Shipments this many days apart on one lane can be combined (default 0, same day)' },
    tl_rate_per_mile: { type: 'number', minimum: 0, description: 'Your typical truckload rate per mile, all-in (default 2.75)' },
    tl_minimum: { type: 'number', minimum: 0, description: 'Truckload minimum charge (default 900)' },
    tl_weight_lbs: { type: 'number', minimum: 1000, description: 'LTL at or above this weight should be quoted as truckload or volume (default 10000)' },
    tl_pallets: { type: 'number', minimum: 1, description: 'Or at or above this many pallets (default 12)' },
    max_weight_lbs: { type: 'number', minimum: 1000, description: 'Most a truck can take (default 44000)' },
    max_pallets: { type: 'number', minimum: 1, description: 'Most pallets a truck can take (default 26)' },
  },
});
const D = { lane_level: 'zip3', window_days: 0, tl_rate_per_mile: 2.75, tl_minimum: 900, tl_weight_lbs: 10000, tl_pallets: 12, max_weight_lbs: 44000, max_pallets: 26 };
const isLtl = (m) => /ltl|less/i.test(str(m)) || !str(m);
const end = (city, state, postal, level) => level === 'state' ? str(state).toUpperCase() : level === 'city' ? `${str(city)} ${str(state).toUpperCase()}`.trim() : (zoneOf(postal) ? `${str(state).toUpperCase()} ${zoneOf(postal)}` : str(state).toUpperCase());

export function analyseLanes(rows, settings = {}) {
  const s = { ...D, ...settings };
  const ships = rows.map((r) => ({ id: str(r.shipment_id), date: isoDate(r.ship_date), month: (isoDate(r.ship_date) || '').slice(0, 7), mode: str(r.mode).toLowerCase() || 'ltl', carrier: str(r.carrier), lane: `${end(r.origin_city, r.origin_state, r.origin_postal, s.lane_level) || '?'} → ${end(r.dest_city, r.dest_state, r.dest_postal, s.lane_level) || '?'}`, weight: num(r.weight), pallets: num(r.pallets), miles: num(r.miles), cost: num(r.cost) || 0 })).filter((x) => x.date);
  const spend = round2(ships.reduce((a, x) => a + x.cost, 0));
  const lanes = [...groupBy(ships, (x) => x.lane)].map(([lane, l]) => { const w = l.reduce((a, x) => a + (x.weight || 0), 0); const mi = l.filter((x) => x.miles); const cost = round2(l.reduce((a, x) => a + x.cost, 0)); return { lane, shipments: l.length, spend: cost, share_pct: spend ? Math.round((cost / spend) * 1000) / 10 : 0, weight: w, cost_per_cwt: w ? round2((cost / w) * 100) : null, cost_per_mile: mi.length ? round2(mi.reduce((a, x) => a + x.cost, 0) / mi.reduce((a, x) => a + x.miles, 0)) : null, modes: [...new Set(l.map((x) => x.mode))].join(', '), carriers: new Set(l.map((x) => x.carrier).filter(Boolean)).size }; }).sort((a, b) => b.spend - a.spend);
  const trend = [...groupBy(ships, (x) => `${x.lane}|${x.month}`)].map(([k, l]) => { const [lane, month] = k.split('|'); const w = l.reduce((a, x) => a + (x.weight || 0), 0); const c = l.reduce((a, x) => a + x.cost, 0); return { lane, month, shipments: l.length, cost_per_cwt: w ? round2((c / w) * 100) : null }; }).sort((a, b) => (a.lane === b.lane ? (a.month < b.month ? -1 : 1) : a.lane < b.lane ? -1 : 1));
  for (const l of lanes) { const tr = trend.filter((x) => x.lane === l.lane && x.cost_per_cwt !== null); l.cwt_change_pct = tr.length >= 2 ? Math.round((tr.at(-1).cost_per_cwt / tr[0].cost_per_cwt - 1) * 1000) / 10 : null; }
  const tlCost = (miles) => (miles ? round2(Math.max(s.tl_minimum, miles * s.tl_rate_per_mile)) : null);
  // Consolidation: LTL on one lane within the window.
  const groups = [];
  for (const [lane, l] of groupBy(ships.filter((x) => isLtl(x.mode)), (x) => x.lane)) {
    const sorted = [...l].sort((a, b) => (a.date < b.date ? -1 : 1)); let cur = [];
    const flush = () => { if (cur.length >= 2) { const w = cur.reduce((a, x) => a + (x.weight || 0), 0), p = cur.reduce((a, x) => a + (x.pallets || 0), 0); if (w <= s.max_weight_lbs && (!p || p <= s.max_pallets)) { const miles = Math.max(...cur.map((x) => x.miles || 0)) || null; const now = round2(cur.reduce((a, x) => a + x.cost, 0)); const tl = tlCost(miles); groups.push({ lane, from: cur[0].date, to: cur.at(-1).date, shipments: cur.map((x) => x.id), count: cur.length, weight: w, pallets: p || null, current_cost: now, truckload_estimate: tl, saving: tl !== null ? round2(now - tl) : null, worth_it: tl !== null && now > tl }); } } cur = []; };
    for (const x of sorted) { if (cur.length && addDays(cur[0].date, s.window_days) < x.date) flush(); cur.push(x); }
    flush();
  }
  groups.sort((a, b) => (b.saving || 0) - (a.saving || 0));
  // A shipment already in a worthwhile group is counted there, not again as a heavy LTL.
  const grouped = new Set(groups.filter((g) => g.worth_it).flatMap((g) => g.shipments));
  const heavy = ships.filter((x) => isLtl(x.mode) && !grouped.has(x.id) && ((x.weight || 0) >= s.tl_weight_lbs || (x.pallets || 0) >= s.tl_pallets)).map((x) => { const tl = tlCost(x.miles); return { shipment_id: x.id, lane: x.lane, date: x.date, weight: x.weight, pallets: x.pallets, cost: x.cost, truckload_estimate: tl, saving: tl !== null ? round2(x.cost - tl) : null }; }).sort((a, b) => (b.saving || 0) - (a.saving || 0));
  const good = groups.filter((g) => g.worth_it);
  return { shipments: ships.length, spend, lanes_count: lanes.length, top_lanes_share_pct: Math.round(lanes.slice(0, 3).reduce((a, l) => a + l.share_pct, 0) * 10) / 10, consolidation_groups: good.length, consolidation_saving: round2(good.reduce((a, g) => a + g.saving, 0)), heavy_ltl: heavy.filter((h) => (h.saving || 0) > 0).length, heavy_ltl_saving: round2(heavy.filter((h) => (h.saving || 0) > 0).reduce((a, h) => a + h.saving, 0)), settings: s, lanes, trend, groups, heavy };
}

export function planText(r, { from, team }) {
  const good = r.groups.filter((g) => g.worth_it); const heavy = r.heavy.filter((h) => (h.saving || 0) > 0);
  return [
    `# Freight consolidation plan`, '',
    `**To:** ${team || '[TO CONFIRM shipping team or planner]'}`, `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `On this history, ${good.length} group(s) of LTL shipments on the same lane ${r.settings.window_days ? `within ${r.settings.window_days} day(s)` : 'on the same day'} could have moved as one truck, about ${r.consolidation_saving} less, and ${heavy.length} single LTL shipment(s) were heavy enough to quote as truckload or volume, about ${r.heavy_ltl_saving} less. Truckload costs are estimates at ${r.settings.tl_rate_per_mile} per mile (minimum ${r.settings.tl_minimum}).`, '',
    ...(good.length ? ['## Ship together', '', '| Lane | Dates | Shipments | Weight | Paid | Truckload estimate | Saving |', '| --- | --- | --- | --- | --- | --- | --- |', ...good.map((g) => `| ${g.lane} | ${g.from}${g.to !== g.from ? ` to ${g.to}` : ''} | ${g.shipments.join(', ')} | ${g.weight} | ${g.current_cost} | ${g.truckload_estimate} | ${g.saving} |`), ''] : []),
    ...(heavy.length ? ['## Quote as truckload or volume LTL', '', '| Shipment | Lane | Weight | Pallets | Paid | Truckload estimate |', '| --- | --- | --- | --- | --- | --- |', ...heavy.map((h) => `| ${h.shipment_id} | ${h.lane} | ${h.weight} | ${h.pallets ?? ''} | ${h.cost} | ${h.truckload_estimate} |`), ''] : []),
    'Proposed rule: [TO CONFIRM e.g. hold orders for this lane to one ship day a week, or quote truckload above 10,000 lb]. Check customer delivery promises before holding any order.',
  ].join('\n');
}
