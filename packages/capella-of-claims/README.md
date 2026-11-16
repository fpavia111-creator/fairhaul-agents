# Capella of Claims (`capella-of-claims`)

Finds loss, shortage and damage on delivered shipments, works out each claim amount and its filing deadline from your terms, tracks the claims you have filed for acknowledgement, payment and short payment, and drafts claim letters. It never files a claim, sends email or short-pays a carrier.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y capella-of-claims demo
npx -y capella-of-claims mcp --root ./claims
```

## What it works out

- **Claim amount:** invoice value of the goods affected, plus the freight charge (unless your terms say not to), less salvage. If your terms give the carrier a liability limit per shipment or per pound, the lower cap applies and the letter shows it.
- **Deadline:** delivery date plus the filing window in your terms (default 270 days), with a per-carrier override. Status is `file_now` with 30 days or fewer left, then `file`, `filed` (already in your claims log), `expired`, `below_minimum`, `review` (no delivery date or no value) or `not_a_claim` (overage).
- **Evidence notes:** a POD signed clean, or concealed damage reported later than the days in your terms. Both are what carriers most often decline on.
- **Claims to chase:** no acknowledgement after the days you expect, open past the time you expect for payment or decline, short paid, or declined.


<!-- generated:start -->

## A demo run

`npx -y capella-of-claims demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Capella of Claims demo (fictional shipments, as of 2026-11-16) in <demo folder>

▶ Find the claims to file and their deadlines
  status: executed  decision: allow
  As of 2026-11-16: 9 exception(s); 4 to file for 8840 (1 due within 30 days); 1 past the filing window (900); 1 already filed; 1 need more data.
    L-2001 damage                3980  file          2027-05-30
    L-2002 shortage              1000  file          2027-07-17
    L-2003 concealed_damage      1000  file          2027-05-01
    L-2004 damage                2860  file_now      2026-11-25
    L-2005 damage                 900  expired       2026-10-12
    L-2006 overage                  0  not_a_claim   
    L-2007 damage                1500  filed         2027-05-16
    L-2008 shortage                 0  review        2027-04-28
    L-2009 damage                  40  below_minimum 2027-08-02

▶ Track the claims already filed
  status: executed  decision: allow
  As of 2026-11-16: 5 claim(s), 4 open, 5380 outstanding, 3050 recovered; 4 need chasing.

▶ Write the worklist and the deadline calendar
  status: executed  decision: allow
  Claims report written. As of 2026-11-16: 9 exception(s); 4 to file for 8840 (1 due within 30 days); 1 past the filing window (900); 1 already filed; 1 need more data.

▶ Draft the claim letter for the most urgent shipment
  status: executed  decision: allow  (auto)
  claim L-2004 drafted for 2860 with 5 open marker(s) ([ATTACH original bill of lading], [ATTACH delivery receipt or POD showing the exception], [ATTACH commercial invoice for the goods], [ATTACH photos and inspection report], [ATTACH paid freight bill]). Nothing was sent.

▶ Approve filing: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person files it)
  status: executed  decision: ask  approved by: Ana Ruiz (fictional)
  claim L-2004 approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to file in the carrier portal itself
  status: blocked  decision: block
  reason: Capella never files a claim in a carrier portal; a person files it.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `capella_scan` | For each exception: type (loss, shortage, damage, concealed damage, overage), claim amount, filing deadline, days left, status (file_now, file, filed, expired, below_minimum, review, not_a_claim) and evidence notes su… | runs |
