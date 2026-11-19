// Column vocabularies shared by the Fairhaul agents, so a carrier invoice,
// a shipment list or a tracking export reads the same way in every agent.
// Each field lists the header names it is also called. The names were written
// from knowledge of common TMS, carrier and AP exports; none was checked
// against a live account. A buyer can name columns by hand in fairhaul-sources.json.
import { readX12, invoicesFrom210 } from './x12.js';
import { round2, str, num, chargeCode } from './freight.js';
import { exportProfile } from './exports.js';

const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const INVOICE_LINE_FIELDS = Object.freeze({
  invoice_number: t(['Invoice Number', 'Invoice No', 'Invoice #', 'Invoice', 'Freight Bill Number', 'Freight Bill', 'Bill Number', 'FB Number', 'Inv No'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC', 'Vendor', 'Vendor Name', 'Supplier', 'Payee']),
  pro: t(['PRO', 'PRO Number', 'Pro #', 'Pro No', 'Tracking Number', 'Tracking', 'Shipment ID', 'Load ID', 'Load Number', 'Load #']),
  bol: t(['BOL', 'BOL Number', 'Bill of Lading', 'B/L', 'BOL #']),
  po: t(['PO', 'PO Number', 'Purchase Order', 'Customer Reference', 'Reference']),
  invoice_date: t(['Invoice Date', 'Bill Date', 'Billed Date', 'Inv Date'], { type: 'date' }),
  ship_date: t(['Ship Date', 'Pickup Date', 'Shipped', 'Pickup', 'Shipment Date'], { type: 'date' }),
  delivery_date: t(['Delivery Date', 'Delivered', 'Delivered Date', 'Actual Delivery'], { type: 'date' }),
  amount: t(['Invoice Total', 'Invoice Amount', 'Total Charges', 'Total', 'Net Charge', 'Amount Due', 'Billed Amount', 'Total Amount'], { type: 'money' }),
  charge_description: t(['Charge Description', 'Charge', 'Charge Type', 'Description', 'Accessorial', 'Charge Code', 'Line Description']),
  charge_amount: t(['Charge Amount', 'Line Amount', 'Line Total', 'Amount', 'Charge Amt'], { type: 'money' }),
  weight: t(['Weight', 'Billed Weight', 'Total Weight', 'Weight (lb)', 'Weight lbs', 'Rated Weight'], { type: 'number' }),
  miles: t(['Miles', 'Mileage', 'Distance', 'Loaded Miles'], { type: 'number' }),
  pallets: t(['Pallets', 'Pallet Count', 'Handling Units', 'Skids'], { type: 'number' }),
  class: t(['Class', 'Freight Class', 'NMFC Class'], { type: 'number' }),
  mode: t(['Mode', 'Service Type', 'Equipment Mode']),
  origin_city: t(['Origin City', 'Shipper City', 'Pickup City', 'From City']),
  origin_state: t(['Origin State', 'Shipper State', 'Pickup State', 'From State']),
  origin_postal: t(['Origin Zip', 'Origin ZIP', 'Origin Postal', 'Origin Postal Code', 'Shipper Zip', 'From Zip']),
  dest_city: t(['Destination City', 'Dest City', 'Consignee City', 'Delivery City', 'To City']),
  dest_state: t(['Destination State', 'Dest State', 'Consignee State', 'Delivery State', 'To State']),
  dest_postal: t(['Destination Zip', 'Dest Zip', 'Destination ZIP', 'Destination Postal', 'Consignee Zip', 'To Zip']),
  currency: t(['Currency', 'Currency Code', 'Curr']),
});

export const SHIPMENT_FIELDS = Object.freeze({
  shipment_id: t(['Shipment ID', 'Load ID', 'Load Number', 'Load #', 'Order', 'Order Number', 'BOL', 'BOL Number', 'Bill of Lading'], { required: true }),
  pro: t(['PRO', 'PRO Number', 'Pro #', 'Tracking Number', 'Tracking']),
  bol: t(['BOL', 'BOL Number', 'Bill of Lading']),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC']),
  ship_date: t(['Ship Date', 'Pickup Date', 'Shipped', 'Actual Pickup'], { type: 'date' }),
  delivery_date: t(['Delivery Date', 'Delivered', 'Actual Delivery'], { type: 'date' }),
  weight: t(['Weight', 'BOL Weight', 'Gross Weight', 'Weight (lb)'], { type: 'number' }),
  pallets: t(['Pallets', 'Handling Units', 'Pallet Count'], { type: 'number' }),
  class: t(['Class', 'Freight Class'], { type: 'number' }),
  quoted_amount: t(['Quoted Amount', 'Quote', 'Rate Confirmation', 'Rate Con Amount', 'Agreed Rate', 'Expected Cost'], { type: 'money' }),
  accessorials_ordered: t(['Accessorials', 'Accessorials Ordered', 'Services', 'Special Services']),
  origin_city: t(['Origin City', 'Shipper City', 'Pickup City']),
  origin_state: t(['Origin State', 'Shipper State', 'Pickup State']),
  origin_postal: t(['Origin Zip', 'Origin Postal', 'Shipper Zip']),
  dest_city: t(['Destination City', 'Dest City', 'Consignee City']),
  dest_state: t(['Destination State', 'Dest State', 'Consignee State']),
  dest_postal: t(['Destination Zip', 'Dest Zip', 'Consignee Zip']),
  miles: t(['Miles', 'Mileage', 'Distance'], { type: 'number' }),
  mode: t(['Mode', 'Service Type']),
  cost_center: t(['Cost Center', 'Department', 'Business Unit', 'Division', 'Customer']),
  gl_account: t(['GL Account', 'Account', 'Expense Account', 'GL']),
  status: t(['Status', 'Shipment Status', 'Load Status']),
  arrived_at: t(['Arrived At', 'Arrival', 'Check In', 'Checked In', 'In Time', 'Gate In'], { type: 'datetime' }),
  departed_at: t(['Departed At', 'Departure', 'Check Out', 'Checked Out', 'Out Time', 'Gate Out'], { type: 'datetime' }),
});

/**
 * Named carrier-invoice exports (see exports.js). Written from knowledge of the
 * exports; none was checked against vendor documentation or a live account.
 */
export const INVOICE_PROFILES = Object.freeze([
  exportProfile('tms_freight_bill_lines', { invoice_number: 'Freight Bill Number', carrier: ['Carrier Name', 'Carrier', 'SCAC'], pro: ['Pro #', 'PRO'], ship_date: 'Pickup Date', amount: 'Invoice Total', weight: 'Billed Weight', origin_city: 'Shipper City', origin_state: 'Shipper State', origin_postal: 'Shipper Zip', dest_city: 'Consignee City', dest_state: 'Consignee State', dest_postal: 'Consignee Zip', charge_description: 'Charge Type', charge_amount: 'Line Amount' }),
  exportProfile('sap_tm_freight_settlement', { invoice_number: ['Supplier Invoice', 'Freight Settlement Document'], carrier: ['Carrier', 'Carrier Name', 'Supplier'], pro: ['Freight Order', 'Freight Unit'], invoice_date: ['Document Date', 'Posting Date'], amount: ['Net Amount', 'Net Value'], currency: ['Currency', 'Document Currency'], charge_description: ['Charge Type Description', 'Charge Type'], charge_amount: ['Charge Amount', 'Amount'], weight: { from: ['Gross Weight'], unit: 'kg' } }, { note: 'SAP TM settlement list: the supplier invoice number is used when the list has one, otherwise the settlement document. Gross weight is read as kilograms.' }),
  exportProfile('sap_tm_freight_settlement_de', { invoice_number: ['Lieferantenrechnung', 'Frachtabrechnungsbeleg'], carrier: ['Frachtführer', 'Spediteur', 'Lieferant'], pro: ['Frachtauftrag', 'Frachteinheit'], invoice_date: ['Belegdatum', 'Buchungsdatum'], amount: ['Nettobetrag', 'Nettowert'], currency: ['Währung', 'Belegwährung'], charge_description: ['Kostenartbezeichnung', 'Frachtkostenart', 'Kostenart'], charge_amount: ['Betrag der Kostenart', 'Betrag'], weight: { from: ['Bruttogewicht'], unit: 'kg' } }, { note: 'SAP TM settlement list with German labels: dates day-first, comma decimals, gross weight in kilograms.' }),
]);

export const FREIGHT_SOURCE_FIELDS = Object.freeze({ invoices: INVOICE_LINE_FIELDS, shipments: SHIPMENT_FIELDS });

/** True when a file looks like X12 (starts with ISA once a BOM and whitespace are skipped). */
export const looksX12 = (text) => /^\s*﻿?\s*ISA./.test(String(text).slice(0, 200));

/** Turn an X12 210 file into invoice-line rows in INVOICE_LINE_FIELDS names. */
export function x12InvoiceLines(text) {
  const r = readX12(text);
  const rows = [];
  for (const inv of invoicesFrom210(r.records)) {
    const base = { invoice_number: inv.invoice_number, carrier: inv.carrier, pro: inv.pro, bol: inv.bol, po: inv.po, invoice_date: inv.invoice_date, delivery_date: inv.delivery_date, amount: inv.amount, weight: inv.weight, origin_city: inv.origin_city, origin_state: inv.origin_state, origin_postal: inv.origin_postal, dest_city: inv.dest_city, dest_state: inv.dest_state, dest_postal: inv.dest_postal };
    if (!inv.charges.length) rows.push(base);
    for (const c of inv.charges) rows.push({ ...base, charge_description: c.code || c.description, charge_amount: c.amount });
  }
  return { rows, problems: r.problems, skipped_sets: r.skipped_sets };
}

/**
 * Read an invoice file through ctx: X12 210 or any table. Returns
 * { rows, x12 } where x12 holds envelope problems when the file was EDI.
 */
export function readInvoiceLines(ctx, path, kind = 'invoices') {
  const text = /\.(edi|x12|txt|210)$/i.test(path) ? ctx.readText(path) : null;
  if (text !== null && looksX12(text)) { const r = x12InvoiceLines(text); return { rows: r.rows, x12: { problems: r.problems, skipped_sets: r.skipped_sets } }; }
  return { rows: ctx.records(path, kind), x12: null };
}

/**
 * Group invoice-line rows into invoices. A row with a charge line adds a line;
 * a row without one is a whole-invoice row. The invoice total is the Invoice Total
 * column when present, otherwise the sum of the lines.
 */
export function groupInvoices(rows, { chargeAliases = {} } = {}) {
  const m = new Map();
  for (const r of rows) {
    const id = `${str(r.carrier).toLowerCase()}|${str(r.invoice_number)}`;
    if (!str(r.invoice_number)) continue;
    let inv = m.get(id);
    if (!inv) {
      inv = { invoice_number: str(r.invoice_number), carrier: str(r.carrier), pro: str(r.pro), bol: str(r.bol), po: str(r.po), invoice_date: r.invoice_date || null, ship_date: r.ship_date || null, delivery_date: r.delivery_date || null, stated_total: num(r.amount), weight: num(r.weight), miles: num(r.miles), pallets: num(r.pallets), class: num(r.class), mode: str(r.mode).toLowerCase() || null, currency: str(r.currency) || null,
        origin: { city: str(r.origin_city), state: str(r.origin_state), postal: str(r.origin_postal) }, destination: { city: str(r.dest_city), state: str(r.dest_state), postal: str(r.dest_postal) }, lines: [], source_rows: 0 };
      m.set(id, inv);
    }
    inv.source_rows++;
    for (const k of ['pro', 'bol', 'po']) if (!inv[k] && str(r[k])) inv[k] = str(r[k]);
    for (const k of ['weight', 'miles', 'pallets', 'class']) if (inv[k] === null && num(r[k]) !== null) inv[k] = num(r[k]);
    if (inv.stated_total === null && num(r.amount) !== null) inv.stated_total = num(r.amount);
    const amt = num(r.charge_amount);
    if (amt !== null || str(r.charge_description)) inv.lines.push({ description: str(r.charge_description) || 'charge', code: chargeCode(r.charge_description, chargeAliases), amount: amt ?? 0 });
  }
  for (const inv of m.values()) {
    inv.lines_total = inv.lines.length ? round2(inv.lines.reduce((s, l) => s + l.amount, 0)) : null;
    inv.total = inv.stated_total ?? inv.lines_total ?? 0;
    const by = {}; for (const l of inv.lines) by[l.code] = round2((by[l.code] || 0) + l.amount);
    inv.by_code = by;
  }
  return [...m.values()];
}
