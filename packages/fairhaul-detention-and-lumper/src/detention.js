// Fairhaul Detention and Lumper: detention, layover and lumper charges checked against dock times.
import { chargeCode, hoursBetween, round2, str, num, groupBy, findCarrier } from 'fairhaul-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const CHARGE_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Load Number', 'Load #', 'Shipment ID', 'PRO', 'Order Number'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC']),
  stop: t(['Stop', 'Stop Number', 'Stop #', 'Stop Sequence']),
  charge_type: t(['Charge Type', 'Charge', 'Accessorial', 'Charge Description', 'Description'], { required: true }),
  amount: t(['Amount', 'Charge Amount', 'Billed Amount'], { type: 'money', required: true }),
  hours_billed: t(['Hours', 'Hours Billed', 'Billed Hours', 'Detention Hours'], { type: 'number' }),
  invoice_number: t(['Invoice Number', 'Invoice', 'Freight Bill']),
});
export const STOP_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Load Number', 'Load #', 'Shipment ID', 'PRO', 'Order Number'], { required: true }),
  stop: t(['Stop', 'Stop Number', 'Stop #', 'Stop Sequence']),
  facility: t(['Facility', 'Location', 'Site', 'Warehouse', 'DC', 'Customer']),
  appointment_at: t(['Appointment', 'Appointment Time', 'Appt', 'Scheduled'], { type: 'datetime' }),
  arrived_at: t(['Arrived', 'Arrived At', 'Check In', 'Checked In', 'Gate In', 'In Time'], { type: 'datetime' }),
  departed_at: t(['Departed', 'Departed At', 'Check Out', 'Checked Out', 'Gate Out', 'Out Time'], { type: 'datetime' }),
  lumper_receipt: t(['Lumper Receipt', 'Receipt Number', 'Receipt #', 'Lumper Receipt Number']),
  lumper_receipt_amount: t(['Receipt Amount', 'Lumper Receipt Amount', 'Lumper Paid'], { type: 'money' }),
});

const RULES = { type: 'object', additionalProperties: false, properties: {
  free_hours: { type: 'number', minimum: 0, maximum: 72, description: 'Free time per stop before detention starts, hours (default 2)' },
  rate_per_hour: { type: 'number', minimum: 0, description: 'Detention rate per hour after free time (default 50)' },
  bill_increment_minutes: { type: 'integer', minimum: 1, maximum: 60, description: 'Round chargeable time up to this many minutes (default 15)' },
  grace_minutes: { type: 'integer', minimum: 0, maximum: 240, description: 'A truck arriving later than appointment plus this many minutes earns no detention (default 15)' },
  max_per_stop: { type: 'number', minimum: 0 },
  layover_amount: { type: 'number', minimum: 0 },
  layover_min_hours: { type: 'number', minimum: 0, maximum: 72, description: 'Hours at a stop before a layover is earned (default 16)' },
  lumper_requires_receipt: { type: 'boolean' },
} };
export const DETENTION_TERMS_SCHEMA = Object.freeze({ ...RULES, properties: { ...RULES.properties, note: { type: 'string' }, tolerance: { type: 'number', minimum: 0 }, carriers: { type: 'object', additionalProperties: RULES } } });

const DEFAULTS = { free_hours: 2, rate_per_hour: 50, bill_increment_minutes: 15, grace_minutes: 15, max_per_stop: null, layover_amount: null, layover_min_hours: 16, lumper_requires_receipt: true };
export const termsFor = (terms, carrier) => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(terms || {}).filter(([k]) => k in DEFAULTS)), ...((terms && terms.carriers && terms.carriers[findCarrier(Object.keys(terms.carriers), carrier)]) || {}) });

const ms = (v) => { const s = str(v); if (!s) return NaN; return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s.replace(' ', 'T') : `${s.replace(' ', 'T')}Z`); };
const key = (load, stop) => `${str(load).toLowerCase()}|${str(stop) || '1'}`;

/** Detention a stop earns under the terms, with the reasoning. */
export function earned(stop, tm) {
  if (!stop || !str(stop.arrived_at) || !str(stop.departed_at)) return { hours: null, payable: null, reason: 'no arrival and departure times on file' };
  const arr = ms(stop.arrived_at), dep = ms(stop.departed_at), appt = ms(stop.appointment_at);
  if (!(dep > arr)) return { hours: null, payable: null, reason: 'departure is not after arrival' };
  if (Number.isFinite(appt) && arr > appt + tm.grace_minutes * 60000) return { hours: round2((dep - arr) / 3600000), payable: 0, late: true, reason: `truck arrived ${Math.round((arr - appt) / 60000)} min after the appointment (grace ${tm.grace_minutes} min), so the clock never started` };
  const start = Number.isFinite(appt) ? Math.max(arr, appt) : arr;
  const onSite = (dep - start) / 3600000;
  const inc = tm.bill_increment_minutes / 60;
  const chargeable = Math.max(0, Math.ceil(Math.max(0, onSite - tm.free_hours) / inc - 1e-9) * inc);
  let payable = round2(chargeable * tm.rate_per_hour);
  if (tm.max_per_stop !== null && tm.max_per_stop !== undefined) payable = Math.min(payable, tm.max_per_stop);
  return { hours: round2(onSite), chargeable_hours: round2(chargeable), payable, reason: `${round2(onSite)} h from ${Number.isFinite(appt) && appt > arr ? 'appointment' : 'arrival'} to departure, ${tm.free_hours} h free, ${round2(chargeable)} h at ${tm.rate_per_hour}` };
}

