# Fairhaul Broker Settlements (`fairhaul-broker-settlements`)

For freight brokers. Settles every carrier payment against its rate confirmation, approved accessorials, quick-pay fee, pay terms, proof of delivery and notice of assignment. It finds invoices above the rate confirmation, double and over payments, payments to the wrong party, past-due loads and invoices with no rate confirmation. It drafts the next payment batch by payee. **A person releases every payment.**

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-broker-settlements demo
npx -y fairhaul-broker-settlements mcp --root ./carrier-pay
```

## How a load is settled

- Owed is the rate plus approved accessorials, less the quick-pay fee (`quick_pay_pct`, default 3%) on quick-pay loads.
- The party to pay is the factor on a notice of assignment in effect when the invoice arrived, unless it was released; otherwise the carrier.
- Due is the invoice date plus the pay terms (2 days on quick pay, else the rate confirmation's terms or `default_terms_days`, default 30).
- Status: `awaiting_invoice`, `hold_no_pod`, `ready`, `past_due` or `paid`. Ready and past-due loads form the next batch, each capped at the rate confirmation.

## Findings

`invoice_over_ratecon`, `two_invoices`, `paid_twice`, `overpaid`, `paid_wrong_party`, `past_due`, `no_pod`, `invoice_without_ratecon`, `payment_without_ratecon`.


<!-- generated:start -->

## What the AI model sees

- **Masked:** this agent reads no column with a person's name or contact details. Anything that looks like a phone number, e-mail or SSN is still replaced in every result.
- **Sent as they are:** ids, codes, places and names of carriers and other businesses (`load_id`, `carrier`, `pod`, `quick_pay`, `invoice_number`, `payee`, `reference`, `factor`); dates (`delivered_at`, `received_at`, `paid_at`, `effective`, `released`); amounts, weights and counts (`rate`, `accessorials`, `pay_terms_days`, `amount`).
- Results go to whatever model your AI assistant uses. For data you may not share with that provider, use a local model or one covered by your agreements with it. The CSV and HTML files written on your machine keep the real values.

## A demo run

`npx -y fairhaul-broker-settlements demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Broker Settlements demo (fictional broker loads, as of 2026-11-16) in <demo folder>

▶ Settle eight loads against rate confirmations, payments and notices
  status: executed  decision: allow
  8 load(s) as of 2026-11-16. Next batch: 3 load(s), 6833. Past due: 2328. Overpaid or paid twice: 1750. Paid to the wrong party: 1890. Invoiced above the rate confirmation: 100.
    L-5101 Ridgeline Freight   pay to Ridgeline Freight    paid              
    L-5102 Prairie Express     pay to Bluewater Factoring  ready             1755
    L-5103 Coastal Line Haul   pay to Coastal Line Haul    past_due          2328
    L-5104 Summit Carriers     pay to Summit Carriers      hold_no_pod       
    L-5105 Prairie Express     pay to Bluewater Factoring  paid              
    L-5106 Ridgeline Freight   pay to Ridgeline Freight    awaiting_invoice  
    L-5107 North Star Hauling  pay to North Star Hauling   ready             2750
    L-5108 Coastal Line Haul   pay to Coastal Line Haul    paid              

▶ Write the settlement report
  status: executed  decision: allow
  Settlement report written. 8 load(s) as of 2026-11-16. Next batch: 3 load(s), 6833. Past due: 2328. Overpaid or paid twice: 1750. Paid to the wrong party: 1890. Invoiced above the rate confirmation: 100.

▶ Draft the next payment batch
  status: executed  decision: allow  (auto)
  payment batch 2026-11-17 drafted for 6833 with 0 open marker(s). Nothing was sent.

▶ Approve releasing it: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: move_money stays one-click, even in Auto

▶ Same call after the click (recorded; a person pays)
  status: executed  decision: ask  approved by: Dana Controller (fictional)
  payment batch 2026-11-17 approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to release a payment itself
  status: blocked  decision: block
  reason: Fairhaul Broker Settlements never pays carriers or factors.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `settlements_settle` | Per load: agreed amount, quick pay, owed, billed, due date, paid, party to pay and status (awaiting invoice, held for POD, ready, past due, paid); every point found with its amount; and the next payment batch by payee. | runs |
