// Alnilam: carrier settlements for freight brokers. Pure functions.
import { round2, str, num, groupBy, isoDate, addDays, daysBetween, carrierKey } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const RATECON_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Load', 'Load Number', 'Pro'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name'], { required: true }),
  rate: t(['Rate', 'Agreed Rate', 'Linehaul', 'All In', 'Carrier Pay'], { type: 'money', required: true }),
  accessorials: t(['Approved Accessorials', 'Accessorials', 'Extras Approved'], { type: 'money' }),
  delivered_at: t(['Delivered', 'Delivery Date', 'Delivered At'], { type: 'date' }),
  pod: t(['POD', 'POD Received', 'Proof of Delivery'], { type: 'bool' }),
  pay_terms_days: t(['Pay Terms', 'Terms Days', 'Net Days'], { type: 'number' }),
  quick_pay: t(['Quick Pay', 'QuickPay'], { type: 'bool' }),
});
export const CARRIER_INVOICE_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Load', 'Load Number', 'Pro'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'Billed By']),
  invoice_number: t(['Invoice Number', 'Invoice']),
  amount: t(['Amount', 'Invoice Amount', 'Total'], { type: 'money', required: true }),
  received_at: t(['Received', 'Invoice Received', 'Invoice Date'], { type: 'date' }),
});
export const PAYMENT_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Load', 'Load Number', 'Pro'], { required: true }),
  payee: t(['Payee', 'Paid To', 'Remit To'], { required: true }),
  amount: t(['Amount', 'Paid', 'Payment Amount'], { type: 'money', required: true }),
  paid_at: t(['Paid', 'Paid At', 'Payment Date'], { type: 'date' }),
  reference: t(['Reference', 'Check', 'ACH Trace', 'Payment ID']),
});
export const NOA_FIELDS = Object.freeze({
  carrier: t(['Carrier', 'Carrier Name'], { required: true }),
  factor: t(['Factor', 'Factoring Company', 'Pay To', 'Assignee'], { required: true }),
  effective: t(['Effective', 'Effective Date', 'NOA Date'], { type: 'date' }),
  released: t(['Released', 'Release Date', 'Letter of Release'], { type: 'date' }),
});

