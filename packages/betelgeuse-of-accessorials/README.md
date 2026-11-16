# Betelgeuse of Accessorials (`betelgeuse-of-accessorials`)

Shows where your accessorial charges come from: by type, by delivery location and by carrier. It flags charges you could have ordered up front but did not (liftgate, residential, appointment and similar), charges above your contract, and locations where the same charge keeps coming back. For those it drafts the address-book changes that make quotes, tenders and BOLs include the service, so it stops arriving as a surprise. It never changes your TMS.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y betelgeuse-of-accessorials demo
npx -y betelgeuse-of-accessorials mcp --root ./freight
```

## What it reads

- **Invoices** with charge lines and the destination (CSV, Excel, JSON or X12 210).
- **Shipments** (optional) with the accessorials ordered, matched by shipment id, PRO, BOL or PO. Without them it still totals and finds repeats, but cannot say what was ordered.
- **Contract** (optional), the Lodestar contract format, for charges above the agreed amount.

Orderable accessorials: liftgate, residential, inside, limited access, appointment, hazmat, sort and segregate, signature, Saturday, declared value, overlength, delivery area. Detention, redelivery, lumper, reweigh and similar are caused by events, so they are never called unordered; repeats of them still show up with a suggested fix.


<!-- generated:start -->

## A demo run

`npx -y betelgeuse-of-accessorials demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Betelgeuse of Accessorials demo (fictional loads, October 2026) in <demo folder>

▶ Find where the accessorial charges come from
  status: executed  decision: allow
  9 invoice(s): accessorials 890 of 4750 freight (18.7%). 6 charge(s) billed but not ordered (380); 1 above contract (10); 4 repeat(s) to fix at the source.
    Austin TX 78701  Residential delivery or pickup x3 (ordered 0)  300
    Tulsa OK 74103   Detention / waiting time x2 (ordered 0)  250
    Austin TX 78701  Liftgate               x3 (ordered 1)  100
    Dallas TX 75201  Appointment or notify  x2 (ordered 1)  30

▶ Write the accessorial report
  status: executed  decision: allow
  Accessorial report written. 9 invoice(s): accessorials 890 of 4750 freight (18.7%). 6 charge(s) billed but not ordered (380); 1 above contract (10); 4 repeat(s) to fix at the source.

▶ Draft the address-book changes
  status: executed  decision: allow  (auto)
  address update address-book drafted for 680 with 1 open marker(s) ([TO CONFIRM who maintains the address book]). Nothing was sent.

▶ Approve the change list: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the click (recorded; a person changes the TMS)
  status: executed  decision: ask  approved by: Sam Lee (fictional)
  address update address-book approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to change the TMS address book itself
  status: blocked  decision: block
  reason: Betelgeuse never changes your TMS or ERP address book; a person does.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `betelgeuse_analyse` | Accessorial charges by type, location and carrier; charges a shipper could have ordered but did not; charges above the contract; and repeats at the same location with the address-book change that stops them. | runs |