export function auditCharges(charges, stops, terms = {}) {
  const tol = num(terms.tolerance) ?? 1;
  const sIdx = new Map(stops.map((s) => [key(s.load_id, s.stop), s]));
  const byLoad = groupBy(stops, (s) => str(s.load_id).toLowerCase());
  const used = new Map(); // load|stop|type -> amount already allowed on an earlier line
  const items = [];
  for (const c of charges) {
    const code = chargeCode(c.charge_type);
    if (!['detention', 'layover', 'lumper'].includes(code)) continue;
    const carrier = str(c.carrier); const tm = termsFor(terms, carrier);
    // A charge that names no stop is checked against every stop of its load: only what no stop could earn is disputed.
    const named = str(c.stop) ? sIdx.get(key(c.load_id, c.stop)) : null;
    const cands = str(c.stop) ? (named ? [named] : []) : byLoad.get(str(c.load_id).toLowerCase()) || [];
    const stop = cands.length === 1 ? cands[0] : null;
    const many = cands.length > 1 ? ` across the load's ${cands.length} stops` : '';
    const billed = num(c.amount) || 0;
    const f = []; let allowed = null;
    if (code === 'detention') {
      const es = cands.map((s) => earned(s, tm)); const known = es.filter((e) => e.payable !== null);
      const e = known.length === 1 && es.length === 1 ? known[0] : null;
      if (!known.length) f.push({ code: 'no_timestamps', detail: `Detention billed ${billed} but ${es.length ? es[0].reason : 'no stop record for this load'}. Ask the carrier for in and out times.` });
      else if (e) {
        allowed = e.payable;
        if (e.late) f.push({ code: 'arrived_late', detail: `Detention billed ${billed}; the ${e.reason}.` });
        else if (billed - allowed > tol) f.push({ code: 'detention_over', detail: `Detention billed ${billed}; dock times give ${allowed} (${e.reason}).` });
        const hb = num(c.hours_billed); if (hb !== null && e.hours !== null && hb > e.hours + 0.25) f.push({ code: 'hours_over_record', detail: `${hb} h billed, but the truck was on site ${e.hours} h in total.` });
      } else {
        allowed = round2(known.reduce((a, x) => a + x.payable, 0));
        if (billed - allowed > tol) f.push({ code: 'detention_over', detail: `Detention billed ${billed}; dock times give ${allowed}${many} (${cands.map((s, i) => `stop ${str(s.stop) || i + 1}: ${es[i].payable === null ? 'no times' : es[i].payable}`).join(', ')}).` });
      }
    } else if (code === 'layover') {
      const hs = cands.map((s) => hoursBetween(s.arrived_at, s.departed_at)).filter((h) => h !== null);
      const h = hs.length ? Math.max(...hs) : null;
      if (h === null) f.push({ code: 'no_timestamps', detail: `Layover billed ${billed} with no dock times on file.` });
      else if (h < tm.layover_min_hours) { allowed = 0; f.push({ code: 'layover_not_earned', detail: `Layover billed ${billed}, but the truck was on site ${h} h${many ? ' at most' : ''} (layover starts at ${tm.layover_min_hours} h).` }); }
      else { allowed = tm.layover_amount ?? billed; if (billed - allowed > tol) f.push({ code: 'layover_over', detail: `Layover billed ${billed}, terms allow ${allowed}.` }); }
    } else {
      const withReceipt = cands.filter((s) => str(s.lumper_receipt));
      const amounts = withReceipt.map((s) => num(s.lumper_receipt_amount)).filter((x) => x !== null);
      if (!withReceipt.length && tm.lumper_requires_receipt) { allowed = 0; f.push({ code: 'lumper_no_receipt', detail: `Lumper billed ${billed} with no receipt on file. Ask for the receipt before paying.` }); }
      else if (amounts.length) { allowed = round2(amounts.reduce((a, x) => a + x, 0)); if (billed - allowed > tol) f.push({ code: 'lumper_over_receipt', detail: `Lumper billed ${billed}, the receipt${amounts.length > 1 ? 's say' : ' says'} ${allowed}.` }); }
      else allowed = billed;
    }
    // The same stop's detention, layover or lumper billed again (a second invoice, a rebill) gets only what is left.
    if (allowed !== null) {
      const uk = `${str(c.load_id).toLowerCase()}|${str(c.stop) || '*'}|${code}`;
      const before = used.get(uk) || 0;
      if (before > 0) { const left = round2(Math.max(0, allowed - before)); f.push({ code: 'already_billed', detail: `${before} of the ${allowed} this stop earns was already allowed on an earlier line${left ? `; ${left} is left` : ''}.` }); allowed = left; }
      used.set(uk, round2(before + Math.min(billed, allowed)));
    }
    const disputable = allowed === null ? 0 : round2(Math.max(0, billed - allowed));
    items.push({ load_id: str(c.load_id), stop: str(c.stop) || (stop && str(stop.stop)) || null, facility: stop ? str(stop.facility) : cands.length ? [...new Set(cands.map((s) => str(s.facility)).filter(Boolean))].join(', ') || null : null, carrier, invoice_number: str(c.invoice_number) || null, type: code, billed, allowed, disputable, status: disputable > tol ? 'dispute' : f.length ? (allowed === null ? 'review' : 'ok') : 'ok', findings: f });
  }
  const sum = (k, st) => round2(items.filter((i) => !st || i.status === st).reduce((s, i) => s + (i[k] || 0), 0));
  return { charges: items.length, billed: sum('billed'), disputable: sum('disputable'), dispute: items.filter((i) => i.status === 'dispute').length, review: items.filter((i) => i.status === 'review').length, ok: items.filter((i) => i.status === 'ok').length, items };
}

