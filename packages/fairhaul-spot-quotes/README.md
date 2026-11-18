# Fairhaul Spot Quotes (`fairhaul-spot-quotes`)

Lines up the spot quotes you collected for each load on one all-in basis, adding fuel and accessorials a quote leaves out. It drops quotes that have expired or would miss the delivery date, compares the best with what the lane usually costs you, and drafts the booking confirmation. It never tenders or books a load.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-spot-quotes demo
npx -y fairhaul-spot-quotes mcp --root ./spot
```

## How quotes are made comparable

- A linehaul-only quote gets fuel added: `fuel_per_mile` × miles (default 0.60), or `fuel_pct` of the quote when miles are unknown (default 20%).
- When the load needs accessorials the quote does not include, `accessorial_allowance` amounts are added; any without an allowance are listed as "ask whether it is included".
- A quote is usable when it is valid through the as-of date and pickup date plus transit days is on or before the deliver-by date.
- The best usable quote is flagged when it is more than `above_history_pct` (default 15%) above the lane history average.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-spot-quotes demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Spot Quotes demo (fictional loads and quotes, as of 2026-11-16) in <demo folder>

▶ Compare the quotes on one all-in basis
  status: executed  decision: allow
  5 load(s) as of 2026-11-16: 2 ready to book, 1 priced well above history, 1 need new quotes, 1 with none. Best usable quotes total 6690 all-in (+590 against lane history).
    Q-701 ready        Ridgeline Freight 2100
    Q-702 check_price  Coastal Line Haul 2350
    Q-703 ready        Prairie Express 2240
    Q-704 requote      -
    Q-705 no_quotes    -

▶ Write the quote board
  status: executed  decision: allow
  Quote board written. 5 load(s) as of 2026-11-16: 2 ready to book, 1 priced well above history, 1 need new quotes, 1 with none. Best usable quotes total 6690 all-in (+590 against lane history).

▶ Draft the booking for Q-701
  status: executed  decision: allow  (auto)
  booking Q-701 drafted for 2100 with 3 open marker(s) ([TO CONFIRM pickup details], [TO CONFIRM delivery details], [TO CONFIRM agreement or broker-carrier contract reference]). Nothing was sent.

▶ Approve tendering: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person tenders it)
  status: executed  decision: ask  approved by: Sam Lee (fictional)
  booking Q-701 approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to tender the load itself
  status: blocked  decision: block
  reason: Fairhaul Spot Quotes never tenders or books loads in your TMS or a load board.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `quotes_compare` | For each load: every quote on an all-in basis with what was added, whether it is usable (not expired, arrives by the deliver-by date), the best usable quote, the spread, the difference from lane history, flags and a s… | runs |
| `quotes_write_report` | Write quotes.csv and .html (one row per quote, best first within each load) into out_dir (default lodestar-out/quotes). | runs |
| `quotes_draft_booking` | Write drafts/booking-<load>.md: the confirmation accepting one carrier's quote for one load, with the all-in amount and what still needs filling in. | asks first (Auto can be opted in) |
| `quotes_request_tender` | After one named human click (even in Auto), record that the reviewed booking draft is approved in booking-requests.csv. | one named click, even in Auto (`binding_send`) |
| `tms_tender_load` | Fairhaul Spot Quotes never tenders or books loads in your TMS or a load board. | refused |
| `email_send` | Fairhaul Spot Quotes never sends email. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Loads needing a truck (`loads`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Load, Shipment ID, Order | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `origin` | text | Origin, From, Pickup City | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `destination` | text | Destination, To, Delivery City | Bestimmungsort, Destination, 届け先, 目的地 |
| `equipment` | text | Equipment, Trailer, Mode | Fahrzeugtyp, Type de véhicule, 車種, 车型 |
| `pickup_date` (required) | date | Pickup Date, Ready Date, Ship Date | Abholdatum, Date d'enlèvement, 集荷日, 提货日期 |
| `deliver_by` | date | Deliver By, Must Deliver, Required Delivery, Due Date | Liefertermin, Date de livraison prévue, 納期, 承诺送达日期 |
| `miles` | miles (km converted) | Miles, Distance | Entfernung, Distance, 距離, 距离 |
| `accessorials` | text | Accessorials, Services, Special Requirements | Zusatzleistungen, Prestations annexes, 付帯作業, 附加服务 |
| `lane_history_avg` | amount | Lane Average, History Average, Typical Cost, Benchmark | - |

### Quotes collected (`quotes`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Load, Shipment ID, Reference | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` (required) | text | Carrier, Broker, Provider, Quoted By | Spediteur, Transporteur, 運送会社, 承运商 |
| `amount` (required) | amount | Amount, Quote, Rate, Price, Linehaul | Betrag, Montant, 金額, 金额 |
| `all_in` | yes/no | All In, All-In, Includes Fuel, Fuel Included | Gesamtpreis, Prix tout compris, 総額運賃, 全包价 |
| `accessorials_included` | yes/no | Accessorials Included, Includes Accessorials | - |
| `valid_until` | date | Valid Until, Expires, Expiry, Good Through | Ablaufdatum, Date d'expiration, 有効期限, 到期日 |
| `transit_days` | number | Transit Days, Transit, Days | Laufzeit, Délai de transit, リードタイム, 运输时效 |
| `notes` | text | Notes, Comments, Conditions | Bemerkung, Remarques, 備考, 备注 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-spot-quotes inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-spot-quotes demo
npx -y fairhaul-spot-quotes mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-spot-quotes": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-spot-quotes",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-spot-quotes -- npx -y fairhaul-spot-quotes mcp --root .`, or install the `fairhaul-spot-quotes` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-spot-quotes approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-spot-quotes approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-spot-quotes kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-spot-quotes tools                 # every tool, its policy and arguments
fairhaul-spot-quotes sources               # the columns each input is read from
fairhaul-spot-quotes inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-spot-quotes call quotes_compare '{"loads":"<loads>","quotes":"<quotes>"}'
fairhaul-spot-quotes eval                  # the private eval cases on the fictional fixtures
fairhaul-spot-quotes demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Additions are your own allowances, not the carrier's numbers. Confirm the real all-in total on the rate confirmation.
- It does not vet the carrier. Check authority, insurance and fraud warning signs first (Fairhaul Carrier Vetting).
