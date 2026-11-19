# Fairhaul Returns Tracking (`fairhaul-returns-tracking`)

Follows every return from authorisation to credit. It finds labels never used, returns received but not credited, credits issued for goods that never came back or for more than came back, and return freight billed twice or with no return authorised. It shows which reasons, customers and SKUs cost the most freight to bring back. **It never issues credits or voids labels.**

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-returns-tracking demo
npx -y fairhaul-returns-tracking mcp --root ./returns
```

## Checks

| Code | Meaning |
|---|---|
| `label_unused` | Authorised more than `unused_days` (default 30) ago; nothing received or credited |
| `received_not_credited` | Received more than `credit_days` (default 7) ago; no credit. The customer is waiting |
| `credited_not_received` | Credit issued; nothing received |
| `short_received` | Fewer units back than authorised |
| `over_credited` | Credit above the value of what came back |
| `freight_billed_twice` | Same return tracking on two carrier charges |
| `freight_without_rma` | Return freight on tracking that matches no RMA |

Only the RMA file is required. Each extra file (receipts, credits, return freight) turns on the checks that need it.


<!-- generated:start -->

## What the AI model sees

- **Masked:** this agent reads no column with a person's name or contact details. Anything that looks like a phone number, e-mail or SSN is still replaced in every result.
- **Sent as they are:** ids, codes, places and names of carriers and other businesses (`rma`, `sku`, `tracking`, `status`, `credit_number`, `carrier`, `invoice_number`); customer, consignee and shipper names (`customer`; pseudonymised with `--pii strict`); dates (`authorised_at`, `received_at`, `credited_at`, `billed_at`); amounts, weights and counts (`units`, `value`, `units_received`, `credit`, `amount`).
- **Free text sent as written** (known names, phone numbers, e-mails and SSN-like numbers inside it are replaced; anything else typed there is not): `reason`, `condition`.
- Results go to whatever model your AI assistant uses. For data you may not share with that provider, use a local model or one covered by your agreements with it. The CSV and HTML files written on your machine keep the real values.

## A demo run

`npx -y fairhaul-returns-tracking demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Returns Tracking demo (fictional returns, as of 2026-11-16) in <demo folder>

▶ Follow every return from label to credit
  status: executed  decision: allow
  8 return(s) worth 1081, return freight 253.35. 8 point(s): credits owed to customers 250, credit given without goods or over value 119.6, return freight to dispute 106.25. Costliest reason for freight: customer changed mind (149).
    RMA-3003  credited_not_received  72.8
    RMA-3004  received_not_credited  192
    RMA-3004  freight_billed_twice   74.5
    RMA-3005  short_received         
    RMA-3005  over_credited          46.8
    RMA-3006  received_not_credited  58
    RMA-3009  label_unused           
    -         freight_without_rma    31.75

▶ Write the returns report
  status: executed  decision: allow
  Returns report written. 8 return(s) worth 1081, return freight 253.35. 8 point(s): credits owed to customers 250, credit given without goods or over value 119.6, return freight to dispute 106.25. Costliest reason for freight: customer changed mind (149).

▶ Draft the return freight dispute to Parcel Co
  status: executed  decision: allow  (auto)
  carrier dispute Parcel Co drafted for 106.25 with 0 open marker(s). Nothing was sent.

▶ Approve sending it: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Ana Ruiz (fictional)
  carrier dispute Parcel-Co approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to issue a customer credit itself
  status: blocked  decision: block
  reason: Fairhaul Returns Tracking never issues, reverses or changes customer credits.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `returns_track` | Each RMA's stage (awaiting return, label unused, received not credited, credited not received, closed), every point found with its amount, and return value and freight by reason, customer and SKU. | runs |
