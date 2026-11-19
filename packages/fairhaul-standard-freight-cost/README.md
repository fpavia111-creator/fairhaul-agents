# Fairhaul Standard Freight Cost (`fairhaul-standard-freight-cost`)

Compares the standard freight built into each item's cost with what freight actually cost per unit, month by month. It finds the SKUs whose standard is too low (margins look better than they are) or too high, proposes a new standard with its basis, estimates the inventory revaluation, and drafts the update. It never changes item costs and never revalues inventory.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-standard-freight-cost demo
npx -y fairhaul-standard-freight-cost mcp --root ./costing
```

Actual freight by SKU can come from your ERP or straight from `allocation.csv` written by [Fairhaul Freight Allocation](../fairhaul-freight-allocation).

## Statuses

| Status | Meaning |
|---|---|
| `standard_too_low` | Actual per unit is more than `threshold_pct` (default 10%) above standard on at least `min_units` (default 20) units |
| `standard_too_high` | More than the threshold below standard |
| `no_standard` | The SKU shipped but the item master has no freight standard |
| `thin_data` | Too few units to judge; no proposal |
| `no_shipments` | Has a standard but did not ship in these files |
| `ok` | Within the threshold |

When the per-unit cost moved more than the threshold between the first and last month, the proposal uses the latest month; otherwise the period average. The basis is written next to every proposal.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-standard-freight-cost demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Standard Freight Cost demo (fictional items, August to October freight) in <demo folder>

▶ Compare standard freight per unit with actual
  status: executed  decision: allow
  8 SKU(s), 1353 units: actual freight 4270.44 vs 3437 at standard (net +738.44). 2 standard(s) too low, 1 too high, 1 with no standard; 4 to change, inventory revaluation about 995.4.
    FLOOR-RUG          18 ->  24.5002  standard_too_low   31.19
    LAMP-SHADE        1.1 ->   1.4349  standard_too_low   1.79
    BOOKENDS          4.5 ->      3.9  standard_too_high  3.9
    DOOR-MAT            - ->      1.9  no_standard        1.9
    MIRROR             12 ->  14.8889  thin_data          
    PLANTER             2 ->        -  no_shipments       
    THROW-BLANKET     2.4 ->   2.5071  ok                 
    CANDLE-SET        0.6 ->   0.6158  ok                 

▶ Write the standards report
  status: executed  decision: allow
  Standards report written. 8 SKU(s), 1353 units: actual freight 4270.44 vs 3437 at standard (net +738.44). 2 standard(s) too low, 1 too high, 1 with no standard; 4 to change, inventory revaluation about 995.4.

▶ Draft the standard update
  status: executed  decision: allow  (auto)
  standard update freight-standards drafted for 995.4 with 0 open marker(s). Nothing was sent.

▶ Approve the update: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the click (recorded; a person loads it)
  status: executed  decision: ask  approved by: Priya Nair (fictional)
  standard update freight-standards approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to change item costs itself
  status: blocked  decision: block
  reason: Fairhaul Standard Freight Cost never changes standard costs in your ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `costing_compare` | Per SKU: units, actual freight, standard, actual per unit, variance in money and percent, month-by-month per unit and trend, status, proposed standard with basis, and inventory revaluation estimate. | runs |
| `costing_write_report` | Write costing-standards.csv and .html (one row per SKU) into out_dir (default fairhaul-out/costing). | runs |
| `costing_draft_standard_update` | Write drafts/standard_update-<name>.md: the items whose freight standard moved past the threshold, the proposed standard and its basis, units on hand and the revaluation estimate. | asks first (Auto can be opted in) |
| `costing_request_apply` | After one named human click (even in Auto), record that the reviewed standard update draft is approved in standard_update-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `erp_update_item_cost` | Fairhaul Standard Freight Cost never changes standard costs in your ERP. | refused |
| `erp_revalue_inventory` | Fairhaul Standard Freight Cost never revalues inventory or posts the variance. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Item master (`items`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `sku` (required) | text | SKU, Item, Item Number, Product | Artikelnummer, Référence, 品番, 物料编码 |
| `description` | text | Description, Item Description, Name | Beschreibung, Description, 摘要, 摘要 |
| `standard_freight` (required) | amount | Standard Freight, Std Freight, Freight Standard, Freight per Unit, Standard Freight per Unit | Standardfrachtkosten, Fret standard, 標準運賃, 标准运费 |
| `on_hand` | number | On Hand, Qty On Hand, Inventory, Units On Hand | Bestand, Stock, 在庫数, 库存数量 |
| `standard_cost` | amount | Standard Cost, Std Cost, Unit Cost | Standardpreis, Coût standard, 標準原価, 标准成本 |

### Actual freight by SKU (`actuals`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `sku` (required) | text | SKU, Item, Item Number, Product | Artikelnummer, Référence, 品番, 物料编码 |
| `units` (required) | number | Units, Qty, Quantity | Menge, Quantité, 数量, 数量 |
| `freight` (required) | amount | Freight, Freight Cost, Allocated Freight, Cost | Frachtkosten, Frais de transport, 運賃, 运费 |
| `ship_date` | date | Ship Date, Date, Invoice Date | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `shipment_id` | text | Shipment ID, Load ID, BOL | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-standard-freight-cost inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-standard-freight-cost demo
npx -y fairhaul-standard-freight-cost mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-standard-freight-cost": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-standard-freight-cost",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-standard-freight-cost -- npx -y fairhaul-standard-freight-cost mcp --root .`, or install the `fairhaul-standard-freight-cost` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-standard-freight-cost approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-standard-freight-cost approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-standard-freight-cost kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-standard-freight-cost tools                 # every tool, its policy and arguments
fairhaul-standard-freight-cost sources               # the columns each input is read from
fairhaul-standard-freight-cost inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-standard-freight-cost call costing_compare '{"items":"<items>","actuals":"<actuals>"}'
fairhaul-standard-freight-cost eval                  # the private eval cases on the fictional fixtures
fairhaul-standard-freight-cost demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Proposals and revaluation are estimates from the files you give it. Seasonality, a one-off expedite or a carrier change can skew a short period.
- Matching is by SKU only.
- Not accounting advice. Your cost accountant decides when standards change and how variance is booked.
