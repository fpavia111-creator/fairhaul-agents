// Algol: freight invoices paid twice. Pure functions.
import { exportProfile, carryGroup, firstRowPer, carrierKey, isoDate, daysBetween, round2, str, num, groupBy, carrierGrouper } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const PAYMENT_FIELDS = Object.freeze({
  vendor: t(['Vendor', 'Vendor Name', 'Carrier', 'Payee', 'Supplier'], { required: true }),
  vendor_id: t(['Vendor ID', 'Vendor Number', 'Supplier ID', 'Vendor #']),
  invoice_number: t(['Invoice Number', 'Invoice', 'Invoice #', 'Inv No', 'Document Number'], { required: true }),
  invoice_date: t(['Invoice Date', 'Doc Date', 'Bill Date'], { type: 'date' }),
  amount: t(['Amount', 'Invoice Amount', 'Paid Amount', 'Gross Amount'], { type: 'money', required: true }),
  paid_date: t(['Paid Date', 'Payment Date', 'Check Date', 'Cleared'], { type: 'date' }),
  payment_ref: t(['Payment Ref', 'Check Number', 'Payment Number', 'ACH Ref', 'Payment ID']),
  pro: t(['PRO', 'PRO Number', 'Tracking Number', 'Reference']),
  bol: t(['BOL', 'Bill of Lading']),
  memo: t(['Memo', 'Description', 'Notes']),
});
export const normInvoice = (v) => str(v).toUpperCase().replace(/^(INV|INVOICE|BILL|FB)[\s#:.-]*/, '').replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\d)/, '');
const normRef = (v) => str(v).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\d)/, '');

