# Fairhaul Air Freight Audit (`fairhaul-air-freight-audit`)

Audits air freight invoices: chargeable weight from actual and volumetric weight, the rate for the right weight break (including a higher break when it costs less), the minimum charge, fuel and security surcharges per kilo, and charges your rate sheet does not have. It also prices a shipment from the rate sheet, and drafts disputes to the forwarder. It never pays or sends.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-air-freight-audit demo
npx -y fairhaul-air-freight-audit mcp --root ./air
```

## Weights and rates

- Volumetric kg = m³ × 1,000,000 ÷ `volumetric_factor` (default 6000, so 1 m³ = 166.67 kg). Chargeable kg = the larger of actual and volumetric, rounded up to `round_up_to` (default 0.5).
- `breaks` per lane: `"-45"`, `"+45"`, `"+100"`, `"+300"`, `"+500"`, `"+1000"` (any you have). The cheapest of "your break" and "a higher break at its minimum weight" wins, then the lane `minimum`.
- `surcharges`: `per_kg` on `chargeable` or `actual` weight with an optional `minimum`, or `flat`.

See `fixtures/rates.json`.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-air-freight-audit demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Air Freight Audit demo (fictional forwarder and rates, autumn 2026) in <demo folder>

▶ Audit the air freight invoices
  status: executed  decision: allow
  5 air waybill(s), 6164.9 billed: 4 with findings, 349 disputable. rate_over 3, charge_not_on_rate_sheet 1, surcharge_over 1, weight_over 1
    176-11112222   420 kg       0  clean
    176-11113333   400 kg     200  rate_over
    176-11114444   260 kg      52  weight_over, rate_over, surcharge_over
    176-11115555    90 kg      52  rate_over
    176-11116666    12 kg      45  charge_not_on_rate_sheet

▶ Price a 90 kg shipment from Frankfurt to Chicago
  status: executed  decision: allow
  90 kg chargeable (actual 90, volumetric 50): air freight 380 at the +100 break, plus surcharges FSC 85.5, SSC 15, AWB 35, SCREENING 20.

▶ Write the air audit
  status: executed  decision: allow
  Air audit written. 5 air waybill(s), 6164.9 billed: 4 with findings, 349 disputable. rate_over 3, charge_not_on_rate_sheet 1, surcharge_over 1, weight_over 1

▶ Draft the dispute to the forwarder
  status: executed  decision: allow  (auto)
  dispute Skyline Logistics drafted for 349 with 1 open marker(s) ([ATTACH the rate sheet and the AWB with dimensions]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Jo Park (fictional)
  dispute Skyline-Logistics approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to pay the forwarder itself
  status: blocked  decision: block
  reason: Fairhaul Air Freight Audit never pays forwarders or airlines.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `air_audit` | For each air waybill: actual, volumetric and chargeable kg, billed total, findings (rate_over, weight_over, surcharge_over, charge_not_on_rate_sheet, no_lane, no_weight, no_rate_sheet, currency_mismatch) and the dispu… | runs |
| `air_quote` | Chargeable weight and air freight cost for one shipment on a lane in the rate sheet, using the cheapest valid weight break. | runs |
| `air_write_report` | Write air.csv and .html (one row per finding; clean waybills listed) into out_dir (default fairhaul-out/air). | runs |
| `air_draft_dispute` | Write drafts/dispute-<forwarder>.md listing each air waybill charged above the rate sheet, with actual, volumetric and chargeable weight. | asks first (Auto can be opted in) |
| `air_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_pay_invoice` | Fairhaul Air Freight Audit never pays forwarders or airlines. | refused |
| `email_send` | Fairhaul Air Freight Audit never sends email. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Air invoice lines (`invoices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `invoice_number` (required) | text | Invoice Number, Invoice, Invoice # | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `forwarder` (required) | text | Forwarder, Carrier, Airline, Vendor | Speditionsfirma, Commissionnaire, フォワーダー, 货代 |
| `awb` (required) | text | AWB, Air Waybill, HAWB, MAWB | Luftfrachtbrief, LTA, 航空運送状番号, 空运提单号 |
| `origin` (required) | text | Origin, Origin Airport, From | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `destination` (required) | text | Destination, Destination Airport, To | Bestimmungsort, Destination, 届け先, 目的地 |
| `flight_date` | date | Flight Date, Departure, ETD, Ship Date | Flugdatum, Date du vol, フライト日, 航班日期 |
| `service` | text | Service, Service Level, Product | Service, Service, サービス, 服务 |
| `pieces` | number | Pieces, Pcs | Packstücke, Colis, 個口数, 件数 |
| `actual_kg` | kilograms (lb converted) | Actual Weight, Gross Weight, Actual kg, Gross kg | Gewicht, Poids, 重量, 重量 |
| `volume_cbm` | number | Volume, CBM, Volume m3, Cubic Meters | Volumen, Volume, 容積, 体积 |
| `billed_kg` | kilograms (lb converted) | Chargeable Weight, Billed Weight, Chargeable kg | Frachtpflichtiges Gewicht, Poids taxable, 課金重量, 计费重量 |
| `charge_code` (required) | text | Charge, Charge Code, Description | Leistungsbeschreibung, Libellé de la prestation, 請求項目, 费用名称 |
| `amount` (required) | amount | Amount, Charge Amount | Betrag, Montant, 金額, 金额 |
| `currency` | text | Currency, Curr, CCY | Währung, Devise, 通貨, 币种 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-air-freight-audit inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-air-freight-audit demo
npx -y fairhaul-air-freight-audit mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-air-freight-audit": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-air-freight-audit",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-air-freight-audit -- npx -y fairhaul-air-freight-audit mcp --root .`, or install the `fairhaul-air-freight-audit` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-air-freight-audit approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-air-freight-audit approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-air-freight-audit kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-air-freight-audit tools                 # every tool, its policy and arguments
fairhaul-air-freight-audit sources               # the columns each input is read from
fairhaul-air-freight-audit inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-air-freight-audit call air_audit '{"invoices":"<invoices>","rates":"<rates>"}'
fairhaul-air-freight-audit eval                  # the private eval cases on the fictional fixtures
fairhaul-air-freight-audit demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Compared against your rate sheet, not an airline tariff.
- Charges in another currency are flagged, not converted.
