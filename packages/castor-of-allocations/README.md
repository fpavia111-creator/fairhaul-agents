# Castor of Allocations (`castor-of-allocations`)

Splits each shipment's freight bill across the orders, customers, SKUs and cost centers that rode on it. It shows freight per unit and as a percent of sales value, and drafts the reclass journal from the freight clearing account to the right GL account and cost center. It never posts to your ledger and never writes cost back into orders.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y castor-of-allocations demo
npx -y castor-of-allocations mcp --root ./close
```

## How the split works

- Choose a basis: `weight` (default), `cube`, `value`, `pallets` or `units`.
- If any line on a shipment lacks that measure, the whole shipment falls back to the next one in `fallback` (default cube, value, units), then equal shares. Each fallback is listed as a problem.
- The last line on each shipment takes the rounding cent, so every shipment allocates to the cent.
- A shipment with no order lines is not allocated and is listed.


<!-- generated:start -->

## A demo run

`npx -y castor-of-allocations demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Castor of Allocations demo (fictional October shipments) in <demo folder>

▶ Split October freight across order lines by weight
  status: executed  decision: allow
  5 shipment(s) billed 5225.5; 4325.5 split across 9 order line(s) by weight, 900 not allocated. 2 problem(s) to look at. Most freight: Front Range Supply (1912.87).
    Front Range Supply       1912.87   11.19% of value
    Lakeside Outfitters          840    9.77% of value
    Bayou Goods               811.33   30.05% of value
    Hill Country Home          761.3    9.58% of value

▶ Same split by cube, to compare
  status: executed  decision: allow
  5 shipment(s) billed 5225.5; 4325.5 split across 9 order line(s) by cube, 900 not allocated. 1 problem(s) to look at. Most freight: Front Range Supply (1912.87).

▶ Write the allocation detail and the reclass journal draft
  status: executed  decision: allow
  Allocation written: 5 shipment(s) billed 5225.5; 4325.5 split across 9 order line(s) by weight, 900 not allocated. 2 problem(s) to look at. Most freight: Front Range Supply (1912.87). Journal draft has 3 line(s).

▶ Approve the journal for posting: waits for a named person
  status: needs_approval  decision: ask
  reason: Posting to the ledger needs a named person's click.

▶ Same call after the click (recorded; a person posts it)
  status: executed  decision: ask  approved by: Dana Controller (fictional)
  Journal approved for posting (3 line(s)). Nothing was posted by the agent.

▶ Agent tries to post to the ledger itself
  status: blocked  decision: block
  reason: Castor never posts to your ledger; a person posts the reviewed entry.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `castor_allocate` | Allocate each shipment's cost to its order lines by the chosen basis (falling back when a line lacks it), with totals by customer, SKU and GL account plus cost center, freight per unit and freight as a percent of value. | runs |
| `castor_write_report` | Write castor-allocation.csv and .html (one row per order line, by customer, SKU and cost center, and the problems) and allocation-journal-draft.csv (debits by GL and cost center, one credit to the clearing account) in… | runs |
| `castor_request_post` | After one named human click, record in post-approvals.csv that the reviewed allocation-journal-draft.csv (by sha256) may be posted. | asks first (Auto can be opted in) |
| `erp_post_journal` | Castor never posts to your ledger; a person posts the reviewed entry. | refused |
| `erp_update_order_cost` | Castor never writes landed cost back into orders or items. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Freight cost per shipment (`costs`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, BOL, PRO | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `cost` (required) | amount | Cost, Freight Cost, Invoice Amount, Total, Amount | Frachtkosten, Frais de transport, 運賃, 运费 |
| `invoice_number` | text | Invoice Number, Invoice | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `carrier` | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `date` | date | Date, Ship Date, Invoice Date | Datum, Date, 日付, 日期 |

### Order lines (`order_lines`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, BOL, PRO | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `order_id` (required) | text | Order, Order ID, Order Number, SO | Bestellnummer, N° de commande, 注文番号, 订单号 |
| `customer` | text | Customer, Customer Name, Ship To | Kunde, Client, 顧客, 客户 |
| `sku` | text | SKU, Item, Product | Artikelnummer, Référence, 品番, 物料编码 |
| `units` | number | Units, Qty, Quantity | Menge, Quantité, 数量, 数量 |
| `weight` | pounds (kg converted) | Weight, Line Weight, Weight (lb) | Gewicht, Poids, 重量, 重量 |
| `cube` | number | Cube, Volume, Cubic Feet, Cu Ft | - |
| `value` | amount | Value, Line Value, Extended Price, Sales Value | Warenwert, Valeur marchandise, 商品価格, 货值 |
| `pallets` | number | Pallets, Pallet Count | Paletten, Palettes, パレット数, 托盘数 |
| `cost_center` | text | Cost Center, Department, Profit Center | Kostenstelle, Centre de coût, 原価センタ, 成本中心 |
| `gl_account` | text | GL Account, Account | Konto, Compte, 勘定科目, 科目代码 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx castor-of-allocations inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y castor-of-allocations demo
npx -y castor-of-allocations mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "castor-of-allocations": {
      "command": "npx",
      "args": [
        "-y",
        "castor-of-allocations",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add castor-of-allocations -- npx -y castor-of-allocations mcp --root .`, or install the `castor-of-allocations` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `castor-of-allocations approve <id> --as "Your Name"` (or on the local approvals page, `castor-of-allocations approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`castor-of-allocations kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
castor-of-allocations tools                 # every tool, its policy and arguments
castor-of-allocations sources               # the columns each input is read from
castor-of-allocations inspect <file>        # how a file would be read (names and shapes, never values)
castor-of-allocations call castor_allocate '{"costs":"<costs>","order_lines":"<order_lines>"}'
castor-of-allocations eval                  # the private eval cases on the fictional fixtures
castor-of-allocations demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- An allocation is a method choice, not a fact. Different bases give different answers; the basis is on every line.
- Matching is by shipment id only. Order lines under another reference look unshipped.
- Not accounting advice. Your controller decides the method and posts the entry.
