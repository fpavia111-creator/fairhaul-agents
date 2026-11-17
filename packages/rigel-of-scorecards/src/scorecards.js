// Rigel: carrier scorecards from your own shipment history. Pure functions.
import { isoDate, hoursBetween, round2, str, num, readYesNo, groupBy, carrierGrouper } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const SCORE_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'Load Number', 'Order', 'BOL'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC'], { required: true }),
  tender: t(['Tender', 'Tender Status', 'Tender Response', 'Accepted', 'Response']),
  pickup_planned: t(['Pickup Planned', 'Pickup Appointment', 'Scheduled Pickup', 'Planned Pickup', 'Pickup Appt'], { type: 'datetime' }),
  pickup_actual: t(['Pickup Actual', 'Actual Pickup', 'Picked Up', 'Pickup Date'], { type: 'datetime' }),
  delivery_planned: t(['Delivery Planned', 'Delivery Appointment', 'Scheduled Delivery', 'Planned Delivery', 'Delivery Appt', 'Due Date'], { type: 'datetime' }),
  delivery_actual: t(['Delivery Actual', 'Actual Delivery', 'Delivered', 'Delivery Date'], { type: 'datetime' }),
  billed_amount: t(['Billed Amount', 'Invoice Amount', 'Billed', 'Invoiced'], { type: 'money' }),
  expected_amount: t(['Expected Amount', 'Quoted', 'Quote', 'Contract Amount', 'Rate Con Amount', 'Expected'], { type: 'money' }),
  claim_amount: t(['Claim Amount', 'Claims', 'OS&D Amount'], { type: 'money' }),
  tracking_updates: t(['Tracking Updates', 'Tracking Events', 'Status Updates', 'Tracked']),
  miles: t(['Miles', 'Distance', 'Loaded Miles'], { type: 'number' }),
  mode: t(['Mode', 'Service']),
});

const METRICS = ['otd_pct', 'otp_pct', 'acceptance_pct', 'billing_accuracy_pct', 'claim_free_pct', 'tracking_pct', 'cost_score'];
export const SCORECARD_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string' },
    weights: { type: 'object', additionalProperties: false, description: 'Relative weight of each metric in the score (defaults: on-time delivery 30, on-time pickup 15, tender acceptance 20, billing accuracy 15, claim-free 10, tracking 5, cost 5)', properties: Object.fromEntries(METRICS.map((m) => [m, { type: 'number', minimum: 0 }])) },
    targets: { type: 'object', additionalProperties: false, description: 'Targets in percent; a carrier below one is flagged', properties: Object.fromEntries(METRICS.filter((m) => m !== 'cost_score').map((m) => [m, { type: 'number', minimum: 0, maximum: 100 }])) },
    grace_minutes: { type: 'integer', minimum: 0, maximum: 1440, description: 'Minutes late still counted on time when both times are known (default 60)' },
    billing_tolerance_pct: { type: 'number', minimum: 0, maximum: 50, description: 'Billed within this percent of expected counts as accurate (default 2)' },
    min_loads: { type: 'integer', minimum: 1, maximum: 1000, description: 'Carriers with fewer loads are listed but not ranked (default 5)' },
  },
});
const D = { weights: { otd_pct: 30, otp_pct: 15, acceptance_pct: 20, billing_accuracy_pct: 15, claim_free_pct: 10, tracking_pct: 5, cost_score: 5 }, targets: { otd_pct: 95, otp_pct: 95, acceptance_pct: 85, billing_accuracy_pct: 95, claim_free_pct: 98, tracking_pct: 90 }, grace_minutes: 60, billing_tolerance_pct: 2, min_loads: 5 };
const LABEL = { otd_pct: 'On-time delivery', otp_pct: 'On-time pickup', acceptance_pct: 'Tender acceptance', billing_accuracy_pct: 'Billing accuracy', claim_free_pct: 'Claim-free loads', tracking_pct: 'Tracking', cost_score: 'Cost per mile (relative)' };
export { LABEL as METRIC_LABELS };

