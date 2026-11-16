# Bellatrix of Reweighs (`bellatrix-of-reweighs`)

Checks LTL weight and class corrections (reweighs and reclasses) against your declared dimensions, the density scale, normal scale tolerance and whether the carrier sent an inspection certificate. It separates the corrections worth challenging from the ones that mean your own product data is wrong, lists the item-master fixes, and drafts disputes. It never pays, sends or edits your item master.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y bellatrix-of-reweighs demo
npx -y bellatrix-of-reweighs mcp --root ./freight
```

## Statuses

| Status | When |
|---|---|
| `challenge` | Reweighed within scale tolerance (default the larger of 2% or 25 lb), or reclassed higher when your dimensions and the corrected weight give a density class at or below the one you declared |
| `ask_for_certificate` | No other reason to challenge, but no inspection certificate or photos on file |
| `fix_our_data` | The same product corrected at least twice with the carrier's figures standing up: update the item master |
| `accept` | The correction looks right |


<!-- generated:start -->

## A demo run

`npx -y bellatrix-of-reweighs demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Bellatrix of Reweighs demo (fictional LTL corrections, October 2026) in <demo folder>

▶ Review the weight and class corrections
  status: executed  decision: allow
  8 correction(s) added 784.15: 3 worth challenging (224.3), 1 need the certificate first (46.8), 3 point to your own product data, 1 look right.
    PRO-7101 Bookcase kit     +  212.4  fix_our_data        
    PRO-7102 Bookcase kit     + 118.75  fix_our_data        
    PRO-7103 Floor lamp       +   14.2  challenge           within_tolerance
    PRO-7104 Patio chair set  +    188  challenge           class_not_supported
    PRO-7105 Rug bundle       +   46.8  ask_for_certificate no_certificate
    PRO-7106 Patio chair set  +   22.1  challenge           no_certificate, within_tolerance
    PRO-7107 Mirror crate     +     64  accept              
    PRO-7108 Bookcase kit     +  117.9  fix_our_data        

▶ Write the corrections report
  status: executed  decision: allow
  Corrections report written. 8 correction(s) added 784.15: 3 worth challenging (224.3), 1 need the certificate first (46.8), 3 point to your own product data, 1 look right.

▶ Draft the dispute for Prairie Express
  status: executed  decision: allow  (auto)
  dispute Prairie Express drafted for 234.8 with 1 open marker(s) ([ATTACH our BOLs and any photos of the freight as tendered]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Sam Lee (fictional)
  dispute Prairie-Express approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to change the item master itself
  status: blocked  decision: block
  reason: Bellatrix never changes your item master; a person does.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `bellatrix_review` | For each correction: weight change, density and density class from your dimensions, the reasons to challenge (within_tolerance, class_not_supported, no_certificate) and a status (challenge, ask_for_certificate, fix_ou… | runs |
| `bellatrix_write_report` | Write bellatrix-corrections.csv and .html (one row per correction with status and reasons; item-master fixes; totals by carrier) into out_dir (default lodestar-out/bellatrix). | runs |
| `bellatrix_draft_dispute` | Write drafts/dispute-<carrier>.md listing each correction worth challenging or missing its certificate, with the reason (within scale tolerance, class not supported by density, no certificate). | asks first (Auto can be opted in) |
| `bellatrix_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_pay_invoice` | Bellatrix never pays or short-pays carriers. | refused |
| `email_send` | Bellatrix never sends email. | refused |
| `erp_update_item_master` | Bellatrix never changes your item master; a person does. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Weight and class corrections (`corrections`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `pro` (required) | text | PRO, PRO Number, Pro # | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `carrier` (required) | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `shipment_id` | text | Shipment ID, BOL, Load ID, Order | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `correction_date` | date | Correction Date, Inspection Date, Date, Invoice Date | Korrekturdatum, Date de correction, 訂正日, 更正日期 |
| `product` | text | Product, SKU, Item, Commodity, Description | Artikel, Article, 品目, 物料 |
| `handling_units` | number | Handling Units, Pallets, Pieces, HU | Packstücke, Colis, 個口数, 件数 |
| `length` | inches (cm converted) | Length, Length (in), L | Länge, Longueur, 長さ, 长 |
| `width` | inches (cm converted) | Width, Width (in), W | Breite, Largeur, 幅, 宽 |
| `height` | inches (cm converted) | Height, Height (in), H | Höhe, Hauteur, 高さ, 高 |
| `declared_weight` | pounds (kg converted) | Declared Weight, BOL Weight, Original Weight, Shipper Weight | Gewicht, Poids, 重量, 重量 |
| `corrected_weight` | pounds (kg converted) | Corrected Weight, Reweigh, Actual Weight, Inspected Weight | Nachgewogenes Gewicht, Poids corrigé, 再計量重量, 复磅重量 |
| `declared_class` | number | Declared Class, BOL Class, Original Class | - |
| `corrected_class` | number | Corrected Class, Inspected Class, New Class | - |
| `amount_added` | amount | Amount Added, Correction Amount, Additional Charge, Rebill Amount, Difference | - |
| `certificate` | yes/no | Certificate, Inspection Certificate, W&I Certificate, Cert Provided, Photos | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx bellatrix-of-reweighs inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y bellatrix-of-reweighs demo
npx -y bellatrix-of-reweighs mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "bellatrix-of-reweighs": {
      "command": "npx",
      "args": [
        "-y",
        "bellatrix-of-reweighs",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add bellatrix-of-reweighs -- npx -y bellatrix-of-reweighs mcp --root .`, or install the `bellatrix-of-reweighs` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `bellatrix-of-reweighs approve <id> --as "Your Name"` (or on the local approvals page, `bellatrix-of-reweighs approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`bellatrix-of-reweighs kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
bellatrix-of-reweighs tools                 # every tool, its policy and arguments
bellatrix-of-reweighs sources               # the columns each input is read from
bellatrix-of-reweighs inspect <file>        # how a file would be read (names and shapes, never values)
bellatrix-of-reweighs call bellatrix_review '{"corrections":"<corrections>"}'
bellatrix-of-reweighs eval                  # the private eval cases on the fictional fixtures
bellatrix-of-reweighs demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- The density scales (`nmfc_2025_13`, `classic_11`) are recalled from public material and not checked against the current NMFC tariff. They matter only for density-rated items. Bellatrix does not assign NMFC items or classes.
- Dimensions are per handling unit and the units are assumed side by side; stacked or odd-shaped freight needs a person.
- Not legal or tariff advice.
