// Fairhaul Parcel Refunds parcel audit: pure functions over parcel invoice lines.
import { exportProfile, chargeCode, dimWeight, round2, str, num, addDays, isoDate, daysBetween, normalizeAddress, groupBy } from 'fairhaul-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
/** Named parcel exports (exports.js). Written from knowledge; not checked against carrier documentation or a live account. */
export const PARCEL_PROFILES = Object.freeze([
  exportProfile('fedex_fbo_csv', { tracking: 'Express or Ground Tracking ID', invoice_number: 'Invoice Number', invoice_date: 'Invoice Date', carrier: { value: 'FedEx' }, service: 'Service Type', ship_date: 'Shipment Date', delivered_at: 'POD Delivery Date', actual_weight: 'Actual Weight Amount', billed_weight: 'Rated Weight Amount', length: 'Dim Length', width: 'Dim Width', height: 'Dim Height', recipient_address: ['Recipient Address Line 1', 'Recipient Address'], recipient_postal: ['Recipient Zip Code', 'Recipient Postal Code'], charge_description: { value: 'Net charge' }, charge_amount: 'Net Charge Amount' }, { note: 'FedEx Billing Online CSV: each shipment is read by its net charge. The numbered charge-description columns are not split into separate charges, so surcharge checks need the per-charge file.' }),
  exportProfile('ups_billing_data', { tracking: 'Tracking Number', invoice_number: 'Invoice Number', invoice_date: 'Invoice Date', carrier: { value: 'UPS' }, ship_date: ['Transaction Date', 'Shipment Date'], zone: 'Zone', actual_weight: 'Entered Weight', billed_weight: 'Billed Weight', recipient_postal: ['Receiver Postal', 'Receiver Postal Code'], recipient_address: ['Receiver Address Line 1', 'Receiver Address'], charge_description: 'Charge Description', charge_amount: 'Net Amount' }, { note: 'UPS billing data with a header row: one row per charge. The raw billing data file without headers needs its header file added first.' }),
  exportProfile('shipstation_shipments', { tracking: 'Tracking Number', invoice_number: { from: ['Order Number'], compute: (_r, get) => `SS-${String(get('Order Number') ?? '').trim()}` }, carrier: ['Carrier', 'Provider'], service: ['Service', 'Requested Service'], ship_date: ['Ship Date', 'Shipped Date'], actual_weight: ['Weight', 'Weight (lb)'], recipient_postal: ['Ship To - Postal Code', 'Ship To Postal Code', 'Postal Code'], charge_description: { value: 'Label' }, charge_amount: ['Shipping Cost', 'Shipment Cost', 'Label Cost'] }, { note: 'ShipStation shipments: the label cost is read as one charge per package; the order number stands in for the invoice number (SS-<order>). Weights are read as pounds; set the export to pounds (or name the unit in lodestar-sources.json as kg).' }),
]);

export const PARCEL_FIELDS = Object.freeze({
  tracking: t(['Tracking Number', 'Tracking ID', 'Express or Ground Tracking ID', 'Lead Shipment Number', 'Package Tracking Number', 'Waybill', 'Waybill Number', 'AWB'], { required: true }),
  invoice_number: t(['Invoice Number', 'Invoice No', 'Invoice']),
  invoice_date: t(['Invoice Date', 'Bill Date'], { type: 'date' }),
  carrier: t(['Carrier', 'Carrier Name']),
  service: t(['Service', 'Service Type', 'Service Level', 'Product']),
  ship_date: t(['Ship Date', 'Shipment Date', 'Pickup Date'], { type: 'date' }),
  promised_at: t(['Promised Delivery', 'Commit Date', 'Guaranteed By', 'Scheduled Delivery', 'Delivery Commitment'], { type: 'datetime' }),
  delivered_at: t(['Delivered At', 'Delivery Date', 'POD Date', 'Actual Delivery'], { type: 'datetime' }),
  zone: t(['Zone', 'Zone Code']),
  actual_weight: t(['Actual Weight', 'Entered Weight', 'Weight'], { type: 'number' }),
  billed_weight: t(['Billed Weight', 'Rated Weight', 'Rated Weight Amount', 'Chargeable Weight'], { type: 'number' }),
  length: t(['Length', 'Dim Length', 'Package Length'], { type: 'number' }),
  width: t(['Width', 'Dim Width', 'Package Width'], { type: 'number' }),
  height: t(['Height', 'Dim Height', 'Package Height'], { type: 'number' }),
  recipient_address: t(['Recipient Address', 'Ship To Address', 'Consignee Address', 'Recipient Address Line 1', 'Delivery Address']),
  recipient_postal: t(['Recipient Zip', 'Ship To Zip', 'Recipient Postal Code', 'Delivery Zip']),
  charge_description: t(['Charge Description', 'Charge', 'Tracking ID Charge Description', 'Charge Type', 'Surcharge']),
  charge_amount: t(['Charge Amount', 'Net Charge', 'Net Charge Amount', 'Tracking ID Charge Amount', 'Amount', 'Billed Charge'], { type: 'money' }),
});