| `returns_write_report` | Write returns.csv and .html (points found; every RMA with its stage; by reason, customer and SKU) into out_dir (default fairhaul-out/returns). | runs |
| `returns_draft_carrier_dispute` | Write drafts/carrier_dispute-<carrier>.md: return freight charges from one carrier billed twice or on tracking numbers with no return authorised, with the total to credit. | asks first (Auto can be opted in) |
| `returns_request_send` | After one named human click (even in Auto), record that the reviewed carrier dispute draft is approved in carrier_dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_issue_credit` | Fairhaul Returns Tracking never issues, reverses or changes customer credits. | refused |
| `carrier_void_label` | Fairhaul Returns Tracking never voids labels with carriers. | refused |
| `email_send` | Fairhaul Returns Tracking never emails carriers or customers. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Return authorisations (`rmas`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `rma` (required) | text | RMA, RMA Number, Return ID, Return Number | Retourennummer, N° de retour, 返品番号, 退货单号 |
| `customer` | text | Customer, Customer Name, Account | Kunde, Client, 顧客, 客户 |
| `sku` | text | SKU, Item, Product | Artikelnummer, Référence, 品番, 物料编码 |
| `units` | number | Units, Qty, Quantity | Menge, Quantité, 数量, 数量 |
| `value` | amount | Value, Return Value, Line Value, Amount | Warenwert, Valeur marchandise, 商品価格, 货值 |
| `reason` | text | Reason, Return Reason, Reason Code | Grund, Motif, 理由, 原因 |
| `authorised_at` (required) | date | Authorised, Authorized, Authorized At, RMA Date, Created | Genehmigt am, Autorisé le, 承認日, 授权日期 |
| `tracking` | text | Tracking, Label Tracking, Return Tracking | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `status` | text | Status, RMA Status | Status, Statut, ステータス, 状态 |

### Returns received (`receipts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `rma` | text | RMA, RMA Number, Return ID | Retourennummer, N° de retour, 返品番号, 退货单号 |
| `tracking` | text | Tracking, Tracking Number | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `received_at` (required) | date | Received, Received At, Receipt Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |
| `units_received` | number | Units Received, Qty Received, Units, Quantity | Erhaltene Menge, Quantité reçue, 入荷数, 收货数量 |
| `condition` | text | Condition, Disposition, Grade | - |

### Credits issued (`credits`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `rma` (required) | text | RMA, RMA Number, Return ID | Retourennummer, N° de retour, 返品番号, 退货单号 |
| `credit` (required) | amount | Credit, Credit Amount, Amount, Refund | Gutschriftsbetrag, Montant de l'avoir, 返金額, 贷项金额 |
| `credited_at` | date | Credited, Credited At, Credit Date, Refund Date | Gutgeschrieben am, Date de l'avoir, 返金日, 退款日期 |
| `credit_number` | text | Credit Memo, Credit Number, Refund ID | Gutschriftsnummer, N° d'avoir, クレジットノート番号, 贷项通知单号 |

### Return freight billed (`charges`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `tracking` (required) | text | Tracking, Tracking Number, Return Tracking | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `carrier` | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `amount` (required) | amount | Amount, Charge, Net Charge, Freight | Betrag, Montant, 金額, 金额 |
| `invoice_number` | text | Invoice Number, Invoice | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `billed_at` | date | Invoice Date, Billed, Date | Rechnungsdatum, Date de facture, 請求日, 发票日期 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-returns-tracking inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-returns-tracking demo
npx -y fairhaul-returns-tracking mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-returns-tracking": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-returns-tracking",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-returns-tracking -- npx -y fairhaul-returns-tracking mcp --root .`, or install the `fairhaul-returns-tracking` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-returns-tracking approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-returns-tracking approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-returns-tracking kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-returns-tracking tools                 # every tool, its policy and arguments
fairhaul-returns-tracking sources               # the columns each input is read from
fairhaul-returns-tracking inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-returns-tracking call returns_track '{"rmas":"<rmas>"}'
fairhaul-returns-tracking eval                  # the private eval cases on the fictional fixtures
fairhaul-returns-tracking demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Receipts match by RMA or tracking, credits by RMA, freight by tracking. Other references will look unmatched.
- A credit before receipt may be deliberate goodwill. Check before reversing anything.
- Whether an unused label costs money depends on your carrier agreement.
