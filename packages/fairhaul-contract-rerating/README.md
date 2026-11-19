# Fairhaul Contract Rerating (`fairhaul-contract-rerating`)

Re-rates your shipment history under every carrier contract you hold: linehaul with minimums and discounts, fuel at the diesel price for the week each load shipped, and the accessorials ordered. It shows what each carrier would have cost, the cheapest carrier on each lane, what you paid above the cheapest contract, and drafts routing guide changes. It never changes your routing guide.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-contract-rerating demo
npx -y fairhaul-contract-rerating mcp --root ./freight
```

Contracts use the Fairhaul contract format shared with Fairhaul Freight Bill Audit and Fairhaul Fuel Surcharges, so one file serves all three.

## Rules

- A carrier prices a shipment only if its contract is in force on the ship date, has a lane that matches, has the measure the lane needs (weight, miles or pallets) and prices every accessorial ordered. Otherwise it shows why not.
- A lane ranking includes only carriers that can price every shipment on it.


<!-- generated:start -->

## What the AI model sees

- **Masked:** this agent reads no column with a person's name or contact details. Anything that looks like a phone number, e-mail or SSN is still replaced in every result.
- **Sent as they are:** ids, codes, places and names of carriers and other businesses (`shipment_id`, `carrier`, `mode`, `origin_city`, `origin_state`, `origin_postal`, `dest_city`, `dest_state`, `dest_postal`, `accessorials`); dates (`ship_date`); amounts, weights and counts (`weight`, `pallets`, `miles`, `class`, `paid`).
- Results go to whatever model your AI assistant uses. For data you may not share with that provider, use a local model or one covered by your agreements with it. The CSV and HTML files written on your machine keep the real values.

## A demo run

`npx -y fairhaul-contract-rerating demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Contract Rerating demo (fictional contracts and history, October 2026) in <demo folder>

▶ Re-rate every past shipment under every contract
  status: executed  decision: allow
  7 shipment(s), 2743.01 paid. Re-rated under every contract: 281.51 more than the cheapest contract on the day. 2 lane(s) where another carrier is cheaper overall (281.51). 1 shipment(s) no contract can price.
    IL → TX   now Ridgeline Freight  best Prairie Express    saves 149.04
    IL → GA   now Prairie Express    best Coastal Line Haul  saves 132.47
    IL → OH   now Ridgeline Freight  best null               saves -

▶ Write the re-rating report
  status: executed  decision: allow
  Re-rating report written. 7 shipment(s), 2743.01 paid. Re-rated under every contract: 281.51 more than the cheapest contract on the day. 2 lane(s) where another carrier is cheaper overall (281.51). 1 shipment(s) no contract can price.

▶ Draft the routing guide changes
  status: executed  decision: allow  (auto)
  routing change routing-guide drafted for 281.51 with 2 open marker(s) ([TO CONFIRM routing guide owner], [TO CONFIRM who approves routing changes]). Nothing was sent.

▶ Approve the change: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the click (recorded; a person changes the routing guide)
  status: executed  decision: ask  approved by: Lee Brown (fictional)
  routing change routing-guide approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to change the routing guide itself
  status: blocked  decision: block
  reason: Fairhaul Contract Rerating never changes your routing guide; a person does.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `rerate_rerate` | Each shipment priced under every carrier contract in force on its ship date (linehaul, fuel at that week's diesel, accessorials), the cheapest carrier and what was paid above it; each lane's carrier ranking and saving… | runs |
| `rerate_write_report` | Write rerate.csv and .html (one row per shipment with each carrier's price; lanes ranked by savings; carriers) into out_dir (default fairhaul-out/rerate). | runs |
| `rerate_draft_routing_change` | Write drafts/routing_change-<name>.md: for each lane where another contract is cheaper on your history, the current and proposed first-choice carrier with the totals. | asks first (Auto can be opted in) |
| `rerate_request_apply` | After one named human click (even in Auto), record that the reviewed routing change draft is approved in routing_change-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `tms_update_routing_guide` | Fairhaul Contract Rerating never changes your routing guide; a person does. | refused |
| `email_send` | Fairhaul Contract Rerating never sends email. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Shipment history (`history`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, BOL, PRO | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` (required) | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `ship_date` | date | Ship Date, Pickup Date, Date | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `mode` | text | Mode, Service | Verkehrsträger, Mode de transport, 輸送モード, 运输方式 |
| `origin_city` | text | Origin City, Ship From City | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `origin_state` | text | Origin State, Ship From State | - |
| `origin_postal` | text | Origin Zip, Origin Postal, Origin Postal Code | PLZ Abgang, Code postal départ, 出荷元郵便番号, 始发地邮编 |
| `dest_city` | text | Destination City, Dest City, Ship To City | Bestimmungsort, Destination, 届け先, 目的地 |
| `dest_state` | text | Destination State, Dest State, Ship To State | - |
| `dest_postal` | text | Destination Zip, Dest Zip, Destination Postal | PLZ Empfänger, Code postal destination, 届け先郵便番号, 目的地邮编 |
| `weight` | pounds (kg converted) | Weight, Weight (lb), Billed Weight | Gewicht, Poids, 重量, 重量 |
| `pallets` | number | Pallets, Handling Units | Paletten, Palettes, パレット数, 托盘数 |
| `miles` | miles (km converted) | Miles, Distance | Entfernung, Distance, 距離, 距离 |
| `class` | number | Class, Freight Class | - |
| `accessorials` | text | Accessorials, Services, Accessorials Ordered | Zusatzleistungen, Prestations annexes, 付帯作業, 附加服务 |
| `paid` | amount | Paid, Paid Amount, Total Cost, Freight Cost, Amount | Bezahlt, Montant payé, 支払額, 已付金额 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-contract-rerating inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-contract-rerating demo
npx -y fairhaul-contract-rerating mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-contract-rerating": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-contract-rerating",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-contract-rerating -- npx -y fairhaul-contract-rerating mcp --root .`, or install the `fairhaul-contract-rerating` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-contract-rerating approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-contract-rerating approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-contract-rerating kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-contract-rerating tools                 # every tool, its policy and arguments
fairhaul-contract-rerating sources               # the columns each input is read from
fairhaul-contract-rerating inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-contract-rerating call rerate_rerate '{"history":"<history>","contracts":"<contracts>"}'
fairhaul-contract-rerating eval                  # the private eval cases on the fictional fixtures
fairhaul-contract-rerating demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Priced from your contract files, not a carrier's live tariff or base-rate product.
- Price is not service. Check on-time and claims (Fairhaul Carrier Scorecards) before moving freight.