/** Services that usually carry a money-back delivery commitment. Edit to match your agreement: many contracts waive it. */
export const DEFAULT_GUARANTEED = ['next day air', 'next day air saver', '2nd day air', '3 day select', 'ground', 'priority overnight', 'standard overnight', 'first overnight', '2day', 'express saver', 'home delivery', 'express worldwide'];

export const PARCEL_TERMS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string' },
    dim_divisor: { type: 'number', minimum: 1, maximum: 1000, description: 'Cubic inches per pound in your agreement (default 139)' },
    guarantee_waived: { type: 'boolean', description: 'true when your agreement waives the money-back delivery guarantee' },
    guaranteed_services: { type: 'array', items: { type: 'string' } },
    claim_window_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Days after the invoice date to request a refund (default 15)' },
    late_grace_minutes: { type: 'integer', minimum: 0, maximum: 1440 },
    commercial_addresses: { type: 'array', items: { type: 'string' }, description: 'Business delivery addresses that should never carry a residential charge' },
    charge_aliases: { type: 'object', additionalProperties: { type: 'string' } },
  },
});

const TRANSPORT = new Set(['linehaul', 'fuel', 'discount']);
/** Economy services that share a word with a guaranteed one but carry no money-back commitment. */
export const NOT_GUARANTEED = ['ground saver', 'ground economy', 'surepost', 'smartpost', 'mail innovations', 'ground advantage', 'economy'];
const hasTime = (v) => /\d{1,2}:\d{2}/.test(str(v));
const ms = (v) => Date.parse(`${String(v).replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'}`);
/** Minutes late (positive) or early. Without a time on both sides, days are compared: a commitment with no time means by the end of that day. Null when it cannot be told. */
function minutesLate(promised, delivered, graceMs) {
  if (!hasTime(promised) || !hasTime(delivered)) { const p = isoDate(promised), d = isoDate(delivered); return p && d ? (d > p ? daysBetween(p, d) * 1440 : 0) : null; }
  const x = ms(delivered) - ms(promised) - graceMs; return Number.isFinite(x) ? x / 60000 : null;
}

/** Group lines into packages (tracking + invoice), keeping every charge. */
export function packagesFrom(rows, aliases = {}) {
  const m = groupBy(rows.filter((r) => str(r.tracking)), (r) => `${str(r.tracking)}|${str(r.invoice_number)}`);
  return [...m.values()].map((lines) => {
    const r0 = lines[0];
    const first = (k) => lines.map((l) => l[k]).find((v) => str(v)) ?? null;
    const charges = lines.filter((l) => str(l.charge_description) || num(l.charge_amount) !== null).map((l) => ({ description: str(l.charge_description) || 'charge', code: chargeCode(l.charge_description, aliases), amount: num(l.charge_amount) || 0 }));
    const by = {}; for (const c of charges) by[c.code] = round2((by[c.code] || 0) + c.amount);
    return { tracking: str(r0.tracking), invoice_number: str(first('invoice_number')), invoice_date: first('invoice_date'), carrier: str(first('carrier')), service: str(first('service')), ship_date: first('ship_date'), promised_at: first('promised_at'), delivered_at: first('delivered_at'), zone: str(first('zone')), actual_weight: num(first('actual_weight')), billed_weight: num(first('billed_weight')), length: num(first('length')), width: num(first('width')), height: num(first('height')), recipient_address: str(first('recipient_address')), recipient_postal: str(first('recipient_postal')), charges, by_code: by, total: round2(charges.reduce((s, c) => s + c.amount, 0)) };
  });
}

