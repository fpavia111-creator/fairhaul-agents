# Fairhaul Parcel Refunds (`fairhaul-parcel-refunds`)

Finds refundable charges in your UPS, FedEx, DHL and USPS invoice data and tells you the date by which to ask for each one. Parcel refund windows are short, so every finding carries a request-by date, and the report includes a calendar with reminders. It drafts the refund request; a person files it.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-parcel-refunds demo
npx -y fairhaul-parcel-refunds mcp --root ./parcel-data
```

## What it finds

| Finding | Refundable amount |
|---|---|
| `late_delivery`: delivered after the commitment on a guaranteed service | Transportation and fuel |
| `late_no_guarantee`: late, but the service is not guaranteed or your terms waive it | Tracked for performance only |
| `duplicate_tracking`: the same tracking number on two invoices | The second charge |
| `voided_label_billed`: a label in your void list was billed | The charge |
| `residential_on_business`: residential charge on an address in your business list | The surcharge |
| `dim_overbilled`: billed weight above what your dimensions and weight give | Estimated, pro rata to weight |
| `address_correction`: correction charges, with repeats to the same address called out | Review (fix the address book) |
| `missing_delivery_scan`: committed date passed a week ago with no delivery on file | Review |

Each package gets a request-by date (invoice date plus `claim_window_days`, default 15) and a status: `claim`, `window_closed`, `review` or `ok`. Anything due within 3 days is listed as urgent.


## Terms file (optional)

`dim_divisor` (default 139), `guarantee_waived`, `guaranteed_services` (defaults cover common overnight, 2-day, 3-day and ground services; edit to match your agreement), `claim_window_days`, `late_grace_minutes`, `commercial_addresses`, `charge_aliases`.

<!-- generated:start -->

## A demo run

`npx -y fairhaul-parcel-refunds demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Parcel Refunds demo (fictional packages, as of 2026-11-16), Auto mode on

▶ Audit eleven parcel charges
  status: executed  decision: allow
  11 package(s), 275.16 billed: 5 to claim (85.93 still in window), 1 past the window (45 lost), 3 to review, 2 clean.
    1ZEX0000000000001   UPS    claim            49.3  by 2026-11-20  late_delivery
    1ZEX0000000000002   UPS    claim            5.85  by 2026-11-20  residential_on_business
    1ZEX0000000000003   UPS    claim            7.65  by 2026-11-20  dim_overbilled
    1ZEX0000000000004   UPS    ok                  0  by 2026-11-20  
    1ZEX0000000000004   UPS    claim           11.93  by 2026-11-27  duplicate_tracking
    1ZEX0000000000005   UPS    claim            11.2  by 2026-11-27  voided_label_billed
    1ZEX0000000000006   UPS    review              0  by 2026-11-27  address_correction
    1ZEX0000000000007   UPS    review              0  by 2026-11-27  address_correction
    748900000001        FedEx  window_closed      45  by 2026-11-04  late_delivery
    748900000002        FedEx  ok                  0  by 2026-11-25  
    748900000003        FedEx  review              0  by 2026-11-25  missing_delivery_scan

▶ Same data when the agreement waives the delivery guarantee
  status: executed  decision: allow
  11 package(s), 275.16 billed: 3 to claim (30.78 still in window), 0 past the window (0 lost), 5 to review, 3 clean.

▶ Write the worklist and the claim-deadline calendar
  status: executed  decision: allow
  Parcel worklist written: 11 package(s), 275.16 billed: 5 to claim (85.93 still in window), 1 past the window (45 lost), 3 to review, 2 clean.

▶ Draft the UPS refund request
  status: executed  decision: allow  (auto)
  refund request UPS drafted for 85.93 with 1 open marker(s) ([TO CONFIRM UPS billing adjustments contact or portal]). Nothing was sent.

▶ Auto: approve submitting it, which stays one click (and the draft still has an open To line)
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to file in the carrier portal itself
  status: blocked  decision: block
  reason: Fairhaul Parcel Refunds never logs in to UPS, FedEx, DHL or USPS billing portals; a person files the request.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `parcels_audit` | Check every package for refundable charges and give a request-by date for each. | runs |
