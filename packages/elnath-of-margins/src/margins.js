// Elnath: freight charged to customers against freight cost. Pure functions.
import { exportProfile, firstRowPer, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ORDER_FIELDS = Object.freeze({
  order_id: t(['Order', 'Order ID', 'Order Number', 'SO'], { required: true }),
  customer: t(['Customer', 'Customer Name', 'Account']),
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'Tracking']),
  order_value: t(['Order Value', 'Merchandise', 'Subtotal', 'Sales'], { type: 'money', required: true }),
  freight_billed: t(['Freight Billed', 'Freight Charged', 'Shipping Charged', 'Freight Revenue', 'Shipping'], { type: 'money' }),
  terms: t(['Freight Terms', 'Terms', 'Incoterm', 'FOB']),
  freight_cost: t(['Freight Cost', 'Actual Freight', 'Cost'], { type: 'money' }),
});
export const COST_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'Tracking'], { required: true }),
  cost: t(['Cost', 'Freight Cost', 'Amount', 'Total'], { type: 'money', required: true }),
});
/** Normalise freight terms into prepaid (we pay, free to customer), prepaid_add (we pay and bill), collect (customer pays carrier), or unknown. */
export function termsOf(v) {
  const s = str(v).toLowerCase();
  // Parcel billing options: "bill recipient", "bill receiver", "bill consignee" and "bill third party"
  // mean the customer pays the carrier; "bill sender" or "bill shipper" means we do.
  if (/collect|fob origin|exw|ex works|third|3rd|recipient|receiver|consignee/.test(s)) return 'collect';
  if (/bill (sender|shipper)/.test(s)) return 'prepaid';
  if (/add|charge|bill|ppa|pp&a/.test(s)) return 'prepaid_add';
  if (/prepaid|ppd|free|fob dest|dap|ddp|delivered/.test(s)) return 'prepaid';
  return s ? 'unknown' : 'unknown';
}

/** Recovery by order, customer and terms; leaks against the free-shipping policy. */
export function freightMargins(orders, costs = [], { threshold = null, maxFreightPct = 10, alternatives = [] } = {}) {
  const costBy = new Map(); for (const c of costs) costBy.set(str(c.shipment_id).toUpperCase(), (costBy.get(str(c.shipment_id).toUpperCase()) || 0) + (num(c.cost) || 0));
  const valueBy = groupBy(orders.filter((o) => str(o.shipment_id)), (o) => str(o.shipment_id).toUpperCase());
  const rows = orders.map((o) => {
    const sid = str(o.shipment_id).toUpperCase(); const value = num(o.order_value) || 0;
    let cost = num(o.freight_cost), basis = 'order';
    if (cost === null && sid && costBy.has(sid)) { const tot = valueBy.get(sid).reduce((a, x) => a + (num(x.order_value) || 0), 0); cost = round2(costBy.get(sid) * (tot ? value / tot : 1 / valueBy.get(sid).length)); basis = valueBy.get(sid).length > 1 ? `shared shipment, by value` : 'shipment'; }
    const terms = termsOf(o.terms); const billed = num(o.freight_billed) || 0;
    const flags = [];
    if (cost === null) flags.push('no_cost');
    if (terms === 'collect' && cost) flags.push('collect_but_we_paid');
    if (terms === 'prepaid_add' && !billed && cost) flags.push('prepaid_add_not_billed');
    if (threshold !== null && terms === 'prepaid' && !billed && value < threshold && cost) flags.push('free_below_threshold');
    if (cost && value && cost / value * 100 > maxFreightPct && billed < cost) flags.push('freight_over_pct');
    return { order_id: str(o.order_id), customer: str(o.customer) || '(none)', shipment_id: str(o.shipment_id), terms, order_value: value, freight_billed: billed, freight_cost: cost, cost_basis: cost === null ? '' : basis, gap: cost === null ? null : round2(billed - cost), recovery_pct: cost ? Math.round((billed / cost) * 1000) / 10 : null, freight_pct_of_value: cost !== null && value ? Math.round((cost / value) * 1000) / 10 : null, flags: flags.join(' ') };
  });
  const roll = (f) => [...groupBy(rows.filter((r) => r.freight_cost !== null), f)].map(([k, l]) => { const c = round2(l.reduce((a, x) => a + x.freight_cost, 0)), b = round2(l.reduce((a, x) => a + x.freight_billed, 0)), v = round2(l.reduce((a, x) => a + x.order_value, 0)); return { key: k, orders: l.length, order_value: v, freight_billed: b, freight_cost: c, gap: round2(b - c), recovery_pct: c ? Math.round((b / c) * 1000) / 10 : null, freight_pct_of_value: v ? Math.round((c / v) * 1000) / 10 : null }; }).sort((a, b) => a.gap - b.gap);
  const known = rows.filter((r) => r.freight_cost !== null);
  const cost = round2(known.reduce((a, x) => a + x.freight_cost, 0)), billed = round2(known.reduce((a, x) => a + x.freight_billed, 0));
  const leak = (flag, f = (r) => r.freight_cost - r.freight_billed) => round2(rows.filter((r) => r.flags.split(' ').includes(flag)).reduce((a, r) => a + f(r), 0));
  // What-if: orders below a threshold pay the average billed rate (billed / value) of orders that did pay.
  const payers = known.filter((r) => r.freight_billed > 0 && r.terms !== 'collect');
  const rate = payers.length ? payers.reduce((a, r) => a + r.freight_billed, 0) / payers.reduce((a, r) => a + r.order_value, 0) : 0;
  const policy = known.filter((r) => r.terms === 'prepaid' && !r.freight_billed);
  const est = (th) => policy.filter((r) => r.order_value < th).reduce((a, r) => a + r.order_value * rate, 0);
  const scenarios = threshold === null ? [] : [threshold, ...alternatives].map((th) => { const extra = round2(est(th)); return { threshold: th, orders_paying: policy.filter((r) => r.order_value < th).length, extra_recovery_estimate: extra, recovery_pct_estimate: cost ? Math.round(((billed + extra) / cost) * 1000) / 10 : null }; });
  return { orders: rows.length, with_cost: known.length, freight_cost: cost, freight_billed: billed, gap: round2(billed - cost), recovery_pct: cost ? Math.round((billed / cost) * 1000) / 10 : null, collect_but_we_paid: leak('collect_but_we_paid', (r) => r.freight_cost), prepaid_add_not_billed: leak('prepaid_add_not_billed'), free_below_threshold: leak('free_below_threshold'), billed_rate_pct: Math.round(rate * 10000) / 100, scenarios, by_customer: roll((r) => r.customer).map(({ key, ...x }) => ({ customer: key, ...x })), by_terms: roll((r) => r.terms).map(({ key, ...x }) => ({ terms: key, ...x })), rows: rows.sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0)) };
}

