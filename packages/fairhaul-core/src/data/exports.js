// Catalogue of export files from real freight, parcel, customs and accounting
// systems that the Fairhaul agents recognise.
//
// Each entry says how to recognise the file (column names that must be there).
// An agent turns an entry into a profile by adding its own column map:
//
//   exportProfile('slack_members', { user: 'fullname', email: 'email' })
//
// basis:
//   'documented'  the column names were checked against the vendor's own
//                 documentation (source and date given);
//   'recalled'    the layout was written from knowledge of the export and was
//                 not checked against documentation or a live account.
// Neither kind was tested against a live account. When a header differs, the
// file still maps by each column's "also called" list, `inspect` shows what was
// matched, and fairhaul-sources.json names the columns by hand.

const e = (id, system, label, signature, extra = {}) => Object.freeze({ id, system, label, signature, basis: 'recalled', ...extra });

export const EXPORTS = Object.freeze(Object.fromEntries([
  // Carrier invoices and freight audit
  e('tms_freight_bill_lines', 'TMS (generic)', 'Freight bill export, one row per charge line', ['Freight Bill Number', 'Charge Type', 'Line Amount']),
  e('sap_tm_freight_settlement', 'SAP Transportation Management', 'Freight settlement documents, list export with English labels', ['Freight Settlement Document', 'Freight Order', ['Net Amount', 'Net Value']]),
  e('sap_tm_freight_settlement_de', 'SAP Transportation Management', 'Frachtabrechnungsbelege, Listenexport mit deutschen Bezeichnungen', ['Frachtabrechnungsbeleg', 'Frachtauftrag'], { dateOrder: 'dmy', decimal: ',' }),
  // Parcel invoice data
  e('fedex_fbo_csv', 'FedEx Billing Online', 'Invoice download (CSV)', ['Express or Ground Tracking ID', 'Net Charge Amount']),
  e('ups_billing_data', 'UPS Billing Center', 'Billing data file with its header row (CSV)', ['Lead Shipment Number', 'Tracking Number', 'Net Amount', 'Charge Description']),
  e('shipstation_shipments', 'ShipStation', 'Shipments > Export (CSV)', ['Order Number', 'Tracking Number', ['Shipping Cost', 'Shipment Cost', 'Label Cost']]),
  // Ocean and customs
  e('container_milestones', 'Container visibility platform (generic)', 'Container milestones export, one row per container', ['Container Number', ['Discharge Date', 'Vessel Discharge'], ['Last Free Day', 'LFD']]),
  e('ace_es003_lines', 'U.S. CBP ACE Reports', 'Entry Summary Line Details (ES-003) export', ['Entry Summary Number', 'Entry Summary Line Number']),
  // Accounts payable and sales (for duplicates, accruals and margins)
  e('netsuite_transactions', 'NetSuite', 'Transaction saved search (default column labels)', ['Document Number', 'Date', 'Name', 'Amount']),
  e('qbo_transaction_list_by_vendor', 'QuickBooks Online', 'Transaction List by Vendor report (CSV or Excel)', ['Transaction Type', 'Num', 'Amount'], { dropTotals: true }),
  e('xero_bills', 'Xero', 'Bills > Export (CSV)', ['ContactName', 'InvoiceNumber', 'Total']),
  e('sap_fbl1n_items', 'SAP S/4HANA or ECC', 'Vendor line items (FBL1N) list export, English labels', [['Vendor', 'Supplier', 'Account'], 'Document Number', ['Amount in Doc. Curr.', 'Amount in Local Currency'], 'Reference']),
  e('shopify_orders', 'Shopify', 'Orders > Export (CSV)', ['Name', 'Financial Status', 'Lineitem name']),
].map((x) => [x.id, x])));

export const EXPORTS_BASIS_NOTE = 'Where a layout says "checked", its column names were compared with the vendor\'s documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.';
