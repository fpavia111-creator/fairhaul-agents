// Alcor: proof of delivery matched to shipments and invoices. Pure functions.
import { isoDate, daysBetween, canonicalCarrier, readYesNo, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const LOAD_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'Load Number', 'Order', 'BOL'], { required: true }),
  pro: t(['PRO', 'PRO Number', 'Pro #', 'Tracking Number']),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC'], { required: true }),
  delivery_date: t(['Delivery Date', 'Delivered', 'Actual Delivery'], { type: 'date' }),
  pieces: t(['Pieces', 'Handling Units', 'Pallets', 'Cartons', 'Qty'], { type: 'number' }),
  invoice_number: t(['Invoice Number', 'Invoice', 'Invoice #']),
  invoice_amount: t(['Invoice Amount', 'Amount', 'Billed'], { type: 'money' }),
  invoice_delivery_date: t(['Invoice Delivery Date', 'Billed Delivery Date'], { type: 'date' }),
  pod_required: t(['POD Required', 'Customer Requires POD'], { type: 'bool' }),
});
export const POD_FIELDS = Object.freeze({
  pro: t(['PRO', 'PRO Number', 'Pro #', 'Tracking Number']),
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL', 'Reference']),
  received_on: t(['Received On', 'Received', 'Uploaded', 'Document Date'], { type: 'date' }),
  pod_delivery_date: t(['POD Delivery Date', 'Delivery Date', 'Date Signed', 'Signed On'], { type: 'date' }),
  signed_by: t(['Signed By', 'Signature', 'Receiver', 'Consignee Signature']),
  pieces_delivered: t(['Pieces Delivered', 'Pieces', 'Qty Delivered', 'Count'], { type: 'number' }),
  exceptions: t(['Exceptions', 'Exception Notes', 'Notation', 'OS&D', 'Remarks']),
  document: t(['Document', 'File', 'File Name', 'Image']),
});
const CLEAN = /^(none|n\/?a|no|clean|ok|good|-|0)?$/i;

