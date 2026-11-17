// Capella: loss, shortage and damage claims. Pure functions.
import { readYesNo, isoDate, addDays, daysBetween, round2, str, num, findCarrier } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const EXCEPTION_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'Load Number', 'Order', 'BOL', 'Bill of Lading'], { required: true }),
  pro: t(['PRO', 'PRO Number', 'Pro #', 'Tracking Number']),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC'], { required: true }),
  delivery_date: t(['Delivery Date', 'Delivered', 'Delivered On', 'POD Date'], { type: 'date' }),
  exception_type: t(['Exception', 'Exception Type', 'OS&D', 'OSD Type', 'Damage Type', 'Issue']),
  noted_on_pod: t(['Noted on POD', 'Exception Noted', 'Signed With Exception', 'POD Notation'], { type: 'bool' }),
  found_on: t(['Found On', 'Discovered On', 'Reported On', 'Found Date'], { type: 'date' }),
  goods_value: t(['Goods Value', 'Invoice Value', 'Value', 'Product Value', 'Damaged Value', 'Loss Value'], { type: 'money' }),
  freight_charge: t(['Freight Charge', 'Freight Cost', 'Freight Paid'], { type: 'money' }),
  salvage_value: t(['Salvage', 'Salvage Value'], { type: 'money' }),
  weight: t(['Weight', 'Weight Affected', 'Lbs Affected', 'Weight (lb)'], { type: 'number' }),
  units: t(['Units', 'Units Affected', 'Qty Affected', 'Cartons Affected'], { type: 'number' }),
  notes: t(['Notes', 'Description', 'Comments']),
});
export const CLAIM_FIELDS = Object.freeze({
  claim_id: t(['Claim ID', 'Claim Number', 'Claim #'], { required: true }),
  shipment_id: t(['Shipment ID', 'Load ID', 'BOL'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name']),
  carrier_claim_number: t(['Carrier Claim Number', 'Carrier Ref', 'Carrier Claim #']),
  filed_on: t(['Filed On', 'Filed', 'Date Filed', 'Submitted'], { type: 'date' }),
  amount: t(['Claim Amount', 'Amount Claimed', 'Amount'], { type: 'money' }),
  acknowledged_on: t(['Acknowledged On', 'Acknowledged', 'Ack Date'], { type: 'date' }),
  status: t(['Status', 'Claim Status']),
  paid_on: t(['Paid On', 'Paid Date', 'Settled On'], { type: 'date' }),
  paid_amount: t(['Paid Amount', 'Amount Paid', 'Settlement'], { type: 'money' }),
  decline_reason: t(['Decline Reason', 'Reason Declined', 'Denial Reason']),
});

export const CLAIM_TERMS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string' },
    filing_window_days: { type: 'integer', minimum: 1, maximum: 1095, description: 'Days after delivery to file a claim (default 270; use the window in your bill of lading or contract)' },
    concealed_report_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Days after delivery to report concealed damage found later (default 5; check your terms)' },
    acknowledge_days: { type: 'integer', minimum: 1, maximum: 120, description: 'Days you expect the carrier to acknowledge a claim (default 30)' },
    resolve_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Days you expect the carrier to pay or decline (default 120)' },
    include_freight_charges: { type: 'boolean', description: 'Add the freight charge to the claim amount (default true)' },
    min_claim_amount: { type: 'number', minimum: 0, description: 'Exceptions worth less than this are listed but not proposed for filing (default 0)' },
    carriers: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, properties: { filing_window_days: { type: 'integer', minimum: 1, maximum: 1095 }, liability_limit_per_lb: { type: 'number', minimum: 0, description: 'Released-value limit per lb of goods affected' }, liability_limit_per_shipment: { type: 'number', minimum: 0 } } } },
  },
});
const D = { filing_window_days: 270, concealed_report_days: 5, acknowledge_days: 30, resolve_days: 120, include_freight_charges: true, min_claim_amount: 0 };

const typeOf = (v) => { const s = str(v).toLowerCase(); return /conceal/.test(s) ? 'concealed_damage' : /short|missing/.test(s) ? 'shortage' : /loss|lost/.test(s) ? 'loss' : /damag|crush|wet|broken/.test(s) ? 'damage' : /over/.test(s) ? 'overage' : s ? 'other' : 'unknown'; };

