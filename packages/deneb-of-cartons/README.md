# Deneb of Cartons (`deneb-of-cartons`)

Checks every parcel's carton against what was inside. It finds the smallest carton in your catalog that fits (any orientation, with padding), works out the dimensional weight and freight a better fit would have saved, flags packages heading for oversize charges and sizes your catalog lacks, and drafts carton and packing rule changes by SKU. It never changes your WMS and never orders cartons.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y deneb-of-cartons demo
npx -y deneb-of-cartons mcp --root ./packaging
```

## Settings (in the carton catalog file)

| Setting | Default | Meaning |
|---|---|---|
| `cartons` | required | Name and inside length, width, height in inches |
| `divisor` | 139 | Cubic inches per dimensional lb |
| `padding_in` | 1 | Inches added to each side of the contents |
| `rate_per_lb` | 1.10 | Your average cost per billable lb, for the saving |
| `oversize_length_plus_girth`, `oversize_longest_side` | 130, 48 | Above either, an extra charge is likely |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `deneb_check` | read | allow |
| `deneb_write_report` | report: `deneb-cartons.csv`, `.html` | allow |
| `deneb_draft_carton_change` | write: `drafts/carton_change-<name>.md`, marked DRAFT | ask |
| `deneb_request_apply` | action (production_deploy): records that the reviewed change (by sha256) may be applied | one named click, even in Auto |
| `wms_update_cartonization`, `purchase_order_create` | refused | block |

## Limits

- Contents are one bounding box per package. Odd shapes and multi-item orders packed loosely need a person.
- Carriers' divisors, rounding and oversize rules differ and change; set yours. Sirius of Parcels audits what the carrier actually billed.
- Test smaller cartons for damage before switching.