/**
 * Audit packages. Finding codes: duplicate_tracking, voided_label_billed, late_delivery,
 * residential_on_business, address_correction, dim_overbilled, dim_unverified, late_no_guarantee,
 * missing_delivery_scan.
 */
export function auditParcels(pkgs, { terms = {}, voids = [], asOf } = {}) {
  const divisor = terms.dim_divisor || 139;
  const guaranteed = (terms.guaranteed_services || DEFAULT_GUARANTEED).map((s) => s.toLowerCase());
  const windowDays = terms.claim_window_days || 15;
  const grace = (terms.late_grace_minutes || 0) * 60000;
  const business = new Set((terms.commercial_addresses || []).map((a) => normalizeAddress(a)));
  const voided = new Set(voids.map((v) => str(v.tracking)).filter(Boolean));
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const seen = new Map(); const corrections = new Map();
  // Work through the packages in invoice order (date, number, tracking) so that "the duplicate" and
  // "the repeat correction" are the later invoice, whatever order the rows arrive in. Results keep the file's order.
  const ord = (p) => `${isoDate(p.invoice_date) || '9999'}|${p.invoice_number}|${p.tracking}`;
  const inOrder = pkgs.map((p, i) => ({ p, i, k: ord(p) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i));
  const items = new Array(pkgs.length);
  for (const { p, i: at } of inOrder) {
    const f = []; const add = (code, amount, detail) => f.push({ code, amount: amount === null ? null : round2(amount), detail });
    const transport = round2(Object.entries(p.by_code).filter(([c]) => TRANSPORT.has(c)).reduce((s, [, v]) => s + v, 0));
    // A later invoice for the same label is a duplicate only if it bills the transportation again;
    // one carrying only an adjustment (an address correction, a residential charge) is checked on its own.
    if (seen.has(p.tracking) && p.by_code.linehaul > 0) add('duplicate_tracking', p.total, `Tracking ${p.tracking} was already billed on invoice ${seen.get(p.tracking)}.`);
    else if (!seen.has(p.tracking)) seen.set(p.tracking, p.invoice_number || '(no invoice number)');
    if (voided.has(p.tracking)) add('voided_label_billed', p.total, `Label ${p.tracking} is in your void list but was billed.`);
    const svc = p.service.toLowerCase();
    const isGuaranteed = !terms.guarantee_waived && guaranteed.some((g) => svc.includes(g)) && !(terms.guaranteed_services ? [] : NOT_GUARANTEED).some((g) => svc.includes(g));
    if (p.promised_at && p.delivered_at) {
      const late = minutesLate(p.promised_at, p.delivered_at, grace);
      if (late > 0) {
        if (isGuaranteed) add('late_delivery', transport || p.total, `Delivered ${p.delivered_at}, committed ${p.promised_at} (${p.service}). The transportation charge may be refundable under the delivery guarantee.`);
        else add('late_no_guarantee', null, `Delivered late (${p.delivered_at} vs ${p.promised_at}), but ${terms.guarantee_waived ? 'your terms waive the guarantee' : `"${p.service}" is not in your guaranteed services`}. Track it for carrier performance.`);
      }
    } else if (p.promised_at && !p.delivered_at && p.ship_date && daysBetween(p.promised_at, today) > 7) add('missing_delivery_scan', null, `No delivery date on file, committed ${p.promised_at}. Check tracking before the claim window closes.`);
    const addrKey = normalizeAddress(p.recipient_address || '');
    if (p.by_code.residential > 0 && addrKey && business.has(addrKey)) add('residential_on_business', p.by_code.residential, `Residential charge ${p.by_code.residential} on ${p.recipient_address}, which is on your business address list.`);
    if (p.by_code.address_correction > 0) {
      const prev = corrections.get(addrKey || p.recipient_postal);
      add('address_correction', null, prev ? `Address correction again for ${p.recipient_address || p.recipient_postal} (also on ${prev}). Fix the address book entry.` : `Address correction ${p.by_code.address_correction}. Check whether the address you shipped to was already correct.`);
      if (!prev) corrections.set(addrKey || p.recipient_postal, p.tracking);
    }
    const dw = dimWeight(p.length, p.width, p.height, divisor);
    if (p.billed_weight && !dw && p.actual_weight && p.billed_weight > Math.ceil(p.actual_weight)) add('dim_unverified', null, `Billed at ${p.billed_weight} lb against ${p.actual_weight} lb actual, with no dimensions on file. Ask the carrier for the dimensions it measured before disputing.`);
    else if (p.billed_weight && (p.actual_weight || dw)) {
      const should = Math.max(Math.ceil(p.actual_weight || 0), dw || 0);
      if (p.billed_weight > should && transport) add('dim_overbilled', round2(transport * (p.billed_weight - should) / p.billed_weight), `Billed at ${p.billed_weight} lb; your dimensions and weight give ${should} lb (divisor ${divisor}). Estimated overcharge is pro rata to weight; the true figure needs the rate card.`);
    }
    const claimBy = p.invoice_date ? addDays(p.invoice_date, windowDays) : null;
    const refundable = round2(Math.min(p.total, f.reduce((s, x) => s + (x.amount > 0 ? x.amount : 0), 0)));
    const open = claimBy ? claimBy >= today : null;
    items[at] = ({ tracking: p.tracking, invoice_number: p.invoice_number, carrier: p.carrier, service: p.service, ship_date: p.ship_date, total: p.total, refundable, claim_by: claimBy, claim_window_open: open, status: refundable > 0 ? (open === false ? 'window_closed' : 'claim') : f.length ? 'review' : 'ok', findings: f });
  }
  const s = (k, st) => round2(items.filter((i) => !st || i.status === st).reduce((a, i) => a + i[k], 0));
  const byCode = {}; for (const i of items) for (const x of i.findings) { byCode[x.code] = byCode[x.code] || { count: 0, amount: 0 }; byCode[x.code].count++; byCode[x.code].amount = round2(byCode[x.code].amount + (x.amount || 0)); }
  const urgent = items.filter((i) => i.status === 'claim' && i.claim_by && daysBetween(today, i.claim_by) <= 3).map((i) => i.tracking);
  return { as_of: today, packages: items.length, billed: s('total'), refundable_open: s('refundable', 'claim'), refundable_lost: s('refundable', 'window_closed'), claim: items.filter((i) => i.status === 'claim').length, window_closed: items.filter((i) => i.status === 'window_closed').length, review: items.filter((i) => i.status === 'review').length, ok: items.filter((i) => i.status === 'ok').length, urgent, by_finding: byCode, dim_divisor: divisor, guarantee_waived: !!terms.guarantee_waived, items };
}

/** Refund request text for one carrier: one line per package. */
export function refundText(items, { carrier, account, from }) {
  const rows = items.filter((i) => i.status === 'claim');
  const total = round2(rows.reduce((s, i) => s + i.refundable, 0));
  return { total, tracking: rows.map((i) => i.tracking), text: [
    `# Billing adjustment request: ${carrier}`, '',
    `**To:** [TO CONFIRM ${carrier} billing adjustments contact or portal]`,
    `**From:** ${from || '[TO CONFIRM your name and company]'}`,
    `**Account:** ${account || '[TO CONFIRM shipper account number]'}`, '',
    `Please review the ${rows.length} package(s) below and credit ${total} in total. Each request is inside the claim window as of today.`, '',
    '| Tracking | Invoice | Service | Request by | Amount | Reason |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.tracking} | ${i.invoice_number} | ${i.service} | ${i.claim_by || ''} | ${i.refundable} | ${i.findings.filter((x) => x.amount > 0).map((x) => x.detail).join(' ')} |`),
    '', `**Total requested:** ${total}`,
  ].join('\n') };
}
