// Regulus: re-rate shipment history under every contract. Pure functions.
import { contractFor, laneFor, laneLinehaul, contractFuel, dieselFor, accessorialAllowed, chargeCode, canonicalCarrier, isoDate, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const HISTORY_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'PRO'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC'], { required: true }),
  ship_date: t(['Ship Date', 'Pickup Date', 'Date'], { type: 'date' }),
  mode: t(['Mode', 'Service']),
  origin_city: t(['Origin City', 'Ship From City']), origin_state: t(['Origin State', 'Ship From State']), origin_postal: t(['Origin Zip', 'Origin Postal', 'Origin Postal Code']),
  dest_city: t(['Destination City', 'Dest City', 'Ship To City']), dest_state: t(['Destination State', 'Dest State', 'Ship To State']), dest_postal: t(['Destination Zip', 'Dest Zip', 'Destination Postal']),
  weight: t(['Weight', 'Weight (lb)', 'Billed Weight'], { type: 'number' }),
  pallets: t(['Pallets', 'Handling Units'], { type: 'number' }),
  miles: t(['Miles', 'Distance'], { type: 'number' }),
  class: t(['Class', 'Freight Class'], { type: 'number' }),
  accessorials: t(['Accessorials', 'Services', 'Accessorials Ordered']),
  paid: t(['Paid', 'Paid Amount', 'Total Cost', 'Freight Cost', 'Amount'], { type: 'money' }),
});

/** Price one shipment under one carrier block. */
export function priceUnder(block, s, contract) {
  const ship = { origin: { city: s.origin_city, state: s.origin_state, postal: s.origin_postal }, destination: { city: s.dest_city, state: s.dest_state, postal: s.dest_postal }, weight: num(s.weight), miles: num(s.miles), pallets: num(s.pallets), mode: str(s.mode).toLowerCase(), class: num(s.class) };
  const lane = laneFor(block, ship); if (!lane) return { total: null, why: 'no lane' };
  const lh = laneLinehaul(lane, ship, block); if (lh === null) return { total: null, why: `lane is ${lane.basis} and the shipment lacks that measure` };
  const fuel = block.fuel ? contractFuel(block, dieselFor(contract.fuel_index, s.ship_date), lh, ship.miles) : 0;
  if (fuel === null) return { total: null, why: 'fuel could not be priced (no index week or no miles)' };
  let acc = 0; const missing = [];
  for (const a of str(s.accessorials).split(/[;,|/]+/).map((x) => x.trim()).filter(Boolean)) { const code = chargeCode(a, contract.charge_aliases); const { allowed, rule } = accessorialAllowed(block, code, { weight: ship.weight, linehaul: lh }); if (allowed === null || (rule && rule.not_allowed)) missing.push(code); else acc += allowed; }
  return { total: round2(lh + fuel + acc), linehaul: lh, fuel: round2(fuel), accessorials: round2(acc), unpriced: missing, why: missing.length ? `accessorial(s) not priced in this contract: ${missing.join(', ')}` : null };
}

/** Re-rate every shipment under every carrier. */
export function rerate(rows, contract) {
  const carriers = (contract.carriers || []).map((c) => c.carrier);
  const items = rows.map((s) => {
    const date = isoDate(s.ship_date); const actual = canonicalCarrier(contract, s.carrier); const paid = num(s.paid);
    const quotes = carriers.map((c) => { const { block, expired } = contractFor(contract, c, date); if (!block) return { carrier: c, total: null, why: expired ? 'contract not in force on the ship date' : 'no contract' }; return { carrier: c, ...priceUnder(block, s, contract) }; });
    const priced = quotes.filter((q) => q.total !== null && !(q.unpriced && q.unpriced.length)).sort((a, b) => a.total - b.total);
    const best = priced[0] || null; const own = quotes.find((q) => q.carrier.toLowerCase() === actual.toLowerCase());
    const base = paid ?? (own && own.total);
    return { shipment_id: str(s.shipment_id), ship_date: date, lane: `${str(s.origin_state) || str(s.origin_postal)} → ${str(s.dest_state) || str(s.dest_postal)}`, mode: str(s.mode) || null, weight: num(s.weight), carrier: actual, paid, contract_cost: own ? own.total : null, best_carrier: best ? best.carrier : null, best_cost: best ? best.total : null, left_on_table: best && base !== null && base !== undefined ? round2(Math.max(0, base - best.total)) : null, quotes };
  });
  const lanes = [...groupBy(items, (i) => `${i.lane}|${i.mode || ''}`)].map(([, l]) => {
    const totals = carriers.map((c) => { const qs = l.map((i) => i.quotes.find((q) => q.carrier === c)).filter((q) => q && q.total !== null && !(q.unpriced && q.unpriced.length)); return { carrier: c, rated: qs.length, total: round2(qs.reduce((s, q) => s + q.total, 0)) }; }).filter((x) => x.rated === l.length).sort((a, b) => a.total - b.total);
    const paid = round2(l.reduce((s, i) => s + (i.paid ?? i.contract_cost ?? 0), 0)); const current = [...groupBy(l, (i) => i.carrier)].sort((a, b) => b[1].length - a[1].length)[0][0];
    return { lane: l[0].lane, mode: l[0].mode, shipments: l.length, current_carrier: current, paid, ranking: totals.map((x) => `${x.carrier} ${x.total}`).join(' < '), best_carrier: totals[0] ? totals[0].carrier : null, best_total: totals[0] ? totals[0].total : null, savings: totals[0] ? round2(Math.max(0, paid - totals[0].total)) : null, change: !!(totals[0] && totals[0].carrier !== current) };
  }).sort((a, b) => (b.savings || 0) - (a.savings || 0));
  const byCarrier = carriers.map((c) => { const qs = items.map((i) => i.quotes.find((q) => q.carrier === c)).filter((q) => q.total !== null); return { carrier: c, can_rate: qs.length, cheapest_on: items.filter((i) => i.best_carrier === c).length, total_if_all: round2(qs.reduce((s, q) => s + q.total, 0)) }; });
  return { shipments: items.length, paid: round2(items.reduce((s, i) => s + (i.paid || 0), 0)), left_on_table: round2(items.reduce((s, i) => s + (i.left_on_table || 0), 0)), not_rateable: items.filter((i) => !i.best_carrier).length, lanes_to_change: lanes.filter((l) => l.change).length, lane_savings: round2(lanes.filter((l) => l.change).reduce((s, l) => s + (l.savings || 0), 0)), carriers: byCarrier, lanes, items };
}

export function routingText(lanes, { from, system }) {
  const list = lanes.filter((l) => l.change && l.savings > 0);
  return [
    `# Routing guide changes${system ? ` for ${system}` : ''}`, '',
    `**To:** [TO CONFIRM routing guide owner]`, `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Re-rating ${list.reduce((s, l) => s + l.shipments, 0)} past shipment(s) under every contract we hold shows ${list.length} lane(s) where another carrier would have cost less, ${Math.round(list.reduce((s, l) => s + l.savings, 0) * 100) / 100} in total on this history.`, '',
    '| Lane | Mode | Shipments | Now | Proposed first choice | Paid | Would have cost | Ranking |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...list.map((l) => `| ${l.lane} | ${l.mode || ''} | ${l.shipments} | ${l.current_carrier} | ${l.best_carrier} | ${l.paid} | ${l.best_total} | ${l.ranking} |`), '',
    'Before changing anything: check service and capacity on these lanes with the proposed carriers (Rigel of Scorecards), and confirm with [TO CONFIRM who approves routing changes].',
  ].join('\n');
}
