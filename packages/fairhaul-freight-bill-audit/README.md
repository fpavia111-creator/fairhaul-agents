# Fairhaul Freight Bill Audit (`fairhaul-freight-bill-audit`)

Audits truckload and LTL freight bills against **your own contract** and tells you how much to dispute, invoice by invoice. It reads the files you already have (carrier invoices as CSV, Excel, JSON or X12 210, your contract as JSON, and optionally your shipment list and paid history), writes a worklist, and drafts dispute letters. It never pays a carrier and never sends anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-freight-bill-audit demo      # fictional carriers and invoices
npx -y fairhaul-freight-bill-audit mcp --root ./freight
```

## What it checks

| Finding | Meaning | Counted as disputable |
|---|---|---|
| `duplicate_invoice`, `duplicate_pro` | Same invoice number, or the same PRO billed twice | Whole invoice |
| `already_paid` | Invoice number or PRO is in your paid history | Whole invoice |
| `lines_do_not_add_up` | Charge lines do not add up to the invoice total | The difference |
| `linehaul_over` | Linehaul above the contract lane (flat, per mile, per cwt, per lb, per pallet, with minimums and discount) | The excess |
| `fuel_over` | Fuel above your fuel table at the diesel price for that week | The excess |
| `accessorial_not_allowed` | The contract says the charge is not allowed | The charge |
| `accessorial_over` | Above the contract amount, hourly rate after free time, or cap | The excess |
| `accessorial_not_ordered` | Liftgate, residential, inside delivery and similar charges that your shipment record does not list | The charge |
| `accessorial_unpriced` | A charge the contract does not price | Needs review |
| `weight_over_bol`, `quote_exceeded` | Billed weight more than 5% over the BOL, or the total above the quote | Needs review |
| `no_contract`, `contract_expired`, `no_lane`, `rate_needs_data`, `fuel_not_checked` | Fairhaul Freight Bill Audit could not check the bill and says what is missing | Needs review |

An invoice with anything it could not check is marked **review**, never **ok**.


## Files it reads

- **Invoices**: one row per invoice or per charge line. Column names such as *Freight Bill Number*, *Pro #*, *Charge Type*, *Line Amount*, *Shipper Zip* are recognised; `fairhaul-freight-bill-audit inspect <file>` shows how a file is read without printing values. X12 210 files (`.edi`, `.x12`) are read directly, with envelope and segment-count checks.
- **Contract** (`freight_contract` schema): carriers with SCAC and aliases, effective dates, lanes (ZIP, ZIP3, ZIP3 range, state or "City, ST"), minimums, discount, fuel table (percent of linehaul or per mile), accessorial terms, and a `fuel_index` of weekly diesel prices that you copy from your index source. See [`fixtures/contract.json`](fixtures/contract.json).
- **Shipments** (optional): BOL weight, quoted amount, accessorials ordered, arrival and departure times (for detention).
- **Paid history** (optional): invoice number, carrier, PRO.

<!-- generated:start -->

## A demo run

`npx -y fairhaul-freight-bill-audit demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Freight Bill Audit demo (fictional carriers, lanes and invoices), Auto mode on

▶ Audit eleven freight bills against the contract
  status: executed  decision: allow
  11 invoice(s), 7046.3 billed: 4 to dispute, 2 duplicate(s), 4 need review, 1 clean. Disputable 1065.8 (15.13% of billed).
    INV-7001  Example Linehaul       454.8  dispute      15.8  fuel_over, accessorial_over
    INV-7002  Example Linehaul       257.5  dispute        85  accessorial_not_allowed
    INV-7003  Example Linehaul         414  ok              0  
    INV-7004  Example Linehaul         414  duplicate     414  duplicate_pro
    INV-7005  Example Linehaul         414  duplicate     414  already_paid
    INV-7006  Example Linehaul         420  dispute         6  lines_do_not_add_up
    INV-7007  Example Linehaul         414  review          0  weight_over_bol
    INV-8101  Sample Freightways      2083  dispute       131  linehaul_over, accessorial_over, accessorial_over, quote_exceeded
    INV-8102  Sample Freightways      1600  review          0  rate_needs_data
    INV-9001  Test Carrier Co          300  review          0  contract_expired
    INV-9100  Unknown Haulers          275  review          0  no_contract

▶ Explain INV-8101 (truckload: linehaul, detention, lumper)
  status: executed  decision: allow
  INV-8101 (Sample Freightways): dispute, billed 2083, disputable 131. Linehaul billed 1400, contract allows 1344 (per mile 2.4, minimum 500). Detention / waiting time billed 200, contract allows 150. Lumper / unloading billed 175, contract allows 150. Invoice total 2083 is 83 over the quoted 2000. Check what changed.

