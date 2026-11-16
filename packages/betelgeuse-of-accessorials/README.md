# Betelgeuse of Accessorials (`betelgeuse-of-accessorials`)

Shows where your accessorial charges come from: by type, by delivery location and by carrier. It flags charges you could have ordered up front but did not (liftgate, residential, appointment and similar), charges above your contract, and locations where the same charge keeps coming back. For those it drafts the address-book changes that make quotes, tenders and BOLs include the service, so it stops arriving as a surprise. It never changes your TMS.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y betelgeuse-of-accessorials demo
npx -y betelgeuse-of-accessorials mcp --root ./freight
```

## What it reads

- **Invoices** with charge lines and the destination (CSV, Excel, JSON or X12 210).
- **Shipments** (optional) with the accessorials ordered, matched by shipment id, PRO, BOL or PO. Without them it still totals and finds repeats, but cannot say what was ordered.
- **Contract** (optional), the Lodestar contract format, for charges above the agreed amount.

Orderable accessorials: liftgate, residential, inside, limited access, appointment, hazmat, sort and segregate, signature, Saturday, declared value, overlength, delivery area. Detention, redelivery, lumper, reweigh and similar are caused by events, so they are never called unordered; repeats of them still show up with a suggested fix.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `betelgeuse_analyse` | read | allow |
| `betelgeuse_write_report` | report: `betelgeuse-accessorials.csv`, `.html` | allow |
| `betelgeuse_draft_address_update` | write: `drafts/address_update-<name>.md`, marked DRAFT | ask |
| `betelgeuse_request_apply` | action (production_deploy): records that the reviewed change list (by sha256) may be applied | one named click, even in Auto |
| `tms_update_address`, `ap_pay_invoice` | refused | block |

## Limits

- An unordered charge is often real: a home with no dock needs a liftgate. Use the report to fix your data first and dispute second; Polaris of Bills drafts disputes.
- Locations are grouped by the destination city, state and postal code on the invoice or shipment, so two spellings of one address count as two places.
