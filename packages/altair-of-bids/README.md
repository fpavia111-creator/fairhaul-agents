# Altair of Bids (`altair-of-bids`)

Scores carrier bids from a freight RFP lane by lane against your incumbent rates and volumes. It builds an award scenario with your rules, flags bids that look like errors, shows savings, carrier shares and lanes nobody covered, and drafts the award letters. It never loads rates into your TMS and never sends awards.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y altair-of-bids demo
npx -y altair-of-bids mcp --root ./rfp
```

## Award rules

| Rule | Default | Effect |
|---|---|---|
| `max_share_pct` | 100 | No carrier gets more than this share of all annual loads |
| `prefer_incumbent_pct` | 0 | Keep the incumbent when its bid is within this percent of the best |
| `backup` | true | Name the next eligible carrier as backup on each lane |
| `exclude` | none | Carriers not to award |
| `outlier_pct` | 25 | A bid this far below the lane median (with 3 or more bids) is flagged and not awarded |

Bid capacity splits a lane across carriers. Lanes are awarded in order of the savings they offer, so a share cap falls on the later lanes. Run it with different rules and compare.


<!-- generated:start -->

## A demo run

`npx -y altair-of-bids demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Altair of Bids demo (fictional RFP, six lanes) in <demo folder>

▶ Award every lane to the lowest bid, no rules
  status: executed  decision: allow
  6 lane(s), 380 annual loads: 5 awarded, 0 partly covered, 1 with no award. Scenario cost 456700 against 477000 at incumbent rates (savings 20300). 2 incumbent(s) kept; 1 bid(s) flagged as possible errors.

▶ Award with a 40% share cap, incumbent preference and backups
  status: executed  decision: allow
  6 lane(s), 380 annual loads: 5 awarded, 0 partly covered, 1 with no award. Scenario cost 458840 against 477000 at incumbent rates (savings 18160). 2 incumbent(s) kept; 1 bid(s) flagged as possible errors.
    L01 Chicago IL → Dallas TX     Coastal Line Haul 120@1450                       awarded
    L02 Chicago IL → Atlanta GA    Coastal Line Haul 32@1300 + Ridgeline Freight 48@1280 awarded
    L03 Dallas TX → Denver CO      Ridgeline Freight 60@1330                        awarded
    L04 Atlanta GA → Miami FL      Summit Carriers 50@1080                          awarded
    L05 Denver CO → Phoenix AZ     Summit Carriers 40@1200                          awarded
    L06 Memphis TN → Columbus OH                                                    no_bids

▶ Write the award scenario
  status: executed  decision: allow
  Award scenario written. 6 lane(s), 380 annual loads: 5 awarded, 0 partly covered, 1 with no award. Scenario cost 458840 against 477000 at incumbent rates (savings 18160). 2 incumbent(s) kept; 1 bid(s) flagged as possible errors.

▶ Draft the award letter to Summit Carriers
  status: executed  decision: allow  (auto)
  award Summit Carriers drafted for 102000 with 2 open marker(s) ([TO CONFIRM reply date], [TO CONFIRM agreement reference]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Lee Brown (fictional)
  award Summit-Carriers approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to load the new rates into the TMS itself
  status: blocked  decision: block
  reason: Altair never loads rates or routing guides into your TMS.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `altair_award` | For each lane: bids, best and median rate, awarded carrier(s) with loads and rate, backup, uncovered loads, cost against the incumbent baseline and notes (incumbent kept, share cap reached, possible bid error). | runs |
| `altair_write_report` | Write altair-award.csv and .html (one row per lane with award, backup and savings; carrier shares; rules used) into out_dir (default lodestar-out/altair). | runs |
| `altair_draft_award` | Write drafts/award-<carrier>.md: the award letter for one carrier listing its lanes, estimated loads and rates, and lanes where it is backup. | asks first (Auto can be opted in) |
| `altair_request_send` | After one named human click (even in Auto), record that the reviewed award draft is approved in award-requests.csv. | one named click, even in Auto (`binding_send`) |
| `tms_load_rates` | Altair never loads rates or routing guides into your TMS. | refused |
| `email_send` | Altair never sends awards or regrets. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### RFP lanes (`lanes`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `lane_id` (required) | text | Lane ID, Lane, Lane Number | Relation, Trajet, 路線, 线路 |
| `origin` | text | Origin, Origin City, From | Abgangsort, Lieu d'enlèvement, 出荷元, 起运地 |
| `destination` | text | Destination, Destination City, To | Bestimmungsort, Destination, 届け先, 目的地 |
| `annual_loads` (required) | number | Annual Loads, Volume, Loads per Year, Annual Volume | Ladungen pro Jahr, Chargements par an, 年間便数, 年运量 |
| `incumbent` | text | Incumbent, Current Carrier, Incumbent Carrier | Bisheriger Spediteur, Transporteur actuel, 現行運送会社, 现有承运商 |
| `incumbent_rate` | amount | Incumbent Rate, Current Rate, Baseline Rate | Bisherige Rate, Tarif actuel, 現行運賃, 现行运价 |
| `equipment` | text | Equipment, Mode, Trailer | Fahrzeugtyp, Type de véhicule, 車種, 车型 |

### Carrier bids (`bids`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `lane_id` (required) | text | Lane ID, Lane, Lane Number | Relation, Trajet, 路線, 线路 |
| `carrier` (required) | text | Carrier, Carrier Name, Bidder, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `rate` (required) | amount | Rate, Bid Rate, All In Rate, Linehaul, Bid | Frachtrate, Tarif, 料率, 运价 |
| `capacity` | number | Capacity, Annual Capacity, Loads Committed, Max Loads | Kapazität, Capacité, 輸送能力, 运力 |
| `notes` | text | Notes, Comments, Conditions | Bemerkung, Remarques, 備考, 备注 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx altair-of-bids inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y altair-of-bids demo
npx -y altair-of-bids mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "altair-of-bids": {
      "command": "npx",
      "args": [
        "-y",
        "altair-of-bids",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add altair-of-bids -- npx -y altair-of-bids mcp --root .`, or install the `altair-of-bids` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `altair-of-bids approve <id> --as "Your Name"` (or on the local approvals page, `altair-of-bids approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`altair-of-bids kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
altair-of-bids tools                 # every tool, its policy and arguments
altair-of-bids sources               # the columns each input is read from
altair-of-bids inspect <file>        # how a file would be read (names and shapes, never values)
altair-of-bids call altair_award '{"lanes":"<lanes>","bids":"<bids>"}'
altair-of-bids eval                  # the private eval cases on the fictional fixtures
altair-of-bids demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Savings assume your estimated volumes move at the bid rates. Rates are compared per load; it does not convert per-mile bids.
- The award is a starting point for a person's decision, not an optimal solver.
