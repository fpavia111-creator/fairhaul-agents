// Antares: customs entry lines checked against commercial invoices. Pure functions.
// Checks facts and arithmetic only. It never says which tariff code is right.
import { exportProfile, round2, str, num, groupBy, isoDate, addDays, daysBetween } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const ENTRY_FIELDS = Object.freeze({
  entry_number: t(['Entry Number', 'Entry No', 'Entry', 'Declaration Number'], { required: true }),
  entry_date: t(['Entry Date', 'Date', 'Release Date'], { type: 'date' }),
  line: t(['Line', 'Line Number', 'Entry Line']),
  invoice_number: t(['Invoice Number', 'Commercial Invoice', 'Invoice'], { required: true }),
  sku: t(['SKU', 'Part Number', 'Item', 'Product'], { required: true }),
  hts: t(['HTS', 'HTS Code', 'Tariff Code', 'Tariff Number', 'Commodity Code', 'HS Code']),
  origin: t(['Origin', 'Country of Origin', 'COO'], { translate: 'country_of_origin' }),
  quantity: t(['Quantity', 'Qty', 'Units'], { type: 'number' }),
  entered_value: t(['Entered Value', 'Customs Value', 'Value'], { type: 'money', required: true }),
  exchange_rate: t(['Exchange Rate', 'FX Rate', 'Rate of Exchange'], { type: 'number' }),
  duty_rate: t(['Duty Rate', 'Rate', 'Duty Rate %'], { type: 'number' }),
  duty: t(['Duty', 'Duty Amount'], { type: 'money' }),
});
export const INVOICE_FIELDS = Object.freeze({
  invoice_number: t(['Invoice Number', 'Commercial Invoice', 'Invoice'], { required: true }),
  sku: t(['SKU', 'Part Number', 'Item', 'Product'], { required: true }),
  quantity: t(['Quantity', 'Qty', 'Units'], { type: 'number' }),
  value: t(['Value', 'Line Value', 'Extended Value', 'Amount'], { type: 'money', required: true }),
  currency: t(['Currency', 'Curr']),
  origin: t(['Origin', 'Country of Origin', 'COO', 'Made In'], { translate: 'country_of_origin' }),
});
// "5%", "5" and "0.05" are the same rate; "0.5%" is half a percent.
const rateOf = (v) => { const pct = /%/.test(String(v ?? '')); const n = num(String(v ?? '').replace(/%/g, '')); return n === null ? null : pct || n > 1 ? n / 100 : n; };
const key = (inv, sku) => `${str(inv).toUpperCase()}|${str(sku).toUpperCase()}`;

/**
 * Check entry lines against invoice lines. duty_impact is an estimate from the
 * rate on the entry line: positive means duty may be owed, negative means duty
 * may have been overpaid. It is not a liability figure.
 */