| `settlements_write_report` | Write settlements.csv and .html (one row per load; points found; next batch by payee) into out_dir (default fairhaul-out/settlements). | runs |
| `settlements_draft_payment_batch` | Write drafts/payment_batch-<date>.md: loads ready or past due, each capped at the rate confirmation net of quick pay and grouped by the party to pay (factor where there is a notice of assignment), plus loads held for … | asks first (Auto can be opted in) |
| `settlements_request_release` | After one named human click (even in Auto), record that the reviewed payment batch draft is approved in payment_batch-requests.csv. | one named click, even in Auto (`move_money`) |
| `ap_release_payment` | Fairhaul Broker Settlements never pays carriers or factors. | refused |
| `bank_transfer` | Fairhaul Broker Settlements never moves money. | refused |
| `tms_update_carrier_pay` | Fairhaul Broker Settlements never changes rates or pay records in your TMS. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Rate confirmations (`ratecons`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Load, Load Number, Pro | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` (required) | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `rate` (required) | amount | Rate, Agreed Rate, Linehaul, All In, Carrier Pay | Frachtrate, Tarif, 料率, 运价 |
| `accessorials` | amount | Approved Accessorials, Accessorials, Extras Approved | Zusatzleistungen, Prestations annexes, 付帯作業, 附加服务 |
| `delivered_at` | date | Delivered, Delivery Date, Delivered At | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `pod` | yes/no | POD, POD Received, Proof of Delivery | Abliefernachweis, Preuve de livraison, 受領書, 签收单 |
| `pay_terms_days` | number | Pay Terms, Terms Days, Net Days | Zahlungsziel, Délai de paiement, 支払サイト, 账期 |
| `quick_pay` | yes/no | Quick Pay, QuickPay | - |

### Carrier invoices (`invoices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Load, Load Number, Pro | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` | text | Carrier, Carrier Name, Billed By | Spediteur, Transporteur, 運送会社, 承运商 |
| `invoice_number` | text | Invoice Number, Invoice | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `amount` (required) | amount | Amount, Invoice Amount, Total | Betrag, Montant, 金額, 金额 |
| `received_at` | date | Received, Invoice Received, Invoice Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |

### Payments made (`payments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Load, Load Number, Pro | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `payee` (required) | text | Payee, Paid To, Remit To | Zahlungsempfänger, Bénéficiaire, 支払先, 收款人 |
| `amount` (required) | amount | Amount, Paid, Payment Amount | Betrag, Montant, 金額, 金额 |
| `paid_at` | date | Paid, Paid At, Payment Date | Zahlungsdatum, Date de paiement, 支払日, 付款日期 |
| `reference` | text | Reference, Check, ACH Trace, Payment ID | Referenz, Référence, 参照番号, 参考号 |

### Notices of assignment (`noas`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `carrier` (required) | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `factor` (required) | text | Factor, Factoring Company, Pay To, Assignee | Factoring-Gesellschaft, Société d'affacturage, ファクタリング会社, 保理公司 |
| `effective` | date | Effective, Effective Date, NOA Date | Gültig ab, Date d'effet, 適用開始日, 生效日期 |
| `released` | date | Released, Release Date, Letter of Release | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-broker-settlements inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-broker-settlements demo
npx -y fairhaul-broker-settlements mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-broker-settlements": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-broker-settlements",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-broker-settlements -- npx -y fairhaul-broker-settlements mcp --root .`, or install the `fairhaul-broker-settlements` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-broker-settlements approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-broker-settlements approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-broker-settlements kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-broker-settlements tools                 # every tool, its policy and arguments
fairhaul-broker-settlements sources               # the columns each input is read from
fairhaul-broker-settlements inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-broker-settlements call settlements_settle '{"ratecons":"<ratecons>"}'
fairhaul-broker-settlements eval                  # the private eval cases on the fictional fixtures
fairhaul-broker-settlements demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Notices are matched by carrier name. Confirm a notice or release with the factor before changing who you pay.
- Extra charges count only if they are in the approved accessorials column.
- Not legal or accounting advice.
