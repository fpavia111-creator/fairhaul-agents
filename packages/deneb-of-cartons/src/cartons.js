// Deneb: carton fit and dimensional weight. Pure functions.
import { dimWeight, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const PACKAGE_FIELDS = Object.freeze({
  package_id: t(['Package ID', 'Tracking Number', 'Order', 'Shipment ID'], { required: true }),
  carton: t(['Carton', 'Box', 'Carton Used', 'Box Code']),
  carton_l: t(['Carton Length', 'Box Length', 'Length'], { type: 'number' }),
  carton_w: t(['Carton Width', 'Box Width', 'Width'], { type: 'number' }),
  carton_h: t(['Carton Height', 'Box Height', 'Height'], { type: 'number' }),
  contents_l: t(['Contents Length', 'Item Length', 'Product Length'], { type: 'number', required: true }),
  contents_w: t(['Contents Width', 'Item Width', 'Product Width'], { type: 'number', required: true }),
  contents_h: t(['Contents Height', 'Item Height', 'Product Height'], { type: 'number', required: true }),
  weight: t(['Weight', 'Actual Weight', 'Weight (lb)'], { type: 'number', required: true }),
  billed: t(['Billed', 'Freight Cost', 'Charge', 'Net Charge'], { type: 'money' }),
  sku: t(['SKU', 'Item', 'Product']),
});
export const CARTON_SETTINGS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['cartons'],
  properties: {
    note: { type: 'string' },
    cartons: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['name', 'l', 'w', 'h'], properties: { name: { type: 'string' }, l: { type: 'number', minimum: 1 }, w: { type: 'number', minimum: 1 }, h: { type: 'number', minimum: 1 }, cost: { type: 'number', minimum: 0 } } } },
    divisor: { type: 'number', minimum: 100, maximum: 400, description: 'Dimensional divisor in cubic inches per lb (default 139)' },
    padding_in: { type: 'number', minimum: 0, maximum: 6, description: 'Inches of padding added to each content dimension (default 1)' },
    rate_per_lb: { type: 'number', minimum: 0, description: 'Average freight cost per billable lb, for the saving estimate (default 1.10)' },
    oversize_length_plus_girth: { type: 'number', minimum: 50, description: 'Length plus girth above which a surcharge is likely (default 130)' },
    oversize_longest_side: { type: 'number', minimum: 10, description: 'Longest side above which a surcharge is likely (default 48)' },
  },
});
const D = { divisor: 139, padding_in: 1, rate_per_lb: 1.1, oversize_length_plus_girth: 130, oversize_longest_side: 48 };
const dims = (l, w, h) => [num(l), num(w), num(h)].map((x) => x || 0).sort((a, b) => b - a);
const fits = (box, need) => box[0] >= need[0] && box[1] >= need[1] && box[2] >= need[2];
const lpg = (d) => d[0] + 2 * (d[1] + d[2]);

