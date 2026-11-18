# Fairhaul Lane Spend (`fairhaul-lane-spend`)

Maps your freight spend by lane and mode and tracks cost per hundredweight and per mile month by month. It finds LTL shipments on one lane that could have shared a truck, and heavy LTL that should have been quoted as truckload, with an estimated saving at your own truckload rate. It drafts the consolidation plan for your shipping team. It never holds orders or books loads.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-lane-spend demo
npx -y fairhaul-lane-spend mcp --root ./freight
```

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `lane_level` | `zip3` | Group places by state, 3-digit ZIP (falls back to state) or city |
| `window_days` | 0 | LTL shipments this many days apart on one lane can combine |
| `tl_rate_per_mile`, `tl_minimum` | 2.75, 900 | Your typical truckload cost, for the estimate |
| `tl_weight_lbs`, `tl_pallets` | 10,000, 12 | A single LTL shipment at or above either is flagged for a truckload or volume quote |
| `max_weight_lbs`, `max_pallets` | 44,000, 26 | What one truck can take |


<!-- generated:start -->

## A demo run

`npx -y fairhaul-lane-spend demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Lane Spend demo (fictional shipments, September and October 2026) in <demo folder>

▶ Map spend by lane and find consolidation
  status: executed  decision: allow
  12 shipment(s), 15990 spend on 3 lane(s); the top three carry 100% of spend. 1 group(s) of LTL could have shared a truck (about 526.25 less); 1 heavy LTL shipment(s) should be quoted as truckload (about 511 less).
    IL 606 → TX 752       7040 (44%)  24.53/cwt
    IL 606 → CO 802       5480 (34.3%)  7.41/cwt
    IL 606 → GA 303       3470 (21.7%)  19.49/cwt

▶ Same with a 2.50 per mile truckload rate
  status: executed  decision: allow
  12 shipment(s), 15990 spend on 3 lane(s); the top three carry 100% of spend. 2 group(s) of LTL could have shared a truck (about 955 less); 1 heavy LTL shipment(s) should be quoted as truckload (about 690 less).

▶ Write the lane report
  status: executed  decision: allow
  Lane report written. 12 shipment(s), 15990 spend on 3 lane(s); the top three carry 100% of spend. 1 group(s) of LTL could have shared a truck (about 526.25 less); 1 heavy LTL shipment(s) should be quoted as truckload (about 511 less).

▶ Draft the consolidation plan
  status: executed  decision: allow  (auto)
  consolidation plan consolidation drafted for 1037.25 with 1 open marker(s) ([TO CONFIRM e.g. hold orders for this lane to one ship day a week, or quote truckload above 10,000 lb]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Lee Brown (fictional)
  consolidation plan consolidation approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to hold orders itself
  status: blocked  decision: block
  reason: Fairhaul Lane Spend never holds, moves or changes orders.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `lanes_analyse` | Spend, share, weight, cost per hundredweight and per mile, modes and carriers by lane; cost per hundredweight by lane and month; LTL groups on one lane within the window that fit one truck, with a truckload estimate; … | runs |
| `lanes_write_report` | Write lanes.csv and .html (one row per lane; consolidation groups; heavy LTL; monthly trend) into out_dir (default lodestar-out/lanes). | runs |
| `lanes_draft_consolidation_plan` | Write drafts/consolidation_plan-<name>.md for your shipping team: the LTL groups that could share a truck, heavy LTL to quote as truckload, the estimated saving and a proposed rule to fill in. | asks first (Auto can be opted in) |
| `lanes_request_send` | After one named human click (even in Auto), record that the reviewed consolidation plan draft is approved in consolidation_plan-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_hold_orders` | Fairhaul Lane Spend never holds, moves or changes orders. | refused |
| `tms_tender_load` | Fairhaul Lane Spend never tenders or books loads. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Shipment history (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, BOL, PRO | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `ship_date` (required) | date | Ship Date, Pickup Date, Date | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `mode` | text | Mode, Service, Mode of Transport | Verkehrsträger, Mode de transport, 輸送モード, 运输方式 |
| `carrier` | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `origin_city` | text | Origin City, Ship From City | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `origin_state` | text | Origin State, Ship From State | - |
| `origin_postal` | text | Origin Zip, Origin Postal | PLZ Abgang, Code postal départ, 出荷元郵便番号, 始发地邮编 |
| `dest_city` | text | Destination City, Dest City, Ship To City | Bestimmungsort, Destination, 届け先, 目的地 |
| `dest_state` | text | Destination State, Dest State, Ship To State | - |
| `dest_postal` | text | Destination Zip, Dest Zip, Destination Postal | PLZ Empfänger, Code postal destination, 届け先郵便番号, 目的地邮编 |
| `weight` | pounds (kg converted) | Weight, Weight (lb), Billed Weight | Gewicht, Poids, 重量, 重量 |
| `pallets` | number | Pallets, Handling Units | Paletten, Palettes, パレット数, 托盘数 |
| `miles` | miles (km converted) | Miles, Distance | Entfernung, Distance, 距離, 距离 |
| `cost` (required) | amount | Cost, Total Cost, Freight Cost, Paid, Amount | Frachtkosten, Frais de transport, 運賃, 运费 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-lane-spend inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-lane-spend demo
npx -y fairhaul-lane-spend mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-lane-spend": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-lane-spend",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-lane-spend -- npx -y fairhaul-lane-spend mcp --root .`, or install the `fairhaul-lane-spend` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-lane-spend approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-lane-spend approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-lane-spend kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-lane-spend tools                 # every tool, its policy and arguments
fairhaul-lane-spend sources               # the columns each input is read from
fairhaul-lane-spend inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-lane-spend call lanes_analyse '{"shipments":"<shipments>"}'
fairhaul-lane-spend eval                  # the private eval cases on the fictional fixtures
fairhaul-lane-spend demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Truckload costs are estimates from your per-mile rate. Different delivery addresses on one lane mean a multi-stop load, which costs more.
- Holding orders to ship together can break delivery promises. Check with customers first.
