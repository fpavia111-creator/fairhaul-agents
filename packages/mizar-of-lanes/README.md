# Mizar of Lanes (`mizar-of-lanes`)

Maps your freight spend by lane and mode and tracks cost per hundredweight and per mile month by month. It finds LTL shipments on one lane that could have shared a truck, and heavy LTL that should have been quoted as truckload, with an estimated saving at your own truckload rate. It drafts the consolidation plan for your shipping team. It never holds orders or books loads.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y mizar-of-lanes demo
npx -y mizar-of-lanes mcp --root ./freight
```

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `lane_level` | `zip3` | Group places by state, 3-digit ZIP (falls back to state) or city |
| `window_days` | 0 | LTL shipments this many days apart on one lane can combine |
| `tl_rate_per_mile`, `tl_minimum` | 2.75, 900 | Your typical truckload cost, for the estimate |
| `tl_weight_lbs`, `tl_pallets` | 10,000, 12 | A single LTL shipment at or above either is flagged for a truckload or volume quote |
| `max_weight_lbs`, `max_pallets` | 44,000, 26 | What one truck can take |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `mizar_analyse` | read | allow |
| `mizar_write_report` | report: `mizar-lanes.csv`, `.html` | allow |
| `mizar_draft_consolidation_plan` | write: `drafts/consolidation_plan-<name>.md`, marked DRAFT | ask |
| `mizar_request_send` | action (binding_send): records that the reviewed plan (by sha256) may be sent | one named click, even in Auto |
| `erp_hold_orders`, `tms_tender_load` | refused | block |

## Limits

- Truckload costs are estimates from your per-mile rate. Different delivery addresses on one lane mean a multi-stop load, which costs more.
- Holding orders to ship together can break delivery promises. Check with customers first.
