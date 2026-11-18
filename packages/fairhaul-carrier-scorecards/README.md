# Fairhaul Carrier Scorecards (`fairhaul-carrier-scorecards`)

Scores each carrier from your own shipment history: on-time delivery and pickup, tender acceptance, billing accuracy, claim-free loads, tracking and cost per mile. It weights them your way, ranks the carriers, shows on-time delivery by quarter and drafts the review note for a carrier. It never sends the note and never changes your routing guide.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-carrier-scorecards demo
npx -y fairhaul-carrier-scorecards mcp --root ./carriers
```

## How the score works

| Measure | Counts as good | Default weight | Default target |
|---|---|---|---|
| On-time delivery | delivered by the planned day, or within the grace minutes when both times are known | 30 | 95% |
| On-time pickup | the same, for pickup | 15 | 95% |
| Tender acceptance | accepted out of tenders with a response | 20 | 85% |
| Billing accuracy | billed within 2% of the expected amount | 15 | 95% |
| Claim-free loads | loads with no claim amount | 10 | 98% |
| Tracking | loads with at least one tracking update | 5 | 90% |
| Cost per mile | relative to the cheapest carrier (100 = cheapest) | 5 | none |

A measure with no data for a carrier drops out and the other weights are rescaled, so missing data never counts as a zero. Carriers with fewer than 5 loads are listed but not ranked. Change any of this in a settings file (see `fixtures/scorecard.json`).


<!-- generated:start -->

## A demo run

`npx -y fairhaul-carrier-scorecards demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Carrier Scorecards demo (fictional carriers, July to November 2026) in <demo folder>

▶ Score and rank the carriers
  status: executed  decision: allow
  4 carrier(s), 21 load(s), 30287 billed. 3 ranked: 1. Ridgeline Freight 94.9, 2. Prairie Express 85.8, 3. Coastal Line Haul 77.2. Not ranked (under 5 loads): Summit Carriers.
     1 Ridgeline Freight  score  94.9  OTD  85.7%  accept   100%  On-time delivery
     2 Prairie Express    score  85.8  OTD   100%  accept  62.5%  Tender acceptance, Billing accuracy
     3 Coastal Line Haul  score  77.2  OTD    50%  accept   100%  On-time delivery, On-time pickup, Claim-free loads, Tracking
     - Summit Carriers    score   100  OTD   100%  accept   100%  

▶ Write the scorecard
  status: executed  decision: allow
  Scorecard written. 4 carrier(s), 21 load(s), 30287 billed. 3 ranked: 1. Ridgeline Freight 94.9, 2. Prairie Express 85.8, 3. Coastal Line Haul 77.2. Not ranked (under 5 loads): Summit Carriers.

▶ Draft the review note for the carrier that slipped
  status: executed  decision: allow  (auto)
  review Coastal Line Haul drafted with 1 open marker(s) ([TO CONFIRM meeting date]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Sam Lee (fictional)
  review Coastal-Line-Haul approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to change the routing guide itself
  status: blocked  decision: block
  reason: Fairhaul Carrier Scorecards never changes your routing guide or carrier awards; a person decides.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `scorecards_score` | Per carrier: loads, spend, on-time delivery and pickup, tender acceptance, billing accuracy and amount over agreed, claim-free loads, tracking, cost per mile, the weighted score (measures with no data drop out), rank,… | runs |
| `scorecards_write_report` | Write scorecards-scorecard.csv and .html (one row per carrier, plus the on-time trend by quarter) into out_dir (default lodestar-out/scorecards). | runs |
| `scorecards_draft_review` | Write drafts/review-<carrier>.md: a review note for one carrier with its results against your targets, its rank, its late loads and any billing above the agreed amount. | asks first (Auto can be opted in) |
| `scorecards_request_send` | After one named human click (even in Auto), record that the reviewed review draft is approved in review-requests.csv. | one named click, even in Auto (`binding_send`) |
| `email_send` | Fairhaul Carrier Scorecards never sends email. | refused |
| `tms_update_routing_guide` | Fairhaul Carrier Scorecards never changes your routing guide or carrier awards; a person decides. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Shipment history (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, Load Number, Order, BOL | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` (required) | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `tender` | text | Tender, Tender Status, Tender Response, Accepted, Response | - |
| `pickup_planned` | date and time | Pickup Planned, Pickup Appointment, Scheduled Pickup, Planned Pickup, Pickup Appt | Geplante Abholung, Enlèvement prévu, 集荷予定日, 计划提货时间 |
| `pickup_actual` | date and time | Pickup Actual, Actual Pickup, Picked Up, Pickup Date | Abholdatum, Date d'enlèvement, 集荷日, 提货日期 |
| `delivery_planned` | date and time | Delivery Planned, Delivery Appointment, Scheduled Delivery, Planned Delivery, Delivery Appt, Due Date | Geplante Zustellung, Livraison planifiée, 配達予定日, 计划送达时间 |
| `delivery_actual` | date and time | Delivery Actual, Actual Delivery, Delivered, Delivery Date | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `billed_amount` | amount | Billed Amount, Invoice Amount, Billed, Invoiced | Betrag, Montant, 金額, 金额 |
| `expected_amount` | amount | Expected Amount, Quoted, Quote, Contract Amount, Rate Con Amount, Expected | Erwarteter Betrag, Montant attendu, 予定金額, 预计金额 |
| `claim_amount` | amount | Claim Amount, Claims, OS&D Amount | Schadenshöhe, Montant réclamé, クレーム金額, 索赔金额 |
| `tracking_updates` | text | Tracking Updates, Tracking Events, Status Updates, Tracked | - |
| `miles` | miles (km converted) | Miles, Distance, Loaded Miles | Entfernung, Distance, 距離, 距离 |
| `mode` | text | Mode, Service | Verkehrsträger, Mode de transport, 輸送モード, 运输方式 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-carrier-scorecards inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-carrier-scorecards demo
npx -y fairhaul-carrier-scorecards mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-carrier-scorecards": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-carrier-scorecards",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-carrier-scorecards -- npx -y fairhaul-carrier-scorecards mcp --root .`, or install the `fairhaul-carrier-scorecards` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-carrier-scorecards approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-carrier-scorecards approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-carrier-scorecards kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-carrier-scorecards tools                 # every tool, its policy and arguments
fairhaul-carrier-scorecards sources               # the columns each input is read from
fairhaul-carrier-scorecards inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-carrier-scorecards call scorecards_score '{"shipments":"<shipments>"}'
fairhaul-carrier-scorecards eval                  # the private eval cases on the fictional fixtures
fairhaul-carrier-scorecards demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Scores are only as good as your TMS dates. A late delivery caused by your own dock still counts against the carrier; check late loads before you share the note.
- Cost per mile ignores lane mix, so a carrier on long lanes looks cheaper per mile.
- It does not score carriers you have no history with.
