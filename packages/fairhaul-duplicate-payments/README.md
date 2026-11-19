# Fairhaul Duplicate Payments (`fairhaul-duplicate-payments`)

Searches years of freight payments for invoices paid more than once, nets off credits you already received, grades each find by confidence and drafts the refund request. It never voids, offsets or moves money, and never changes vendor records.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-duplicate-payments demo
npx -y fairhaul-duplicate-payments mcp --root ./ap-history
```

## Rules

| Rule | Confidence | What it means |
|---|---|---|
| `exact_duplicate` | high | Same carrier, invoice number and amount, paid twice |
| `invoice_number_variant` | high | The same invoice keyed two ways ("INV-00418" and "418") |
| `two_vendor_records` | high | The same invoice paid under two vendor records; merge or block one |
| `same_pro` | high or medium | One PRO paid under two invoice numbers; medium when the amounts differ (often a balance-due bill) |
| `same_amount_and_date` | low | Same carrier and amount a few days apart with no shared reference; could be two real loads |

Credit memos (negative lines) that name the invoice or PRO are netted off. A pair is reported once, under the strongest rule.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-duplicate-payments demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Duplicate Payments demo (fictional payments, 2025 to 2026) in <demo folder>

▶ Search the payment history for invoices paid twice
  status: executed  decision: allow
  14 payment(s), 16245 paid: 6 possible duplicate group(s). To recover: 4950 high confidence, 185 medium, 1200 low. 1 already credited.
    high   same_pro                CL-90311 / CL-90377          2150  recover
    high   invoice_number_variant  INV-00418 / 418              1840  recover
    high   two_vendor_records      INV-00519 / INV-00519         960  recover
    high   exact_duplicate         PX-3101 / PX-3101               0  already_credited
    medium same_pro                CL-90402 / CL-90402-B         185  recover
    low    same_amount_and_date    PX-2207 / PX-2209            1200  recover

▶ Write the report
  status: executed  decision: allow
  Duplicate payment report written. 14 payment(s), 16245 paid: 6 possible duplicate group(s). To recover: 4950 high confidence, 185 medium, 1200 low. 1 already credited.

▶ Draft the refund request to Ridgeline Freight
  status: executed  decision: allow  (auto)
  recovery Ridgeline Freight drafted for 2800 with 1 open marker(s) ([ATTACH remittance advice for each payment]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Pat Kim (fictional)
  recovery Ridgeline-Freight approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to void a payment itself
  status: blocked  decision: block
  reason: Fairhaul Duplicate Payments never voids, reverses or offsets payments.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `duplicates_search` | Groups of payments that look like one invoice paid more than once, each with a rule (exact_duplicate, invoice_number_variant, two_vendor_records, same_pro, same_amount_and_date), a confidence, the amount paid twice, c… | runs |
| `duplicates_write_report` | Write duplicates.csv and .html (one row per group, by confidence, totals by vendor) into out_dir (default fairhaul-out/duplicates). | runs |
| `duplicates_draft_recovery` | Write drafts/recovery-<vendor>.md: a refund request listing each invoice the vendor was paid twice, with payment refs and dates. | asks first (Auto can be opted in) |
| `duplicates_request_send` | After one named human click (even in Auto), record that the reviewed recovery draft is approved in recovery-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_void_payment` | Fairhaul Duplicate Payments never voids, reverses or offsets payments. | refused |
| `email_send` | Fairhaul Duplicate Payments never sends email. | refused |
| `erp_block_vendor` | Fairhaul Duplicate Payments never changes vendor records; a person merges or blocks them. | refused |
| `duplicates_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `duplicates_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `duplicates_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `duplicates_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### AP payment history (`payments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `vendor` (required) | text | Vendor, Vendor Name, Carrier, Payee, Supplier | Lieferant, Fournisseur, 仕入先, 供应商 |
| `vendor_id` | text | Vendor ID, Vendor Number, Supplier ID, Vendor # | Lieferantennummer, Code fournisseur, 仕入先コード, 供应商编号 |
| `invoice_number` (required) | text | Invoice Number, Invoice, Invoice #, Inv No, Document Number | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `invoice_date` | date | Invoice Date, Doc Date, Bill Date | Rechnungsdatum, Date de facture, 請求日, 发票日期 |
| `amount` (required) | amount | Amount, Invoice Amount, Paid Amount, Gross Amount | Betrag, Montant, 金額, 金额 |
| `paid_date` | date | Paid Date, Payment Date, Check Date, Cleared | Zahlungsdatum, Date de paiement, 支払日, 付款日期 |
| `payment_ref` | text | Payment Ref, Check Number, Payment Number, ACH Ref, Payment ID | Referenz, Référence, 参照番号, 参考号 |
| `pro` | text | PRO, PRO Number, Tracking Number, Reference | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `bol` | text | BOL, Bill of Lading | Frachtbrief, Lettre de voiture, 船荷証券番号, 提单号 |
| `memo` | text | Memo, Description, Notes | Verwendungszweck, Libellé, 摘要, 摘要 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| NetSuite | Transaction saved search (default column labels) | Document Number, Date, Name, Amount | no |
| QuickBooks Online | Transaction List by Vendor report (CSV or Excel) | Transaction Type, Num, Amount | no |
| Xero | Bills > Export (CSV) | ContactName, InvoiceNumber, Total | no |
| SAP S/4HANA or ECC | Vendor line items (FBL1N) list export, English labels | Vendor or Supplier or Account, Document Number, Amount in Doc. Curr. or Amount in Local Currency, Reference | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-duplicate-payments inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Memory

fairhaul-duplicate-payments can remember facts about your setup so the next run does not have to be told again. `duplicates_learn` only proposes a fact; it changes nothing until a named person accepts it with `duplicates_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.fairhaul/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `same_vendor` | compares invoices under those vendor records with each other as one vendor in every duplicate search (more matches, never fewer) |
| `note` | nothing (shown by recall only) |

```bash
fairhaul-duplicate-payments memory list
fairhaul-duplicate-payments memory accept MEM-1a2b3c4d5e6f --as "Your Name"
fairhaul-duplicate-payments memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "carrier renamed"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-duplicate-payments demo
npx -y fairhaul-duplicate-payments mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-duplicate-payments": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-duplicate-payments",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-duplicate-payments -- npx -y fairhaul-duplicate-payments mcp --root .`, or install the `fairhaul-duplicate-payments` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-duplicate-payments approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-duplicate-payments approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-duplicate-payments kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-duplicate-payments tools                 # every tool, its policy and arguments
fairhaul-duplicate-payments sources               # the columns each input is read from
fairhaul-duplicate-payments inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-duplicate-payments call duplicates_search '{"payments":"<payments>"}'
fairhaul-duplicate-payments eval                  # the private eval cases on the fictional fixtures
fairhaul-duplicate-payments demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Medium and low confidence finds need the bills pulled before anyone asks for money back.
- How far back you can recover depends on your agreements and the law that applies; Fairhaul Duplicate Payments does not decide that.
- It reads only the payment history you give it. A duplicate paid through another system will not show up.
