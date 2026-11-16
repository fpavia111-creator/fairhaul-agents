// Altair: freight RFP bid analysis and award scenarios. Pure functions.
import { canonicalCarrier, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const LANE_FIELDS = Object.freeze({
  lane_id: t(['Lane ID', 'Lane', 'Lane Number'], { required: true }),
  origin: t(['Origin', 'Origin City', 'From']),
  destination: t(['Destination', 'Destination City', 'To']),
  annual_loads: t(['Annual Loads', 'Volume', 'Loads per Year', 'Annual Volume'], { type: 'number', required: true }),
  incumbent: t(['Incumbent', 'Current Carrier', 'Incumbent Carrier']),
  incumbent_rate: t(['Incumbent Rate', 'Current Rate', 'Baseline Rate'], { type: 'money' }),
  equipment: t(['Equipment', 'Mode', 'Trailer']),
});
export const BID_FIELDS = Object.freeze({
  lane_id: t(['Lane ID', 'Lane', 'Lane Number'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'Bidder', 'SCAC'], { required: true }),
  rate: t(['Rate', 'Bid Rate', 'All In Rate', 'Linehaul', 'Bid'], { type: 'money', required: true }),
  capacity: t(['Capacity', 'Annual Capacity', 'Loads Committed', 'Max Loads'], { type: 'number' }),
  notes: t(['Notes', 'Comments', 'Conditions']),
});
export const AWARD_RULES_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string' },
    max_share_pct: { type: 'number', minimum: 1, maximum: 100, description: 'No carrier gets more than this share of all annual loads (default 100)' },
    prefer_incumbent_pct: { type: 'number', minimum: 0, maximum: 50, description: 'Keep the incumbent when its bid is within this percent of the best bid (default 0)' },
    backup: { type: 'boolean', description: 'Name a backup carrier for each lane (default true)' },
    exclude: { type: 'array', items: { type: 'string' }, description: 'Carriers not to award' },
    outlier_pct: { type: 'number', minimum: 5, maximum: 90, description: 'A bid this percent below the lane median is flagged as a possible error (default 25)' },
  },
});

