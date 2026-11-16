# Nunki of Quotes (`nunki-of-quotes`)

Lines up the spot quotes you collected for each load on one all-in basis, adding fuel and accessorials a quote leaves out. It drops quotes that have expired or would miss the delivery date, compares the best with what the lane usually costs you, and drafts the booking confirmation. It never tenders or books a load.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y nunki-of-quotes demo
npx -y nunki-of-quotes mcp --root ./spot
```

## How quotes are made comparable

- A linehaul-only quote gets fuel added: `fuel_per_mile` × miles (default 0.60), or `fuel_pct` of the quote when miles are unknown (default 20%).
- When the load needs accessorials the quote does not include, `accessorial_allowance` amounts are added; any without an allowance are listed as "ask whether it is included".
- A quote is usable when it is valid through the as-of date and pickup date plus transit days is on or before the deliver-by date.
- The best usable quote is flagged when it is more than `above_history_pct` (default 15%) above the lane history average.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `nunki_compare` | read | allow |
| `nunki_write_report` | report: `nunki-quotes.csv`, `.html` | allow |
| `nunki_draft_booking` | write: `drafts/booking-<load>.md`, marked DRAFT | ask |
| `nunki_request_tender` | action (binding_send): records that the reviewed booking (by sha256) may be tendered | one named click, even in Auto |
| `tms_tender_load`, `email_send` | refused | block |

## Limits

- Additions are your own allowances, not the carrier's numbers. Confirm the real all-in total on the rate confirmation.
- It does not vet the carrier. Check authority, insurance and fraud warning signs first (Aldebaran of Carriers).
