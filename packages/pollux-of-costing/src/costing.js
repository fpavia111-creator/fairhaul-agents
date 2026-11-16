// Pollux: standard freight in item cost against actual freight per unit. Pure functions.
import { round2, str, num, groupBy, isoDate } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ITEM_FIELDS = Object.freeze({
  sku: t(['SKU', 'Item', 'Item Number', 'Product'], { required: true }),
  description: t(['Description', 'Item Description', 'Name']),
  standard_freight: t(['Standard Freight', 'Std Freight', 'Freight Standard', 'Freight per Unit', 'Standard Freight per Unit'], { type: 'money', required: true }),
  on_hand: t(['On Hand', 'Qty On Hand', 'Inventory', 'Units On Hand'], { type: 'number' }),
  standard_cost: t(['Standard Cost', 'Std Cost', 'Unit Cost'], { type: 'money' }),
});
export const ACTUAL_FIELDS = Object.freeze({
  sku: t(['SKU', 'Item', 'Item Number', 'Product'], { required: true }),
  units: t(['Units', 'Qty', 'Quantity'], { type: 'number', required: true }),
  freight: t(['Freight', 'Freight Cost', 'Allocated Freight', 'Cost'], { type: 'money', required: true }),
  ship_date: t(['Ship Date', 'Date', 'Invoice Date'], { type: 'date' }),
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL']),
});

/**
 * Compare standard freight per unit with actual. Variance is actual minus
 * standard times units: positive means the standard is too low and margins
 * look better than they are.
 */
export function compareStandards(items, actuals, { thresholdPct = 10, minUnits = 20 } = {}) {
  const std = new Map(items.map((i) => [str(i.sku).toUpperCase(), i]));
  const bySku = groupBy(actuals.filter((a) => (num(a.units) || 0) > 0), (a) => str(a.sku).toUpperCase());
  const rows = [];
  const add = (sku, item, list) => {
    const s = item ? num(item.standard_freight) : null;
    const units = list.reduce((a, x) => a + num(x.units), 0); const freight = round2(list.reduce((a, x) => a + (num(x.freight) || 0), 0));
    const actual = units ? Math.round((freight / units) * 10000) / 10000 : null;
    const months = [...groupBy(list.filter((x) => isoDate(x.ship_date)), (x) => isoDate(x.ship_date).slice(0, 7))].sort(([a], [b]) => a.localeCompare(b)).map(([m, l]) => { const u = l.reduce((a, x) => a + num(x.units), 0); return { month: m, units: u, per_unit: Math.round((l.reduce((a, x) => a + (num(x.freight) || 0), 0) / u) * 10000) / 10000 }; });
    const trendPct = months.length >= 2 && months[0].per_unit ? Math.round(((months.at(-1).per_unit - months[0].per_unit) / months[0].per_unit) * 1000) / 10 : null;
    const variance = s !== null && units ? round2(freight - s * units) : null;
    const variancePct = s && actual !== null ? Math.round(((actual - s) / s) * 1000) / 10 : null;
    let status;
    if (!item) status = 'no_standard';
    else if (!units) status = 'no_shipments';
    else if (units < minUnits) status = 'thin_data';
    else if ((variancePct !== null && variancePct > thresholdPct) || (s === 0 && actual > 0)) status = 'standard_too_low'; // a zero standard with real freight is always too low
    else if (variancePct !== null && variancePct < -thresholdPct) status = 'standard_too_high';
    else status = 'ok';
    const change = status === 'standard_too_low' || status === 'standard_too_high' || (status === 'no_standard' && units >= minUnits);
    const proposed = change ? Math.round((months.length >= 2 && Math.abs(trendPct) > thresholdPct ? months.at(-1).per_unit : actual) * 100) / 100 : null;
    const onHand = item ? num(item.on_hand) : null;
    rows.push({ sku: item ? str(item.sku) : str(list[0].sku), description: item ? str(item.description) : '', units, freight, standard: s, actual_per_unit: actual, variance, variance_pct: variancePct, trend_pct: trendPct, months: months.map((m) => `${m.month}:${m.per_unit}`).join(' '), status, proposed_standard: proposed, proposed_basis: proposed === null ? '' : months.length >= 2 && Math.abs(trendPct) > thresholdPct ? `latest month (${months.at(-1).month}), trend ${trendPct > 0 ? '+' : ''}${trendPct}%` : `period average of ${units} units`, on_hand: onHand, revaluation_estimate: proposed !== null && s !== null && onHand ? round2((proposed - s) * onHand) : null });
  };
  for (const [k, list] of bySku) add(k, std.get(k), list);
  for (const [k, item] of std) if (!bySku.has(k)) add(k, item, []);
  const order = { standard_too_low: 0, standard_too_high: 1, no_standard: 2, thin_data: 3, no_shipments: 4, ok: 5 };
  rows.sort((a, b) => order[a.status] - order[b.status] || Math.abs(b.variance || 0) - Math.abs(a.variance || 0));
  const sum = (f) => round2(rows.reduce((a, r) => a + (f(r) || 0), 0));
  const count = (s) => rows.filter((r) => r.status === s).length;
  return { skus: rows.length, units: rows.reduce((a, r) => a + r.units, 0), actual_freight: sum((r) => r.freight), standard_freight: sum((r) => (r.standard !== null ? r.standard * r.units : 0)), net_variance: sum((r) => r.variance), under_costed: sum((r) => (r.variance > 0 ? r.variance : 0)), over_costed: sum((r) => (r.variance < 0 ? r.variance : 0)), standard_too_low: count('standard_too_low'), standard_too_high: count('standard_too_high'), no_standard: count('no_standard'), thin_data: count('thin_data'), no_shipments: count('no_shipments'), to_change: rows.filter((r) => r.proposed_standard !== null).length, revaluation_estimate: sum((r) => r.revaluation_estimate), settings: { threshold_pct: thresholdPct, min_units: minUnits }, rows };
}

/** Markdown for the standard update draft. */
export function updateText(r, a = {}) {
  const ch = r.rows.filter((x) => x.proposed_standard !== null);
  const L = [`# Freight standard update${a.effective ? `, effective ${a.effective}` : ''}`, '', `**To:** ${a.to || '[TO CONFIRM: cost accounting owner]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', `Actual freight for ${r.units} units across ${r.skus} SKUs was ${r.actual_freight} against ${r.standard_freight} at standard: ${r.under_costed} under-costed and ${-r.over_costed} over-costed. The ${ch.length} item(s) below moved more than ${r.settings.threshold_pct}% from their standard on at least ${r.settings.min_units} units.`, '', '| SKU | Description | Standard | Actual per unit | Proposed | Basis | On hand | Revaluation (estimate) |', '|---|---|---|---|---|---|---|---|'];
  for (const x of ch) L.push(`| ${x.sku} | ${x.description || ''} | ${x.standard ?? 'none'} | ${x.actual_per_unit} | ${x.proposed_standard} | ${x.proposed_basis} | ${x.on_hand ?? ''} | ${x.revaluation_estimate ?? ''} |`);
  L.push('', `Inventory revaluation if loaded as shown: about ${r.revaluation_estimate}. Your cost accountant decides whether and when to revalue.`);
  const thin = r.rows.filter((x) => x.status === 'thin_data');
  if (thin.length) L.push('', `Not changed for lack of volume: ${thin.map((x) => `${x.sku} (${x.units} units)`).join(', ')}.`);
  L.push('', `Load into: ${a.system || '[TO CONFIRM: ERP item cost table]'}. Pollux does not change item costs.`);
  return L.join('\n');
}
