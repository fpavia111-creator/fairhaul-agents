# Fairhaul Customs Entries (`fairhaul-customs-entries`)

Checks your customs broker's entry lines against your commercial invoices. It looks at entered value (with the exchange rate), quantity, origin and duty arithmetic. It finds invoice lines entered twice or not at all, and the same SKU or code entered differently across entries. It estimates duty possibly over or underpaid and counts the days left to ask for a correction. **It gives no classification advice and files nothing.**

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-customs-entries demo
npx -y fairhaul-customs-entries mcp --root ./customs
```

## Checks

| Code | Meaning |
|---|---|
| `value_below_invoice`, `value_above_invoice` | Entered value differs from the invoice (converted at the entry's exchange rate) by more than `tolerance_pct` (default 1%) |
| `quantity_mismatch`, `origin_mismatch` | Entry and invoice disagree |
| `duty_math` | Entered value times the line's rate is not the duty on the line |
| `entered_twice` | The same invoice and SKU is on two entries |
| `invoice_line_not_entered` | On an entered invoice but on no entry line |
| `missing_data` | No tariff code, origin or quantity |
| `code_inconsistent` | The same SKU under different tariff codes. Fairhaul Customs Entries does not say which is right |
| `rate_inconsistent` | The same code and origin at different rates. Dates or programs may explain it |

`duty_impact` uses the rate on the entry line: positive may be owed, negative may have been overpaid.

The correction countdown runs only when you pass `correction_window_days`, the window your broker advises. Fairhaul Customs Entries has no built-in deadline.


<!-- generated:start -->

## What the AI model sees

- **Masked:** this agent reads no column with a person's name or contact details. Anything that looks like a phone number, e-mail or SSN is still replaced in every result.
- **Sent as they are:** ids, codes, places and names of carriers and other businesses (`entry_number`, `line`, `invoice_number`, `sku`, `hts`, `origin`, `currency`); dates (`entry_date`); amounts, weights and counts (`quantity`, `entered_value`, `exchange_rate`, `duty_rate`, `duty`, `value`).
- Results go to whatever model your AI assistant uses. For data you may not share with that provider, use a local model or one covered by your agreements with it. The CSV and HTML files written on your machine keep the real values.

## A demo run

`npx -y fairhaul-customs-entries demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Customs Entries demo (fictional entries and invoices, as of 2026-11-16) in <demo folder>

▶ Check three entries against the commercial invoices
  status: executed  decision: allow
  3 entries, 8 line(s): 9 point(s) to check. Estimated duty possibly overpaid 196.5, possibly underpaid 32.4. 1 entry with findings close to the correction deadline.
    ABC-1002002-2                FLOOR-RUG      value_below_invoice      32.4
    ABC-1002002-2                THROW-BLANKET  duty_math                -27.5
    ABC-1003003-3                BOOKENDS       value_below_invoice      0
    ABC-1003003-3                BOOKENDS       quantity_mismatch        
    ABC-1003003-3                BOOKENDS       origin_mismatch          
    ABC-1003003-3                MIRROR         entered_twice            -169
    -                            PLANTER        invoice_line_not_entered 
    ABC-1001001-1 ABC-1003003-3  LAMP-SHADE     code_inconsistent        
    ABC-1001001-1 ABC-1003003-3  MIRROR         rate_inconsistent        

▶ Write the entry review
  status: executed  decision: allow
  Entry review written. 3 entries, 8 line(s): 9 point(s) to check. Estimated duty possibly overpaid 196.5, possibly underpaid 32.4. 1 entry with findings close to the correction deadline.

▶ Draft the note to the broker for entry ABC-1003003-3
  status: executed  decision: allow  (auto)
  correction request ABC-1003003-3 drafted for -169 with 0 open marker(s). Nothing was sent.