| `capella_track` | For each filed claim: age, outstanding amount and what to chase: no acknowledgement, past the expected resolution time, short paid, or declined. | runs |
| `capella_write_report` | Write capella-claims.csv and .html (one row per exception with amount, deadline and action, plus the open claims to chase) and claim-deadlines.ics (one event per claim to file, reminders 14 and 3 days before) into out… | runs |
| `capella_draft_claim` | Write drafts/claim-<shipment>.md: a freight claim letter for one exception with the amount worked out (goods value plus freight, less salvage, capped by any liability limit in your terms), the filing deadline and a li… | asks first (Auto can be opted in) |
| `capella_request_file` | After one named human click (even in Auto), record that the reviewed claim draft is approved in claim-requests.csv. | one named click, even in Auto (`binding_send`) |
| `carrier_portal_submit` | Capella never files a claim in a carrier portal; a person files it. | refused |
| `email_send` | Capella never sends email. | refused |
| `ap_offset_invoice` | Capella never short-pays or offsets a carrier invoice against a claim. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Exceptions (OS&D) (`exceptions`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, Load Number, Order, BOL, Bill of Lading | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `pro` | text | PRO, PRO Number, Pro #, Tracking Number | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `carrier` (required) | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `delivery_date` | date | Delivery Date, Delivered, Delivered On, POD Date | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `exception_type` | text | Exception, Exception Type, OS&D, OSD Type, Damage Type, Issue | Abweichung, Anomalie, 異常, 异常 |
| `noted_on_pod` | yes/no | Noted on POD, Exception Noted, Signed With Exception, POD Notation | - |
| `found_on` | date | Found On, Discovered On, Reported On, Found Date | Schaden festgestellt am, Constaté le, 発見日, 发现日期 |
| `goods_value` | amount | Goods Value, Invoice Value, Value, Product Value, Damaged Value, Loss Value | Warenwert, Valeur marchandise, 商品価格, 货值 |
| `freight_charge` | amount | Freight Charge, Freight Cost, Freight Paid | Versandkosten, Frais de port, 請求送料, 运费收入 |
| `salvage_value` | amount | Salvage, Salvage Value | Restwert, Valeur de sauvetage, 残存価値, 残值 |
| `weight` | pounds (kg converted) | Weight, Weight Affected, Lbs Affected, Weight (lb) | Gewicht, Poids, 重量, 重量 |
| `units` | number | Units, Units Affected, Qty Affected, Cartons Affected | Menge, Quantité, 数量, 数量 |
| `notes` | text | Notes, Description, Comments | Bemerkung, Remarques, 備考, 备注 |

### Claims log (`claims`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `claim_id` (required) | text | Claim ID, Claim Number, Claim # | Schadensnummer, N° de sinistre, 事故番号, 索赔编号 |
| `shipment_id` (required) | text | Shipment ID, Load ID, BOL | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `carrier` | text | Carrier, Carrier Name | Spediteur, Transporteur, 運送会社, 承运商 |
| `carrier_claim_number` | text | Carrier Claim Number, Carrier Ref, Carrier Claim # | Schadennummer Spediteur, N° de dossier transporteur, 運送会社受付番号, 承运商案件号 |
| `filed_on` | date | Filed On, Filed, Date Filed, Submitted | Angemeldet am, Déposé le, 申請日, 提交日期 |
| `amount` | amount | Claim Amount, Amount Claimed, Amount | Betrag, Montant, 金額, 金额 |
| `acknowledged_on` | date | Acknowledged On, Acknowledged, Ack Date | Bestätigt am, Accusé de réception le, 受付確認日, 确认日期 |
| `status` | text | Status, Claim Status | Status, Statut, ステータス, 状态 |
| `paid_on` | date | Paid On, Paid Date, Settled On | Zahlungsdatum, Date de paiement, 支払日, 付款日期 |
| `paid_amount` | amount | Paid Amount, Amount Paid, Settlement | Bezahlt, Montant payé, 支払額, 已付金额 |
| `decline_reason` | text | Decline Reason, Reason Declined, Denial Reason | Ablehnungsgrund, Motif de refus, 否認理由, 拒赔原因 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx capella-of-claims inspect <file>` (names and shapes only, never values) and name them in `lodestar-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y capella-of-claims demo
npx -y capella-of-claims mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "capella-of-claims": {
      "command": "npx",
      "args": [
        "-y",
        "capella-of-claims",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add capella-of-claims -- npx -y capella-of-claims mcp --root .`, or install the `capella-of-claims` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `capella-of-claims approve <id> --as "Your Name"` (or on the local approvals page, `capella-of-claims approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`capella-of-claims kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
capella-of-claims tools                 # every tool, its policy and arguments
capella-of-claims sources               # the columns each input is read from
capella-of-claims inspect <file>        # how a file would be read (names and shapes, never values)
capella-of-claims call capella_scan '{"exceptions":"<exceptions>"}'
capella-of-claims eval                  # the private eval cases on the fictional fixtures
capella-of-claims demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Deadlines come from the terms file you give it. The window that binds you is in your bill of lading, contract or the law that applies to the shipment; check it.
- It does not decide whether the carrier is liable. It shows the evidence the carrier will ask about.
- Not legal advice.
