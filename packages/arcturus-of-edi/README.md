# Arcturus of EDI (`arcturus-of-edi`)

Reads the X12 files your carriers and EDI provider exchange with you, checks that they are well formed, turns them into spreadsheets, and reconciles them: every invoice against its tender and the carrier that accepted it, every invoiced load against a delivery status, every transaction your partner rejected. It never sends EDI.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y arcturus-of-edi demo
npx -y arcturus-of-edi mcp --root ./edi-archive
```

## Sets it reads

| Set | What Arcturus takes from it |
|---|---|
| 204 Load tender | Carrier SCAC, shipment id, stops with dates and places, weight, tendered amount |
| 210 Freight invoice | Invoice number, PRO, shipment reference, dates, total (B3), charge lines (L1), origin and destination |
| 214 Shipment status | PRO, shipment id, each status event (AT7) with time and place |
| 990 Tender response | Accepted or declined, by which carrier |
| 997 / 999 Acknowledgement | Group status and each transaction's accepted, rejected or with-errors status |

Delimiters are detected from the ISA segment, so `*`, `|` or other separators and `~` or line-break terminators all read. Envelope checks: ISA/IEA, GS/GE and ST/SE pairs, control numbers and counts, each with its segment number.

## Reconciliation findings

`invoice_without_tender`, `invoice_from_other_carrier`, `invoice_over_tender`, `invoice_lines_mismatch`, `invoiced_without_delivery_status`, `tender_no_response`, `tender_declined`, `response_without_tender`, `rejected_by_partner`.


<!-- generated:start -->

## A demo run

`npx -y arcturus-of-edi demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Arcturus of EDI demo (fictional X12 between a shipper and two carriers) in <demo folder>

▶ Check the structure of five X12 files
  status: executed  decision: allow
  5 file(s), 13 transaction(s) read; 0 file(s) with problems. tenders-204.edi: ok {"204":3}; responses-990.edi: ok {"990":4}; status-214.edi: ok {"214":2}; invoices-210.edi: ok {"210":3}; ack-997.edi: ok {"997":1}

▶ A file with a wrong SE count and a wrong GE count, and a file that is not EDI
  status: executed  decision: allow
  2 file(s), 3 transaction(s) read; 2 file(s) with problems. broken-210.edi: 2 problem(s) {"210":3}; not-edi.txt: not an X12 file: no ISA segment 

▶ Reconcile tenders, responses, status, invoices and acknowledgements
  status: executed  decision: allow
  3 tender(s), 3 invoice(s), 4 status event(s), 4 response(s): 5 finding(s) {"invoice_over_tender":2,"invoiced_without_delivery_status":1,"invoice_without_tender":1,"rejected_by_partner":1}.
    invoice_over_tender               INV-7101  Invoice INV-7101 is 486; the tender for SH-1001 said 450 (+36). Check the charge lines for added accessorials or fuel.
    invoice_over_tender               INV-7102  Invoice INV-7102 is 195; the tender for SH-1002 said 150 (+45). Check the charge lines for added accessorials or fuel.
    invoiced_without_delivery_status  INV-7102  No 214 delivery event for SH-1002 / PRO-55502. Ask for proof of delivery before paying.
    invoice_without_tender            INV-7103  Invoice INV-7103 names shipment "SH-9999", which no 204 tender in these files covers.
    rejected_by_partner               210 0003  The partner's IM acknowledgement for group 204 marks 210 control 0003 as rejected. Fix and resend through your EDI provider.

▶ Tender acceptance by carrier
  status: executed  decision: allow
  EXLT: 2/3 accepted (67%); SMPF: 1/1 accepted (100%)

▶ Convert everything to spreadsheets
  status: executed  decision: allow
  6 CSV file(s) and the reconciliation written.

▶ Agent tries to transmit EDI itself
  status: blocked  decision: block
  reason: Arcturus never sends EDI to a trading partner or VAN; your EDI provider does.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `arcturus_inspect` | Detect delimiters and check ISA/IEA, GS/GE and ST/SE pairs, control numbers and counts for each file. | runs |
| `arcturus_reconcile` | Match 210 invoices to 204 tenders and 990 acceptances, compare amounts, look for 214 delivery events, and list transactions a 997/999 rejected. | runs |
| `arcturus_tender_stats` | Accepted and declined 990 responses per carrier SCAC, lowest acceptance first. | runs |
| `arcturus_convert` | Write one CSV per kind (tenders, invoices, invoice lines, status events, responses, acknowledgements) plus edi-reconcile.csv and .html into out_dir (default lodestar-out/arcturus). | runs |
| `edi_transmit` | Arcturus never sends EDI to a trading partner or VAN; your EDI provider does. | refused |
| `van_upload` | Arcturus never uploads to a VAN, AS2 endpoint or SFTP mailbox. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y arcturus-of-edi demo
npx -y arcturus-of-edi mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "arcturus-of-edi": {
      "command": "npx",
      "args": [
        "-y",
        "arcturus-of-edi",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add arcturus-of-edi -- npx -y arcturus-of-edi mcp --root .`, or install the `arcturus-of-edi` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `arcturus-of-edi approve <id> --as "Your Name"` (or on the local approvals page, `arcturus-of-edi approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`arcturus-of-edi kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
arcturus-of-edi tools                 # every tool, its policy and arguments
arcturus-of-edi sources               # the columns each input is read from
arcturus-of-edi inspect <file>        # how a file would be read (names and shapes, never values)
arcturus-of-edi call arcturus_inspect '{"files":"<files>"}'
arcturus-of-edi eval                  # the private eval cases on the fictional fixtures
arcturus-of-edi demo
```

## Audit log and data

Every call is written to `.lodestar/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Element positions follow the public X12 004010 structure as recalled. They were not checked against the licensed X12 implementation guides, and trading partners often use their own variations. Check the first files from each partner by hand.
- 210 amounts are read as two implied decimals when they have no decimal point, as the standard numeric type N2 requires.
- It does not send, resend or acknowledge anything. Your EDI provider does that.
