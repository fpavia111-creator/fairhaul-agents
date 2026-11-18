# Fairhaul Freight Accruals (`fairhaul-freight-accruals`)

Builds the month-end freight accrual: every shipment that went out by period end with no carrier invoice dated by period end, with an estimate and where the estimate came from, totalled by GL account and cost center, and a draft journal entry. It also checks how accurate last month's accrual was. It never posts to your ledger.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-freight-accruals demo
npx -y fairhaul-freight-accruals mcp --root ./close
```

## How each shipment is estimated

1. **Invoice after period end**: the invoice arrived after the cut-off, so its amount is used.
2. **Quote**: the quoted or rate-confirmation amount on the shipment.
3. **Contract**: lane rate plus fuel from your contract file (the same format as Fairhaul Freight Bill Audit).
4. **Lane average**: the average of at least two invoices on the same carrier and lane.
5. **Carrier average**: the average of at least three invoices from the carrier.
6. Otherwise **no estimate**: listed with no amount so a person fills it in.

Cancelled shipments and shipments after period end are skipped and counted. Shipments older than 60 days with no invoice are called out; they are often lost bills or a carrier that never invoices.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-freight-accruals demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Freight Accruals demo (fictional shipments, period ending 2026-10-31) in <demo folder>

▶ Build the October freight accrual
  status: executed  decision: allow
  Period ending 2026-10-31: 7 shipment(s) shipped, 1 billed in period, 6 to accrue for 2970.5 (1 with no estimate), 1 older than 60 days. Last accrual: 2066 accrued vs 2130 billed (mean error 3.4%).
    S-2   Example Linehaul         410  quote
    S-3   Example Linehaul       172.5  invoice_after_period_end
    S-4   Sample Freightways      1624  contract_with_fuel
    S-5   Example Linehaul         414  contract_with_fuel
    S-6   Nova Carriers              -  no_estimate
    S-9   Example Linehaul         350  quote

▶ Write the accrual detail and the journal entry draft
  status: executed  decision: allow
  Accrual written: Period ending 2026-10-31: 7 shipment(s) shipped, 1 billed in period, 6 to accrue for 2970.5 (1 with no estimate), 1 older than 60 days. Last accrual: 2066 accrued vs 2130 billed (mean error 3.4%). Journal draft has 4 line(s).

▶ Approve the journal for posting: waits for a named person
  status: needs_approval  decision: ask
  reason: Posting to the ledger needs a named person's click.

▶ Same call after the click (recorded; a person posts it)
  status: executed  decision: ask  approved by: Dana Controller (fictional)
  Journal approved for posting (4 line(s)). Nothing was posted by the agent.

▶ Agent tries to post to the ledger itself
  status: blocked  decision: block
  reason: Fairhaul Freight Accruals never posts to your ledger; a person posts the reviewed entry.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `accruals_accrue` | List shipments shipped by period end with no invoice dated by period end, each with an estimate and its basis; totals by GL account and cost center; reversal and accuracy of the prior accrual. | runs |
| `accruals_write_report` | Write accruals-accrual.csv and .html (one row per shipment accrued, by cost center and the prior-period reversal) and journal-entry-draft.csv (debits by GL and cost center, one credit to accrued freight) into out_dir (… | runs |
| `accruals_request_post` | After one named human click, record in post-approvals.csv that the reviewed journal-entry-draft.csv (by sha256) may be posted. | asks first (Auto can be opted in) |
| `erp_post_journal` | Fairhaul Freight Accruals never posts to your ledger; a person posts the reviewed entry. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Shipments (`shipments`)

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

### Last period accrual (`prior`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, Load Number | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `amount` (required) | amount | Amount, Accrued, Accrual | Betrag, Montant, 金額, 金额 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-freight-accruals inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-freight-accruals demo
npx -y fairhaul-freight-accruals mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-freight-accruals": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-freight-accruals",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-freight-accruals -- npx -y fairhaul-freight-accruals mcp --root .`, or install the `fairhaul-freight-accruals` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-freight-accruals approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-freight-accruals approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-freight-accruals kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-freight-accruals tools                 # every tool, its policy and arguments
fairhaul-freight-accruals sources               # the columns each input is read from
fairhaul-freight-accruals inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-freight-accruals call accruals_accrue '{"shipments":"<shipments>","invoices":"<invoices>","period_end":"<period_end>"}'
fairhaul-freight-accruals eval                  # the private eval cases on the fictional fixtures
fairhaul-freight-accruals demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Estimates are estimates. The basis is shown on every line so a reviewer can challenge it.
- Matching uses shipment id, PRO, BOL and PO. A carrier that invoices under another reference will look unbilled.
- Not accounting advice. Your controller decides the accrual and posts it.
