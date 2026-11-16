// Arcturus: X12 transport files read, converted and reconciled. Pure functions.
import { readX12, round2, str, carrierKey, groupBy } from 'lodestar-core';

/** Read several EDI texts ({ name, text }) into one bundle of records with per-file problems. */
export function readAll(files) {
  const out = { files: [], records: [] };
  for (const f of files) {
    let r;
    try { r = readX12(f.text); } catch (e) { out.files.push({ file: f.name, ok: false, error: String(e.message || e), problems: [] }); continue; }
    const sets = {}; for (const x of r.records) sets[x.set] = (sets[x.set] || 0) + 1;
    out.files.push({ file: f.name, ok: r.problems.length === 0, interchanges: r.interchanges, transaction_count: r.transaction_count, sets, skipped_sets: r.skipped_sets, delimiters: r.delimiters, problems: r.problems });
    for (const x of r.records) out.records.push({ ...x, file: f.name });
  }
  return out;
}

/** Flat tables per transaction set, for CSV. */
export function tables(records) {
  const pick = (s) => records.filter((r) => r.set === s);
  return {
    tenders: pick('204').map((r) => ({ file: r.file, control: r.control, scac: r.scac, shipment_id: r.shipment_id, purpose: r.purpose, stops: r.stops.length, pickup_at: (r.stops[0] && r.stops[0].dates[0] && r.stops[0].dates[0].at) || '', delivery_at: (r.stops.at(-1) && r.stops.at(-1).dates[0] && r.stops.at(-1).dates[0].at) || '', destination: r.stops.at(-1) && r.stops.at(-1).party ? `${r.stops.at(-1).party.city || ''} ${r.stops.at(-1).party.state || ''}`.trim() : '', weight: r.weight, amount: r.amount })),
    invoices: pick('210').map((r) => ({ file: r.file, control: r.control, invoice_number: r.invoice_number, scac: r.scac, pro: r.shipment_id, shipment_ref: r.references.BM || r.references.SI || '', invoice_date: r.invoice_date, delivery_date: r.delivery_date, amount: r.amount, charge_lines: r.charges.length, lines_total: round2(r.charges.reduce((s, c) => s + (c.amount || 0), 0)), origin: r.origin ? `${r.origin.city} ${r.origin.state} ${r.origin.postal}` : '', destination: r.destination ? `${r.destination.city} ${r.destination.state} ${r.destination.postal}` : '' })),
    invoice_lines: pick('210').flatMap((r) => r.charges.map((c) => ({ invoice_number: r.invoice_number, scac: r.scac, line: c.line, code: c.code, rate: c.rate, rate_qualifier: c.rate_qualifier, amount: c.amount }))),
    status_events: pick('214').flatMap((r) => r.events.map((e) => ({ file: r.file, pro: r.pro, shipment_id: r.shipment_id, scac: r.scac, stop: e.stop, status_code: e.status_code, status: e.status, reason_code: e.reason_code, at: e.at, time_zone: e.time_zone, city: e.place && e.place.city, state: e.place && e.place.state }))),
    responses: pick('990').map((r) => ({ file: r.file, scac: r.scac, shipment_id: r.shipment_id, date: r.date, action_code: r.action_code, action: r.action })),
    acknowledgements: records.filter((r) => r.set === '997' || r.set === '999').flatMap((r) => (r.sets.length ? r.sets : [{}]).map((s) => ({ file: r.file, acknowledges_group: r.acknowledges_group, functional: r.functional, group_status: r.group_status, set: s.set || '', control: s.control || '', set_status: s.status || '' }))),
  };
}

/**
 * Reconcile: invoices against tenders (amount, carrier), tenders against
 * responses (accepted by whom), invoiced loads against delivery status, and
 * transactions the partner rejected in a 997/999.
 */
