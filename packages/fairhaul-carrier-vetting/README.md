# Fairhaul Carrier Vetting (`fairhaul-carrier-vetting`)

Checks your carrier master and booked loads for warning signs of fraud and double brokering. It looks for bank accounts, phones, emails or MC numbers shared across carriers, new authority, lapsed insurance, recent payment detail changes, free-mail contacts, and dispatch contacts on a load that differ from the master. It scores each carrier, lists the loads to hold or verify before pickup, and drafts a verification request. **A person verifies and decides.**

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-carrier-vetting demo
npx -y fairhaul-carrier-vetting mcp --root ./carriers
```

## Signals and weights

| Signal | Weight |
|---|---|
| `shared_bank`, `unsatisfactory_rating` | 5 |
| `duplicate_mc`, `contact_differs_on_load`, `insurance_expired` | 4 |
| `shared_phone`, `shared_email`, `bank_changed_recently` (30 days) | 3 |
| `new_authority` (180 days, adjustable), `missing_mc_dot` | 2 |
| `insurance_expiring` (30 days), `remit_to_other_name`, `free_email`, `shared_address`, `conditional_rating` | 1 |

Level: 5 or more is high, 2 to 4 medium, 1 low. Loads on high or inactive carriers are held; loads on medium carriers, or whose own contacts or dates raise a sign, are verified before pickup. A carrier not in the master is held.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-carrier-vetting demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Carrier Vetting demo (fictional carriers and loads, as of 2026-11-16) in <demo folder>

▶ Check carriers and booked loads for warning signs
  status: executed  decision: allow
  7 carrier(s) as of 2026-11-16: 3 high, 1 medium, 1 low on warning signs. Of 6 booked load(s), 4 to hold until verified and 1 to verify before pickup.
    L-9002 Swift Lane Logistics   high     hold: verify by phone on a number you already had before releasing
    L-9004 Prairie Express Inc    high     hold: verify by phone on a number you already had before releasing
    L-9005 North Star Hauling     high     hold: verify by phone on a number you already had before releasing
    L-9006 TRIX                   unknown  carrier not in the master; vet before pickup
    L-9003 Coastal Line Haul      medium   verify before pickup
    L-9001 Ridgeline Freight LLC  none     none

▶ Write the carrier report
  status: executed  decision: allow
  Carrier report written. 7 carrier(s) as of 2026-11-16: 3 high, 1 medium, 1 low on warning signs. Of 6 booked load(s), 4 to hold until verified and 1 to verify before pickup.

▶ Draft a verification request to Swift Lane Logistics
  status: executed  decision: allow  (auto)
  verification request SWFT drafted with 1 open marker(s) ([CHECK: internal note below, for your team only; delete it before this goes to the carrier]). Nothing was sent.

▶ Approve sending it: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: error  decision: ask
  reason: the draft still has open markers ([CHECK: internal note below, for your team only; delete it before this goes to the carrier]); fix them, or pass accept_open_issues: true with a note saying why

▶ Agent tries to change a carrier's bank details itself
  status: blocked  decision: block
  reason: Fairhaul Carrier Vetting never changes payment details.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `vetting_vet` | Score each carrier on weighted warning signs with the detail behind each, and list booked loads with the action to take before pickup (hold, verify or none). | runs |
| `vetting_write_report` | Write vetting-carriers.csv and .html (one row per carrier with its signals; loads to hold and verify) into out_dir (default lodestar-out/vetting). | runs |
| `vetting_draft_verification_request` | Write drafts/verification_request-<carrier>.md: a polite request to one carrier for the documents that would clear its warning signs (insurance certificate from the agent, notice of assignment, payment detail confirma… | asks first (Auto can be opted in) |
| `vetting_request_send` | After one named human click (even in Auto), record that the reviewed verification request draft is approved in verification_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `tms_block_carrier` | Fairhaul Carrier Vetting never blocks or deactivates a carrier. | refused |
| `ap_change_remit_to` | Fairhaul Carrier Vetting never changes payment details. | refused |
| `email_send` | Fairhaul Carrier Vetting never emails carriers. | refused |
| `vetting_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `vetting_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `vetting_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `vetting_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Carrier master (`carriers`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `carrier_id` (required) | text | Carrier ID, Vendor ID, Code, SCAC | Spediteurnummer, Code transporteur, 運送会社コード, 承运商代码 |
| `name` (required) | text | Carrier, Carrier Name, Legal Name, Name | Name, Nom, 名前, 名称 |
| `mc` | text | MC, MC Number, Docket | - |
| `dot` | text | DOT, USDOT, DOT Number | - |
| `phone` | text | Phone, Dispatch Phone, Contact Phone | Telefon, Téléphone, 電話番号, 电话 |
| `email` | text | Email, Dispatch Email, Contact Email | E-Mail, E-mail, メールアドレス, 邮箱 |
| `address` | text | Address, Street, Physical Address | Adresse, Adresse, 住所, 地址 |
| `remit_to` | text | Remit To, Remit Name, Payee | Zahlungsempfänger, Bénéficiaire, 支払先, 收款人 |
| `bank_last4` | text | Bank Last 4, Account Last 4, Bank Account | - |
| `bank_changed` | date | Bank Changed, Remit Changed, Payment Info Changed | - |
| `authority_date` | date | Authority Date, Authority Granted, MC Granted | - |
| `insurance_expiry` | date | Insurance Expiry, COI Expiry, Insurance Expires, Cargo Insurance Expiry | Versicherung gültig bis, Expiration de l'assurance, 保険期限, 保险到期日 |
| `safety_rating` | text | Safety Rating, Rating | - |
| `status` | text | Status, Carrier Status | Status, Statut, ステータス, 状态 |

### Booked loads (`loads`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `load_id` (required) | text | Load ID, Shipment ID, Load | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier_id` (required) | text | Carrier ID, Vendor ID, Code, SCAC | Spediteurnummer, Code transporteur, 運送会社コード, 承运商代码 |
| `pickup_date` | date | Pickup Date, Ship Date, Pickup | Abholdatum, Date d'enlèvement, 集荷日, 提货日期 |
| `booked_at` | date | Booked, Booked At, Tender Date | Gebucht am, Réservé le, 手配日, 订舱日期 |
| `value` | amount | Cargo Value, Value | Warenwert, Valeur marchandise, 商品価格, 货值 |
| `dispatch_phone` | text | Dispatch Phone, Driver Phone, Phone | Telefon, Téléphone, 電話番号, 电话 |
| `dispatch_email` | text | Dispatch Email, Email | E-Mail, E-mail, メールアドレス, 邮箱 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-carrier-vetting inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Memory

