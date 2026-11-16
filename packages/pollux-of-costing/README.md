# Pollux of Costing (`pollux-of-costing`)

Compares the standard freight built into each item's cost with what freight actually cost per unit, month by month. It finds the SKUs whose standard is too low (margins look better than they are) or too high, proposes a new standard with its basis, estimates the inventory revaluation, and drafts the update. It never changes item costs and never revalues inventory.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y pollux-of-costing demo
npx -y pollux-of-costing mcp --root ./costing
```

Actual freight by SKU can come from your ERP or straight from `castor-allocation.csv` written by [Castor of Allocations](../castor-of-allocations).

## Statuses

| Status | Meaning |
|---|---|
| `standard_too_low` | Actual per unit is more than `threshold_pct` (default 10%) above standard on at least `min_units` (default 20) units |
| `standard_too_high` | More than the threshold below standard |
| `no_standard` | The SKU shipped but the item master has no freight standard |
| `thin_data` | Too few units to judge; no proposal |
| `no_shipments` | Has a standard but did not ship in these files |
| `ok` | Within the threshold |

When the per-unit cost moved more than the threshold between the first and last month, the proposal uses the latest month; otherwise the period average. The basis is written next to every proposal.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `pollux_compare` | read | allow |
| `pollux_write_report` | report: `pollux-standards.csv`, `.html` | allow |
| `pollux_draft_standard_update` | write: a Markdown draft, marked DRAFT | allow |
| `pollux_request_apply` | action (`production_deploy`): records the approved draft by sha256 | one named click, even in Auto |
| `erp_update_item_cost`, `erp_revalue_inventory` | refused | block |

## Limits

- Proposals and revaluation are estimates from the files you give it. Seasonality, a one-off expedite or a carrier change can skew a short period.
- Matching is by SKU only.
- Not accounting advice. Your cost accountant decides when standards change and how variance is booked.