export function checkEntries(entries, invoices, { tolerancePct = 1, asOf = null, windowDays = null } = {}) {
  const invBy = groupBy(invoices, (i) => key(i.invoice_number, i.sku));
  const findings = [];
  // Which entry had an invoice line first: the earliest entry date, then the lowest entry number,
  // so the answer does not depend on the order of the rows in the file.
  const seen = new Map();
  for (const e of entries) { const k = key(e.invoice_number, e.sku); const at = `${isoDate(e.entry_date) || '9999'}|${str(e.entry_number)}`; if (!seen.has(k) || at < seen.get(k).at) seen.set(k, { at, entry: str(e.entry_number) }); }
  const add = (e, code, detail, duty_impact = null) => findings.push({ entry_number: str(e.entry_number), line: str(e.line), invoice_number: str(e.invoice_number), sku: str(e.sku), code, detail, duty_impact: duty_impact === null ? null : round2(duty_impact) });
  const groups = groupBy(entries, (x) => `${str(x.entry_number)}#${key(x.invoice_number, x.sku)}`);
  for (const e of entries) {
    const k = key(e.invoice_number, e.sku); const value = num(e.entered_value) || 0; const rate = rateOf(e.duty_rate);
    if (seen.get(k).entry !== str(e.entry_number)) add(e, 'entered_twice', `Invoice ${e.invoice_number} ${e.sku} is also on entry ${seen.get(k).entry}. If both are right, ignore; if not, one may have paid duty twice.`, rate !== null ? -value * rate : null);
    const missing = ['hts', 'origin', 'quantity'].filter((f) => !str(e[f]));
    if (missing.length) add(e, 'missing_data', `Entry line has no ${missing.join(', ')}.`);
    if (rate !== null && num(e.duty) !== null && Math.abs(value * rate - num(e.duty)) > 0.5) add(e, 'duty_math', `Entered value ${value} at ${Math.round(rate * 10000) / 100}% is ${round2(value * rate)}; the line says ${num(e.duty)}.`, value * rate - num(e.duty));
    const inv = invBy.get(k);
    if (!inv) { add(e, 'not_on_invoice', `${e.sku} is not on commercial invoice ${e.invoice_number} in these files.`); continue; }
    // One invoice line may be split over several lines of the same entry: compare their total, once.
    const group = groups.get(`${str(e.entry_number)}#${k}`);
    const firstOfGroup = group[0] === e;
    const gValue = round2(group.reduce((a, x) => a + (num(x.entered_value) || 0), 0)); const gQty = group.every((x) => num(x.quantity) === null) ? null : group.reduce((a, x) => a + (num(x.quantity) || 0), 0);
    const split = group.length > 1 ? ` (${group.length} entry lines together)` : '';
    const fx = num(e.exchange_rate) || 1; const invValue = round2(inv.reduce((a, i) => a + (num(i.value) || 0), 0) * fx); const invQty = inv.reduce((a, i) => a + (num(i.quantity) || 0), 0);
    if (firstOfGroup && invValue && Math.abs(gValue - invValue) / invValue * 100 > tolerancePct) add(e, gValue < invValue ? 'value_below_invoice' : 'value_above_invoice', `Entered value ${gValue}${split}; the invoice says ${invValue}${fx !== 1 ? ` (${inv[0].currency || 'foreign'} at ${fx})` : ''}. Difference ${round2(gValue - invValue)}.`, rate !== null ? (invValue - gValue) * rate : null);
    if (firstOfGroup && gQty !== null && invQty && gQty !== invQty) add(e, 'quantity_mismatch', `Entered quantity ${gQty}${split}; the invoice says ${invQty}.`);
    const io = [...new Set(inv.map((i) => str(i.origin).toUpperCase()).filter(Boolean))];
    if (str(e.origin) && io.length && !io.includes(str(e.origin).toUpperCase())) add(e, 'origin_mismatch', `Entry says origin ${str(e.origin).toUpperCase()}; the invoice says ${io.join(', ')}. Ask your broker which document is right.`);
  }
  const entered = new Set(entries.map((e) => key(e.invoice_number, e.sku)));
  const invs = new Set(entries.map((e) => str(e.invoice_number).toUpperCase()));
  for (const [k, list] of invBy) if (invs.has(k.split('|')[0]) && !entered.has(k)) findings.push({ entry_number: '', line: '', invoice_number: str(list[0].invoice_number), sku: str(list[0].sku), code: 'invoice_line_not_entered', detail: `${list[0].sku} is on invoice ${list[0].invoice_number} (value ${round2(list.reduce((a, i) => a + (num(i.value) || 0), 0))}) but on no entry line here.`, duty_impact: null });
  // Consistency across entries. These say the codes differ, not which one is right.
  for (const [sku, list] of groupBy(entries.filter((e) => str(e.hts)), (e) => str(e.sku).toUpperCase())) {
    const codes = [...new Set(list.map((e) => str(e.hts)))].sort();
    if (codes.length > 1) findings.push({ entry_number: [...new Set(list.map((e) => str(e.entry_number)))].sort().join(' '), line: '', invoice_number: '', sku: str(list[0].sku), code: 'code_inconsistent', detail: `${list[0].sku} was entered under ${codes.length} tariff codes: ${codes.map((c) => `${c} (${list.filter((e) => str(e.hts) === c).map((e) => str(e.entry_number)).sort().join(', ')})`).join('; ')}. Ask your broker or a licensed customs professional which applies.`, duty_impact: null });
  }
  for (const [k, list] of groupBy(entries.filter((e) => str(e.hts) && rateOf(e.duty_rate) !== null), (e) => `${str(e.hts)}|${str(e.origin).toUpperCase()}`)) {
    const rates = [...new Set(list.map((e) => rateOf(e.duty_rate)))].sort((a, b) => a - b);
    if (rates.length > 1) { const [hts, o] = k.split('|'); findings.push({ entry_number: [...new Set(list.map((e) => str(e.entry_number)))].sort().join(' '), line: '', invoice_number: '', sku: [...new Set(list.map((e) => str(e.sku)))].sort().join(' '), code: 'rate_inconsistent', detail: `Tariff code ${hts} from ${o || 'unknown origin'} carries ${rates.map((r) => `${Math.round(r * 10000) / 100}%`).join(' and ')} on different lines. Dates or programs may explain it; ask your broker.`, duty_impact: null }); }
  }
  const fBy = new Map(); for (const x of findings) for (const n of new Set(x.entry_number.split(' '))) { if (!fBy.has(n)) fBy.set(n, []); fBy.get(n).push(x); }
  const byEntry = [...groupBy(entries, (e) => str(e.entry_number))].map(([n, ls]) => {
    const d = isoDate(ls[0].entry_date); const deadline = d && windowDays ? addDays(d, windowDays) : null; const left = deadline && asOf ? daysBetween(isoDate(asOf), deadline) : null;
    const f = fBy.get(n) || [];
    return { entry_number: n, entry_date: d, lines: ls.length, entered_value: round2(ls.reduce((a, e) => a + (num(e.entered_value) || 0), 0)), duty: round2(ls.reduce((a, e) => a + (num(e.duty) || 0), 0)), findings: f.length, duty_impact: round2(f.reduce((a, x) => a + (x.duty_impact || 0), 0)), correct_by: deadline, days_left: left, urgency: left === null ? '' : left < 0 ? 'window_passed' : left <= 30 ? 'urgent' : 'open' };
  }).sort((a, b) => (a.days_left ?? 1e9) - (b.days_left ?? 1e9));
  const byCode = {}; for (const f of findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  const impact = (s) => round2(findings.filter((f) => s(f.duty_impact || 0)).reduce((a, f) => a + f.duty_impact, 0));
  return { entries: byEntry.length, lines: entries.length, findings: findings.length, by_code: byCode, duty_overpaid_estimate: Math.abs(impact((x) => x < 0)), duty_underpaid_estimate: impact((x) => x > 0), urgent: byEntry.filter((e) => e.urgency === 'urgent' && e.findings).length, by_entry: byEntry, items: findings };
}

/** Markdown for a correction request to the broker. */
export function correctionText(r, entry, a = {}) {
  const e = r.by_entry.find((x) => x.entry_number === entry);
  const f = r.items.filter((x) => x.entry_number.split(' ').includes(entry));
  const L = [`# Entry ${entry}: points to check`, '', `**To:** ${a.to || '[TO CONFIRM: broker contact]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', `Hello${a.broker ? ` ${a.broker}` : ''},`, '', `We compared entry ${entry}${e.entry_date ? ` of ${e.entry_date}` : ''} with our commercial invoices and found ${f.length} point(s) to check. Please confirm each, and tell us whether a correction is needed${e.correct_by ? ` before ${e.correct_by}` : ''}.`, '', '| Line | Invoice | SKU | Check | Detail |', '|---|---|---|---|---|'];
  for (const x of f) L.push(`| ${x.line || '-'} | ${x.invoice_number || '-'} | ${x.sku} | ${x.code.replace(/_/g, ' ')} | ${x.detail} |`);
  L.push('', 'We are not asking you to change any tariff classification on our say-so; where codes differ we would like your view of which applies.', '', 'Thank you,', a.from || '[YOUR NAME]');
  return L.join('\n');
}

/** ACE entry summary line export (exports.js). Written from knowledge; not checked against CBP documentation or a live ACE account. */
export const ENTRY_PROFILES = Object.freeze([
  exportProfile('ace_es003_lines', { entry_number: 'Entry Summary Number', line: 'Entry Summary Line Number', entry_date: ['Entry Summary Date', 'Entry Date'], hts: ['HTS Number - Full', 'HTS Number'], origin: ['Country of Origin Code', 'Country of Origin'], quantity: ['Line Tariff Quantity', 'HTS Quantity'], entered_value: ['Line Tariff Goods Value Amount', 'Line Goods Value Amount'], duty: ['Line Duty Amount', 'Line Tariff Duty Amount'], invoice_number: ['Commercial Invoice Number', 'Invoice Number'], sku: ['Part Number', 'Manufacturer Part Number'] }, { note: 'ACE ES-003 line details: one row per entry line (the first tariff number of each line is used).' }),
]);