const hasTime = (v) => /\d{1,2}:\d{2}/.test(str(v));
/** true when on time, false when late, null when unknown. Dates only: late if a later day. Times on both: late beyond grace. */
export function onTime(planned, actual, graceMinutes = 60) {
  if (!str(planned) || !str(actual)) return null;
  if (hasTime(planned) && hasTime(actual)) { const h = hoursBetween(planned, actual); return h === null ? null : h * 60 <= graceMinutes; }
  const p = isoDate(planned), a = isoDate(actual); return p && a ? a <= p : null;
}
const accepted = (v) => { const s = str(v).toLowerCase(); if (!s) return null; if (/declin|reject|refus|^d$|^r$/.test(s)) return false; if (/accept|^a$/.test(s)) return true; return readYesNo(v); };
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const quarterOf = (d) => { const x = isoDate(d); return x ? `${x.slice(0, 4)}-Q${Math.floor((Number(x.slice(5, 7)) - 1) / 3) + 1}` : null; };

/** Score every carrier. */
export function scorecards(rows, cfg = {}) {
  const c = { ...D, ...cfg, weights: { ...D.weights, ...(cfg.weights || {}) }, targets: { ...D.targets, ...(cfg.targets || {}) } };
  // "Ridgeline Freight Inc.", "Ridgeline Freight" and plain "Ridgeline" are one carrier, shown by the name used most.
  // Sister companies ("FedEx Freight", "FedEx Express") stay apart.
  const group = carrierGrouper(rows.map((r) => r.carrier));
  const by = groupBy(rows, (r) => group(r.carrier) || '(none)');
  const cards = [];
  for (const [, list] of by) {
    const counts = new Map(); for (const r of list) { const n = str(r.carrier) || '(none)'; counts.set(n, (counts.get(n) || 0) + 1); }
    const carrier = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    const tendered = list.map((r) => accepted(r.tender)).filter((x) => x !== null);
    const loads = list.filter((r) => accepted(r.tender) !== false);
    const otd = loads.map((r) => onTime(r.delivery_planned, r.delivery_actual, c.grace_minutes)).filter((x) => x !== null);
    const otp = loads.map((r) => onTime(r.pickup_planned, r.pickup_actual, c.grace_minutes)).filter((x) => x !== null);
    const billed = loads.filter((r) => num(r.billed_amount) !== null && num(r.expected_amount));
    const accurate = billed.filter((r) => Math.abs(num(r.billed_amount) - num(r.expected_amount)) <= (num(r.expected_amount) * c.billing_tolerance_pct) / 100 + 0.005);
    const overbilled = round2(billed.reduce((s, r) => s + Math.max(0, num(r.billed_amount) - num(r.expected_amount)), 0));
    const claims = loads.filter((r) => (num(r.claim_amount) || 0) > 0);
    const tracked = loads.filter((r) => str(r.tracking_updates) !== '').map((r) => { const n = num(r.tracking_updates); return n !== null ? n > 0 : readYesNo(r.tracking_updates) === true; });
    const costLoads = loads.filter((r) => num(r.billed_amount) !== null && (num(r.miles) || 0) > 0);
    const spend = round2(loads.reduce((s, r) => s + (num(r.billed_amount) || 0), 0));
    const lateLoads = loads.filter((r) => onTime(r.delivery_planned, r.delivery_actual, c.grace_minutes) === false).map((r) => str(r.shipment_id));
    const trend = [...groupBy(loads.filter((r) => onTime(r.delivery_planned, r.delivery_actual, c.grace_minutes) !== null), (r) => quarterOf(r.delivery_planned))].sort(([a], [b]) => (a < b ? -1 : 1)).map(([q, l]) => ({ quarter: q, loads: l.length, otd_pct: pct(l.filter((r) => onTime(r.delivery_planned, r.delivery_actual, c.grace_minutes)).length, l.length) }));
    cards.push({
      carrier, tendered: tendered.length, loads: loads.length, spend,
      otd_pct: pct(otd.filter(Boolean).length, otd.length), otp_pct: pct(otp.filter(Boolean).length, otp.length),
      acceptance_pct: pct(tendered.filter(Boolean).length, tendered.length),
      billing_accuracy_pct: pct(accurate.length, billed.length), overbilled,
      claim_free_pct: loads.length ? pct(loads.length - claims.length, loads.length) : null, claims: claims.length, claim_amount: round2(claims.reduce((s, r) => s + num(r.claim_amount), 0)),
      tracking_pct: pct(tracked.filter(Boolean).length, tracked.length),
      cost_per_mile: costLoads.length ? round2(costLoads.reduce((s, r) => s + num(r.billed_amount), 0) / costLoads.reduce((s, r) => s + num(r.miles), 0)) : null,
      late_loads: lateLoads, otd_trend: trend,
    });
  }
  const cheapest = Math.min(...cards.map((x) => x.cost_per_mile).filter((x) => x));
  for (const x of cards) {
    x.cost_score = x.cost_per_mile && Number.isFinite(cheapest) ? Math.round((cheapest / x.cost_per_mile) * 1000) / 10 : null;
    const used = METRICS.filter((m) => x[m] !== null && c.weights[m] > 0);
    const wsum = used.reduce((s, m) => s + c.weights[m], 0);
    x.score = wsum ? Math.round((used.reduce((s, m) => s + x[m] * c.weights[m], 0) / wsum) * 10) / 10 : null;
    x.score_based_on = used;
    x.below_target = Object.entries(c.targets).filter(([m, tg]) => x[m] !== null && x[m] < tg).map(([m, tg]) => ({ metric: m, label: LABEL[m], value: x[m], target: tg }));
    x.ranked = x.loads >= c.min_loads;
    const worst = x.otd_trend.length >= 2 ? x.otd_trend.at(-1).otd_pct - x.otd_trend.at(-2).otd_pct : null;
    x.otd_change = worst === null ? null : Math.round(worst * 10) / 10;
  }
  const order = cards.filter((x) => x.ranked && x.score !== null).sort((a, b) => b.score - a.score || b.loads - a.loads || (a.carrier < b.carrier ? -1 : 1));
  order.forEach((x, i) => { x.rank = i + 1; });
  for (const x of cards) if (!x.rank) x.rank = null;
  cards.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.loads - a.loads || (a.carrier < b.carrier ? -1 : a.carrier > b.carrier ? 1 : 0));
  return { carriers: cards.length, ranked: order.length, loads: cards.reduce((s, x) => s + x.loads, 0), spend: round2(cards.reduce((s, x) => s + x.spend, 0)), weights: c.weights, targets: c.targets, min_loads: c.min_loads, cards };
}