| `betelgeuse_write_report` | Write betelgeuse-accessorials.csv and .html (one row per accessorial charge; repeats to fix; totals by type, location and carrier) into out_dir (default lodestar-out/betelgeuse). | runs |
| `betelgeuse_draft_address_update` | Write drafts/address_update-<name>.md: the address-book changes (residential, liftgate, appointment and similar flags) for every location with repeat accessorials. | asks first (Auto can be opted in) |
| `betelgeuse_request_apply` | After one named human click (even in Auto), record that the reviewed address update draft is approved in address_update-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `tms_update_address` | Betelgeuse never changes your TMS or ERP address book; a person does. | refused |
| `ap_pay_invoice` | Betelgeuse never pays or short-pays carriers. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Carrier invoices (`invoices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `invoice_number` (required) | text | Invoice Number, Invoice No, Invoice #, Invoice, Freight Bill Number, Freight Bill | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `carrier` | text | Carrier, Carrier Name, SCAC, Vendor, Vendor Name, Supplier | Spediteur, Transporteur, 運送会社, 承运商 |
| `pro` | text | PRO, PRO Number, Pro #, Pro No, Tracking Number, Tracking | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `bol` | text | BOL, BOL Number, Bill of Lading, B/L, BOL # | Frachtbrief, Lettre de voiture, 船荷証券番号, 提单号 |
| `po` | text | PO, PO Number, Purchase Order, Customer Reference, Reference | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `invoice_date` | date | Invoice Date, Bill Date, Billed Date, Inv Date | Rechnungsdatum, Date de facture, 請求日, 发票日期 |
| `ship_date` | date | Ship Date, Pickup Date, Shipped, Pickup, Shipment Date | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `delivery_date` | date | Delivery Date, Delivered, Delivered Date, Actual Delivery | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `amount` | amount | Invoice Total, Invoice Amount, Total Charges, Total, Net Charge, Amount Due | Betrag, Montant, 金額, 金额 |
| `charge_description` | text | Charge Description, Charge, Charge Type, Description, Accessorial, Charge Code | Leistungsbeschreibung, Libellé de la prestation, 請求項目, 费用名称 |
| `charge_amount` | amount | Charge Amount, Line Amount, Line Total, Amount, Charge Amt | Gebührenbetrag, Montant de la ligne, 明細金額, 费用金额 |
| `weight` | pounds (kg converted) | Weight, Billed Weight, Total Weight, Weight (lb), Weight lbs, Rated Weight | Gewicht, Poids, 重量, 重量 |
| `miles` | miles (km converted) | Miles, Mileage, Distance, Loaded Miles | Entfernung, Distance, 距離, 距离 |
| `pallets` | number | Pallets, Pallet Count, Handling Units, Skids | Paletten, Palettes, パレット数, 托盘数 |
| `class` | number | Class, Freight Class, NMFC Class | - |
| `mode` | text | Mode, Service Type, Equipment Mode | Verkehrsträger, Mode de transport, 輸送モード, 运输方式 |
| `origin_city` | text | Origin City, Shipper City, Pickup City, From City | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `origin_state` | text | Origin State, Shipper State, Pickup State, From State | - |
| `origin_postal` | text | Origin Zip, Origin ZIP, Origin Postal, Origin Postal Code, Shipper Zip, From Zip | PLZ Abgang, Code postal départ, 出荷元郵便番号, 始发地邮编 |
| `dest_city` | text | Destination City, Dest City, Consignee City, Delivery City, To City | Bestimmungsort, Destination, 届け先, 目的地 |
| `dest_state` | text | Destination State, Dest State, Consignee State, Delivery State, To State | - |
| `dest_postal` | text | Destination Zip, Dest Zip, Destination ZIP, Destination Postal, Consignee Zip, To Zip | PLZ Empfänger, Code postal destination, 届け先郵便番号, 目的地邮编 |
| `currency` | text | Currency, Currency Code, Curr | Währung, Devise, 通貨, 币种 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| TMS (generic) | Freight bill export, one row per charge line | Freight Bill Number, Charge Type, Line Amount | no |
| SAP Transportation Management | Freight settlement documents, list export with English labels | Freight Settlement Document, Freight Order, Net Amount or Net Value | no |
| SAP Transportation Management | Frachtabrechnungsbelege, Listenexport mit deutschen Bezeichnungen | Frachtabrechnungsbeleg, Frachtauftrag | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Shipments with accessorials ordered (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, Load Number, Load #, Order, Order Number | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `pro` | text | PRO, PRO Number, Pro #, Tracking Number, Tracking | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `bol` | text | BOL, BOL Number, Bill of Lading | Frachtbrief, Lettre de voiture, 船荷証券番号, 提单号 |
| `carrier` | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `ship_date` | date | Ship Date, Pickup Date, Shipped, Actual Pickup | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `delivery_date` | date | Delivery Date, Delivered, Actual Delivery | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `weight` | pounds (kg converted) | Weight, BOL Weight, Gross Weight, Weight (lb) | Gewicht, Poids, 重量, 重量 |
| `pallets` | number | Pallets, Handling Units, Pallet Count | Paletten, Palettes, パレット数, 托盘数 |
| `class` | number | Class, Freight Class | - |
| `quoted_amount` | amount | Quoted Amount, Quote, Rate Confirmation, Rate Con Amount, Agreed Rate, Expected Cost | Angebotspreis, Montant du devis, 見積金額, 报价金额 |
| `accessorials_ordered` | text | Accessorials, Accessorials Ordered, Services, Special Services | Zusatzleistungen, Prestations annexes, 付帯作業, 附加服务 |
| `origin_city` | text | Origin City, Shipper City, Pickup City | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `origin_state` | text | Origin State, Shipper State, Pickup State | - |
| `origin_postal` | text | Origin Zip, Origin Postal, Shipper Zip | PLZ Abgang, Code postal départ, 出荷元郵便番号, 始发地邮编 |
| `dest_city` | text | Destination City, Dest City, Consignee City | Bestimmungsort, Destination, 届け先, 目的地 |
| `dest_state` | text | Destination State, Dest State, Consignee State | - |
| `dest_postal` | text | Destination Zip, Dest Zip, Consignee Zip | PLZ Empfänger, Code postal destination, 届け先郵便番号, 目的地邮编 |
| `miles` | miles (km converted) | Miles, Mileage, Distance | Entfernung, Distance, 距離, 距离 |
| `mode` | text | Mode, Service Type | Verkehrsträger, Mode de transport, 輸送モード, 运输方式 |
| `cost_center` | text | Cost Center, Department, Business Unit, Division, Customer | Kostenstelle, Centre de coût, 原価センタ, 成本中心 |
| `gl_account` | text | GL Account, Account, Expense Account, GL | Konto, Compte, 勘定科目, 科目代码 |
| `status` | text | Status, Shipment Status, Load Status | Status, Statut, ステータス, 状态 |
| `arrived_at` | date and time | Arrived At, Arrival, Check In, Checked In, In Time, Gate In | Ankunft, Arrivée, 到着日時, 到达时间 |
| `departed_at` | date and time | Departed At, Departure, Check Out, Checked Out, Out Time, Gate Out | Abfahrt, Départ, 出発日時, 离开时间 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx betelgeuse-of-accessorials inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y betelgeuse-of-accessorials demo
npx -y betelgeuse-of-accessorials mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "betelgeuse-of-accessorials": {
      "command": "npx",
      "args": [
        "-y",
        "betelgeuse-of-accessorials",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add betelgeuse-of-accessorials -- npx -y betelgeuse-of-accessorials mcp --root .`, or install the `betelgeuse-of-accessorials` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `betelgeuse-of-accessorials approve <id> --as "Your Name"` (or on the local approvals page, `betelgeuse-of-accessorials approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`betelgeuse-of-accessorials kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
betelgeuse-of-accessorials tools                 # every tool, its policy and arguments
betelgeuse-of-accessorials sources               # the columns each input is read from
betelgeuse-of-accessorials inspect <file>        # how a file would be read (names and shapes, never values)
betelgeuse-of-accessorials call betelgeuse_analyse '{"invoices":"<invoices>"}'
betelgeuse-of-accessorials eval                  # the private eval cases on the fictional fixtures
betelgeuse-of-accessorials demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- An unordered charge is often real: a home with no dock needs a liftgate. Use the report to fix your data first and dispute second; Polaris of Bills drafts disputes.
- Locations are grouped by the destination city, state and postal code on the invoice or shipment, so two spellings of one address count as two places.
