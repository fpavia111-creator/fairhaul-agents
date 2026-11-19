# Fairhaul Ocean Freight Audit (`fairhaul-ocean-freight-audit`)

Audits ocean freight invoices line by line against your service contract: the base rate per container by port pair, BAF, peak season and other surcharges with their validity dates, charges the contract includes in the rate, charges the contract does not have, duplicates, and container counts against the bill of lading. It drafts disputes to the line or forwarder. It never pays or sends.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-ocean-freight-audit demo
npx -y fairhaul-ocean-freight-audit mcp --root ./ocean
```

## Contract format

One entry per line or forwarder: `lanes` with `pol`, `pod` (UN/LOCODE or as written on your invoices) and `rates` per container type (`20GP`, `40GP`, `40HC`...), and `surcharges` by code with `per_container` or `flat` (per B/L), optional `valid_from` and `valid_to`, or `included: true`. `code_aliases` maps your invoice wording to a code. See `fixtures/contract.json`.

Codes recognised without aliases: OFR (ocean freight), BAF, LSS, CAF, PSS (also GRI), THC_O, THC_D, DOC, ISPS, EBS, CSC, SEAL.


<!-- generated:start -->

## What the AI model sees

- **Masked:** this agent reads no column with a person's name or contact details. Anything that looks like a phone number, e-mail or SSN is still replaced in every result.
- **Sent as they are:** ids, codes, places and names of carriers and other businesses (`invoice_number`, `carrier`, `bl`, `pol`, `pod`, `equipment`, `charge_code`, `currency`); dates (`sailing_date`); amounts, weights and counts (`containers`, `quantity`, `unit_rate`, `amount`).
- Results go to whatever model your AI assistant uses. For data you may not share with that provider, use a local model or one covered by your agreements with it. The CSV and HTML files written on your machine keep the real values.

## A demo run

`npx -y fairhaul-ocean-freight-audit demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Ocean Freight Audit demo (fictional lines and contracts, 2026) in <demo folder>

▶ Audit the ocean invoices against the contract
  status: executed  decision: allow
  6 bill(s) of lading, 28566 billed: 5 with findings, 3355 disputable. container_count 1, contract_expired 1, currency_mismatch 1, duplicate_charge 1, rate_over 1, surcharge_included 1, surcharge_not_in_contract 1, surcharge_out_of_window 1
    BMLBL-7781        0  clean
    BMLBL-7790      730  rate_over, surcharge_out_of_window, surcharge_included
    BMLBL-7802      525  duplicate_charge, surcharge_not_in_contract
    BMLBL-7810     2100  container_count
    NSL-55120         0  contract_expired
    BMLBL-7815        0  currency_mismatch

▶ Write the ocean audit
  status: executed  decision: allow
  Ocean audit written. 6 bill(s) of lading, 28566 billed: 5 with findings, 3355 disputable. container_count 1, contract_expired 1, currency_mismatch 1, duplicate_charge 1, rate_over 1, surcharge_included 1, surcharge_not_in_contract 1, surcharge_out_of_window 1

▶ Draft the dispute to Blue Meridian Line
  status: executed  decision: allow  (auto)
  dispute Blue Meridian Line drafted for 3355 with 1 open marker(s) ([ATTACH the contract rate sheet pages for these lanes]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Jo Park (fictional)
  dispute Blue-Meridian-Line approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to pay the line itself
  status: blocked  decision: block
  reason: Fairhaul Ocean Freight Audit never pays lines or forwarders.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `ocean_audit` | For each bill of lading: billed total, findings (rate_over, surcharge_over, surcharge_not_in_contract, surcharge_included, surcharge_out_of_window, surcharge_unpriced, duplicate_charge, container_count, no_lane, no_ra… | runs |
| `ocean_write_report` | Write ocean.csv and .html (one row per finding, bills with no findings listed as clean) into out_dir (default fairhaul-out/ocean). | runs |
| `ocean_draft_dispute` | Write drafts/dispute-<carrier>.md listing each ocean invoice charge above or outside the contract, by invoice and B/L. | asks first (Auto can be opted in) |
| `ocean_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_pay_invoice` | Fairhaul Ocean Freight Audit never pays lines or forwarders. | refused |
| `email_send` | Fairhaul Ocean Freight Audit never sends email. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Ocean invoice lines (`invoices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `invoice_number` (required) | text | Invoice Number, Invoice, Invoice # | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `carrier` (required) | text | Carrier, Line, Forwarder, Vendor | Spediteur, Transporteur, 運送会社, 承运商 |
| `bl` (required) | text | BL, B/L, Bill of Lading, MBL, HBL | Frachtbrief, Lettre de voiture, 船荷証券番号, 提单号 |
| `pol` (required) | text | POL, Port of Loading, Origin Port | Ladehafen, Port de chargement, 積地港, 起运港 |
| `pod` (required) | text | POD, Port of Discharge, Destination Port | Abliefernachweis, Preuve de livraison, 受領書, 签收单 |
| `sailing_date` | date | Sailing Date, ETD, On Board Date, Departure | Abfahrtsdatum, Date de départ du navire, 出港日, 开船日期 |
| `equipment` | text | Equipment, Container Type, Size Type, Size | Fahrzeugtyp, Type de véhicule, 車種, 车型 |
| `containers` | number | Containers, Container Count, Qty Containers, Units | - |
| `charge_code` (required) | text | Charge Code, Charge, Code, Description | Leistungsbeschreibung, Libellé de la prestation, 請求項目, 费用名称 |
| `quantity` | number | Quantity, Qty | Menge, Quantité, 数量, 数量 |
| `unit_rate` | amount | Unit Rate, Rate | - |
| `amount` (required) | amount | Amount, Charge Amount, Total | Betrag, Montant, 金額, 金额 |
| `currency` | text | Currency, Curr, CCY | Währung, Devise, 通貨, 币种 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-ocean-freight-audit inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-ocean-freight-audit demo
npx -y fairhaul-ocean-freight-audit mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-ocean-freight-audit": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-ocean-freight-audit",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-ocean-freight-audit -- npx -y fairhaul-ocean-freight-audit mcp --root .`, or install the `fairhaul-ocean-freight-audit` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-ocean-freight-audit approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-ocean-freight-audit approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-ocean-freight-audit kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-ocean-freight-audit tools                 # every tool, its policy and arguments
fairhaul-ocean-freight-audit sources               # the columns each input is read from
fairhaul-ocean-freight-audit inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-ocean-freight-audit call ocean_audit '{"invoices":"<invoices>","contract":"<contract>"}'
fairhaul-ocean-freight-audit eval                  # the private eval cases on the fictional fixtures
fairhaul-ocean-freight-audit demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Compared against your contract file, not the line's published tariff or a rate index.
- Charges in another currency are flagged, not converted.
- Demurrage and detention are handled by Fairhaul Container Demurrage.
