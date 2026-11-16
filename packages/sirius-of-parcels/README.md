# Sirius of Parcels (`sirius-of-parcels`)

Finds refundable charges in your UPS, FedEx, DHL and USPS invoice data and tells you the date by which to ask for each one. Parcel refund windows are short, so every finding carries a request-by date, and the report includes a calendar with reminders. It drafts the refund request; a person files it.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y sirius-of-parcels demo
npx -y sirius-of-parcels mcp --root ./parcel-data
```

## What it finds

| Finding | Refundable amount |
|---|---|
| `late_delivery`: delivered after the commitment on a guaranteed service | Transportation and fuel |
| `late_no_guarantee`: late, but the service is not guaranteed or your terms waive it | Tracked for performance only |
| `duplicate_tracking`: the same tracking number on two invoices | The second charge |
| `voided_label_billed`: a label in your void list was billed | The charge |
| `residential_on_business`: residential charge on an address in your business list | The surcharge |
| `dim_overbilled`: billed weight above what your dimensions and weight give | Estimated, pro rata to weight |
| `address_correction`: correction charges, with repeats to the same address called out | Review (fix the address book) |
| `missing_delivery_scan`: committed date passed a week ago with no delivery on file | Review |

Each package gets a request-by date (invoice date plus `claim_window_days`, default 15) and a status: `claim`, `window_closed`, `review` or `ok`. Anything due within 3 days is listed as urgent.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `sirius_audit`, `sirius_explain` | read | allow |
| `sirius_write_report` | report: `sirius-audit.csv`, `.html`, `claim-deadlines.ics` | allow |
| `sirius_draft_refund_request` | write: one request per carrier, packages still in window only | ask |
| `sirius_request_submit` | action, `binding_send`, tied to the draft hash | one named click, even in Auto |
| `carrier_portal_submit`, `ap_pay_invoice` | refused | block |

## Terms file (optional)

`dim_divisor` (default 139), `guarantee_waived`, `guaranteed_services` (defaults cover common overnight, 2-day, 3-day and ground services; edit to match your agreement), `claim_window_days`, `late_grace_minutes`, `commercial_addresses`, `charge_aliases`.

## Limits

- Many shipping agreements waive or suspend the delivery guarantee. Set `guarantee_waived` when yours does; Sirius cannot know.
- Dimensional-weight refunds are estimates; the exact amount needs the carrier's rate for each weight.
- Carrier column names (for example *Express or Ground Tracking ID*, *Tracking ID Charge Amount*) were written from knowledge of the exports and not tested against a live account. `sirius-of-parcels inspect <file>` shows how a file is read.
- Not legal advice. A person decides what to request and files it.