/** Scan delivered shipments with exceptions: claim amount, deadline, and what to do. */
export function scanExceptions(rows, claims = [], terms = {}, { asOf } = {}) {
  const tm = { ...D, ...terms };
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const filed = new Set(claims.map((c) => str(c.shipment_id).toLowerCase()));
  const items = rows.map((r) => {
    const type = typeOf(r.exception_type); const carrier = str(r.carrier);
    const ct = (terms.carriers && terms.carriers[findCarrier(Object.keys(terms.carriers), carrier)]) || {};
    const windowDays = ct.filing_window_days || tm.filing_window_days;
    const delivered = isoDate(r.delivery_date);
    const value = num(r.goods_value) || 0, freight = tm.include_freight_charges ? num(r.freight_charge) || 0 : 0, salvage = num(r.salvage_value) || 0;
    let amount = round2(Math.max(0, value + freight - salvage));
    const notes = []; let cappedFrom = null;
    const wt = num(r.weight);
    const caps = [ct.liability_limit_per_shipment ? { cap: ct.liability_limit_per_shipment, why: `${ct.liability_limit_per_shipment} per shipment` } : null, ct.liability_limit_per_lb && wt ? { cap: round2(ct.liability_limit_per_lb * wt), why: `${ct.liability_limit_per_lb} per lb on ${wt} lb` } : null].filter((c) => c && c.cap < amount).sort((x, y) => x.cap - y.cap);
    if (ct.liability_limit_per_lb && !wt) notes.push(`Your terms limit this carrier to ${ct.liability_limit_per_lb} per lb; add the weight affected to check the cap.`);
    if (caps.length) { notes.push(`Your terms cap this carrier's liability at ${caps[0].why}; the claim is capped from ${amount}.`); cappedFrom = amount; amount = caps[0].cap; }
    const deadline = delivered && type !== 'overage' ? addDays(delivered, windowDays) : null;
    const daysLeft = deadline ? daysBetween(today, deadline) : null;
    const noted = readYesNo(r.noted_on_pod);
    let status, action;
    if (type === 'overage') { status = 'not_a_claim'; action = 'Overage: tell the carrier and arrange return; nothing to claim.'; }
    else if (filed.has(str(r.shipment_id).toLowerCase())) { status = 'filed'; action = 'Already in the claims log; see capella_track.'; }
    else if (!delivered) { status = 'review'; action = 'No delivery date on file, so the filing deadline is unknown.'; }
    else if (daysLeft < 0) { status = 'expired'; action = `The ${windowDays}-day filing window closed on ${deadline}.`; }
    else if (amount <= 0) { status = 'review'; action = 'No goods value on file. Add the invoice value of the goods.'; }
    else if (amount < tm.min_claim_amount) { status = 'below_minimum'; action = `Worth ${amount}, below your ${tm.min_claim_amount} minimum.`; }
    else { status = daysLeft <= 30 ? 'file_now' : 'file'; action = `File by ${deadline} (${daysLeft} day(s) left).`; }
    if (type === 'concealed_damage') { const found = isoDate(r.found_on); const lag = found && delivered ? daysBetween(delivered, found) : null; notes.push(lag === null ? 'Concealed damage: record when it was found.' : lag > tm.concealed_report_days ? `Concealed damage found ${lag} day(s) after delivery, later than the ${tm.concealed_report_days} days in your terms. Expect the carrier to dispute it; inspection evidence matters.` : `Concealed damage found ${lag} day(s) after delivery.`); }
    else if (noted === false && ['damage', 'shortage', 'loss'].includes(type)) notes.push('The POD was signed clean. The carrier will likely say the goods were delivered in good order; gather photos and receiving records.');
    return { shipment_id: str(r.shipment_id), pro: str(r.pro) || null, carrier, type, delivered: delivered || null, deadline, days_left: daysLeft, noted_on_pod: noted, goods_value: value, freight_charge: freight, salvage, capped_from: cappedFrom, amount, status, action, notes, units: num(r.units), description: str(r.notes) };
  });
  const sum = (st) => round2(items.filter((i) => st.includes(i.status)).reduce((s, i) => s + i.amount, 0));
  return { as_of: today, exceptions: items.length, to_file: items.filter((i) => ['file', 'file_now'].includes(i.status)).length, file_now: items.filter((i) => i.status === 'file_now').length, claimable: sum(['file', 'file_now']), expired: items.filter((i) => i.status === 'expired').length, expired_value: sum(['expired']), filed: items.filter((i) => i.status === 'filed').length, review: items.filter((i) => i.status === 'review').length, terms: { filing_window_days: tm.filing_window_days, concealed_report_days: tm.concealed_report_days }, items };
}

