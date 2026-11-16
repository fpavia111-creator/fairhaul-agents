# Spica of Fuel (`spica-of-fuel`)

Checks every fuel surcharge against the carrier's fuel table at the diesel price for the week the load shipped. It finds invoices priced on the wrong week (usually the week the carrier invoiced, after diesel rose), compares carriers' fuel tables side by side and shows what a diesel move would have cost. It drafts disputes; it never pays, short-pays or sends.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y spica-of-fuel demo
npx -y spica-of-fuel mcp --root ./freight
```

## Inputs

- **Invoices** with a linehaul line and a fuel line (CSV, Excel, JSON or X12 210), ship date and, for per-mile tables, miles.
- **Contract** in the Lodestar contract format (the same as Polaris of Bills): each carrier's `fuel` table (`pct_of_linehaul` or `per_mile`, rows by diesel price) and `fuel_index`, the weekly diesel prices you copy from the index your agreements name. Spica does not fetch prices.

## Statuses

`ok`, `fuel_over`, `wrong_week` (the billed amount matches another week's price), `fuel_under`, `fuel_not_billed`, `fuel_not_in_contract`, `index_stale` (no index week within 7 days before the ship date), `not_checked` (no miles or no linehaul line, or diesel outside the table), `no_index`, `no_contract`, `contract_expired`, `no_date`.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `spica_check`, `spica_compare`, `spica_sensitivity` | read | allow |
| `spica_write_report` | report: `spica-fuel.csv`, `.html` | allow |
| `spica_draft_dispute` | write: `drafts/dispute-<carrier>.md`, marked DRAFT | ask |
| `spica_request_send` | action (binding_send): records that the reviewed dispute (by sha256) may be sent | one named click, even in Auto |
| `ap_pay_invoice`, `email_send` | refused | block |

## Limits

- The week rule is "latest index week on or before the ship date". Some agreements use the pickup week, the invoice week or a lag; check yours before you dispute.
- Fuel as a percent of linehaul uses the linehaul line less any discount line.
- It reads only the files you give it and is not a tariff service.