export function checkCartons(rows, cfg) {
  const s = { ...D, ...cfg }; const catalog = cfg.cartons.map((c) => ({ ...c, d: dims(c.l, c.w, c.h), vol: c.l * c.w * c.h })).sort((a, b) => a.vol - b.vol);
  const items = rows.map((r) => {
    const need = dims(r.contents_l, r.contents_w, r.contents_h).map((x) => x + 2 * s.padding_in);
    const named = catalog.find((c) => c.name.toLowerCase() === str(r.carton).toLowerCase());
    const used = num(r.carton_l) ? dims(r.carton_l, r.carton_w, r.carton_h) : named ? named.d : null;
    const wt = num(r.weight) || 0; const best = catalog.find((c) => fits(c.d, need)) || null;
    const usedDim = used ? dimWeight(used[0], used[1], used[2], s.divisor) : null; const bestDim = best ? dimWeight(best.d[0], best.d[1], best.d[2], s.divisor) : null;
    const billNow = used ? Math.max(Math.ceil(wt), usedDim) : null; const billBest = best ? Math.max(Math.ceil(wt), bestDim) : null;
    const saveLbs = billNow !== null && billBest !== null ? Math.max(0, billNow - billBest) : 0;
    const fill = used ? Math.round(((need[0] * need[1] * need[2]) / (used[0] * used[1] * used[2])) * 1000) / 10 : null;
    const flags = [];
    if (!best) flags.push('No carton in the catalog fits these contents.');
    if (used && !fits(used, need.map((x) => x - 2 * s.padding_in))) flags.push('The contents do not fit the carton recorded; check the data.');
    const big = used || (best && best.d); if (big && (lpg(big) > s.oversize_length_plus_girth || big[0] > s.oversize_longest_side)) flags.push(`Length plus girth ${lpg(big)} in, longest side ${big[0]} in: likely an additional handling or oversize charge.`);
    const status = !best ? 'no_fit' : saveLbs > 0 ? 'smaller_carton' : 'ok';
    return { package_id: str(r.package_id), sku: str(r.sku) || null, carton_used: str(r.carton) || (used ? used.join('x') : null), used_dims: used ? used.join('x') : null, fill_pct: fill, weight: wt, dim_weight_now: usedDim, billable_now: billNow, best_carton: best ? best.name : null, dim_weight_best: bestDim, billable_best: billBest, billable_lbs_saved: saveLbs, est_saving: round2(saveLbs * s.rate_per_lb), status, flags };
  });
  const usage = catalog.map((c) => ({ carton: c.name, dims: c.d.join('x'), used: items.filter((i) => str(i.carton_used).toLowerCase() === c.name.toLowerCase()).length, best_fit_for: items.filter((i) => i.best_carton === c.name).length }));
  const noFit = items.filter((i) => i.status === 'no_fit');
  const suggest = [...new Set(noFit.map((i) => { const r = rows.find((x) => str(x.package_id) === i.package_id); return dims(r.contents_l, r.contents_w, r.contents_h).map((x) => Math.ceil(x + 2 * s.padding_in)).join('x'); }))];
  const sm = items.filter((i) => i.status === 'smaller_carton');
  return { packages: items.length, smaller_carton: sm.length, billable_lbs_saved: sm.reduce((a, i) => a + i.billable_lbs_saved, 0), est_saving: round2(sm.reduce((a, i) => a + i.est_saving, 0)), no_fit: noFit.length, oversize_risk: items.filter((i) => i.flags.some((f) => /oversize/.test(f))).length, avg_fill_pct: (() => { const f = items.filter((i) => i.fill_pct !== null); return f.length ? Math.round((f.reduce((a, i) => a + i.fill_pct, 0) / f.length) * 10) / 10 : null; })(), suggested_new_cartons: suggest, settings: { divisor: s.divisor, padding_in: s.padding_in, rate_per_lb: s.rate_per_lb }, usage, by_sku: [...groupBy(sm, (i) => i.sku || '(none)')].map(([sku, l]) => ({ sku, packages: l.length, from: [...new Set(l.map((i) => i.carton_used))].join(', '), to: [...new Set(l.map((i) => i.best_carton))].join(', '), est_saving: round2(l.reduce((a, i) => a + i.est_saving, 0)) })).sort((a, b) => b.est_saving - a.est_saving), items };
}

export function changeText(r, { from, system }) {
  return [
    `# Carton and packing rule changes${system ? ` for ${system}` : ''}`, '',
    `**To:** [TO CONFIRM warehouse or WMS owner]`, `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `Across ${r.packages} package(s), ${r.smaller_carton} went out in a bigger carton than needed. Packing them in the smallest carton that fits (with ${r.settings.padding_in} in of padding) would have cut ${r.billable_lbs_saved} billable lb, about ${r.est_saving} at ${r.settings.rate_per_lb} per lb. Average fill was ${r.avg_fill_pct}%.`, '',
    '## Packing rules by item', '', '| SKU | Packages | Packed in | Smallest that fits | Est. saving |', '| --- | --- | --- | --- | --- |',
    ...r.by_sku.map((x) => `| ${x.sku} | ${x.packages} | ${x.from} | ${x.to} | ${x.est_saving} |`), '',
    ...(r.suggested_new_cartons.length ? [`## Add cartons`, '', `${r.no_fit} package(s) fit no carton in the catalog. Sizes that would take them (inches, with padding): ${r.suggested_new_cartons.join(', ')}.`, ''] : []),
    '## Carton use', '', '| Carton | Size | Used | Best fit for |', '| --- | --- | --- | --- |', ...r.usage.map((u) => `| ${u.carton} | ${u.dims} | ${u.used} | ${u.best_fit_for} |`), '',
    'Test the smaller cartons for damage before changing the rule: [TO CONFIRM drop test or trial week].',
  ].join('\n');
}