/** Dwell and detention cost by facility, worst first: where your own docks cost you money. */
export function facilities(stops, charges = [], terms = {}) {
  const cost = new Map();
  const sIdx = new Map(stops.map((s) => [key(s.load_id, s.stop), s])); const lIdx = new Map(); for (const s of stops) { const l = str(s.load_id).toLowerCase(); if (!lIdx.has(l)) lIdx.set(l, s); }
  for (const c of charges) { if (!['detention', 'layover'].includes(chargeCode(c.charge_type))) continue; const s = sIdx.get(key(c.load_id, c.stop)) || lIdx.get(str(c.load_id).toLowerCase()); const fac = s ? str(s.facility) || '(no facility)' : '(no stop record)'; cost.set(fac, round2((cost.get(fac) || 0) + (num(c.amount) || 0))); }
  const out = [];
  for (const [fac, list] of groupBy(stops, (s) => str(s.facility) || '(no facility)')) {
    const dw = list.map((s) => hoursBetween(s.arrived_at, s.departed_at)).filter((h) => h !== null && h >= 0);
    const tm = termsFor(terms, '');
    const over = dw.filter((h) => h > tm.free_hours).length;
    const lateIn = list.filter((s) => { const a = ms(s.arrived_at), p = ms(s.appointment_at); return Number.isFinite(a) && Number.isFinite(p) && a > p + tm.grace_minutes * 60000; }).length;
    out.push({ facility: fac, stops: list.length, avg_dwell_hours: dw.length ? round2(dw.reduce((a, b) => a + b, 0) / dw.length) : null, max_dwell_hours: dw.length ? Math.max(...dw) : null, over_free_time: over, over_free_time_pct: dw.length ? Math.round((over / dw.length) * 100) : null, carriers_late: lateIn, detention_billed: cost.get(fac) || 0 });
  }
  return out.sort((a, b) => b.detention_billed - a.detention_billed || (b.avg_dwell_hours || 0) - (a.avg_dwell_hours || 0));
}

export function disputeText(items, { carrier, from, contact }) {
  const rows = items.filter((i) => i.status === 'dispute');
  const total = round2(rows.reduce((s, i) => s + i.disputable, 0));
  return { total, loads: rows.map((i) => i.load_id), text: [
    `# Detention, layover and lumper dispute: ${carrier}`, '',
    `**To:** ${contact || '[TO CONFIRM carrier billing contact]'}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `We checked ${rows.length} charge(s) against our dock records and the agreed terms, and dispute ${total}.`, '',
    '| Load | Stop | Facility | Type | Billed | Allowed | Disputed | Reason |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.load_id} | ${i.stop || ''} | ${i.facility || ''} | ${i.type} | ${i.billed} | ${i.allowed} | ${i.disputable} | ${i.findings.map((f) => f.detail).join(' ')} |`),
    '', `**Total disputed:** ${total}`, '', 'Attached: [ATTACH gate or dock log extract for each stop]',
  ].join('\n') };
}