▶ Read the same carrier bills from an X12 210 file
  status: executed  decision: allow
  2 invoice(s), 604.8 billed: 1 to dispute, 0 duplicate(s), 0 need review, 1 clean. Disputable 12.2 (2.02% of billed).

▶ Write the audit worklist
  status: executed  decision: allow
  Audit worklist written: 11 invoice(s), 7046.3 billed: 4 to dispute, 2 duplicate(s), 4 need review, 1 clean. Disputable 1065.8 (15.13% of billed).

▶ Draft a dispute letter to Example Linehaul (Auto is opted in for drafts here)
  status: executed  decision: allow  (auto)
  dispute Example Linehaul drafted for 934.8 with 1 open marker(s) ([ATTACH contract pages or rate confirmation that apply]). Nothing was sent.

▶ Auto: approve sending the dispute, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the human click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Dana Logistics Lead (fictional)
  dispute Example-Linehaul approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to pay the carrier itself
  status: blocked  decision: block
  reason: Fairhaul Freight Bill Audit never pays carriers; your AP team pays the approved amount.

Audit log: <demo folder>
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `bills_audit` | Check every invoice against the contract and flag duplicates, paid-before bills, linehaul over contract, fuel over table, accessorials not allowed, unpriced or not ordered, math errors and weights over the BOL. | runs |
| `bills_explain` | Show one invoice's charge lines, the contract amounts they were checked against, and every finding with its reason. | runs |
| `bills_write_report` | Write bills-audit.csv (one row per invoice with blank decision columns) and bills-audit.html (totals by carrier and finding) into out_dir (default lodestar-out/bills). | runs |
| `bills_draft_dispute` | Write drafts/dispute-<carrier>.md: one dispute letter to one carrier listing every disputed invoice with the amount and the contract reason. | asks first (Auto can be opted in) |
| `bills_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `bills_request_pay` | After one named human click (even in Auto), record in pay-approvals.csv the amount AP may pay on one invoice (usually the undisputed balance). | one named click, even in Auto (`move_money`) |
| `bills_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `bills_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `bills_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `bills_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |
| `ap_pay_invoice` | Fairhaul Freight Bill Audit never pays carriers; your AP team pays the approved amount. | refused |
| `email_send` | Fairhaul Freight Bill Audit never sends email; a person sends the approved dispute. | refused |
| `carrier_portal_submit` | Fairhaul Freight Bill Audit never logs in to carrier portals. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Carrier invoices or freight bills (`invoices`)

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

### Paid invoice history (`paid`)

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

### Shipments or BOLs (`shipments`)

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-freight-bill-audit inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Memory

fairhaul-freight-bill-audit can remember facts about your setup so the next run does not have to be told again. `bills_learn` only proposes a fact; it changes nothing until a named person accepts it with `bills_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.lodestar/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `charge_alias` | reads that charge wording as that code in every audit, so it is checked against the contract terms for the code (the contract's own charge_aliases win) |
| `carrier_alias` | audits invoices billed under that name against the named carrier's contract block (a name the contract already gives to a carrier keeps that carrier) |
| `note` | nothing (shown by recall only) |

```bash
fairhaul-freight-bill-audit memory list
fairhaul-freight-bill-audit memory accept MEM-1a2b3c4d5e6f --as "Your Name"
fairhaul-freight-bill-audit memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "carrier renamed"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-freight-bill-audit demo
npx -y fairhaul-freight-bill-audit mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-freight-bill-audit": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-freight-bill-audit",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-freight-bill-audit -- npx -y fairhaul-freight-bill-audit mcp --root .`, or install the `fairhaul-freight-bill-audit` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-freight-bill-audit approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-freight-bill-audit approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-freight-bill-audit kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-freight-bill-audit tools                 # every tool, its policy and arguments
fairhaul-freight-bill-audit sources               # the columns each input is read from
fairhaul-freight-bill-audit inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-freight-bill-audit call bills_audit '{"invoices":"<invoices>","contract":"<contract>"}'
fairhaul-freight-bill-audit eval                  # the private eval cases on the fictional fixtures
fairhaul-freight-bill-audit demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- It checks bills against the contract file you give it. It is not a tariff service, does not know your carrier's rules tariff, and does not look anything up online.
- X12 element positions follow the public 004010 structure as recalled; they were not checked against the licensed implementation guides, and trading partners differ.
- The TMS column names were written from knowledge of common exports and were not tested against a live account.
- Not legal or accounting advice. A person decides what to dispute and what to pay.
