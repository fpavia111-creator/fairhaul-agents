# Canopus of Air (`canopus-of-air`)

Audits air freight invoices: chargeable weight from actual and volumetric weight, the rate for the right weight break (including a higher break when it costs less), the minimum charge, fuel and security surcharges per kilo, and charges your rate sheet does not have. It also prices a shipment from the rate sheet, and drafts disputes to the forwarder. It never pays or sends.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y canopus-of-air demo
npx -y canopus-of-air mcp --root ./air
```

## Weights and rates

- Volumetric kg = m³ × 1,000,000 ÷ `volumetric_factor` (default 6000, so 1 m³ = 166.67 kg). Chargeable kg = the larger of actual and volumetric, rounded up to `round_up_to` (default 0.5).
- `breaks` per lane: `"-45"`, `"+45"`, `"+100"`, `"+300"`, `"+500"`, `"+1000"` (any you have). The cheapest of "your break" and "a higher break at its minimum weight" wins, then the lane `minimum`.
- `surcharges`: `per_kg` on `chargeable` or `actual` weight with an optional `minimum`, or `flat`.

See `fixtures/rates.json`.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `canopus_audit`, `canopus_quote` | read | allow |
| `canopus_write_report` | report: `canopus-air.csv`, `.html` | allow |
| `canopus_draft_dispute` | write: `drafts/dispute-<forwarder>.md`, marked DRAFT | ask |
| `canopus_request_send` | action (binding_send): records that the reviewed dispute (by sha256) may be sent | one named click, even in Auto |
| `ap_pay_invoice`, `email_send` | refused | block |

## Limits

- Compared against your rate sheet, not an airline tariff.
- Charges in another currency are flagged, not converted.
