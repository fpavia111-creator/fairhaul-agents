// Mira: open loads against their tracking events. Pure functions.
import { hoursBetween, isoDate, canonicalCarrier, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const OPEN_LOAD_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'Load Number', 'Order'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC'], { required: true }),
  customer: t(['Customer', 'Consignee', 'Ship To', 'Customer Name']),
  pickup_appt: t(['Pickup Appointment', 'Pickup Appt', 'Scheduled Pickup', 'Pickup Planned'], { type: 'datetime' }),
  delivery_appt: t(['Delivery Appointment', 'Delivery Appt', 'Scheduled Delivery', 'Delivery Planned', 'Due'], { type: 'datetime' }),
  status: t(['Status', 'Load Status']),
  destination: t(['Destination', 'Dest', 'Ship To City', 'Delivery City']),
});
export const EVENT_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'Load Number', 'Reference'], { required: true }),
  at: t(['Event Time', 'Time', 'Timestamp', 'Date Time', 'Status Time'], { type: 'datetime', required: true }),
  event: t(['Event', 'Status', 'Status Code', 'Description']),
  location: t(['Location', 'City', 'Place']),
  eta: t(['ETA', 'Estimated Arrival', 'Estimated Delivery'], { type: 'datetime' }),
});
const kind = (e) => { const s = str(e).toLowerCase(); return /deliver(ed|y complete)|^d1$|pod/.test(s) ? 'delivered' : /picked|pickup complete|departed (pickup|shipper)|^af$/.test(s) ? 'picked_up' : /arriv/.test(s) ? 'arrived' : /delay|breakdown|weather|reschedul/.test(s) ? 'delay' : 'update'; };

/** Assess open loads as of a date and time. */
export function assess(loads, events, { asOf, staleHours = 4, riskMinutes = 0 } = {}) {
  const now = str(asOf) || new Date().toISOString().slice(0, 16);
  const ev = groupBy(events, (e) => str(e.shipment_id).toLowerCase());
  const items = [];
  for (const l of loads) {
    if (/deliver|cancel|closed/i.test(str(l.status))) continue;
    const list = [...(ev.get(str(l.shipment_id).toLowerCase()) || [])].filter((e) => str(e.at)).sort((a, b) => (str(a.at) < str(b.at) ? -1 : 1));
    const last = list.at(-1) || null; const kinds = list.map((e) => kind(e.event));
    const pickedUp = kinds.includes('picked_up') || kinds.includes('delivered') || kinds.some((k, i) => k === 'update' && i > 0);
    const delivered = kinds.includes('delivered');
    if (delivered) { items.push({ shipment_id: str(l.shipment_id), carrier: canonicalCarrier({}, l.carrier), customer: str(l.customer) || null, status: 'delivered_not_closed', severity: 3, detail: 'Tracking shows delivered; close it in the TMS and collect the POD.', last_event: last && str(last.event), last_at: last && str(last.at), hours_since_update: last ? hoursBetween(last.at, now) : null, eta: null, delivery_appt: str(l.delivery_appt) || null }); continue; }
    const etaEv = [...list].reverse().find((e) => str(e.eta)); const eta = etaEv ? str(etaEv.eta) : null;
    const since = last ? hoursBetween(last.at, now) : null;
    const pu = str(l.pickup_appt), da = str(l.delivery_appt);
    const issues = [];
    if (pu && hoursBetween(pu, now) > 2 && !pickedUp) issues.push({ code: 'missed_pickup', sev: 0, detail: `Pickup was due ${pu}; no pickup event ${round2(hoursBetween(pu, now))} hour(s) later.` });
    if (!last && pu && hoursBetween(pu, now) > 0) issues.push({ code: 'no_tracking', sev: 1, detail: 'No tracking events at all since the pickup time.' });
    if (last && pickedUp && since > staleHours) issues.push({ code: 'stale', sev: 1, detail: `Last update ${since} hour(s) ago (${str(last.event)}${last.location ? `, ${str(last.location)}` : ''}).` });
    if (da && eta && hoursBetween(da, eta) * 60 > riskMinutes) issues.push({ code: 'eta_past_appointment', sev: 0, detail: `ETA ${eta} is ${round2(hoursBetween(da, eta))} hour(s) after the ${da} appointment.` });
    if (da && hoursBetween(da, now) > 0) issues.push({ code: 'past_appointment', sev: 0, detail: `The delivery appointment ${da} has passed with no delivery event.` });
    if (kinds.includes('delay')) issues.push({ code: 'delay_reported', sev: 1, detail: `Carrier reported: ${str(list[kinds.lastIndexOf('delay')].event)}.` });
    const status = issues.some((i) => i.code === 'past_appointment' || i.code === 'missed_pickup') ? 'late' : issues.some((i) => i.code === 'eta_past_appointment' || i.code === 'delay_reported') ? 'at_risk' : issues.length ? 'blind' : 'on_track';
    items.push({ shipment_id: str(l.shipment_id), carrier: canonicalCarrier({}, l.carrier), customer: str(l.customer) || null, destination: str(l.destination) || null, status, severity: { late: 0, at_risk: 1, blind: 2, on_track: 4 }[status], detail: issues.map((i) => i.detail).join(' ') || 'On track.', issues: issues.map((i) => i.code), last_event: last ? str(last.event) : null, last_at: last ? str(last.at) : null, hours_since_update: since, eta, delivery_appt: da || null, pickup_appt: pu || null });
  }
  items.sort((a, b) => a.severity - b.severity || (b.hours_since_update ?? 1e9) - (a.hours_since_update ?? 1e9));
  const carriers = [...groupBy(items, (i) => i.carrier)].map(([carrier, l]) => ({ carrier, open: l.length, late: l.filter((i) => i.status === 'late').length, at_risk: l.filter((i) => i.status === 'at_risk').length, blind: l.filter((i) => i.status === 'blind').length, tracking_ok_pct: Math.round((l.filter((i) => !(i.issues || []).some((c) => c === 'stale' || c === 'no_tracking')).length / l.length) * 1000) / 10 })).sort((a, b) => a.tracking_ok_pct - b.tracking_ok_pct);
  const c = (s) => items.filter((i) => i.status === s).length;
  return { as_of: now, open: items.length, late: c('late'), at_risk: c('at_risk'), blind: c('blind'), on_track: c('on_track'), delivered_not_closed: c('delivered_not_closed'), carriers, items };
}

export function noticeText(items, { customer, from, contact }) {
  return [
    `# Delivery update for ${customer}`, '',
    `**To:** ${contact || `[TO CONFIRM ${customer} contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `${items.length} of your shipment(s) may arrive later than planned. Here is what we know now.`, '',
    '| Shipment | Due | Latest estimate | Latest news |', '| --- | --- | --- | --- |',
    ...items.map((i) => `| ${i.shipment_id} | ${i.delivery_appt || ''} | ${i.eta || '[TO CONFIRM new estimate with the carrier]'} | ${i.last_event || 'No update yet'}${i.last_at ? ` (${i.last_at})` : ''} |`), '',
    'We will update you again by [TO CONFIRM time of next update].',
  ].join('\n');
}