/** Find invoices paid more than once. */
export function findDuplicates(rows, { dateWindowDays = 3, asOf, sameVendors = [] } = {}) {
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  // Vendor records a person confirmed are one carrier (accepted domain memory) share one key.
  const alias = new Map(); for (const g of sameVendors) { const keys = g.vendors.map((v) => carrierKey(v) || str(v).toLowerCase()).filter(Boolean); for (const k of keys) alias.set(k, `same:${keys[0]}`); }
  const group = carrierGrouper(rows.map((r) => r.vendor));
  const vendorKey = (r) => { const byName = group(r.vendor); const byId = str(r.vendor_id).toLowerCase(); return alias.get(byName) || alias.get(byId) || alias.get(carrierKey(r.vendor_id)) || byName || byId; };
  const pay = rows.map((r, i) => ({ row: i + 1, vendor: str(r.vendor), vkey: vendorKey(r), vendor_id: str(r.vendor_id), invoice_number: str(r.invoice_number), inv: normInvoice(r.invoice_number), invoice_date: isoDate(r.invoice_date), amount: num(r.amount) ?? 0, paid_date: isoDate(r.paid_date), payment_ref: str(r.payment_ref), pro: normRef(r.pro), bol: normRef(r.bol), memo: str(r.memo) }));
  const paid = pay.filter((p) => p.amount > 0 && p.paid_date);
  const credits = pay.filter((p) => p.amount < 0);
  const groups = []; const used = new Set();
  const add = (rule, confidence, list, why) => {
    const ids = list.map((p) => p.row).sort((a, b) => a - b); const key = ids.join(',');
    if (list.length < 2 || used.has(key) || list.every((p) => used.has(`r${p.row}`))) return;
    used.add(key); for (const p of list) used.add(`r${p.row}`);
    const sorted = [...list].sort((a, b) => (a.paid_date < b.paid_date ? -1 : 1));
    const overpaid = round2(sorted.slice(1).reduce((s, p) => s + p.amount, 0));
    const refs = new Set(list.flatMap((p) => [p.inv, p.pro].filter(Boolean)));
    const credited = round2(Math.abs(credits.filter((c) => c.vkey === list[0].vkey && (refs.has(c.inv) || refs.has(c.pro) || [...refs].some((r) => c.memo.toUpperCase().includes(r))))
      .reduce((s, c) => s + c.amount, 0)));
    const open = round2(Math.max(0, overpaid - credited));
    groups.push({ rule, confidence, vendor: list[0].vendor, vendors: [...new Set(list.map((p) => p.vendor))], invoice_numbers: list.map((p) => p.invoice_number), pro: list.find((p) => p.pro)?.pro || null, amounts: list.map((p) => p.amount), paid_dates: sorted.map((p) => p.paid_date), payment_refs: sorted.map((p) => p.payment_ref).filter(Boolean), rows: ids, overpaid, credited, to_recover: open, age_days: daysBetween(sorted.at(-1).paid_date, today), why, status: open <= 0 ? 'already_credited' : 'recover' });
  };
  // 1. Same vendor, same normalised invoice number, same amount.
  for (const [, l] of groupBy(paid, (p) => `${p.vkey}|${p.inv}|${p.amount}`)) if (l.length > 1) { const raw = new Set(l.map((p) => p.invoice_number)); const ids = new Set(l.map((p) => p.vendor_id).filter(Boolean)); if (ids.size > 1) add('two_vendor_records', 'high', l, `Invoice ${l[0].invoice_number} for ${l[0].amount} paid under vendor records ${l.map((p) => `${p.vendor} (${p.vendor_id})`).join(' and ')}. Merge or block the duplicate vendor record.`); else add(raw.size > 1 ? 'invoice_number_variant' : 'exact_duplicate', 'high', l, raw.size > 1 ? `The same invoice written ${[...raw].map((x) => `"${x}"`).join(' and ')}, paid ${l.length} times.` : `Invoice ${l[0].invoice_number} paid ${l.length} times.`); }
  // 2. Same invoice number and amount under two vendor records.
  for (const [, l] of groupBy(paid, (p) => `${p.inv}|${p.amount}`)) if (l.length > 1 && new Set(l.map((p) => p.vkey)).size > 1 && l[0].inv.length >= 4) add('two_vendor_records', 'high', l, `Invoice ${l[0].invoice_number} for ${l[0].amount} paid under ${[...new Set(l.map((p) => p.vendor))].join(' and ')}. Check whether these are one carrier.`);
  // 3. Same PRO paid twice by one vendor.
  for (const [, l] of groupBy(paid.filter((p) => p.pro), (p) => `${p.vkey}|${p.pro}`)) if (l.length > 1) { const same = new Set(l.map((p) => p.amount)).size === 1; add('same_pro', same ? 'high' : 'medium', l, same ? `PRO ${l[0].pro} billed and paid ${l.length} times for the same amount under different invoice numbers.` : `PRO ${l[0].pro} paid ${l.length} times for different amounts. It may be a balance-due or corrected bill; check before asking for money back.`); }
  // 4. Same vendor and amount within a few days, no shared reference.
  for (const [, l] of groupBy(paid, (p) => `${p.vkey}|${p.amount}`)) {
    const s = [...l].sort((a, b) => (a.invoice_date < b.invoice_date ? -1 : 1));
    for (let i = 1; i < s.length; i++) if (s[i].invoice_date && s[i - 1].invoice_date && daysBetween(s[i - 1].invoice_date, s[i].invoice_date) <= dateWindowDays && !(s[i].pro && s[i - 1].pro && s[i].pro !== s[i - 1].pro)) add('same_amount_and_date', 'low', [s[i - 1], s[i]], `Same carrier and amount (${s[i].amount}) with invoice dates ${s[i - 1].invoice_date} and ${s[i].invoice_date}. Could be two real loads; pull both bills.`);
  }
  const rank = { high: 0, medium: 1, low: 2 };
  groups.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.to_recover - a.to_recover);
  const tot = (c) => round2(groups.filter((g) => g.confidence === c && g.status === 'recover').reduce((s, g) => s + g.to_recover, 0));
  const vendors = [...groupBy(groups.filter((g) => g.status === 'recover'), (g) => g.vendor)].map(([vendor, l]) => ({ vendor, groups: l.length, to_recover: round2(l.reduce((s, g) => s + g.to_recover, 0)), high: round2(l.filter((g) => g.confidence === 'high').reduce((s, g) => s + g.to_recover, 0)) })).sort((a, b) => b.to_recover - a.to_recover);
  return { as_of: today, payments: paid.length, credits: credits.length, paid_total: round2(paid.reduce((s, p) => s + p.amount, 0)), groups: groups.length, to_recover_high: tot('high'), to_recover_medium: tot('medium'), to_recover_low: tot('low'), already_credited: groups.filter((g) => g.status === 'already_credited').length, vendors, items: groups };
}