/** Quarterly review note for one carrier. */
export function reviewText(card, total, { from, contact, period }) {
  const rows = METRICS.filter((m) => m !== 'cost_score' && card[m] !== null).map((m) => { const tg = total.targets[m]; return `| ${LABEL[m]} | ${card[m]}% | ${tg}% | ${card[m] >= tg ? 'met' : 'below'} |`; });
  return [
    `# Carrier review: ${card.carrier}${period ? `, ${period}` : ''}`, '',
    `**To:** ${contact || `[TO CONFIRM ${card.carrier} account manager]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `Over this period you moved ${card.loads} load(s) for us${card.spend ? ` (${card.spend} billed)` : ''}. ${card.rank ? `Your overall score is ${card.score} of 100, rank ${card.rank} of ${total.ranked} carriers we scored.` : `With fewer than ${total.min_loads} loads you are not ranked this period.`}`, '',
    '| Measure | Result | Our target | |', '| --- | --- | --- | --- |', ...rows, '',
    card.below_target.length ? `Where we need to see improvement: ${card.below_target.map((b) => `${b.label.toLowerCase()} (${b.value}% against ${b.target}%)`).join('; ')}.` : 'You met every target we track. Thank you.',
    ...(card.otd_trend.length > 1 ? ['', `On-time delivery by quarter: ${card.otd_trend.map((q) => `${q.quarter} ${q.otd_pct}% (${q.loads} load(s))`).join(', ')}.`] : []),
    ...(card.late_loads.length ? ['', `Late deliveries: ${card.late_loads.join(', ')}.`] : []),
    ...(card.overbilled ? ['', `Invoices above the agreed amount came to ${card.overbilled} this period.`] : []),
    '', 'Can we review these numbers together on [TO CONFIRM meeting date]? Please bring your own data if it differs from ours.',
  ].join('\n');
}