/** Score bids and build one award scenario. */
export function award(lanes, bids, rules = {}) {
  const r = { max_share_pct: 100, prefer_incumbent_pct: 0, backup: true, exclude: [], outlier_pct: 25, ...rules };
  const excl = new Set(r.exclude.map((x) => canonicalCarrier({}, x).toLowerCase()));
  const totalLoads = lanes.reduce((s, l) => s + (num(l.annual_loads) || 0), 0); const cap = (r.max_share_pct / 100) * totalLoads;
  const given = new Map();
  const byLane = groupBy(bids, (b) => str(b.lane_id).toLowerCase());
  const prepared = lanes.map((l) => {
    const loads = num(l.annual_loads) || 0; const inc = l.incumbent ? canonicalCarrier({}, l.incumbent) : null; const incRate = num(l.incumbent_rate);
    const list = (byLane.get(str(l.lane_id).toLowerCase()) || []).map((b) => ({ carrier: canonicalCarrier({}, b.carrier), rate: num(b.rate), capacity: num(b.capacity), notes: str(b.notes) })).filter((b) => b.rate !== null && b.rate > 0).sort((a, b) => a.rate - b.rate);
    const rates = list.map((b) => b.rate); const median = rates.length ? rates[Math.floor((rates.length - 1) / 2)] : null;
    for (const b of list) b.outlier = median !== null && list.length >= 3 && b.rate < median * (1 - r.outlier_pct / 100);
    return { lane: l, loads, inc, incRate, list, median, savingsPotential: incRate && list.length ? (incRate - list[0].rate) * loads : 0 };
  }).sort((a, b) => b.savingsPotential - a.savingsPotential);
  const results = prepared.map(({ lane, loads, inc, incRate, list, median }) => {
    const eligible = list.filter((b) => !excl.has(b.carrier.toLowerCase()) && !b.outlier);
    const notes = list.filter((b) => b.outlier).map((b) => `${b.carrier} bid ${b.rate}, far below the lane median ${median}; confirm it is not an error before awarding.`);
    const best = eligible[0] || null;
    let order = eligible;
    if (best && inc && r.prefer_incumbent_pct > 0) { const ib = eligible.find((b) => b.carrier === inc); if (ib && ib.rate <= best.rate * (1 + r.prefer_incumbent_pct / 100)) { order = [ib, ...eligible.filter((b) => b !== ib)]; if (ib !== best) notes.push(`Incumbent ${inc} kept: ${ib.rate} is within ${r.prefer_incumbent_pct}% of the best bid ${best.rate}.`); } }
    let left = loads; const splits = [];
    for (const b of order) {
      if (left <= 0) break;
      const room = Math.max(0, cap - (given.get(b.carrier) || 0)); const take = Math.min(left, b.capacity ?? left, room);
      if (take <= 0) { if (room <= 0) notes.push(`${b.carrier} skipped: at the ${r.max_share_pct}% share cap.`); continue; }
      splits.push({ carrier: b.carrier, loads: take, rate: b.rate, cost: round2(take * b.rate) }); given.set(b.carrier, (given.get(b.carrier) || 0) + take); left -= take;
    }
    const awarded = splits.length ? splits : [];
    const backup = r.backup ? (order.find((b) => !awarded.some((s) => s.carrier === b.carrier)) || null) : null;
    const cost = round2(awarded.reduce((s, x) => s + x.cost, 0)); const covered = loads - left;
    const baseline = incRate ? round2(incRate * covered) : null;
    const status = !list.length ? 'no_bids' : !awarded.length ? 'not_awarded' : left > 0 ? 'partly_covered' : 'awarded';
    return { lane_id: str(lane.lane_id), lane: `${str(lane.origin)} → ${str(lane.destination)}`, annual_loads: loads, bids: list.length, best_rate: list[0] ? list[0].rate : null, median_rate: median, incumbent: inc, incumbent_rate: incRate, awards: awarded, backup: backup ? { carrier: backup.carrier, rate: backup.rate } : null, uncovered_loads: left, annual_cost: cost, baseline_cost: baseline, savings: baseline !== null ? round2(baseline - cost) : null, change_pct: baseline ? Math.round(((cost - baseline) / baseline) * 1000) / 10 : null, incumbent_kept: !!(inc && awarded.some((s) => s.carrier === inc)), status, notes };
  }).sort((a, b) => (a.lane_id < b.lane_id ? -1 : 1));
  const carriers = [...given].map(([carrier, loads]) => ({ carrier, lanes: results.filter((x) => x.awards.some((s) => s.carrier === carrier)).length, loads, share_pct: Math.round((loads / totalLoads) * 1000) / 10, spend: round2(results.reduce((s, x) => s + x.awards.filter((a) => a.carrier === carrier).reduce((y, a) => y + a.cost, 0), 0)) })).sort((a, b) => b.spend - a.spend);
  const base = results.filter((x) => x.baseline_cost !== null);
  return { lanes: results.length, annual_loads: totalLoads, awarded: results.filter((x) => x.status === 'awarded').length, partly_covered: results.filter((x) => x.status === 'partly_covered').length, no_bids: results.filter((x) => x.status === 'no_bids' || x.status === 'not_awarded').length, annual_cost: round2(results.reduce((s, x) => s + x.annual_cost, 0)), baseline_cost: round2(base.reduce((s, x) => s + x.baseline_cost, 0)), savings: round2(base.reduce((s, x) => s + x.savings, 0)), incumbents_kept: results.filter((x) => x.incumbent_kept).length, outlier_bids: results.reduce((s, x) => s + x.notes.filter((n) => /far below/.test(n)).length, 0), rules: r, carriers, results };
}

export function awardText(carrier, results, { from, contact, rfp, start }) {
  const mine = results.filter((x) => x.awards.some((a) => a.carrier === carrier)); const back = results.filter((x) => x.backup && x.backup.carrier === carrier);
  return [
    `# Award: ${rfp || 'freight RFP'}, ${carrier}`, '',
    `**To:** ${contact || `[TO CONFIRM ${carrier} pricing contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `Thank you for your bid. We are pleased to award you the lanes below${start ? ` from ${start}` : ' from [TO CONFIRM start date]'}, at the rates you bid. Volumes are estimates, not commitments.`, '',
    '| Lane | Route | Est. annual loads | Your rate |', '| --- | --- | --- | --- |',
    ...mine.map((x) => { const a = x.awards.find((y) => y.carrier === carrier); return `| ${x.lane_id} | ${x.lane} | ${a.loads} | ${a.rate} |`; }),
    ...(back.length ? ['', 'You are also our backup carrier on:', '', ...back.map((x) => `- ${x.lane_id} ${x.lane} at ${x.backup.rate}`)] : []), '',
    'Please confirm by [TO CONFIRM reply date]. Terms are as in our transportation agreement: [TO CONFIRM agreement reference].',
  ].join('\n');
}
