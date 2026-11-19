# Fairhaul Freight Margins (`fairhaul-freight-margins`)

Compares the freight you charged each customer with what the freight actually cost. It shows recovery by customer and by freight terms, and finds collect orders you paid for, prepaid-and-add orders with no freight on the invoice, and orders shipped free below your threshold. It estimates how other free-shipping thresholds would change recovery. **It never changes terms or bills customers.**

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-freight-margins demo
npx -y fairhaul-freight-margins mcp --root ./sales
```

## What it reads

- Orders with value, freight charged and terms. Cost can be on the order or come from a shipment cost file; a shipment with several orders is split by order value.
- Terms are read from your wording: prepaid, delivered or free terms count as `prepaid`; prepaid and add (PP&A) as `prepaid_add`; collect, FOB origin, ex works or third party as `collect`.

## Flags

`collect_but_we_paid`, `prepaid_add_not_billed`, `free_below_threshold`, `freight_over_pct` (freight above `max_freight_pct`, default 10% of order value, and not fully charged), `no_cost`.

Threshold estimates assume every prepaid order below the threshold is charged the average rate of the orders that paid freight, and that customers do not change behaviour.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-freight-margins demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Freight Margins demo (fictional orders and freight costs) in <demo folder>

▶ Compare freight charged with freight cost
  status: executed  decision: allow
  10 order(s): freight cost 2215.92, charged 213, 9.6% recovered (gap -2002.92). Collect orders we paid: 210. Prepaid-and-add not billed: 88. Shipped free below the threshold: 213.52. Largest gap: Front Range Supply (-1457.52).
    Front Range Supply   cost  1457.52  charged      0      0%
    Hill Country Home    cost      286  charged      0      0%
    Bayou Goods          cost    152.2  charged      0      0%
    Gulf Coast Gifts     cost     96.4  charged      0      0%
    Lakeside Outfitters  cost    223.8  charged    213   95.2%
    threshold 1000 enforced: +85.2 (13.5% recovered)
    threshold 1500 enforced: +85.2 (13.5% recovered)
    threshold 2500 enforced: +175.79 (17.5% recovered)

▶ Write the recovery report
  status: executed  decision: allow
  Recovery report written. 10 order(s): freight cost 2215.92, charged 213, 9.6% recovered (gap -2002.92). Collect orders we paid: 210. Prepaid-and-add not billed: 88. Shipped free below the threshold: 213.52. Largest gap: Front Range Supply (-1457.52).

▶ Draft the freight terms review
  status: executed  decision: allow  (auto)
  terms change freight-terms drafted for 2002.92 with 0 open marker(s). Nothing was sent.

▶ Approve the review: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the click (recorded; a person changes terms)
  status: executed  decision: ask  approved by: Priya Nair (fictional)
  terms change freight-terms approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to bill a customer for freight itself
  status: blocked  decision: block
  reason: Fairhaul Freight Margins never invoices customers for freight.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `margins_margins` | Per order: terms, value, freight charged and cost (split by value on shared shipments), gap, recovery and flags. | runs |
| `margins_write_report` | Write margins.csv and .html (one row per order; by customer; by terms; threshold estimates) into out_dir (default fairhaul-out/margins). | runs |
| `margins_draft_terms_change` | Write drafts/terms_change-<name>.md: the freight recovery gap, policy leaks, the customers losing the most with a proposal to decide, and the free-shipping threshold estimates. | asks first (Auto can be opted in) |
| `margins_request_apply` | After one named human click (even in Auto), record that the reviewed terms change draft is approved in terms_change-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `erp_update_customer_terms` | Fairhaul Freight Margins never changes customer freight terms or prices. | refused |
| `ar_rebill_freight` | Fairhaul Freight Margins never invoices customers for freight. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Orders (`orders`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `order_id` (required) | text | Order, Order ID, Order Number, SO | Bestellnummer, N° de commande, 注文番号, 订单号 |
| `customer` | text | Customer, Customer Name, Account | Kunde, Client, 顧客, 客户 |
| `shipment_id` | text | Shipment ID, Load ID, BOL, Tracking | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `order_value` (required) | amount | Order Value, Merchandise, Subtotal, Sales | Bestellwert, Montant de la commande, 注文金額, 订单金额 |
| `freight_billed` | amount | Freight Billed, Freight Charged, Shipping Charged, Freight Revenue, Shipping | Versandkosten, Frais de port, 請求送料, 运费收入 |
| `terms` | text | Freight Terms, Terms, Incoterm, FOB | Lieferbedingung, Incoterm, 貿易条件, 贸易条款 |
| `freight_cost` | amount | Freight Cost, Actual Freight, Cost | Frachtkosten, Frais de transport, 運賃, 运费 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Shopify | Orders > Export (CSV) | Name, Financial Status, Lineitem name | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Freight cost per shipment (`costs`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, BOL, Tracking | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `cost` (required) | amount | Cost, Freight Cost, Amount, Total | Frachtkosten, Frais de transport, 運賃, 运费 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-freight-margins inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-freight-margins demo
npx -y fairhaul-freight-margins mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-freight-margins": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-freight-margins",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-freight-margins -- npx -y fairhaul-freight-margins mcp --root .`, or install the `fairhaul-freight-margins` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-freight-margins approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-freight-margins approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-freight-margins kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-freight-margins tools                 # every tool, its policy and arguments
fairhaul-freight-margins sources               # the columns each input is read from
fairhaul-freight-margins inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-freight-margins call margins_margins '{"orders":"<orders>"}'
fairhaul-freight-margins eval                  # the private eval cases on the fictional fixtures
fairhaul-freight-margins demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Freight cost must come from your files; orders without one are listed and left out of totals.
- Threshold figures are estimates, not forecasts.
- Not pricing or accounting advice.