fairhaul-carrier-vetting can remember facts about your setup so the next run does not have to be told again. `vetting_learn` only proposes a fact; it changes nothing until a named person accepts it with `vetting_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.lodestar/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `watch_contact` | adds the on_watch_list warning sign (high) to every carrier in the master, and a hold reason to every booked load, that uses this detail (more warning signs, never fewer) |
| `note` | nothing (shown by recall only) |

```bash
fairhaul-carrier-vetting memory list
fairhaul-carrier-vetting memory accept MEM-1a2b3c4d5e6f --as "Your Name"
fairhaul-carrier-vetting memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "carrier renamed"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-carrier-vetting demo
npx -y fairhaul-carrier-vetting mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-carrier-vetting": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-carrier-vetting",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-carrier-vetting -- npx -y fairhaul-carrier-vetting mcp --root .`, or install the `fairhaul-carrier-vetting` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-carrier-vetting approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-carrier-vetting approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-carrier-vetting kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-carrier-vetting tools                 # every tool, its policy and arguments
fairhaul-carrier-vetting sources               # the columns each input is read from
fairhaul-carrier-vetting inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-carrier-vetting call vetting_vet '{"carriers":"<carriers>"}'
fairhaul-carrier-vetting eval                  # the private eval cases on the fictional fixtures
fairhaul-carrier-vetting demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Warning signs are not findings of fraud. Shared addresses can be a shared yard; a factoring company is normal.
- Reads only your files. It does not query government registries, insurers or any outside service. Check authority and insurance at the source.
- Verify by calling a number you already had, not one from an email or a change request.