| `parcels_explain` | Show one package's charges, findings and request-by date. | runs |
| `parcels_write_report` | Write parcels-audit.csv and .html (one row per package with findings) and claim-deadlines.ics (one event per carrier and request-by date) into out_dir (default lodestar-out/parcels). | runs |
| `parcels_draft_refund_request` | Write drafts/refund_request-<carrier>.md listing every package of one carrier that is still inside the claim window, with amount, reason and request-by date. | asks first (Auto can be opted in) |
| `parcels_request_submit` | After one named human click (even in Auto), record that the reviewed refund request draft is approved in refund_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `carrier_portal_submit` | Fairhaul Parcel Refunds never logs in to UPS, FedEx, DHL or USPS billing portals; a person files the request. | refused |
| `ap_pay_invoice` | Fairhaul Parcel Refunds never pays carrier invoices. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Parcel invoice data (`invoices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `tracking` (required) | text | Tracking Number, Tracking ID, Express or Ground Tracking ID, Lead Shipment Number, Package Tracking Number, Waybill | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `invoice_number` | text | Invoice Number, Invoice No, Invoice | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `invoice_date` | date | Invoice Date, Bill Date | Rechnungsdatum, Date de facture, 請求日, 发票日期 |
| `carrier` | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `service` | text | Service, Service Type, Service Level, Product | Service, Service, サービス, 服务 |
| `ship_date` | date | Ship Date, Shipment Date, Pickup Date | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `promised_at` | date and time | Promised Delivery, Commit Date, Guaranteed By, Scheduled Delivery, Delivery Commitment | Liefertermin, Date de livraison prévue, 納期, 承诺送达日期 |
| `delivered_at` | date and time | Delivered At, Delivery Date, POD Date, Actual Delivery | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `zone` | text | Zone, Zone Code | Zone, Zone, ゾーン, 区域 |
| `actual_weight` | pounds (kg converted) | Actual Weight, Entered Weight, Weight | Gewicht, Poids, 重量, 重量 |
| `billed_weight` | pounds (kg converted) | Billed Weight, Rated Weight, Rated Weight Amount, Chargeable Weight | Frachtpflichtiges Gewicht, Poids taxable, 課金重量, 计费重量 |
| `length` | inches (cm converted) | Length, Dim Length, Package Length | Länge, Longueur, 長さ, 长 |
| `width` | inches (cm converted) | Width, Dim Width, Package Width | Breite, Largeur, 幅, 宽 |
| `height` | inches (cm converted) | Height, Dim Height, Package Height | Höhe, Hauteur, 高さ, 高 |
| `recipient_address` | text | Recipient Address, Ship To Address, Consignee Address, Recipient Address Line 1, Delivery Address | Adresse, Adresse, 住所, 地址 |
| `recipient_postal` | text | Recipient Zip, Ship To Zip, Recipient Postal Code, Delivery Zip | PLZ Empfänger, Code postal destination, 届け先郵便番号, 目的地邮编 |
| `charge_description` | text | Charge Description, Charge, Tracking ID Charge Description, Charge Type, Surcharge | Leistungsbeschreibung, Libellé de la prestation, 請求項目, 费用名称 |
| `charge_amount` | amount | Charge Amount, Net Charge, Net Charge Amount, Tracking ID Charge Amount, Amount, Billed Charge | Gebührenbetrag, Montant de la ligne, 明細金額, 费用金额 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| FedEx Billing Online | Invoice download (CSV) | Express or Ground Tracking ID, Net Charge Amount | no |
| UPS Billing Center | Billing data file with its header row (CSV) | Lead Shipment Number, Tracking Number, Net Amount, Charge Description | no |
| ShipStation | Shipments > Export (CSV) | Order Number, Tracking Number, Shipping Cost or Shipment Cost or Label Cost | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Voided labels (`voids`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `tracking` (required) | text | Tracking Number, Tracking, Tracking ID | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-parcel-refunds inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-parcel-refunds demo
npx -y fairhaul-parcel-refunds mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-parcel-refunds": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-parcel-refunds",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-parcel-refunds -- npx -y fairhaul-parcel-refunds mcp --root .`, or install the `fairhaul-parcel-refunds` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-parcel-refunds approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-parcel-refunds approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-parcel-refunds kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-parcel-refunds tools                 # every tool, its policy and arguments
fairhaul-parcel-refunds sources               # the columns each input is read from
fairhaul-parcel-refunds inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-parcel-refunds call parcels_audit '{"invoices":"<invoices>"}'
fairhaul-parcel-refunds eval                  # the private eval cases on the fictional fixtures
fairhaul-parcel-refunds demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Many shipping agreements waive or suspend the delivery guarantee. Set `guarantee_waived` when yours does; Fairhaul Parcel Refunds cannot know.
- Dimensional-weight refunds are estimates; the exact amount needs the carrier's rate for each weight.
- Carrier column names (for example *Express or Ground Tracking ID*, *Tracking ID Charge Amount*) were written from knowledge of the exports and not tested against a live account. `fairhaul-parcel-refunds inspect <file>` shows how a file is read.
- Not legal advice. A person decides what to request and files it.
