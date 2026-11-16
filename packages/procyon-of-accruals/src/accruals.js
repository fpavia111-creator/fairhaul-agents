// Procyon: month-end freight accrual. Pure functions.
import { contractFor, laneFor, laneLinehaul, contractFuel, dieselFor, canonicalCarrier, isoDate, daysBetween, round2, str, num, groupBy, zoneOf } from 'lodestar-core';

const ids = (x) => [x.shipment_id, x.pro, x.bol, x.po].map((v) => str(v).toLowerCase()).filter(Boolean);

/** Estimate one shipment's cost: quote, then contract, then lane history, then carrier history. */
export function estimate(s, { contract, history }) {
  const q = num(s.quoted_amount);
  if (q !== null && q > 0) return { amount: round2(q), basis: 'quote' };
  const { block } = contractFor(contract, s.carrier, s.ship_date);
  if (block) {
    const ship = { origin: { city: s.origin_city, state: s.origin_state, postal: s.origin_postal }, destination: { city: s.dest_city, state: s.dest_state, postal: s.dest_postal }, weight: num(s.weight), miles: num(s.miles), pallets: num(s.pallets), mode: str(s.mode).toLowerCase() };
    const lane = laneFor(block, ship); const lh = laneLinehaul(lane, ship, block);
    if (lh !== null) { const fuel = contractFuel(block, dieselFor(contract.fuel_index, s.ship_date), lh, ship.miles) || 0; return { amount: round2(lh + fuel), basis: fuel ? 'contract_with_fuel' : 'contract' }; }
  }
  const laneKey = `${canonicalCarrier(contract, s.carrier)}|${zoneOf(s.origin_postal) || str(s.origin_state)}|${zoneOf(s.dest_postal) || str(s.dest_state)}`;
  const lh = history.lanes.get(laneKey); if (lh && lh.n >= 2) return { amount: round2(lh.total / lh.n), basis: `lane_average_of_${lh.n}` };
  const ch = history.carriers.get(canonicalCarrier(contract, s.carrier)); if (ch && ch.n >= 3) return { amount: round2(ch.total / ch.n), basis: `carrier_average_of_${ch.n}` };
  return { amount: null, basis: 'no_estimate' };
}

/**
 * Build the accrual as of period_end. A shipment is accrued when it shipped on or
 * before period_end and no invoice dated on or before period_end covers it.
 * An invoice dated after period_end for such a shipment gives the actual amount.
 */
export function buildAccrual(shipments, invoices, { periodEnd, contract = {}, prior = [], defaultGl = 'freight_expense' } = {}) {
  const pe = isoDate(periodEnd); if (!pe) throw new Error('period_end must be a date, YYYY-MM-DD');
  const byId = new Map(); for (const inv of invoices) for (const k of ids(inv)) { if (!byId.has(k)) byId.set(k, []); byId.get(k).push(inv); }
  const history = { lanes: new Map(), carriers: new Map() };
  for (const inv of invoices) {
    const c = canonicalCarrier(contract, inv.carrier); const lk = `${c}|${zoneOf(inv.origin.postal) || inv.origin.state}|${zoneOf(inv.destination.postal) || inv.destination.state}`;
    for (const [m, k] of [[history.lanes, lk], [history.carriers, c]]) { const v = m.get(k) || { n: 0, total: 0 }; v.n++; v.total += inv.total; m.set(k, v); }
  }
  const lines = []; const billedIn = []; const skipped = { not_shipped: 0, after_period: 0, cancelled: 0 };
  for (const s of shipments) {
    const d = isoDate(s.ship_date);
    if (/cancel|void/i.test(str(s.status))) { skipped.cancelled++; continue; }
    if (!d) { skipped.not_shipped++; continue; }
    if (d > pe) { skipped.after_period++; continue; }
    const invs = ids(s).flatMap((k) => byId.get(k) || []);
    const uniq = [...new Set(invs)];
    const inPeriod = uniq.filter((i) => i.invoice_date && isoDate(i.invoice_date) <= pe);
    if (inPeriod.length) { billedIn.push({ shipment_id: s.shipment_id, invoices: inPeriod.map((i) => i.invoice_number) }); continue; }
    const late = uniq.filter((i) => !i.invoice_date || isoDate(i.invoice_date) > pe);
    const est = late.length ? { amount: round2(late.reduce((a, i) => a + i.total, 0)), basis: 'invoice_after_period_end' } : estimate(s, { contract, history });
    lines.push({ shipment_id: str(s.shipment_id), carrier: canonicalCarrier(contract, s.carrier), ship_date: d, age_days: daysBetween(d, pe), cost_center: str(s.cost_center) || '(none)', gl_account: str(s.gl_account) || defaultGl, amount: est.amount, basis: est.basis, invoices_after: late.map((i) => i.invoice_number) });
  }
  const total = round2(lines.reduce((a, l) => a + (l.amount || 0), 0));
  const byCc = [...groupBy(lines, (l) => `${l.gl_account}|${l.cost_center}`)].map(([k, ls]) => { const [gl, cc] = k.split('|'); return { gl_account: gl, cost_center: cc, shipments: ls.length, amount: round2(ls.reduce((a, l) => a + (l.amount || 0), 0)) }; }).sort((a, b) => b.amount - a.amount);
  const noEst = lines.filter((l) => l.amount === null);
  const aged = lines.filter((l) => l.age_days > 60);
  // Reversal and accuracy of last period's accrual
  const priorIdx = new Map(prior.map((p) => [str(p.shipment_id).toLowerCase(), num(p.amount)]));
  const reversals = []; for (const [sid, amt] of priorIdx) { const invs = byId.get(sid) || []; const actual = invs.length ? round2(invs.reduce((a, i) => a + i.total, 0)) : null; reversals.push({ shipment_id: sid, accrued: amt, actual, variance: actual === null ? null : round2(actual - amt), status: actual === null ? 'still_unbilled' : 'billed' }); }
  const billed = reversals.filter((r) => r.status === 'billed');
  const accuracy = billed.length ? { shipments: billed.length, accrued: round2(billed.reduce((a, r) => a + r.accrued, 0)), actual: round2(billed.reduce((a, r) => a + r.actual, 0)), variance: round2(billed.reduce((a, r) => a + r.variance, 0)), mean_abs_error_pct: Math.round((billed.reduce((a, r) => a + Math.abs(r.variance) / (r.accrued || 1), 0) / billed.length) * 1000) / 10 } : null;
  return { period_end: pe, shipments_in_period: lines.length + billedIn.length, billed_in_period: billedIn.length, accrued: lines.length, total, without_estimate: noEst.length, over_60_days: aged.length, by_cost_center: byCc, by_basis: Object.fromEntries([...groupBy(lines, (l) => l.basis.replace(/_of_\d+$/, ''))].map(([k, v]) => [k, v.length])), skipped, lines, reversals, accuracy };
}

/** Draft journal entry lines: debit expense per GL and cost center, credit the accrual account, and reverse on day one of the next period. */
export function journalLines(r, { liability = 'accrued_freight', memo } = {}) {
  const m = memo || `Freight accrual ${r.period_end} (draft by procyon-of-accruals)`;
  const out = r.by_cost_center.filter((x) => x.amount > 0).map((x) => ({ date: r.period_end, account: x.gl_account, cost_center: x.cost_center, debit: x.amount, credit: '', memo: m }));
  if (r.total > 0) out.push({ date: r.period_end, account: liability, cost_center: '', debit: '', credit: r.total, memo: m });
  return out;
}