/** Settle each load: what is owed, to whom, by when, and what was paid. */
export function settle(ratecons, { invoices = [], payments = [], noas = [], asOf, quickPayPct = 3, defaultTerms = 30, tolerance = 1 } = {}) {
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const inv = groupBy(invoices, (x) => str(x.load_id).toUpperCase()); const pay = groupBy(payments, (x) => str(x.load_id).toUpperCase());
  // Notices indexed by carrier, latest first, with their dates read once.
  const noaBy = new Map([...groupBy(noas, (n) => carrierKey(n.carrier))].map(([k, l]) => [k, l.map((n) => ({ n, from: isoDate(n.effective), to: isoDate(n.released), eff: str(n.effective) })).sort((a, b) => b.eff.localeCompare(a.eff))]));
  const keyOf = new Map(); const ck = (c) => { if (!keyOf.has(c)) keyOf.set(c, carrierKey(c)); return keyOf.get(c); };
  const noaFor = (carrier, date) => { const hit = (noaBy.get(ck(carrier)) || []).find((x) => (!x.from || x.from <= date) && (!x.to || x.to > date)); return hit ? hit.n : null; };
  const rows = []; const findings = [];
  const add = (load, code, detail, amount = null) => findings.push({ load_id: load, code, detail, amount: amount === null ? null : round2(amount) });
  const seen = new Set();
  for (const r of ratecons) {
    const id = str(r.load_id); const K = id.toUpperCase(); seen.add(K);
    const agreed = round2((num(r.rate) || 0) + (num(r.accessorials) || 0));
    const qp = r.quick_pay === true || /yes|true/i.test(str(r.quick_pay));
    const owed = round2(qp ? agreed * (1 - quickPayPct / 100) : agreed);
    const invs = inv.get(K) || []; const pays = pay.get(K) || [];
    const billed = round2(invs.reduce((a, x) => a + (num(x.amount) || 0), 0)); const paid = round2(pays.reduce((a, x) => a + (num(x.amount) || 0), 0));
    const recv = invs.map((x) => isoDate(x.received_at)).filter(Boolean).sort()[0] || null;
    const pod = r.pod === true || /yes|true|received/i.test(str(r.pod));
    // A notice binds from the day it is in force until it is released, so who is owed
    // depends on when the money moves: today for the batch, the payment date for a payment.
    const noa = noaFor(r.carrier, today); const payTo = noa ? str(noa.factor) : str(r.carrier);
    const terms = qp ? 2 : num(r.pay_terms_days) ?? defaultTerms; const due = recv ? addDays(recv, terms) : null;
    if (invs.length && billed - agreed > tolerance) add(id, 'invoice_over_ratecon', `Invoice ${invs.map((x) => x.invoice_number).join(', ')} is ${billed}; the rate confirmation and approved accessorials are ${agreed}. Pay ${agreed} unless more was approved in writing.`, billed - agreed);
    if (invs.length > 1) add(id, 'two_invoices', `${invs.length} carrier invoices for one load: ${invs.map((x) => `${x.invoice_number} ${num(x.amount)}`).join(', ')}.`);
    if (pays.length > 1) add(id, 'paid_twice', `${pays.length} payments for one load: ${pays.map((x) => `${x.reference || '?'} ${num(x.amount)} to ${x.payee}`).join('; ')}.`, paid - owed);
    else if (paid - owed > tolerance) add(id, 'overpaid', `Paid ${paid}; owed ${owed}${qp ? ` after the ${quickPayPct}% quick-pay fee` : ''}.`, paid - owed);
    for (const p of pays) {
      const on = isoDate(p.paid_at) || recv || today; const n = noaFor(r.carrier, on); const owedTo = n ? str(n.factor) : str(r.carrier);
      if (ck(p.payee) !== ck(owedTo)) add(id, 'paid_wrong_party', `Paid ${num(p.amount)} to ${p.payee}${isoDate(p.paid_at) ? ` on ${isoDate(p.paid_at)}` : ''}, but ${n ? `a notice of assignment in force then directs payment to ${n.factor}` : `the carrier is ${r.carrier}`}. ${n ? 'The factor can still claim the full amount.' : 'Check who was paid and why.'}`, num(p.amount));
    }
    let status;
    if (pays.length) status = 'paid';
    else if (!invs.length) status = 'awaiting_invoice';
    else if (!pod) status = 'hold_no_pod';
    else if (due && due < today) status = 'past_due';
    else status = 'ready';
    if (status === 'past_due') add(id, 'past_due', `Invoice received ${recv}, due ${due} on ${qp ? 'quick-pay' : `net ${terms}`}; ${daysBetween(due, today)} days late.`, Math.min(billed || agreed, agreed) * (qp ? 1 - quickPayPct / 100 : 1));
    if (status === 'hold_no_pod') add(id, 'no_pod', 'Invoice received but no proof of delivery on file.');
    rows.push({ load_id: id, carrier: str(r.carrier), pay_to: payTo, noa: noa ? str(noa.factor) : '', agreed, quick_pay: qp, owed, billed: invs.length ? billed : null, invoice_received: recv, due, paid, status, to_pay: status === 'ready' || status === 'past_due' ? round2(Math.min(billed, agreed) * (qp ? 1 - quickPayPct / 100 : 1)) : 0 });
  }
  for (const [K, list] of inv) if (!seen.has(K)) add(str(list[0].load_id), 'invoice_without_ratecon', `Invoice ${list.map((x) => x.invoice_number).join(', ')} from ${list[0].carrier || 'unknown'} for ${round2(list.reduce((a, x) => a + (num(x.amount) || 0), 0))}; no rate confirmation for this load.`);
  for (const [K, list] of pay) if (!seen.has(K)) add(str(list[0].load_id), 'payment_without_ratecon', `Paid ${round2(list.reduce((a, x) => a + (num(x.amount) || 0), 0))} to ${list[0].payee}; no rate confirmation for this load.`, list.reduce((a, x) => a + (num(x.amount) || 0), 0));
  const byCode = {}; for (const f of findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  const amt = (codes) => round2(findings.filter((f) => codes.includes(f.code)).reduce((a, f) => a + (f.amount || 0), 0));
  const batch = rows.filter((r) => r.to_pay > 0).sort((a, b) => str(a.due).localeCompare(str(b.due)));
  const byPayee = [...groupBy(batch, (r) => r.pay_to)].map(([p, l]) => ({ pay_to: p, loads: l.length, amount: round2(l.reduce((a, x) => a + x.to_pay, 0)), load_ids: l.map((x) => x.load_id).join(' ') })).sort((a, b) => b.amount - a.amount);
  return { as_of: today, loads: rows.length, by_status: Object.fromEntries([...groupBy(rows, (r) => r.status)].map(([s, l]) => [s, l.length])), findings: findings.length, by_code: byCode, recoverable: amt(['overpaid', 'paid_twice']), wrong_party_exposure: amt(['paid_wrong_party']), held_back: amt(['invoice_over_ratecon']), past_due: amt(['past_due']), batch_total: round2(batch.reduce((a, x) => a + x.to_pay, 0)), batch_loads: batch.length, batch_by_payee: byPayee, rows, items: findings };
}

/** Markdown for the proposed payment batch. */
export function batchText(r, a = {}) {
  const L = [`# Carrier payment batch, ${a.pay_date || r.as_of}`, '', `**To:** ${a.to || '[TO CONFIRM: person who releases payments]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', `${r.batch_loads} load(s), ${r.batch_total} in total. Each line is capped at the rate confirmation plus approved accessorials, net of any quick-pay fee, and paid to the party on the notice of assignment where there is one.`, '', '| Pay to | Loads | Amount |', '|---|---|---|'];
  for (const p of r.batch_by_payee) L.push(`| ${p.pay_to} | ${p.load_ids} | ${p.amount} |`);
  const hold = r.rows.filter((x) => x.status === 'hold_no_pod');
  if (hold.length) L.push('', `Held for proof of delivery: ${hold.map((x) => x.load_id).join(', ')}.`);
  const over = r.items.filter((x) => x.code === 'invoice_over_ratecon');
  if (over.length) L.push('', 'Paid at the rate confirmation, not the invoice:', '', ...over.map((x) => `- ${x.load_id}: ${x.detail}`));
  const rec = r.items.filter((x) => ['paid_twice', 'overpaid', 'paid_wrong_party'].includes(x.code));
  if (rec.length) L.push('', 'Earlier payments to recover or check before this batch:', '', ...rec.map((x) => `- ${x.load_id}: ${x.detail}`));
  return L.join('\n');
}
