# Fairhaul Freight Emissions (`fairhaul-freight-emissions`)

Estimates the greenhouse gas emissions of your shipments from weight, distance and mode, using emission factors you choose and name. It gives totals by mode, carrier, lane and customer, a data quality score and a labelled mode-shift what-if, and drafts a statement for a customer who asks. **Every figure is an estimate. Nothing is submitted anywhere.**

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-freight-emissions demo
npx -y fairhaul-freight-emissions mcp --root ./sustainability
```

## Method

kg CO2e = tonnes × km × factor (g CO2e per tonne-km) ÷ 1000.

- **You supply the factors** in a JSON file with a `source` that names where they came from. Fairhaul Freight Emissions ships no official values; the demo factors are example numbers only.
- Weights in lb or kg and distances in mi or km are converted. Mode names map through `aliases`.
- A shipment with no weight, no distance or no factor for its mode is listed and left out, never guessed.
- Data quality: the share of shipments with a measured distance (`distance_source` of actual, GPS or telematics) rather than a planned one.
- The optional `shift` what-if moves long shipments in some modes to another, adding extra distance.


<!-- generated:start -->

## What the AI model sees

- **Masked:** this agent reads no column with a person's name or contact details. Anything that looks like a phone number, e-mail or SSN is still replaced in every result.
- **Sent as they are:** ids, codes, places and names of carriers and other businesses (`shipment_id`, `mode`, `carrier`, `origin`, `destination`, `weight_unit`, `distance_unit`, `distance_source`); customer, consignee and shipper names (`customer`; pseudonymised with `--pii strict`); amounts, weights and counts (`weight`, `distance`).
- Results go to whatever model your AI assistant uses. For data you may not share with that provider, use a local model or one covered by your agreements with it. The CSV and HTML files written on your machine keep the real values.

## A demo run

`npx -y fairhaul-freight-emissions demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Freight Emissions demo (fictional shipments, example factors only) in <demo folder>

▶ Estimate emissions for nine shipments
  status: executed  decision: allow
  Estimate: 10.292 t CO2e for 7 of 9 shipment(s) (207313 tonne-km, 50 g per tonne-km); 2 not estimated; 22% with measured distance. Largest: ftl (8369.14 kg). Moving 3 ftl shipment(s) to intermodal would save about 4759.95 kg. Factors: EXAMPLE VALUES FOR THE DEMO ONLY. Replace with the factors your sustainability team has chosen, and name that source here.
    ftl        8369.14 kg CO2e    80 g/tkm
    ocean       1528.8 kg CO2e    15 g/tkm
    air         309.42 kg CO2e   900 g/tkm
    parcel        54.2 kg CO2e   300 g/tkm
    ltl          30.54 kg CO2e   120 g/tkm

▶ Write the emissions report
  status: executed  decision: allow
  Emissions estimate written. Estimate: 10.292 t CO2e for 7 of 9 shipment(s) (207313 tonne-km, 50 g per tonne-km); 2 not estimated; 22% with measured distance. Largest: ftl (8369.14 kg). Moving 3 ftl shipment(s) to intermodal would save about 4759.95 kg. Factors: EXAMPLE VALUES FOR THE DEMO ONLY. Replace with the factors your sustainability team has chosen, and name that source here.

▶ Draft a statement for Front Range Supply
  status: executed  decision: allow  (auto)
  emissions statement Front Range Supply drafted with 0 open marker(s). Nothing was sent.

▶ Approve sending it: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Ana Ruiz (fictional)
  emissions statement Front-Range-Supply approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to submit figures to a reporting portal itself
  status: blocked  decision: block
  reason: Fairhaul Freight Emissions never submits figures to a reporting portal, customer survey or regulator.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `emissions_estimate` | Per shipment: mode, tonnes, km, tonne-km, factor, kg CO2e estimate and data quality. | runs |
| `emissions_write_report` | Write emissions.csv and .html (one row per shipment; by mode, carrier, lane and customer; mode-shift what-if) into out_dir (default fairhaul-out/emissions). | runs |
| `emissions_draft_emissions_statement` | Write drafts/emissions_statement-<customer>.md: estimated emissions of one customer's shipments, line by line, with the method, the factor source and a plain statement that the figures are estimates and not verified. | asks first (Auto can be opted in) |
| `emissions_request_send` | After one named human click (even in Auto), record that the reviewed emissions statement draft is approved in emissions_statement-requests.csv. | one named click, even in Auto (`binding_send`) |
| `esg_portal_submit` | Fairhaul Freight Emissions never submits figures to a reporting portal, customer survey or regulator. | refused |
| `email_send` | Fairhaul Freight Emissions never emails anyone. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Shipments (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, BOL, Tracking | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `mode` (required) | text | Mode, Service, Transport Mode | Verkehrsträger, Mode de transport, 輸送モード, 运输方式 |
| `carrier` | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `customer` | text | Customer, Customer Name, Ship To | Kunde, Client, 顧客, 客户 |
| `origin` | text | Origin, Origin City, From | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `destination` | text | Destination, Destination City, To | Bestimmungsort, Destination, 届け先, 目的地 |
| `weight` | number | Weight, Weight (lb), Gross Weight, Billed Weight | - |
| `weight_unit` | text | Weight Unit, UOM | - |
| `distance` | number | Distance, Miles, Mileage, Km, Distance (mi) | - |
| `distance_unit` | text | Distance Unit | - |
| `distance_source` | text | Distance Source | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-freight-emissions inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-freight-emissions demo
npx -y fairhaul-freight-emissions mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-freight-emissions": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-freight-emissions",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-freight-emissions -- npx -y fairhaul-freight-emissions mcp --root .`, or install the `fairhaul-freight-emissions` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-freight-emissions approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-freight-emissions approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-freight-emissions kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-freight-emissions tools                 # every tool, its policy and arguments
fairhaul-freight-emissions sources               # the columns each input is read from
fairhaul-freight-emissions inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-freight-emissions call emissions_estimate '{"shipments":"<shipments>","factors":"<factors>"}'
fairhaul-freight-emissions eval                  # the private eval cases on the fictional fixtures
fairhaul-freight-emissions demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Estimates only. Not verified or assured, not a certified footprint, and no claim of conformity with any reporting standard.
- No geocoding or routing: distances come from your files.
- Empty running, warehousing and packaging are excluded unless your factors include them.
