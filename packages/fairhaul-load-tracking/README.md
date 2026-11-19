# Fairhaul Load Tracking (`fairhaul-load-tracking`)

Reads your open loads and their tracking events and finds the ones that need a call: late (appointment passed, pickup missed), at risk (ETA past the appointment, delay reported), blind (stale or no tracking) and delivered but still open. It ranks carriers on tracking and drafts the delay notice to your customer. It never messages anyone and never changes your TMS.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-load-tracking demo
npx -y fairhaul-load-tracking mcp --root ./visibility
```

Tracking events can come from a visibility platform export, a carrier API dump or EDI 214 files converted with Fairhaul EDI Files (`edi_convert` writes the status events as CSV).


<!-- generated:start -->

## A demo run

`npx -y fairhaul-load-tracking demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Load Tracking demo (fictional loads, 2026-11-16 10:00) in <demo folder>

▶ Find the open loads that need attention
  status: executed  decision: allow
  8 open load(s) at 2026-11-16 10:00: 2 late, 1 at risk, 1 with stale or no tracking, 3 on track, 1 delivered but still open.
    T-604 Coastal Line Haul  late                  missed_pickup, no_tracking
    T-603 Coastal Line Haul  late                  eta_past_appointment, past_appointment, delay_reported
    T-606 Prairie Express    at_risk               eta_past_appointment
    T-602 Ridgeline Freight  blind                 stale
    T-607 Summit Carriers    delivered_not_closed  
    T-608 Summit Carriers    on_track              
    T-605 Prairie Express    on_track              
    T-601 Ridgeline Freight  on_track              

▶ Write the exceptions board
  status: executed  decision: allow
  Exceptions board written. 8 open load(s) at 2026-11-16 10:00: 2 late, 1 at risk, 1 with stale or no tracking, 3 on track, 1 delivered but still open.

▶ Draft the delay notice for Hill Country Home
  status: executed  decision: allow  (auto)
  delay notice Hill Country Home drafted with 1 open marker(s) ([TO CONFIRM time of next update]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Jo Park (fictional)
  delay notice Hill-Country-Home approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to text the driver itself
  status: blocked  decision: block
  reason: Fairhaul Load Tracking never texts drivers, carriers or customers.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `tracking_assess` | For each open load: status (late, at_risk, blind, on_track, delivered_not_closed), issues (missed_pickup, no_tracking, stale, eta_past_appointment, past_appointment, delay_reported), last event and its age, ETA and ap… | runs |
| `tracking_write_report` | Write tracking-exceptions.csv and .html (one row per open load, worst first; carriers by tracking compliance) into out_dir (default fairhaul-out/tracking). | runs |
| `tracking_draft_delay_notice` | Write drafts/delay_notice-<customer>.md telling one customer which of their loads are late or at risk, with the appointment, latest ETA and latest event. | asks first (Auto can be opted in) |
| `tracking_request_send` | After one named human click (even in Auto), record that the reviewed delay notice draft is approved in delay_notice-requests.csv. | one named click, even in Auto (`binding_send`) |
| `email_send` | Fairhaul Load Tracking never emails customers or carriers. | refused |
| `sms_send` | Fairhaul Load Tracking never texts drivers, carriers or customers. | refused |
| `tms_update_status` | Fairhaul Load Tracking never changes load status in your TMS. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Open loads (`loads`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, Load Number, Order | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` (required) | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `customer` | text | Customer, Consignee, Ship To, Customer Name | Kunde, Client, 顧客, 客户 |
| `pickup_appt` | date and time | Pickup Appointment, Pickup Appt, Scheduled Pickup, Pickup Planned | Abholtermin, Rendez-vous d'enlèvement, 集荷予約, 提货预约 |
| `delivery_appt` | date and time | Delivery Appointment, Delivery Appt, Scheduled Delivery, Delivery Planned, Due | Termin, Rendez-vous, 予約時刻, 预约时间 |
| `status` | text | Status, Load Status | Status, Statut, ステータス, 状态 |
| `destination` | text | Destination, Dest, Ship To City, Delivery City | Bestimmungsort, Destination, 届け先, 目的地 |

### Tracking events (`events`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, Load Number, Reference | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `at` (required) | date and time | Event Time, Time, Timestamp, Date Time, Status Time | Zeitpunkt, Date et heure, 日時, 时间 |
| `event` | text | Event, Status, Status Code, Description | Ereignis, Événement, 配送状況, 物流状态 |
| `location` | text | Location, City, Place | Lagerort, Emplacement, 保管場所, 库位 |
| `eta` | date and time | ETA, Estimated Arrival, Estimated Delivery | Voraussichtliche Ankunft, Date d'arrivée prévue, 到着予定日, 预计到达 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-load-tracking inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-load-tracking demo
npx -y fairhaul-load-tracking mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-load-tracking": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-load-tracking",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-load-tracking -- npx -y fairhaul-load-tracking mcp --root .`, or install the `fairhaul-load-tracking` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-load-tracking approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-load-tracking approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-load-tracking kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-load-tracking tools                 # every tool, its policy and arguments
fairhaul-load-tracking sources               # the columns each input is read from
fairhaul-load-tracking inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-load-tracking call tracking_assess '{"loads":"<loads>","events":"<events>"}'
fairhaul-load-tracking eval                  # the private eval cases on the fictional fixtures
fairhaul-load-tracking demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- A snapshot of the files you give it, not live tracking. Run it again with fresh exports.
- Times are compared as written. Put every file in one time zone, or the hours will be off.
- Event wording varies by carrier; Fairhaul Load Tracking recognises common words for picked up, delivered, arrived and delayed.
