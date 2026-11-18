# Fairhaul Fuel Surcharges (`fairhaul-fuel-surcharges`)

Checks every fuel surcharge against the carrier's fuel table at the diesel price for the week the load shipped. It finds invoices priced on the wrong week (usually the week the carrier invoiced, after diesel rose), compares carriers' fuel tables side by side and shows what a diesel move would have cost. It drafts disputes; it never pays, short-pays or sends.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-fuel-surcharges demo
npx -y fairhaul-fuel-surcharges mcp --root ./freight
```

## Inputs

- **Invoices** with a linehaul line and a fuel line (CSV, Excel, JSON or X12 210), ship date and, for per-mile tables, miles.
- **Contract** in the Fairhaul contract format (the same as Fairhaul Freight Bill Audit): each carrier's `fuel` table (`pct_of_linehaul` or `per_mile`, rows by diesel price) and `fuel_index`, the weekly diesel prices you copy from the index your agreements name. Fairhaul Fuel Surcharges does not fetch prices.

## Statuses

`ok`, `fuel_over`, `wrong_week` (the billed amount matches another week's price), `fuel_under`, `fuel_not_billed`, `fuel_not_in_contract`, `index_stale` (no index week within 7 days before the ship date), `not_checked` (no miles or no linehaul line, or diesel outside the table), `no_index`, `no_contract`, `contract_expired`, `no_date`.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-fuel-surcharges demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Fuel Surcharges demo (fictional carriers and diesel prices, autumn 2026) in <demo folder>

▶ Check every fuel surcharge against the table and the diesel week
  status: executed  decision: allow
  11 invoice(s), 2721 fuel billed: 3 over the table for 130 (2 priced on the wrong diesel week); 2 could not be checked. Latest index week 2026-11-02 (4.08).
    F-1001 Ridgeline Freight  billed    192  table    192  ok
    F-1002 Ridgeline Freight  billed    255  table    255  ok
    F-1003 Coastal Line Haul  billed    450  table    450  ok
    F-1004 Coastal Line Haul  billed    495  table    405  wrong_week
    F-1005 Prairie Express    billed    210  table    180  wrong_week
    F-1006 Prairie Express    billed    205  table    195  fuel_over
    F-1007 Ridgeline Freight  billed    204  table    204  index_stale
    F-1008 Coastal Line Haul  billed    480  table      -  not_checked
    F-1009 Summit Carriers    billed     60  table      -  fuel_not_in_contract
    F-1010 Ridgeline Freight  billed    120  table    128  fuel_under
    F-1011 Northgate Haulers  billed     50  table      -  no_contract

▶ Compare the fuel tables at today's diesel
  status: executed  decision: allow
  At diesel 4.08 on a 1000 linehaul, 500-mile load, the highest fuel table is Coastal Line Haul and the lowest is Ridgeline Freight.

▶ What a 10-cent diesel rise costs
  status: executed  decision: allow
  A 0.1 move in diesel would have changed fuel on 8 invoice(s) by 75 (from 2009 to 2084). Tables move in steps, so small moves can change nothing.

▶ Write the fuel report
  status: executed  decision: allow
  Fuel report written. 11 invoice(s), 2721 fuel billed: 3 over the table for 130 (2 priced on the wrong diesel week); 2 could not be checked. Latest index week 2026-11-02 (4.08).

▶ Draft the dispute for the carrier billing on the wrong week
  status: executed  decision: allow  (auto)
  dispute Prairie Express drafted for 40 with 1 open marker(s) ([TO CONFIRM index name and source]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Sam Lee (fictional)
  dispute Prairie-Express approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to short-pay the invoice itself
  status: blocked  decision: block
  reason: Fairhaul Fuel Surcharges never pays or short-pays carriers.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `fuel_check` | For each invoice: billed fuel, the table amount at the diesel price for the week it shipped, the difference and a status (ok, fuel_over, wrong_week, fuel_under, fuel_not_billed, fuel_not_in_contract, index_stale, not_… | runs |
| `fuel_compare` | Each carrier's fuel surcharge at several diesel prices for one reference load, so tables with different bases (percent of linehaul or per mile) can be compared. | runs |
| `fuel_sensitivity` | Reprice the fuel on these invoices with diesel moved by step dollars per gallon and report the change, by carrier. | runs |
| `fuel_write_report` | Write fuel.csv and .html (one row per invoice with the table amount and status, totals by carrier, the table comparison) into out_dir (default lodestar-out/fuel). | runs |
| `fuel_draft_dispute` | Write drafts/dispute-<carrier>.md listing each invoice whose fuel surcharge is above the carrier's table at the diesel price for the week it shipped, including invoices priced on a later week. | asks first (Auto can be opted in) |
| `fuel_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_pay_invoice` | Fairhaul Fuel Surcharges never pays or short-pays carriers. | refused |
| `email_send` | Fairhaul Fuel Surcharges never sends email. | refused |

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

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-fuel-surcharges inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-fuel-surcharges demo
npx -y fairhaul-fuel-surcharges mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-fuel-surcharges": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-fuel-surcharges",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-fuel-surcharges -- npx -y fairhaul-fuel-surcharges mcp --root .`, or install the `fairhaul-fuel-surcharges` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-fuel-surcharges approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-fuel-surcharges approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-fuel-surcharges kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-fuel-surcharges tools                 # every tool, its policy and arguments
fairhaul-fuel-surcharges sources               # the columns each input is read from
fairhaul-fuel-surcharges inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-fuel-surcharges call fuel_check '{"invoices":"<invoices>","contract":"<contract>"}'
fairhaul-fuel-surcharges eval                  # the private eval cases on the fictional fixtures
fairhaul-fuel-surcharges demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- The week rule is "latest index week on or before the ship date". Some agreements use the pickup week, the invoice week or a lag; check yours before you dispute.
- Fuel as a percent of linehaul uses the linehaul line less any discount line.
- It reads only the files you give it and is not a tariff service.