/** Track filed claims: acknowledgement and resolution overdue, short paid, declined. */
export function trackClaims(claims, terms = {}, { asOf } = {}) {
  const tm = { ...D, ...terms };
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const items = claims.map((c) => {
    const filed = isoDate(c.filed_on); const amount = num(c.amount) || 0; const paid = num(c.paid_amount); const st = str(c.status).toLowerCase();
    const age = filed ? daysBetween(filed, today) : null; const f = [];
    if (/declin|denied|reject/.test(st)) f.push({ code: 'declined', detail: `Declined${str(c.decline_reason) ? `: ${str(c.decline_reason)}` : ''}. Decide whether to appeal with more evidence.` });
    else if (paid !== null && paid > 0 && paid < amount - 0.005) f.push({ code: 'short_paid', detail: `Paid ${paid} of ${amount} (${round2(amount - paid)} short). Ask for the basis of the deduction.` });
    else if ((paid === null || paid === 0) && !/closed|withdrawn/.test(st)) {
      if (!isoDate(c.acknowledged_on) && age !== null && age > tm.acknowledge_days) f.push({ code: 'ack_overdue', detail: `Filed ${age} day(s) ago with no acknowledgement (you expect one within ${tm.acknowledge_days}).` });
      if (age !== null && age > tm.resolve_days) f.push({ code: 'resolution_overdue', detail: `Open ${age} day(s), past the ${tm.resolve_days} days you expect for payment or decline.` });
    }
    const open = !(paid !== null && paid >= amount - 0.005) && !/closed|withdrawn/.test(st);
    return { claim_id: str(c.claim_id), shipment_id: str(c.shipment_id), carrier: str(c.carrier), filed_on: filed, age_days: age, amount, paid: paid ?? 0, outstanding: open ? round2(amount - (paid || 0)) : 0, status: str(c.status) || (open ? 'open' : 'closed'), open, findings: f };
  });
  return { as_of: today, claims: items.length, open: items.filter((i) => i.open).length, outstanding: round2(items.reduce((s, i) => s + i.outstanding, 0)), recovered: round2(items.reduce((s, i) => s + i.paid, 0)), needs_chasing: items.filter((i) => i.findings.length).length, items };
}

/** Claim letter for one exception. */
export function claimText(i, { from, contact, reference }) {
  return [
    `# Freight claim: ${i.carrier}, shipment ${i.shipment_id}`, '',
    `**To:** ${contact || `[TO CONFIRM ${i.carrier} claims contact]`}`, `**From:** ${from || '[TO CONFIRM claimant name and company]'}`, `**Our reference:** ${reference || i.shipment_id}`, '',
    `We file this claim for ${i.type.replace('_', ' ')} on shipment ${i.shipment_id}${i.pro ? ` (PRO ${i.pro})` : ''}, delivered ${i.delivered}.`, '',
    '| Item | Amount |', '| --- | --- |',
    `| Invoice value of goods affected${i.units ? ` (${i.units} unit(s))` : ''} | ${i.goods_value} |`,
    ...(i.freight_charge ? [`| Freight charges | ${i.freight_charge} |`] : []),
    ...(i.salvage ? [`| Less salvage | -${i.salvage} |`] : []),
    ...(i.capped_from ? [`| Limited to the carrier's liability limit (from ${i.capped_from}) | ${i.amount} |`] : []),
    `| **Total claimed** | **${i.amount}** |`, '',
    i.description ? `Description: ${i.description}` : 'Description: [TO CONFIRM what was lost or damaged and how]', '',
    'Attached:', '- [ATTACH original bill of lading]', '- [ATTACH delivery receipt or POD showing the exception]', '- [ATTACH commercial invoice for the goods]', '- [ATTACH photos and inspection report]', ...(i.freight_charge ? ['- [ATTACH paid freight bill]'] : []), '',
    `Please acknowledge this claim and send your claim number. ${i.deadline ? `(Our records show the filing deadline as ${i.deadline}.)` : ''}`,
  ].join('\n');
}
