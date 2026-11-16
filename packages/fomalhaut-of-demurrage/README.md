# Fomalhaut of Demurrage (`fomalhaut-of-demurrage`)

Tracks each import container's free time at the port (demurrage) and with the line (detention or per diem) from your own terms. It counts the days left, prices what is accruing through your rate tiers, warns before the last free day, writes a calendar of last free days and return-by dates, checks the line's D&D invoices and drafts disputes. It never pays and never books appointments.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y fomalhaut-of-demurrage demo
npx -y fomalhaut-of-demurrage mcp --root ./imports
```

## How days are counted

- Demurrage free time starts the day after discharge (`start_offset_days`, default 1) and ends at gate out.
- Detention starts on the gate-out day and ends when the empty is returned.
- Calendar days by default; set `business_days` per clock to skip weekends. `excluded_dates` (terminal closures, holidays your agreement allows) never count.
- Chargeable days are priced through `tiers` in order, or `tiers_by_size` when the container size matches (e.g. `40HC`).

See `fixtures/terms.json` for the format.


<!-- generated:start -->

## A demo run

`npx -y fomalhaut-of-demurrage demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fomalhaut of Demurrage demo (fictional containers, as of 2026-11-16) in <demo folder>

▶ Count free time and charges for every container
  status: executed  decision: allow
  7 container(s): 2 to move now, 2 accruing charges, 1 in free time, 1 returned, 1 with no terms on file. Open exposure 1750. 4 charge(s) checked: 2 above your terms (500).
    BMLU1000001 act_now             0  Today is the last free day at the port; pick it up today.
    BMLU1000002 accruing         1100  Charges running: demurrage day 6. Pick it up.
    BMLU1000003 accruing          650  Charges running: detention day 2. Return the empty.
    NSCU2000004 act_now             0  Today is the last free day at the port; pick it up today.
    NSCU2000005 closed            750  Returned.
    BMLU1000006 in_free_time        0  Free until 2026-11-19.
    HSLU3000007 no_terms               No free time terms for Harbor Star Line.

▶ Write the free time board and calendar
  status: executed  decision: allow
  Free time board written. 7 container(s): 2 to move now, 2 accruing charges, 1 in free time, 1 returned, 1 with no terms on file. Open exposure 1750. 4 charge(s) checked: 2 above your terms (500).

▶ Draft the dispute to Blue Meridian Line
  status: executed  decision: allow  (auto)
  dispute Blue Meridian Line drafted for 250 with 1 open marker(s) ([ATTACH terminal gate records and the agreement page with the free time]). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Jo Park (fictional)
  dispute Blue-Meridian-Line approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to book a terminal appointment itself
  status: blocked  decision: block
  reason: Fomalhaut never books terminal or return appointments.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `fomalhaut_clocks` | For each container: last free day at the port and days left, return-by date for the empty, chargeable days and cost so far for demurrage and detention, status (act_now, accruing, in_free_time, closed, no_terms), and a… | runs |
| `fomalhaut_write_report` | Write fomalhaut-containers.csv and .html (one row per container, worst first; charges checked; totals by line) and free-time.ics (last free days and return-by dates, reminder the day before) into out_dir (default lode… | runs |
| `fomalhaut_draft_dispute` | Write drafts/dispute-<line>.md listing each demurrage or detention charge above your free time and rates, with the dates and the days your terms give. | asks first (Auto can be opted in) |
| `fomalhaut_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_pay_invoice` | Fomalhaut never pays the line or terminal. | refused |
| `terminal_book_appointment` | Fomalhaut never books terminal or return appointments. | refused |
| `email_send` | Fomalhaut never sends email. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Import containers (`containers`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `container` (required) | text | Container, Container Number, Container No, Equipment | Container, Conteneur, コンテナ番号, 集装箱号 |
| `line` (required) | text | Line, Carrier, Steamship Line, Ocean Carrier, SCAC | Reederei, Compagnie maritime, 船会社, 船公司 |
| `bl` | text | BL, B/L, Bill of Lading, MBL | Frachtbrief, Lettre de voiture, 船荷証券番号, 提单号 |
| `size` | text | Size, Type, Size Type, Equipment Type | Containertyp, Type de conteneur, コンテナタイプ, 箱型 |
| `discharged` (required) | date | Discharged, Discharge Date, Vessel Discharge, Unloaded | Entladen am, Déchargé le, 荷揚げ日, 卸船日期 |
| `last_free_day` | date | Last Free Day, LFD, Free Time Expires | Letzter freier Tag, Dernier jour franc, フリータイム最終日, 免费期截止日 |
| `gate_out` | date | Gate Out, Out Gate, Picked Up, Pickup Date | Gate-out, Sortie terminal, 搬出日, 提柜日期 |
| `empty_returned` | date | Empty Returned, Empty Return, Returned, In Gate Empty | Leerrückgabe, Retour à vide, 空コンテナ返却日, 还空箱日期 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Container visibility platform (generic) | Container milestones export, one row per container | Container Number, Discharge Date or Vessel Discharge, Last Free Day or LFD | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### D&D charges (`charges`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `container` (required) | text | Container, Container Number, Equipment | Container, Conteneur, コンテナ番号, 集装箱号 |
| `invoice_number` | text | Invoice Number, Invoice, Invoice # | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `charge_type` (required) | text | Charge Type, Type, Charge, Description | Leistungsbeschreibung, Libellé de la prestation, 請求項目, 费用名称 |
| `days_billed` | number | Days Billed, Days, Chargeable Days | Berechnete Tage, Jours facturés, 請求日数, 计费天数 |
| `amount` (required) | amount | Amount, Charge Amount, Billed | Betrag, Montant, 金額, 金额 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fomalhaut-of-demurrage inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fomalhaut-of-demurrage demo
npx -y fomalhaut-of-demurrage mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fomalhaut-of-demurrage": {
      "command": "npx",
      "args": [
        "-y",
        "fomalhaut-of-demurrage",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fomalhaut-of-demurrage -- npx -y fomalhaut-of-demurrage mcp --root .`, or install the `fomalhaut-of-demurrage` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fomalhaut-of-demurrage approve <id> --as "Your Name"` (or on the local approvals page, `fomalhaut-of-demurrage approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fomalhaut-of-demurrage kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fomalhaut-of-demurrage tools                 # every tool, its policy and arguments
fomalhaut-of-demurrage sources               # the columns each input is read from
fomalhaut-of-demurrage inspect <file>        # how a file would be read (names and shapes, never values)
fomalhaut-of-demurrage call fomalhaut_clocks '{"containers":"<containers>","terms":"<terms>"}'
fomalhaut-of-demurrage eval                  # the private eval cases on the fictional fixtures
fomalhaut-of-demurrage demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Free time and rates come from your terms file, not the line's or terminal's live tariff. Combined demurrage-and-detention clocks need two entries.
- Where the line's last free day differs from yours, Fomalhaut shows both and does not decide who is right.
- Not legal advice.
