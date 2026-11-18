# Fairhaul Detention and Lumper (`fairhaul-detention-and-lumper`)

Checks detention, layover and lumper charges against your own dock log: when the truck arrived, when the appointment was, when it left, and whether a lumper receipt exists. It works out what each charge should have been under your terms, drafts disputes for the difference, and ranks your facilities by dwell time and detention cost, which is usually the bigger saving.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-detention-and-lumper demo
npx -y fairhaul-detention-and-lumper mcp --root ./dock-data
```

## How a charge is checked

- **Detention**: the clock starts at the appointment (or at arrival if there was none, or if the truck came later but within the grace period). A truck that arrived after the appointment plus grace earns nothing. Free time is taken off, the rest is rounded up to the billing increment, priced at the hourly rate and capped per stop. Hours billed above the time actually on site are flagged too.
- **Layover**: earned only after `layover_min_hours` on site, at the agreed amount.
- **Lumper**: needs a receipt when `lumper_requires_receipt` is on (default), and may not exceed the receipt.
- No dock times means **review**, never "fine".

Defaults (each stated in the report): 2 free hours, 50 per hour, 15-minute grace, 15-minute increments, layover after 16 hours. Per-carrier overrides go under `carriers` in the terms file.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-detention-and-lumper demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Detention and Lumper demo (fictional loads and docks), Auto mode on

▶ Check nine detention, layover and lumper charges against the dock log
  status: executed  decision: allow
  9 charge(s), 1525 billed: 7 to dispute (712.5), 1 need dock times, 1 supported.
    L-100  detention  billed   150 allowed    150  ok       
    L-101  detention  billed   200 allowed  112.5  dispute  detention_over, hours_over_record
    L-102  detention  billed   100 allowed      0  dispute  arrived_late
    L-103  detention  billed    75 allowed      ?  review   no_timestamps
    L-104  layover    billed   250 allowed      0  dispute  layover_not_earned
    L-105  lumper     billed   180 allowed    150  dispute  lumper_over_receipt
    L-106  lumper     billed   150 allowed      0  dispute  lumper_no_receipt
    L-107  detention  billed   120 allowed     75  dispute  detention_over
    L-108  layover    billed   300 allowed    250  dispute  layover_over

▶ Explain L-101 (billed six hours, on site four)
  status: executed  decision: allow
  L-101 stop 2 detention: billed 200, allowed 112.5. Detention billed 200; dock times give 112.5 (4.08 h from arrival to departure, 2 h free, 2.25 h at 50). 6 h billed, but the truck was on site 4.08 h in total.

▶ Which of your own facilities cause detention
  status: executed  decision: allow
  Example DC Dallas: 4 stop(s), avg dwell 5.52 h, 75% over free time, detention 600
Sample Plant Peoria: 2 stop(s), avg dwell 14.42 h, 100% over free time, detention 400
Fictional Grocery DC: 3 stop(s), avg dwell 2.33 h, 67% over free time, detention 120

▶ Write the worklist
  status: executed  decision: allow
  Detention worklist written: 9 charge(s), 1525 billed: 7 to dispute (712.5), 1 need dock times, 1 supported.

▶ Draft the dispute to Sample Freightways
  status: executed  decision: allow  (auto)
  dispute Sample Freightways drafted for 525 with 1 open marker(s) ([ATTACH gate or dock log extract for each stop]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to pay the lumper service itself
  status: blocked  decision: block
  reason: Fairhaul Detention and Lumper never pays carriers or lumper services.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `detention_audit` | Check each detention, layover and lumper charge against dock times, appointment grace, free time, billing increment, caps and receipts. | runs |
| `detention_explain` | Show every detention, layover and lumper charge on one load with the dock times and the reasoning. | runs |
| `detention_facilities` | Average and longest dwell, share of stops over free time, late carrier arrivals and detention billed, per facility, worst first. | runs |
| `detention_write_report` | Write detention-audit.csv and .html (charges with allowed and disputable amounts, plus the facility ranking) into out_dir (default lodestar-out/detention). | runs |
| `detention_draft_dispute` | Write drafts/dispute-<carrier>.md listing every disputed detention, layover and lumper charge for one carrier with billed, allowed and the dock-time reason. | asks first (Auto can be opted in) |
| `detention_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_pay_invoice` | Fairhaul Detention and Lumper never pays carriers or lumper services. | refused |
| `email_send` | Fairhaul Detention and Lumper never sends email. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Detention, layover and lumper charges (`charges`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Load Number, Load #, Shipment ID, PRO, Order Number | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `stop` | text | Stop, Stop Number, Stop #, Stop Sequence | Stopp, Arrêt, 立寄り先, 站点 |
| `charge_type` (required) | text | Charge Type, Charge, Accessorial, Charge Description, Description | Leistungsbeschreibung, Libellé de la prestation, 請求項目, 费用名称 |
| `amount` (required) | amount | Amount, Charge Amount, Billed Amount | Betrag, Montant, 金額, 金额 |
| `hours_billed` | number | Hours, Hours Billed, Billed Hours, Detention Hours | Berechnete Stunden, Heures facturées, 請求時間, 计费小时 |
| `invoice_number` | text | Invoice Number, Invoice, Freight Bill | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |

### Dock or yard log (`stops`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Load Number, Load #, Shipment ID, PRO, Order Number | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `stop` | text | Stop, Stop Number, Stop #, Stop Sequence | Stopp, Arrêt, 立寄り先, 站点 |
| `facility` | text | Facility, Location, Site, Warehouse, DC, Customer | Lagerort, Emplacement, 保管場所, 库位 |
| `appointment_at` | date and time | Appointment, Appointment Time, Appt, Scheduled | Termin, Rendez-vous, 予約時刻, 预约时间 |
| `arrived_at` | date and time | Arrived, Arrived At, Check In, Checked In, Gate In, In Time | Ankunft, Arrivée, 到着日時, 到达时间 |
| `departed_at` | date and time | Departed, Departed At, Check Out, Checked Out, Gate Out, Out Time | Abfahrt, Départ, 出発日時, 离开时间 |
| `lumper_receipt` | text | Lumper Receipt, Receipt Number, Receipt #, Lumper Receipt Number | - |
| `lumper_receipt_amount` | amount | Receipt Amount, Lumper Receipt Amount, Lumper Paid | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-detention-and-lumper inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-detention-and-lumper demo
npx -y fairhaul-detention-and-lumper mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-detention-and-lumper": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-detention-and-lumper",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-detention-and-lumper -- npx -y fairhaul-detention-and-lumper mcp --root .`, or install the `fairhaul-detention-and-lumper` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-detention-and-lumper approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-detention-and-lumper approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-detention-and-lumper kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-detention-and-lumper tools                 # every tool, its policy and arguments
fairhaul-detention-and-lumper sources               # the columns each input is read from
fairhaul-detention-and-lumper inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-detention-and-lumper call detention_audit '{"charges":"<charges>","stops":"<stops>"}'
fairhaul-detention-and-lumper eval                  # the private eval cases on the fictional fixtures
fairhaul-detention-and-lumper demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- It trusts the dock log you give it. If gate times are typed by hand, check them before disputing.
- Allowed amounts follow your terms file, not your carrier's tariff.
- Yard and dock column names (*Gate In*, *Gate Out*, *Receipt #*) were written from knowledge of common exports, not tested against a live system.
- Not legal advice. A person decides what to dispute.
