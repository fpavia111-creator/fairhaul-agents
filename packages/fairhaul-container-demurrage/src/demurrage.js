// Fairhaul Container Demurrage: container demurrage and detention. Pure functions.
import { exportProfile, isoDate, addDays, daysBetween, round2, str, num, groupBy, findCarrier } from 'fairhaul-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const CONTAINER_FIELDS = Object.freeze({
  container: t(['Container', 'Container Number', 'Container No', 'Equipment'], { required: true }),
  line: t(['Line', 'Carrier', 'Steamship Line', 'Ocean Carrier', 'SCAC'], { required: true, translate: 'ocean_line' }),
  bl: t(['BL', 'B/L', 'Bill of Lading', 'MBL']),
  size: t(['Size', 'Type', 'Size Type', 'Equipment Type']),
  discharged: t(['Discharged', 'Discharge Date', 'Vessel Discharge', 'Unloaded'], { type: 'date', required: true }),
  last_free_day: t(['Last Free Day', 'LFD', 'Free Time Expires'], { type: 'date' }),
  gate_out: t(['Gate Out', 'Out Gate', 'Picked Up', 'Pickup Date'], { type: 'date' }),
  empty_returned: t(['Empty Returned', 'Empty Return', 'Returned', 'In Gate Empty'], { type: 'date' }),
});
export const DD_CHARGE_FIELDS = Object.freeze({
  container: t(['Container', 'Container Number', 'Equipment'], { required: true }),
  invoice_number: t(['Invoice Number', 'Invoice', 'Invoice #']),
  charge_type: t(['Charge Type', 'Type', 'Charge', 'Description'], { required: true }),
  days_billed: t(['Days Billed', 'Days', 'Chargeable Days'], { type: 'number' }),
  amount: t(['Amount', 'Charge Amount', 'Billed'], { type: 'money', required: true }),
});
const tiers = { type: 'array', minItems: 1, description: 'Per-day rates after free time, in order; the last tier has no days and runs on', items: { type: 'object', additionalProperties: false, required: ['rate'], properties: { days: { type: 'integer', minimum: 1 }, rate: { type: 'number', minimum: 0 } } } };
const clock = { type: 'object', additionalProperties: false, required: ['free_days', 'tiers'], properties: { free_days: { type: 'integer', minimum: 0, maximum: 60 }, business_days: { type: 'boolean', description: 'Count only Monday to Friday, skipping excluded dates (default calendar days)' }, tiers, tiers_by_size: { type: 'object', additionalProperties: tiers } } };
export const DD_TERMS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['lines'],
  properties: {
    note: { type: 'string' },
    start_offset_days: { type: 'integer', minimum: 0, maximum: 2, description: 'Free time starts this many days after discharge (default 1)' },
    warn_days: { type: 'integer', minimum: 0, maximum: 10, description: 'Flag containers this many days or fewer from the last free day (default 2)' },
    excluded_dates: { type: 'array', items: { type: 'string', format: 'date' }, description: 'Dates that do not count (terminal closed, holiday), as your tariff or agreement allows' },
    lines: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, properties: { demurrage: clock, detention: clock } } },
  },
});

const isWeekend = (d) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return w === 0 || w === 6; };
const counts = (d, c, excl) => !excl.has(d) && !(c.business_days && isWeekend(d));
/** Counted days from start to end inclusive. */
export function countDays(start, end, c = {}, excluded = []) { const ex = new Set(excluded); let n = 0; for (let d = start; d && d <= end; d = addDays(d, 1)) if (counts(d, c, ex)) n++; return n; }
/** The date the nth counted day falls on. */
export function nthDay(start, n, c = {}, excluded = []) { const ex = new Set(excluded); let k = 0; for (let d = start, i = 0; i < 400; d = addDays(d, 1), i++) if (counts(d, c, ex) && ++k === n) return d; return null; }
/** Price chargeable days through the tiers. */
export function tierCost(days, list) { let left = days, cost = 0; for (const tr of list) { if (left <= 0) break; const take = tr.days ? Math.min(tr.days, left) : left; cost += take * tr.rate; left -= take; } return round2(cost); }
const tiersFor = (c, size) => (c.tiers_by_size && size && c.tiers_by_size[String(size).toUpperCase().replace(/[^0-9A-Z]/g, '')]) || c.tiers;