/** Markdown proposal of freight term changes for the customers losing the most. */
export function termsText(r, a = {}) {
  const top = r.by_customer.filter((c) => c.gap < 0).slice(0, a.top || 5);
  const L = [`# Freight terms review`, '', `**To:** ${a.to || '[TO CONFIRM: sales or pricing owner]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', `Freight cost ${r.freight_cost} against ${r.freight_billed} charged to customers: ${r.recovery_pct}% recovered, a gap of ${-r.gap}.`, ''];
  if (r.collect_but_we_paid) L.push(`- Collect orders we paid freight on: ${r.collect_but_we_paid}. Check the carrier was given the customer's account.`);
  if (r.prepaid_add_not_billed) L.push(`- Prepaid-and-add orders with no freight on the invoice: ${r.prepaid_add_not_billed}.`);
  if (r.free_below_threshold) L.push(`- Orders below the free-shipping threshold that shipped free: ${r.free_below_threshold}.`);
  L.push('', '| Customer | Orders | Freight cost | Charged | Gap | Freight % of sales | Proposal |', '|---|---|---|---|---|---|---|');
  for (const c of top) L.push(`| ${c.customer} | ${c.orders} | ${c.freight_cost} | ${c.freight_billed} | ${c.gap} | ${c.freight_pct_of_value}% | [TO DECIDE: e.g. prepaid and add, minimum order, or price change] |`);
  if (r.scenarios.length > 1) { L.push('', 'Free-shipping threshold, estimated:', '', '| Threshold, enforced | Free-freight orders that would pay | Extra recovery | Recovery % |', '|---|---|---|---|'); for (const s of r.scenarios) L.push(`| ${s.threshold} | ${s.orders_paying} | ${s.extra_recovery_estimate} | ${s.recovery_pct_estimate}% |`); L.push('', `Estimates assume every prepaid order below the threshold is charged ${r.billed_rate_pct}% of order value, the average of orders that paid freight, and that no customer changes behaviour.`); }
  return L.join('\n');
}

/** Shopify orders export (exports.js). Written from knowledge; not checked against Shopify documentation or a live store. */
export const ORDER_PROFILES = Object.freeze([
  exportProfile('shopify_orders', { order_id: 'Name', customer: ['Billing Name', 'Email'], order_value: 'Subtotal', freight_billed: 'Shipping', terms: { value: 'prepaid' } }, { rows: firstRowPer('order_id'), note: 'Shopify orders: one row per order (Shopify repeats the order once per line item); shipping charged is the Shipping column, and every order is read as prepaid.' }),
]);
