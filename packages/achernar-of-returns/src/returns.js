// Achernar: returns from authorisation to credit, and the freight to bring them back. Pure functions.
import { round2, str, num, groupBy, isoDate, daysBetween } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const RMA_FIELDS = Object.freeze({
  rma: t(['RMA', 'RMA Number', 'Return ID', 'Return Number'], { required: true }),
  customer: t(['Customer', 'Customer Name', 'Account']),
  sku: t(['SKU', 'Item', 'Product']),
  units: t(['Units', 'Qty', 'Quantity'], { type: 'number' }),
  value: t(['Value', 'Return Value', 'Line Value', 'Amount'], { type: 'money' }),
  reason: t(['Reason', 'Return Reason', 'Reason Code']),
  authorised_at: t(['Authorised', 'Authorized', 'Authorized At', 'RMA Date', 'Created'], { type: 'date', required: true }),
  tracking: t(['Tracking', 'Label Tracking', 'Return Tracking'], {}),
  status: t(['Status', 'RMA Status']),
});
export const RECEIPT_FIELDS = Object.freeze({
  rma: t(['RMA', 'RMA Number', 'Return ID']),
  tracking: t(['Tracking', 'Tracking Number']),
  received_at: t(['Received', 'Received At', 'Receipt Date'], { type: 'date', required: true }),
  units_received: t(['Units Received', 'Qty Received', 'Units', 'Quantity'], { type: 'number' }),
  condition: t(['Condition', 'Disposition', 'Grade']),
});
export const CREDIT_FIELDS = Object.freeze({
  rma: t(['RMA', 'RMA Number', 'Return ID'], { required: true }),
  credit: t(['Credit', 'Credit Amount', 'Amount', 'Refund'], { type: 'money', required: true }),
  credited_at: t(['Credited', 'Credited At', 'Credit Date', 'Refund Date'], { type: 'date' }),
  credit_number: t(['Credit Memo', 'Credit Number', 'Refund ID']),
});
export const CHARGE_FIELDS = Object.freeze({
  tracking: t(['Tracking', 'Tracking Number', 'Return Tracking'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name']),
  amount: t(['Amount', 'Charge', 'Net Charge', 'Freight'], { type: 'money', required: true }),
  invoice_number: t(['Invoice Number', 'Invoice']),
  billed_at: t(['Invoice Date', 'Billed', 'Date'], { type: 'date' }),
});
const k = (v) => str(v).toUpperCase().replace(/\s+/g, '');

/** Follow each RMA through label, receipt, credit and return freight. */
export function trackReturns(rmas, { receipts = [], credits = [], charges = [], asOf, unusedDays = 30, creditDays = 7 } = {}) {
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const rByRma = groupBy(receipts.filter((r) => str(r.rma)), (r) => k(r.rma)); const rByTrk = groupBy(receipts.filter((r) => str(r.tracking)), (r) => k(r.tracking));
  const cByRma = groupBy(credits, (c) => k(c.rma)); const chByTrk = groupBy(charges, (c) => k(c.tracking));
  const known = new Set(rmas.map((r) => k(r.tracking)).filter(Boolean));
  const items = []; const findings = [];
  const add = (rma, code, detail, amount = null) => findings.push({ rma, code, detail, amount: amount === null ? null : round2(amount) });
  for (const r of rmas) {
    const id = str(r.rma); const trk = k(r.tracking); const auth = isoDate(r.authorised_at);
    if (/cancel|void/i.test(str(r.status))) continue;
    const rec = [...(rByRma.get(k(id)) || []), ...(trk ? rByTrk.get(trk) || [] : [])].filter((x, i, a) => a.indexOf(x) === i);
    const cr = cByRma.get(k(id)) || []; const ch = trk ? chByTrk.get(trk) || [] : [];
    const units = num(r.units); const value = num(r.value) || 0;
    const got = rec.reduce((a, x) => a + (num(x.units_received) ?? units ?? 0), 0); const recAt = rec.map((x) => isoDate(x.received_at)).sort()[0] || null;
    const credited = round2(cr.reduce((a, x) => a + (num(x.credit) || 0), 0)); const freight = round2(ch.reduce((a, x) => a + (num(x.amount) || 0), 0));
    let stage = !rec.length ? (cr.length ? 'credited_not_received' : 'awaiting_return') : cr.length ? 'closed' : 'received_not_credited';
    if (!rec.length && !cr.length && auth && daysBetween(auth, today) > unusedDays) { stage = 'label_unused'; add(id, 'label_unused', `Authorised ${auth}, ${daysBetween(auth, today)} days ago; nothing received${ch.length ? '' : ' and no carrier scan billed'}. Close the RMA and void the label if your carrier charges for unused labels.`); }
    if (stage === 'received_not_credited' && daysBetween(recAt, today) > creditDays) add(id, 'received_not_credited', `Received ${recAt}, ${daysBetween(recAt, today)} days ago; no credit issued. The customer is waiting.`, value * (units ? Math.min(1, got / units) : 1));
    if (stage === 'credited_not_received') add(id, 'credited_not_received', `Credited ${credited} but nothing received against this RMA.`, credited);
    if (rec.length && units && got < units) add(id, 'short_received', `${units} unit(s) authorised, ${got} received.`);
    const due = units && rec.length ? round2(value * Math.min(1, got / units)) : value;
    if (cr.length && credited > due + 0.01) add(id, 'over_credited', `Credited ${credited}; ${rec.length ? `${got} of ${units} received is worth ${due}` : `the RMA is worth ${value}`}.`, credited - due);
    if (ch.length > 1) add(id, 'freight_billed_twice', `Return tracking ${r.tracking} billed ${ch.length} times: ${ch.map((x) => `${x.invoice_number || '?'} ${num(x.amount)}`).join(', ')}.`, freight - num(ch[0].amount));
    items.push({ rma: id, customer: str(r.customer) || '(none)', sku: str(r.sku) || '(none)', reason: str(r.reason) || '(none)', units, value, authorised_at: auth, received_at: recAt, units_received: rec.length ? got : null, condition: rec.map((x) => str(x.condition)).filter(Boolean).join(' '), credited, freight, freight_pct_of_value: value ? Math.round((freight / value) * 1000) / 10 : null, stage });
  }
  for (const [trk, list] of chByTrk) if (!known.has(trk)) findings.push({ rma: '', code: 'freight_without_rma', detail: `Return freight on tracking ${list[0].tracking} (${list.map((x) => `${x.invoice_number || '?'} ${num(x.amount)}`).join(', ')}) matches no RMA here.`, amount: round2(list.reduce((a, x) => a + (num(x.amount) || 0), 0)) });
  const roll = (f) => [...groupBy(items, f)].map(([key, l]) => ({ key, returns: l.length, value: round2(l.reduce((a, x) => a + x.value, 0)), freight: round2(l.reduce((a, x) => a + x.freight, 0)) })).map((x) => ({ ...x, freight_pct_of_value: x.value ? Math.round((x.freight / x.value) * 1000) / 10 : null })).sort((a, b) => b.freight - a.freight);
  const byCode = {}; for (const f of findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  const sum = (codes) => round2(findings.filter((f) => codes.includes(f.code)).reduce((a, f) => a + (f.amount || 0), 0));
  return { as_of: today, rmas: items.length, return_value: round2(items.reduce((a, x) => a + x.value, 0)), return_freight: round2(items.reduce((a, x) => a + x.freight, 0) + sum(['freight_without_rma'])), by_stage: Object.fromEntries([...groupBy(items, (x) => x.stage)].map(([s, l]) => [s, l.length])), findings: findings.length, by_code: byCode, credits_owed: sum(['received_not_credited']), credit_at_risk: sum(['credited_not_received', 'over_credited']), freight_disputable: sum(['freight_billed_twice', 'freight_without_rma']), by_reason: roll((x) => x.reason).map(({ key, ...r }) => ({ reason: key, ...r })), by_customer: roll((x) => x.customer).map(({ key, ...r }) => ({ customer: key, ...r })), by_sku: roll((x) => x.sku).map(({ key, ...r }) => ({ sku: key, ...r })), items: findings, rmas_detail: items };
}

/** Markdown dispute to one carrier for return freight billed twice or with no RMA. */
export function disputeText(r, carrier, charges, a = {}) {
  const trks = new Set(charges.filter((c) => str(c.carrier).toLowerCase() === carrier.toLowerCase()).map((c) => k(c.tracking)));
  const f = r.items.filter((x) => (x.code === 'freight_billed_twice' || x.code === 'freight_without_rma') && [...trks].some((tk) => x.detail.toUpperCase().replace(/\s+/g, '').includes(tk)));
  const L = [`# Return freight dispute: ${carrier}`, '', `**To:** ${a.to || '[TO CONFIRM: carrier billing contact]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', 'Hello,', '', `We found ${f.length} return shipment charge(s) we believe are not owed. Please credit them or send proof of delivery for each.`, '', '| Issue | Detail | Amount |', '|---|---|---|'];
  for (const x of f) L.push(`| ${x.code === 'freight_billed_twice' ? 'Billed twice' : 'No return authorised'} | ${x.detail} | ${x.amount} |`);
  L.push('', `Total: ${round2(f.reduce((s, x) => s + (x.amount || 0), 0))}`, '', 'Thank you,', a.from || '[YOUR NAME]');
  return { text: L.join('\n'), amount: round2(f.reduce((s, x) => s + (x.amount || 0), 0)), count: f.length };
}