▶ Approve sending it: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Ana Ruiz (fictional)
  correction request ABC-1003003-3 approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to pick a tariff code itself
  status: blocked  decision: block
  reason: Fairhaul Customs Entries never classifies goods or picks a tariff code. Ask your broker or a licensed customs professional.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `entries_check` | Every point found per entry line (value, quantity, origin, duty arithmetic, entered twice, invoice line not entered, missing data) and across entries (same SKU under different codes, same code and origin at different … | runs |
| `entries_write_report` | Write entries.csv and .html (one row per point found; entries by deadline) into out_dir (default fairhaul-out/entries). | runs |
| `entries_draft_correction_request` | Write drafts/correction_request-<entry>.md: a note to your customs broker listing each point found on one entry and asking whether a correction is needed and by when. | asks first (Auto can be opted in) |
| `entries_request_send` | After one named human click (even in Auto), record that the reviewed correction request draft is approved in correction_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `customs_file_correction` | Fairhaul Customs Entries never files anything with customs. | refused |
| `customs_classify_item` | Fairhaul Customs Entries never classifies goods or picks a tariff code. | refused |
| `ap_pay_duty` | Fairhaul Customs Entries never pays duty or broker invoices. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Entry lines (`entries`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `entry_number` (required) | text | Entry Number, Entry No, Entry, Declaration Number | Zollanmeldung, N° de déclaration, 申告番号, 报关单号 |
| `entry_date` | date | Entry Date, Date, Release Date | Anmeldedatum, Date de déclaration, 申告日, 申报日期 |
| `line` | text | Line, Line Number, Entry Line | Position, Ligne, 明細番号, 行号 |
| `invoice_number` (required) | text | Invoice Number, Commercial Invoice, Invoice | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `sku` (required) | text | SKU, Part Number, Item, Product | Artikelnummer, Référence, 品番, 物料编码 |
| `hts` | text | HTS, HTS Code, Tariff Code, Tariff Number, Commodity Code, HS Code | Zolltarifnummer, Code SH, HSコード, HS编码 |
| `origin` | text | Origin, Country of Origin, COO | Ursprungsland, Pays d'origine, 原産国, 原产国 |
| `quantity` | number | Quantity, Qty, Units | Menge, Quantité, 数量, 数量 |
| `entered_value` (required) | amount | Entered Value, Customs Value, Value | Zollwert, Valeur en douane, 課税価格, 完税价格 |
| `exchange_rate` | number | Exchange Rate, FX Rate, Rate of Exchange | Wechselkurs, Taux de change, 為替レート, 汇率 |
| `duty_rate` | number | Duty Rate, Rate, Duty Rate % | Zollsatz, Taux de droit, 関税率, 关税税率 |
| `duty` | amount | Duty, Duty Amount | Zoll, Droits de douane, 関税, 关税 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| U.S. CBP ACE Reports | Entry Summary Line Details (ES-003) export | Entry Summary Number, Entry Summary Line Number | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Commercial invoices (`invoices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `invoice_number` (required) | text | Invoice Number, Commercial Invoice, Invoice | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `sku` (required) | text | SKU, Part Number, Item, Product | Artikelnummer, Référence, 品番, 物料编码 |
| `quantity` | number | Quantity, Qty, Units | Menge, Quantité, 数量, 数量 |
| `value` (required) | amount | Value, Line Value, Extended Value, Amount | Warenwert, Valeur marchandise, 商品価格, 货值 |
| `currency` | text | Currency, Curr | Währung, Devise, 通貨, 币种 |
| `origin` | text | Origin, Country of Origin, COO, Made In | Ursprungsland, Pays d'origine, 原産国, 原产国 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-customs-entries inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-customs-entries demo
npx -y fairhaul-customs-entries mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-customs-entries": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-customs-entries",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-customs-entries -- npx -y fairhaul-customs-entries mcp --root .`, or install the `fairhaul-customs-entries` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-customs-entries approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-customs-entries approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-customs-entries kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-customs-entries tools                 # every tool, its policy and arguments
fairhaul-customs-entries sources               # the columns each input is read from
fairhaul-customs-entries inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-customs-entries call entries_check '{"entries":"<entries>","invoices":"<invoices>"}'
fairhaul-customs-entries eval                  # the private eval cases on the fictional fixtures
fairhaul-customs-entries demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Matching is by invoice number and SKU. Entries summarised to fewer lines than the invoice will show differences.
- Duty figures are estimates from your files, not liability figures. Fees, other duties and special programs are not computed.
- Not customs, legal or tax advice. Your broker or a licensed customs professional decides classification, origin and corrections.
