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

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `arcturus_inspect`, `arcturus_reconcile`, `arcturus_tender_stats` | read | allow |
| `arcturus_convert` | report: one CSV per kind, plus `edi-reconcile.csv` and `.html` | allow |
| `edi_transmit`, `van_upload` | refused | block |

## Limits

- Element positions follow the public X12 004010 structure as recalled. They were not checked against the licensed X12 implementation guides, and trading partners often use their own variations. Check the first files from each partner by hand.
- 210 amounts are read as two implied decimals when they have no decimal point, as the standard numeric type N2 requires.
- It does not send, resend or acknowledge anything. Your EDI provider does that.
