// Castor: freight cost split across order lines. Pure functions.
import { round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const COST_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'PRO'], { required: true }),
  cost: t(['Cost', 'Freight Cost', 'Invoice Amount', 'Total', 'Amount'], { type: 'money', required: true }),
  invoice_number: t(['Invoice Number', 'Invoice']),
  carrier: t(['Carrier', 'Carrier Name']),
  date: t(['Date', 'Ship Date', 'Invoice Date'], { type: 'date' }),
});
export const ORDER_LINE_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'PRO'], { required: true }),
  order_id: t(['Order', 'Order ID', 'Order Number', 'SO'], { required: true }),
  customer: t(['Customer', 'Customer Name', 'Ship To']),
  sku: t(['SKU', 'Item', 'Product']),
  units: t(['Units', 'Qty', 'Quantity'], { type: 'number' }),
  weight: t(['Weight', 'Line Weight', 'Weight (lb)'], { type: 'number' }),
  cube: t(['Cube', 'Volume', 'Cubic Feet', 'Cu Ft'], { type: 'number' }),
  value: t(['Value', 'Line Value', 'Extended Price', 'Sales Value'], { type: 'money' }),
  pallets: t(['Pallets', 'Pallet Count'], { type: 'number' }),
  cost_center: t(['Cost Center', 'Department', 'Profit Center']),
  gl_account: t(['GL Account', 'Account']),
});
export const BASES = ['weight', 'cube', 'value', 'pallets', 'units'];

/** Allocate each shipment's cost to its order lines. Falls back down the basis list when a line lacks the measure. */
export function allocate(costs, lines, { basis = 'weight', fallback = ['cube', 'value', 'units'], defaultGl = 'freight_out' } = {}) {
  const byShip = groupBy(lines, (l) => str(l.shipment_id).toLowerCase());
  const out = []; const problems = [];
  for (const c of costs) {
    const sid = str(c.shipment_id); const total = num(c.cost) || 0; const ls = byShip.get(sid.toLowerCase()) || [];
    if (!ls.length) { problems.push({ shipment_id: sid, cost: total, problem: 'no order lines for this shipment; cost not allocated' }); continue; }
    const used = [basis, ...fallback.filter((b) => b !== basis)].find((b) => ls.every((l) => (num(l[b]) || 0) > 0)) || 'equal';
    if (used !== basis) problems.push({ shipment_id: sid, cost: total, problem: `not every line has ${basis}; split by ${used === 'equal' ? 'equal shares' : used} instead` });
    const w = ls.map((l) => (used === 'equal' ? 1 : num(l[used])));
    const sum = w.reduce((a, b) => a + b, 0);
    let given = 0;
    ls.forEach((l, i) => {
      const share = i === ls.length - 1 ? round2(total - given) : round2((total * w[i]) / sum); given = round2(given + share);
      out.push({ shipment_id: sid, invoice_number: str(c.invoice_number) || null, carrier: str(c.carrier) || null, order_id: str(l.order_id), customer: str(l.customer) || '(none)', sku: str(l.sku) || '(none)', units: num(l.units), basis: used, share_pct: Math.round((w[i] / sum) * 10000) / 100, freight: share, per_unit: num(l.units) ? Math.round((share / num(l.units)) * 10000) / 10000 : null, freight_pct_of_value: num(l.value) ? Math.round((share / num(l.value)) * 10000) / 100 : null, cost_center: str(l.cost_center) || '(none)', gl_account: str(l.gl_account) || defaultGl });
    });
  }
  const roll = (key) => [...groupBy(out, key)].map(([k, l]) => { const f = round2(l.reduce((a, x) => a + x.freight, 0)); const u = l.reduce((a, x) => a + (x.units || 0), 0); const v = l.filter((x) => x.freight_pct_of_value !== null); return { key: k, lines: l.length, freight: f, units: u || null, per_unit: u ? Math.round((f / u) * 10000) / 10000 : null, freight_pct_of_value: v.length ? Math.round((v.reduce((a, x) => a + x.freight, 0) / v.reduce((a, x) => a + x.freight / (x.freight_pct_of_value / 100), 0)) * 10000) / 100 : null }; }).sort((a, b) => b.freight - a.freight);
  const allocated = round2(out.reduce((a, x) => a + x.freight, 0)); const billed = round2(costs.reduce((a, c) => a + (num(c.cost) || 0), 0));
  return { shipments: costs.length, billed, allocated, unallocated: round2(billed - allocated), basis, lines: out.length, by_customer: roll((x) => x.customer).map(({ key, ...r }) => ({ customer: key, ...r })), by_sku: roll((x) => x.sku).map(({ key, ...r }) => ({ sku: key, ...r })), by_cost_center: [...groupBy(out, (x) => `${x.gl_account}|${x.cost_center}`)].map(([k, l]) => { const [gl, cc] = k.split('|'); return { gl_account: gl, cost_center: cc, freight: round2(l.reduce((a, x) => a + x.freight, 0)) }; }).sort((a, b) => b.freight - a.freight), problems, allocations: out };
}

/** Journal lines: debit freight by GL and cost center, credit the clearing account the bills were booked to. */
export function journalLines(r, { clearing = 'freight_clearing', date, memo } = {}) {
  const m = memo || `Freight allocation (draft by castor-of-allocations)`;
  const lines = r.by_cost_center.filter((x) => x.freight).map((x) => ({ date: date || '', account: x.gl_account, cost_center: x.cost_center, debit: x.freight, credit: '', memo: m }));
  if (r.allocated) lines.push({ date: date || '', account: clearing, cost_center: '', debit: '', credit: r.allocated, memo: m });
  return lines;
}
