# Fairhaul Carton Sizing (`fairhaul-carton-sizing`)

Checks every parcel's carton against what was inside. It finds the smallest carton in your catalog that fits (any orientation, with padding), works out the dimensional weight and freight a better fit would have saved, flags packages heading for oversize charges and sizes your catalog lacks, and drafts carton and packing rule changes by SKU. It never changes your WMS and never orders cartons.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-carton-sizing demo
npx -y fairhaul-carton-sizing mcp --root ./packaging
```

## Settings (in the carton catalog file)

| Setting | Default | Meaning |
|---|---|---|
| `cartons` | required | Name and inside length, width, height in inches |
| `divisor` | 139 | Cubic inches per dimensional lb |
| `padding_in` | 1 | Inches added to each side of the contents |
| `rate_per_lb` | 1.10 | Your average cost per billable lb, for the saving |
| `oversize_length_plus_girth`, `oversize_longest_side` | 130, 48 | Above either, an extra charge is likely |


<!-- generated:start -->

## A demo run

`npx -y fairhaul-carton-sizing demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Carton Sizing demo (fictional parcels and cartons) in <demo folder>

▶ Check every carton against its contents
  status: executed  decision: allow
  9 package(s), average fill 55.1%: 4 could use a smaller carton (36 billable lb, about 39.6); 2 fit no carton in the catalog; 1 at risk of an oversize charge.
    P-01 LAMP-SHADE     M2      -> M1     22 ->  12 lb  smaller_carton
    P-02 LAMP-SHADE     M2      -> M1     22 ->  12 lb  smaller_carton
    P-03 LAMP-SHADE     M2      -> M1     22 ->  12 lb  smaller_carton
    P-04 CANDLE-SET     S2      -> S2      6 ->   6 lb  ok
    P-05 CANDLE-SET     M1      -> S2     12 ->   6 lb  smaller_carton
    P-06 THROW-BLANKET  L1      -> L1     50 ->  50 lb  ok
    P-07 FLOOR-RUG      CUSTOM  -> none   36 ->   - lb  no_fit
    P-08 MIRROR         CUSTOM  -> none   51 ->   - lb  no_fit
    P-09 BOOKENDS       S1      -> S1      3 ->   3 lb  ok

▶ Write the carton report
  status: executed  decision: allow
  Carton report written. 9 package(s), average fill 55.1%: 4 could use a smaller carton (36 billable lb, about 39.6); 2 fit no carton in the catalog; 1 at risk of an oversize charge.

▶ Draft the carton and packing rule changes
  status: executed  decision: allow  (auto)
  carton change cartons drafted for 39.6 with 2 open marker(s) ([TO CONFIRM warehouse or WMS owner], [TO CONFIRM drop test or trial week]). Nothing was sent.

▶ Approve the change: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the click (recorded; a person changes the WMS)
  status: executed  decision: ask  approved by: Ana Ruiz (fictional)
  carton change cartons approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to change the WMS packing rules itself
  status: blocked  decision: block
  reason: Fairhaul Carton Sizing never changes packing rules or the carton catalog in your WMS.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `cartons_check` | For each package: carton used, fill, dimensional and billable weight now, the smallest catalog carton that fits (any orientation, with padding) and its billable weight, the lb and money saved, oversize risk and data p… | runs |
| `cartons_write_report` | Write cartons.csv and .html (one row per package; savings by SKU; carton usage) into out_dir (default lodestar-out/cartons). | runs |
| `cartons_draft_carton_change` | Write drafts/carton_change-<name>.md: packing rules by SKU (from carton, to carton, saving), cartons to add for packages nothing fits, and carton usage. | asks first (Auto can be opted in) |
| `cartons_request_apply` | After one named human click (even in Auto), record that the reviewed carton change draft is approved in carton_change-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `wms_update_cartonization` | Fairhaul Carton Sizing never changes packing rules or the carton catalog in your WMS. | refused |
| `purchase_order_create` | Fairhaul Carton Sizing never orders cartons. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Shipped parcels (`packages`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `package_id` (required) | text | Package ID, Tracking Number, Order, Shipment ID | - |
| `carton` | text | Carton, Box, Carton Used, Box Code | Karton, Carton, 箱サイズ, 纸箱 |
| `carton_l` | inches (cm converted) | Carton Length, Box Length, Length | Kartonlänge, Longueur du carton, 箱の長さ, 纸箱长 |
| `carton_w` | inches (cm converted) | Carton Width, Box Width, Width | Kartonbreite, Largeur du carton, 箱の幅, 纸箱宽 |
| `carton_h` | inches (cm converted) | Carton Height, Box Height, Height | Kartonhöhe, Hauteur du carton, 箱の高さ, 纸箱高 |
| `contents_l` (required) | inches (cm converted) | Contents Length, Item Length, Product Length | Artikellänge, Longueur de l'article, 商品の長さ, 商品长 |
| `contents_w` (required) | inches (cm converted) | Contents Width, Item Width, Product Width | Artikelbreite, Largeur de l'article, 商品の幅, 商品宽 |
| `contents_h` (required) | inches (cm converted) | Contents Height, Item Height, Product Height | Artikelhöhe, Hauteur de l'article, 商品の高さ, 商品高 |
| `weight` (required) | pounds (kg converted) | Weight, Actual Weight, Weight (lb) | Gewicht, Poids, 重量, 重量 |
| `billed` | amount | Billed, Freight Cost, Charge, Net Charge | Frachtkosten, Frais de transport, 運賃, 运费 |
| `sku` | text | SKU, Item, Product | Artikelnummer, Référence, 品番, 物料编码 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-carton-sizing inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-carton-sizing demo
npx -y fairhaul-carton-sizing mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-carton-sizing": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-carton-sizing",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-carton-sizing -- npx -y fairhaul-carton-sizing mcp --root .`, or install the `fairhaul-carton-sizing` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-carton-sizing approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-carton-sizing approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-carton-sizing kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-carton-sizing tools                 # every tool, its policy and arguments
fairhaul-carton-sizing sources               # the columns each input is read from
fairhaul-carton-sizing inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-carton-sizing call cartons_check '{"packages":"<packages>","cartons":"<cartons>"}'
fairhaul-carton-sizing eval                  # the private eval cases on the fictional fixtures
fairhaul-carton-sizing demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Contents are one bounding box per package. Odd shapes and multi-item orders packed loosely need a person.
- Carriers' divisors, rounding and oversize rules differ and change; set yours. Fairhaul Parcel Refunds audits what the carrier actually billed.
- Test smaller cartons for damage before switching.