/** Free time, days used and cost for each container, as of a date. */
export function clocks(rows, terms, { asOf } = {}) {
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const off = terms.start_offset_days ?? 1, warn = terms.warn_days ?? 2, ex = terms.excluded_dates || [];
  const lineTerms = (name) => { const k = findCarrier(Object.keys(terms.lines || {}), name); return k ? terms.lines[k] : null; };
  return rows.map((r) => {
    const lt = lineTerms(r.line); const disc = isoDate(r.discharged), out = isoDate(r.gate_out), ret = isoDate(r.empty_returned);
    const base = { container: str(r.container), line: str(r.line), bl: str(r.bl) || null, size: str(r.size) || null, discharged: disc, gate_out: out, empty_returned: ret };
    if (!lt) return { ...base, status: 'no_terms', detail: `No free time terms for ${str(r.line)}.` };
    const res = { ...base };
    if (lt.demurrage && disc) {
      const c = lt.demurrage; const start = addDays(disc, off); const lfd = nthDay(start, c.free_days, c, ex);
      const end = out || today; const used = end >= start ? countDays(start, end, c, ex) : 0; const charge = Math.max(0, used - c.free_days);
      const left = out ? null : (lfd ? (today <= lfd ? countDays(addDays(today, 1), lfd, c, ex) : 0) : null);
      Object.assign(res, { dem_lfd: lfd, dem_lfd_line: isoDate(r.last_free_day), dem_days: used, dem_charge_days: charge, dem_cost: tierCost(charge, tiersFor(c, r.size)), dem_days_left: left, dem_running: !out && charge > 0 });
      if (res.dem_lfd_line && lfd && res.dem_lfd_line < lfd) res.lfd_note = `The line shows last free day ${res.dem_lfd_line}; your terms give ${lfd}.`;
    }
    if (lt.detention && out) {
      const c = lt.detention; const end = ret || today; const used = countDays(out, end, c, ex); const charge = Math.max(0, used - c.free_days);
      Object.assign(res, { det_return_by: nthDay(out, c.free_days, c, ex), det_days: used, det_charge_days: charge, det_cost: tierCost(charge, tiersFor(c, r.size)), det_running: !ret && charge > 0, det_days_left: ret ? null : Math.max(0, c.free_days - used) });
    }
    const exposure = round2((res.dem_cost || 0) + (res.det_cost || 0));
    const status = ret ? 'closed' : (res.dem_running || res.det_running) ? 'accruing' : (!out && res.dem_days_left !== null && res.dem_days_left <= warn) || (out && res.det_days_left !== null && res.det_days_left <= warn) ? 'act_now' : 'in_free_time';
    const detail = status === 'accruing' ? `Charges running: ${res.dem_running ? `demurrage day ${res.dem_charge_days}` : `detention day ${res.det_charge_days}`}. ${out ? 'Return the empty.' : 'Pick it up.'}` : status === 'act_now' ? (out ? `Return the empty by ${res.det_return_by}.` : res.dem_lfd === today ? 'Today is the last free day at the port; pick it up today.' : `Pick up by ${res.dem_lfd} (${res.dem_days_left} more counted day(s) after today).`) : status === 'closed' ? 'Returned.' : out ? `Return by ${res.det_return_by}.` : `Free until ${res.dem_lfd}.`;
    return { ...res, exposure, status, detail };
  });
}