export function recoveryText(groups, { from, contact, confidence = ['high'] }) {
  const list = groups.filter((g) => g.status === 'recover' && confidence.includes(g.confidence));
  const total = round2(list.reduce((s, g) => s + g.to_recover, 0));
  return { total, text: [
    `# Request for refund of duplicate payments: ${list[0].vendor}`, '',
    `**To:** ${contact || `[TO CONFIRM ${list[0].vendor} accounts receivable contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `Our records show ${list.length} invoice(s) paid more than once, ${total} in total. Please refund it or confirm a credit against open invoices.`, '',
    '| Invoices | PRO | Amounts | Paid on | Payment refs | Paid twice |', '| --- | --- | --- | --- | --- | --- |',
    ...list.map((g) => `| ${g.invoice_numbers.join(', ')} | ${g.pro || ''} | ${g.amounts.join(', ')} | ${g.paid_dates.join(', ')} | ${g.payment_refs.join(', ')} | ${g.to_recover} |`), '',
    '[ATTACH remittance advice for each payment]',
  ].join('\n') };
}

/** Named AP exports (exports.js). Written from knowledge; not checked against vendor documentation or a live account. */
const abs = (v) => String(v ?? '').trim().replace(/^\((.*)\)$/, '$1').replace(/^-/, '');
export const PAYMENT_PROFILES = Object.freeze([
  exportProfile('netsuite_transactions', { vendor: 'Name', invoice_number: ['Reference No.', 'Reference Number', 'Document Number'], invoice_date: 'Date', amount: { from: 'Amount', transform: abs }, memo: 'Memo' }, { skipRow: (_r, get) => !/bill|vendor/i.test(String(get('Type') || 'bill')), note: 'NetSuite saved search: vendor bill rows only; the vendor reference number is used as the invoice number when the search has it.' }),
  exportProfile('qbo_transaction_list_by_vendor', { invoice_number: 'Num', invoice_date: 'Date', amount: { from: 'Amount', transform: abs }, memo: ['Memo/Description', 'Memo'] }, { provides: ['vendor'], rows: (rows) => carryGroup('vendor')(rows).filter((r) => String(r.invoice_number || '').trim()), note: 'QuickBooks Online: the vendor is read from the group heading above each block of rows; rows without a bill number are skipped.' }),
  exportProfile('xero_bills', { vendor: 'ContactName', invoice_number: 'InvoiceNumber', invoice_date: 'InvoiceDate', amount: 'Total', memo: ['Reference', 'Description'] }, { rows: firstRowPer('invoice_number'), note: 'Xero bills: one row per bill (Xero repeats the bill once per line).' }),
  exportProfile('sap_fbl1n_items', { vendor_id: ['Vendor', 'Supplier', 'Account'], vendor: ['Name 1', 'Vendor Name', 'Supplier Name'], invoice_number: 'Reference', invoice_date: 'Document Date', amount: { from: ['Amount in Doc. Curr.', 'Amount in Local Currency'], transform: abs }, paid_date: ['Clearing Date', 'Clearing date'], payment_ref: ['Clearing Document', 'Clrng doc.'], memo: 'Text' }, { note: 'SAP vendor line items: the Reference field holds the supplier invoice number; clearing date and document are read as the payment.' }),
]);
