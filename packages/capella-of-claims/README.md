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

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `capella_scan`, `capella_track` | read | allow |
| `capella_write_report` | report: `capella-claims.csv`, `.html`, `claim-deadlines.ics` (reminders 14 and 3 days before) | allow |
| `capella_draft_claim` | write: `drafts/claim-<shipment>.md`, marked DRAFT, with `[ATTACH ...]` markers for the documents | ask |
| `capella_request_file` | action (binding_send): records that the reviewed draft (by sha256) may be filed | one named click, even in Auto |
| `carrier_portal_submit`, `email_send`, `ap_offset_invoice` | refused | block |

## Limits

- Deadlines come from the terms file you give it. The window that binds you is in your bill of lading, contract or the law that applies to the shipment; check it.
- It does not decide whether the carrier is liable. It shows the evidence the carrier will ask about.
- Not legal advice.