/** Match PODs to loads and decide what each load needs. */
export function matchPods(loads, pods, { asOf, chaseAfterDays = 3 } = {}) {
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const idx = new Map(); for (const p of pods) for (const k of [p.pro, p.shipment_id]) if (str(k)) { const key = str(k).toLowerCase(); if (!idx.has(key)) idx.set(key, []); idx.get(key).push(p); }
  const items = loads.map((l) => {
    const delivered = isoDate(l.delivery_date) || isoDate(l.invoice_delivery_date);
    const found = [...new Set([l.pro, l.shipment_id].filter((k) => str(k)).flatMap((k) => idx.get(str(k).toLowerCase()) || []))];
    const p = found.sort((a, b) => (str(b.received_on) > str(a.received_on) ? 1 : -1))[0] || null;
    const issues = [];
    const invoiced = !!str(l.invoice_number);
    if (!p) {
      const age = delivered ? daysBetween(delivered, today) : null;
      if (delivered || invoiced) issues.push({ code: 'missing_pod', detail: `No POD on file${age !== null ? `, ${age} day(s) after delivery` : ''}.${readYesNo(l.pod_required) ? ' Your customer requires a POD, so billing them waits on it.' : ''}` });
    } else {
      if (!str(p.signed_by) || /unsigned|no signature|^none$/i.test(str(p.signed_by))) issues.push({ code: 'unsigned', detail: 'The POD has no receiver signature or printed name.' });
      const pd = isoDate(p.pod_delivery_date), inv = isoDate(l.invoice_delivery_date) || isoDate(l.delivery_date);
      if (pd && inv && pd !== inv) issues.push({ code: 'date_mismatch', detail: `The POD shows delivery on ${pd}; the ${isoDate(l.invoice_delivery_date) ? 'invoice' : 'shipment'} says ${inv}. Matters for on-time and detention.` });
      const want = num(l.pieces), got = num(p.pieces_delivered);
      if (want !== null && got !== null && got < want) issues.push({ code: 'short', detail: `POD shows ${got} of ${want} piece(s) delivered. Possible shortage claim (Capella of Claims).` });
      if (str(p.exceptions) && !CLEAN.test(str(p.exceptions))) issues.push({ code: 'exception_noted', detail: `The receiver noted: "${str(p.exceptions)}". Possible claim (Capella of Claims).` });
    }
    const age = delivered ? daysBetween(delivered, today) : null;
    const status = !issues.length ? 'ok' : issues.some((i) => i.code === 'missing_pod') ? (age !== null && age < chaseAfterDays ? 'waiting' : 'chase') : issues.some((i) => ['short', 'exception_noted'].includes(i.code)) ? 'claim_review' : 'fix';
    const hold = invoiced && ['chase', 'waiting', 'claim_review', 'fix'].includes(status) && issues.some((i) => ['missing_pod', 'unsigned', 'short', 'exception_noted'].includes(i.code));
    return { shipment_id: str(l.shipment_id), pro: str(l.pro) || null, carrier: canonicalCarrier({}, l.carrier), delivered, age_days: age, invoice_number: str(l.invoice_number) || null, invoice_amount: num(l.invoice_amount), pod_required: readYesNo(l.pod_required), pod_document: p ? str(p.document) || '(on file)' : null, pod_received: p ? isoDate(p.received_on) : null, status, hold_invoice: hold, issues };
  });
  const carriers = [...groupBy(items, (i) => i.carrier)].map(([carrier, l]) => { const due = l.filter((i) => i.status !== 'waiting' && (i.delivered || i.invoice_number)); const lag = l.filter((i) => i.pod_received && i.delivered).map((i) => daysBetween(i.delivered, i.pod_received)); return { carrier, loads: l.length, with_pod: l.filter((i) => i.pod_document).length, pod_pct: due.length ? Math.round((due.filter((i) => i.pod_document).length / due.length) * 1000) / 10 : null, clean_pct: due.length ? Math.round((due.filter((i) => i.status === 'ok').length / due.length) * 1000) / 10 : null, avg_days_to_pod: lag.length ? Math.round((lag.reduce((a, b) => a + b, 0) / lag.length) * 10) / 10 : null, missing: l.filter((i) => i.status === 'chase').length }; }).sort((a, b) => (a.pod_pct ?? 101) - (b.pod_pct ?? 101));
  const held = items.filter((i) => i.hold_invoice);
  const count = (s) => items.filter((i) => i.status === s).length;
  return { as_of: today, loads: items.length, ok: count('ok'), chase: count('chase'), waiting: count('waiting'), claim_review: count('claim_review'), fix: count('fix'), invoices_to_hold: held.length, held_amount: round2(held.reduce((s, i) => s + (i.invoice_amount || 0), 0)), carriers, items };
}

export function requestText(items, { from, contact }) {
  const list = items.filter((i) => i.status === 'chase' || (i.status === 'fix' && i.issues.some((x) => x.code === 'unsigned')));
  return [
    `# Proof of delivery request: ${list[0].carrier}`, '',
    `**To:** ${contact || `[TO CONFIRM ${list[0].carrier} POD or billing contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `Please send a signed proof of delivery for the ${list.length} shipment(s) below. ${list.some((i) => i.invoice_number) ? 'We hold the matching invoices until we receive them.' : ''}`, '',
    '| Shipment | PRO | Delivered | Invoice | What we need |', '| --- | --- | --- | --- | --- |',
    ...list.map((i) => `| ${i.shipment_id} | ${i.pro || ''} | ${i.delivered || ''} | ${i.invoice_number || ''} | ${i.issues.map((x) => (x.code === 'missing_pod' ? 'Signed POD' : x.code === 'unsigned' ? 'POD with receiver signature and printed name' : x.detail)).join('; ')} |`),
  ].join('\n');
}