export function reconcile(records, { tolerance = 1 } = {}) {
  const t = tables(records);
  // 204 purpose 01 cancels the tender; 04 (change) replaces it. Files are read in order.
  const tenders = new Map();
  for (const x of t.tenders) { const k = str(x.shipment_id).toLowerCase(); if (x.purpose === '01') { const prev = tenders.get(k); tenders.set(k, { ...(prev || x), cancelled: true }); } else tenders.set(k, { ...x, cancelled: false }); }
  const responses = groupBy(t.responses, (x) => str(x.shipment_id).toLowerCase());
  const events = groupBy(t.status_events, (x) => str(x.shipment_id || x.pro).toLowerCase());
  const eventsByPro = groupBy(t.status_events, (x) => str(x.pro).toLowerCase());
  const findings = [];
  const add = (code, ref, detail, amount = null) => findings.push({ code, ref, detail, amount: amount === null ? null : round2(amount) });
  for (const inv of t.invoices) {
    const sid = str(inv.shipment_ref).toLowerCase();
    const tender = tenders.get(sid);
    if (!tender) { add('invoice_without_tender', inv.invoice_number, `Invoice ${inv.invoice_number} names shipment "${inv.shipment_ref || '(none)'}", which no 204 tender in these files covers.`, inv.amount); continue; }
    if (tender.cancelled) { add('invoice_on_cancelled_tender', inv.invoice_number, `Invoice ${inv.invoice_number} is for ${tender.shipment_id}, whose tender was cancelled (204 purpose 01). Ask whether the truck moved or a cancellation fee applies before paying.`, inv.amount); continue; }
    const accepted = (responses.get(sid) || []).filter((r) => r.action === 'accepted').map((r) => r.scac);
    if (accepted.length && !accepted.some((s) => carrierKey(s) === carrierKey(inv.scac))) add('invoice_from_other_carrier', inv.invoice_number, `Invoice ${inv.invoice_number} is from ${inv.scac}, but the 990 shows ${accepted.join(', ')} accepted ${tender.shipment_id}.`, inv.amount);
    if (tender.amount !== null && inv.amount !== null && inv.amount - tender.amount > tolerance) add('invoice_over_tender', inv.invoice_number, `Invoice ${inv.invoice_number} is ${inv.amount}; the tender for ${tender.shipment_id} said ${tender.amount} (+${round2(inv.amount - tender.amount)}). Check the charge lines for added accessorials or fuel.`, inv.amount - tender.amount);
    if (inv.amount !== null && Math.abs(inv.amount - inv.lines_total) > 0.005 && inv.charge_lines) add('invoice_lines_mismatch', inv.invoice_number, `Charge lines on ${inv.invoice_number} add up to ${inv.lines_total}; B3 says ${inv.amount}.`);
    const ev = [...(events.get(sid) || []), ...(eventsByPro.get(str(inv.pro).toLowerCase()) || [])];
    if (!ev.some((e) => ['completed_unloading', 'departed_delivery', 'arrived_delivery'].includes(e.status))) add('invoiced_without_delivery_status', inv.invoice_number, `No 214 delivery event for ${tender.shipment_id} / ${inv.pro}. Ask for proof of delivery before paying.`);
  }
  for (const [sid, list] of responses) {
    if (!tenders.has(sid)) add('response_without_tender', list[0].shipment_id, `990 response for ${list[0].shipment_id}, which is not in these 204 files.`);
    if (list.length && list.every((r) => r.action === 'declined')) add('tender_declined', list[0].shipment_id, `Every carrier declined ${list[0].shipment_id}. It still needs a carrier.`);
  }
  for (const [sid, tender] of tenders) if (!tender.cancelled && !responses.has(sid)) add('tender_no_response', tender.shipment_id, `No 990 for tender ${tender.shipment_id}.`);
  for (const a of t.acknowledgements) if (a.set_status && a.set_status !== 'A') add('rejected_by_partner', `${a.set} ${a.control}`, `The partner's ${a.functional ? `${a.functional} ` : ''}acknowledgement for group ${a.acknowledges_group} marks ${a.set} control ${a.control} as ${a.set_status === 'R' ? 'rejected' : a.set_status === 'E' ? 'accepted with errors' : a.set_status}. Fix and resend through your EDI provider.`);
  const byCode = {}; for (const f of findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  return { tenders: t.tenders.length, invoices: t.invoices.length, status_events: t.status_events.length, responses: t.responses.length, findings, by_finding: byCode };
}

/** Tender acceptance per carrier from 990s. */
export function tenderStats(records) {
  const t = tables(records);
  const out = [];
  for (const [scac, list] of groupBy(t.responses, (r) => r.scac)) {
    const acc = list.filter((r) => r.action === 'accepted').length, dec = list.filter((r) => r.action === 'declined').length;
    out.push({ scac, responses: list.length, accepted: acc, declined: dec, acceptance_pct: list.length ? Math.round((acc / list.length) * 100) : null });
  }
  return out.sort((a, b) => (a.acceptance_pct ?? 0) - (b.acceptance_pct ?? 0));
}
