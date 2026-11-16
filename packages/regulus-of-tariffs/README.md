# Regulus of Tariffs (`regulus-of-tariffs`)

Re-rates your shipment history under every carrier contract you hold: linehaul with minimums and discounts, fuel at the diesel price for the week each load shipped, and the accessorials ordered. It shows what each carrier would have cost, the cheapest carrier on each lane, what you paid above the cheapest contract, and drafts routing guide changes. It never changes your routing guide.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y regulus-of-tariffs demo
npx -y regulus-of-tariffs mcp --root ./freight
```

Contracts use the Lodestar contract format shared with Polaris of Bills and Spica of Fuel, so one file serves all three.

## Rules

- A carrier prices a shipment only if its contract is in force on the ship date, has a lane that matches, has the measure the lane needs (weight, miles or pallets) and prices every accessorial ordered. Otherwise it shows why not.
- A lane ranking includes only carriers that can price every shipment on it.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `regulus_rerate` | read | allow |
| `regulus_write_report` | report: `regulus-rerate.csv`, `.html` | allow |
| `regulus_draft_routing_change` | write: `drafts/routing_change-<name>.md`, marked DRAFT | ask |
| `regulus_request_apply` | action (production_deploy): records that the reviewed change (by sha256) may be applied | one named click, even in Auto |
| `tms_update_routing_guide`, `email_send` | refused | block |

## Limits

- Priced from your contract files, not a carrier's live tariff or base-rate product.
- Price is not service. Check on-time and claims (Rigel of Scorecards) before moving freight.