/** Check D&D invoices against the clocks. */
export function checkCharges(charges, items, { tolerance = 1 } = {}) {
  const byC = new Map(items.map((i) => [i.container.toUpperCase(), i]));
  // Several invoices for one container and charge type are checked together: the first ones
  // use up what the terms allow, and anything billed after that is over.
  const prior = new Map();
  return charges.map((c) => {
    const i = byC.get(str(c.container).toUpperCase()); const type = /det|per ?diem/i.test(str(c.charge_type)) ? 'detention' : 'demurrage'; const billed = num(c.amount) || 0;
    const base = { container: str(c.container), invoice_number: str(c.invoice_number) || null, type, days_billed: num(c.days_billed), billed };
    if (!i || i.status === 'no_terms') return { ...base, expected: null, difference: null, status: 'not_checked', detail: i ? i.detail : 'Container not in your container file.' };
    const exp = type === 'demurrage' ? i.dem_cost : i.det_cost; const days = type === 'demurrage' ? i.dem_charge_days : i.det_charge_days;
    if (exp === undefined) return { ...base, expected: null, difference: null, status: 'not_checked', detail: type === 'demurrage' ? 'No discharge date.' : 'No gate-out date.' };
    const pk = `${i.container.toUpperCase()}|${type}`; const before = prior.get(pk) || { amount: 0, invoices: [] }; prior.set(pk, { amount: round2(before.amount + billed), invoices: [...before.invoices, base.invoice_number || '?'] });
    const diff = round2(Math.max(0, before.amount + billed - exp) - Math.max(0, before.amount - exp)) || round2(Math.min(0, billed - exp));
    const earlier = before.amount ? ` Already billed ${before.amount} on ${before.invoices.join(', ')} for this container.` : '';
    return { ...base, expected: exp, expected_days: days, difference: diff, status: diff > tolerance ? 'over' : 'ok', detail: diff > tolerance ? `Billed ${billed}${base.days_billed !== null ? ` for ${base.days_billed} day(s)` : ''}; your terms give ${days} chargeable day(s), ${exp}.${earlier}${i.lfd_note ? ` ${i.lfd_note}` : ''}` : 'Matches your terms.' };
  });
}

export function summary(items, checks = []) {
  const s = (k) => items.filter((i) => i.status === k).length;
  const over = checks.filter((c) => c.status === 'over');
  return { containers: items.length, act_now: s('act_now'), accruing: s('accruing'), in_free_time: s('in_free_time'), closed: s('closed'), no_terms: s('no_terms'), exposure_open: round2(items.filter((i) => i.status !== 'closed').reduce((a, i) => a + (i.exposure || 0), 0)), charges_checked: checks.length, over: over.length, disputable: round2(over.reduce((a, c) => a + c.difference, 0)), by_line: [...groupBy(items, (i) => i.line)].map(([line, l]) => ({ line, containers: l.length, accruing: l.filter((i) => i.status === 'accruing').length, exposure: round2(l.reduce((a, i) => a + (i.exposure || 0), 0)) })) };
}

export function disputeText(list, items, { from, contact }) {
  const total = round2(list.reduce((s, c) => s + c.difference, 0)); const byC = new Map(items.map((i) => [i.container, i]));
  return { total, text: [
    `# Demurrage and detention dispute: ${byC.get(list[0].container).line}`, '',
    `**To:** ${contact || '[TO CONFIRM line D&D dispute contact]'}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `The charges below are above the free time and rates in our agreement. We ask for a credit of ${total}.`, '',
    '| Container | Invoice | Type | Discharged | Out | Returned | Billed | Per our terms | Over |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...list.map((c) => { const i = byC.get(c.container); return `| ${c.container} | ${c.invoice_number || ''} | ${c.type} | ${i.discharged || ''} | ${i.gate_out || ''} | ${i.empty_returned || ''} | ${c.billed} | ${c.expected} | ${c.difference} |`; }), '',
    ...list.map((c) => `- ${c.container}: ${c.detail}`), '',
    '[ATTACH terminal gate records and the agreement page with the free time]',
  ].join('\n') };
}

/** Generic container milestone export (exports.js). Written from knowledge; not checked against a platform's documentation or a live account. */
export const CONTAINER_PROFILES = Object.freeze([
  exportProfile('container_milestones', { container: 'Container Number', line: ['Carrier', 'Shipping Line', 'Ocean Carrier', 'Carrier SCAC'], bl: ['Master BL', 'MBL', 'Bill of Lading'], size: ['Container Type', 'Equipment Type', 'Size'], discharged: ['Discharge Date', 'Vessel Discharge'], last_free_day: ['Last Free Day', 'LFD'], gate_out: ['Out Gate', 'Gate Out Full', 'Gate Out'], empty_returned: ['Empty Return', 'Empty Returned', 'Gate In Empty'] }),
]);
