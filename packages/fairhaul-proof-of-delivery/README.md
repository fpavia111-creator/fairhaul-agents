# Fairhaul Proof of Delivery (`fairhaul-proof-of-delivery`)

Matches every delivered or invoiced load to its proof of delivery. It flags missing, unsigned, short and exception-noted PODs and delivery dates that disagree with the invoice, lists the invoices to hold for review, scores carriers on how fast and how cleanly they send PODs, and drafts POD requests. It never holds, releases or pays an invoice and never sends anything.

MIT · Node 20 or newer · local files only · built on [`fairhaul-core`](../fairhaul-core)

```bash
npx -y fairhaul-proof-of-delivery demo
npx -y fairhaul-proof-of-delivery mcp --root ./pods
```

## Statuses

| Status | When |
|---|---|
| `ok` | Signed POD, pieces and date match, no exceptions |
| `chase` | No POD more than 3 days (configurable) after delivery |
| `waiting` | No POD yet, still within the wait period |
| `claim_review` | The POD shows fewer pieces or a receiver's exception note; see Fairhaul Freight Claims |
| `fix` | Unsigned, or the POD's delivery date differs from the invoice's |

An invoiced load that is missing its POD, unsigned, short or exception-noted is marked `hold_invoice` for a person to review.


<!-- generated:start -->

## A demo run

`npx -y fairhaul-proof-of-delivery demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairhaul Proof of Delivery demo (fictional loads, November 2026) in <demo folder>

▶ Match every load to its proof of delivery
  status: executed  decision: allow
  10 load(s) as of 2026-11-16: 3 clean POD(s), 2 to chase, 1 still within the wait period, 2 with shortage or damage noted, 2 to fix. 5 invoice(s) to hold for review (7830).
    D-501 Ridgeline Freight  ok                          
    D-502 Ridgeline Freight  claim_review  hold invoice  exception_noted
    D-503 Ridgeline Freight  fix           hold invoice  unsigned
    D-504 Coastal Line Haul  claim_review  hold invoice  short
    D-505 Coastal Line Haul  chase         hold invoice  missing_pod
    D-506 Coastal Line Haul  fix                         date_mismatch
    D-507 Prairie Express    ok                          
    D-508 Prairie Express    chase         hold invoice  missing_pod
    D-509 Prairie Express    waiting                     missing_pod
    D-510 Summit Carriers    ok                          

▶ Write the POD worklist
  status: executed  decision: allow
  POD worklist written. 10 load(s) as of 2026-11-16: 3 clean POD(s), 2 to chase, 1 still within the wait period, 2 with shortage or damage noted, 2 to fix. 5 invoice(s) to hold for review (7830).

▶ Draft the POD request to Coastal Line Haul
  status: executed  decision: allow  (auto)
  pod request Coastal Line Haul drafted with 0 open marker(s). Nothing was sent.

▶ Approve sending: waits for a named person even in Auto
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Pat Kim (fictional)
  pod request Coastal-Line-Haul approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to hold the invoice in AP itself
  status: blocked  decision: block
  reason: Fairhaul Proof of Delivery never holds or releases invoices in your AP system; it lists them for a person.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `pod_match` | For each load: the POD found (by PRO or shipment id), issues (missing_pod, unsigned, date_mismatch, short, exception_noted), a status (ok, chase, waiting, claim_review, fix) and whether to hold the invoice for review. | runs |
| `pod_write_report` | Write pods.csv and .html (one row per load with issues, the invoices to hold, and POD performance by carrier) into out_dir (default fairhaul-out/pod). | runs |
| `pod_draft_pod_request` | Write drafts/pod_request-<carrier>.md asking one carrier for each missing or unsigned POD, with shipment, PRO, delivery date and invoice. | asks first (Auto can be opted in) |
| `pod_request_send` | After one named human click (even in Auto), record that the reviewed pod request draft is approved in pod_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_hold_invoice` | Fairhaul Proof of Delivery never holds or releases invoices in your AP system; it lists them for a person. | refused |
| `ap_release_payment` | Fairhaul Proof of Delivery never releases payments. | refused |
| `email_send` | Fairhaul Proof of Delivery never sends email. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Delivered or invoiced loads (`loads`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment_id` (required) | text | Shipment ID, Load ID, Load Number, Order, BOL | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `pro` | text | PRO, PRO Number, Pro #, Tracking Number | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `carrier` (required) | text | Carrier, Carrier Name, SCAC | Spediteur, Transporteur, 運送会社, 承运商 |
| `delivery_date` | date | Delivery Date, Delivered, Actual Delivery | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `pieces` | number | Pieces, Handling Units, Pallets, Cartons, Qty | Packstücke, Colis, 個口数, 件数 |
| `invoice_number` | text | Invoice Number, Invoice, Invoice # | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `invoice_amount` | amount | Invoice Amount, Amount, Billed | Betrag, Montant, 金額, 金额 |
| `invoice_delivery_date` | date | Invoice Delivery Date, Billed Delivery Date | - |
| `pod_required` | yes/no | POD Required, Customer Requires POD | - |

### POD log (`pods`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `pro` | text | PRO, PRO Number, Pro #, Tracking Number | Sendungsnummer, Numéro de suivi, 追跡番号, 运单号 |
| `shipment_id` | text | Shipment ID, Load ID, BOL, Reference | Sendungs-ID, N° d'expédition, 出荷番号, 发货单号 |
| `received_on` | date | Received On, Received, Uploaded, Document Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |
| `pod_delivery_date` | date | POD Delivery Date, Delivery Date, Date Signed, Signed On | Lieferdatum, Date de livraison, 配達日, 送达日期 |
| `signed_by` | text | Signed By, Signature, Receiver, Consignee Signature | Unterschrieben von, Signé par, 受領者, 签收人 |
| `pieces_delivered` | number | Pieces Delivered, Pieces, Qty Delivered, Count | Zugestellte Packstücke, Colis livrés, 配達個数, 签收件数 |
| `exceptions` | text | Exceptions, Exception Notes, Notation, OS&D, Remarks | Abweichung, Anomalie, 異常, 异常 |
| `document` | text | Document, File, File Name, Image | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairhaul-proof-of-delivery inspect <file>` (names and shapes only, never values) and name them in `fairhaul-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairhaul-proof-of-delivery demo
npx -y fairhaul-proof-of-delivery mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairhaul-proof-of-delivery": {
      "command": "npx",
      "args": [
        "-y",
        "fairhaul-proof-of-delivery",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairhaul-proof-of-delivery -- npx -y fairhaul-proof-of-delivery mcp --root .`, or install the `fairhaul-proof-of-delivery` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairhaul-proof-of-delivery approve <id> --as "Your Name"` (or on the local approvals page, `fairhaul-proof-of-delivery approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairhaul-proof-of-delivery kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairhaul-proof-of-delivery tools                 # every tool, its policy and arguments
fairhaul-proof-of-delivery sources               # the columns each input is read from
fairhaul-proof-of-delivery inspect <file>        # how a file would be read (names and shapes, never values)
fairhaul-proof-of-delivery call pod_match '{"loads":"<loads>","pods":"<pods>"}'
fairhaul-proof-of-delivery eval                  # the private eval cases on the fictional fixtures
fairhaul-proof-of-delivery demo
```

## Audit log and data

Every call is written to `.fairhaul/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Fairhaul Proof of Delivery reads a POD log (the fields your document system or carrier portal exports), not the images. A person should look at the POD itself before an invoice is released or disputed.
- Matching is by PRO and shipment id.
