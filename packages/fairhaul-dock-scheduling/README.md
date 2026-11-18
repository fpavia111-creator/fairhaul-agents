# Fairhaul Dock Scheduling (`fairhaul-dock-scheduling`)

Plans a day of dock appointments across your doors, trailer types, crews and hours. Each appointment is sized by pallets and whether the trailer is floor loaded, and requests that need another window are listed with the reason. It also reviews past appointments for no-shows, late arrivals, waits by hour and how long each kind of load really takes, so you can set slot lengths from fact. **It never books or confirms an appointment.**

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-dock-scheduling demo
npx -y fairhaul-dock-scheduling mcp --root ./receiving
```

## How the plan works

- Duration is `setup_minutes` plus pallets times `minutes_per_pallet`, or `minutes_per_floor_pallet` when floor loaded.
- Requests with the earliest window end go first; `priority` breaks ties.
- Each goes on the earliest door of its trailer type, on the `slot_minutes` grid, within its window and dock hours, while fewer than `crews` loads are being worked.
- It is a first fit, not an optimum. Move loads by hand where it helps.

`docks_review` gives minutes per pallet by load type and the 80th percentile work time. Use them to update the dock settings.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-dock-scheduling demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Dock Scheduling demo (fictional distribution center) in <demo folder>

▶ Review two weeks of past appointments
  status: executed  decision: allow
  10 past appointment(s): 70% on time, 2 late, 1 no-show(s); average wait for a door 31 min, worst at 07:00 (54 min). Unload takes floor 6.5 min/pallet, palletised 2.7 min/pallet.

▶ Plan Wednesday's appointments
  status: executed  decision: allow
  2026-11-18: 8 of 10 appointment(s) placed on 4 door(s), 06:00-14:00, dock use 34%. 2 could not be placed.
    PO-4401 Ridgeline Freight    D1  06:00-07:07 scheduled
    PO-4403 Coastal Line Haul    D4  06:00-06:55 scheduled
    PO-4404 Summit Carriers      D2  07:00-07:51 scheduled
    PO-4406 Coastal Line Haul    D4  07:00-07:59 scheduled
    PO-4402 Prairie Express      D1  07:15-09:54 scheduled
    PO-4405 Ridgeline Freight    D2  08:00-08:59 scheduled
    PO-4407 Prairie Express      D1  10:00-12:51 scheduled
    PO-4409 Summit Carriers      D2  12:00-12:35 scheduled
    PO-4408 North Star Hauling   --  --:-----:-- no_slot: no door takes flatbed
    PO-4410 Bayou Goods Freight  --  --:-----:-- no_slot: needs 171 minutes; the dock closes before it could finish

▶ Write the dock report
  status: executed  decision: allow
  Dock report written. 2026-11-18: 8 of 10 appointment(s) placed on 4 door(s), 06:00-14:00, dock use 34%. 2 could not be placed. 10 past appointment(s): 70% on time, 2 late, 1 no-show(s); average wait for a door 31 min, worst at 07:00 (54 min). Unload takes floor 6.5 min/pallet, palletised 2.7 min/pallet.

▶ Draft the schedule for carriers
  status: executed  decision: allow  (auto)
  schedule 2026-11-18 drafted with 0 open marker(s). Nothing was sent.

▶ Approve publishing it: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person books them)
  status: executed  decision: ask  approved by: Jo Park (fictional)
  schedule 2026-11-18 approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to book an appointment itself
  status: blocked  decision: block
  reason: Fairhaul Dock Scheduling never books, moves or cancels appointments in your scheduling or yard system.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `docks_plan` | Place each request on the earliest fitting door within its window and dock hours without exceeding crews (earliest window end first, then priority). | runs |
| `docks_review` | Arrival against appointment (on time, late, early, no-show), wait for a door, work and turn minutes per load; by carrier, by appointment hour and by load type with minutes per pallet and the 80th percentile work time. | runs |
| `docks_write_report` | Write docks-plan.csv and .html (the day's schedule, door use, loads by hour) and, with history, docks-review.csv and .html into out_dir (default lodestar-out/docks). | runs |
| `docks_draft_schedule` | Write drafts/schedule-<date>.md: the day's appointments by load, carrier, door and time, and the requests that need another window. | asks first (Auto can be opted in) |
| `docks_request_publish` | After one named human click (even in Auto), record that the reviewed schedule draft is approved in schedule-requests.csv. | one named click, even in Auto (`binding_send`) |
| `yms_book_appointment` | Fairhaul Dock Scheduling never books, moves or cancels appointments in your scheduling or yard system. | refused |
| `email_send` | Fairhaul Dock Scheduling never emails carriers. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Appointment requests (`requests`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, PO, Shipment ID, Reference | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `direction` | text | Direction, In/Out, Type | Richtung, Sens, 入出庫区分, 方向 |
| `door_type` | text | Door Type, Equipment, Trailer Type | - |
| `pallets` | number | Pallets, Pallet Count | Paletten, Palettes, パレット数, 托盘数 |
| `floor_loaded` | yes/no | Floor Loaded, Floor Load, Loose | - |
| `window_start` | text | Window Start, Earliest, Requested Time, Requested | Zeitfenster von, Début du créneau, 時間帯開始, 时间窗开始 |
| `window_end` | text | Window End, Latest | Zeitfenster bis, Fin du créneau, 時間帯終了, 时间窗结束 |
| `priority` | number | Priority, Hot | Priorität, Priorité, 優先度, 优先级 |

### Past appointments (`history`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, PO, Shipment ID, Reference | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `load_type` | text | Load Type, Type, Floor Loaded | - |
| `pallets` | number | Pallets, Pallet Count | Paletten, Palettes, パレット数, 托盘数 |
| `appointment_at` (required) | date and time | Appointment, Appointment At, Appt | Termin, Rendez-vous, 予約時刻, 预约时间 |
| `arrived_at` | date and time | Arrived, Arrived At, Check In, Gate In | Ankunft, Arrivée, 到着日時, 到达时间 |
| `door_at` | date and time | Door, Door At, At Door, Unload Start | - |
| `departed_at` | date and time | Departed, Departed At, Check Out, Gate Out | Abfahrt, Départ, 出発日時, 离开时间 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-dock-scheduling inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-dock-scheduling demo
npx -y fairhaul-dock-scheduling mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-dock-scheduling": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-dock-scheduling",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-dock-scheduling -- npx -y fairhaul-dock-scheduling mcp --root .`, or install the `fairhaul-dock-scheduling` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-dock-scheduling approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-dock-scheduling approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-dock-scheduling kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-dock-scheduling tools                 # every tool, its policy and arguments
fairhaul-dock-scheduling sources               # the columns each input is read from
fairhaul-dock-scheduling inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-dock-scheduling call docks_plan '{"requests":"<requests>","dock":"<dock>"}'
fairhaul-dock-scheduling eval                  # the private eval cases on the fictional fixtures
fairhaul-dock-scheduling demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Durations follow your settings, not the actual freight; check them against `docks_review`.
- One day at a time, in local time, with no lunch breaks or shift changes.
- Labor is counted as crews working at once, not by skill or equipment.
