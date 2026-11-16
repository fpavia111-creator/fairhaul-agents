# Castor of Allocations (`castor-of-allocations`)

Splits each shipment's freight bill across the orders, customers, SKUs and cost centers that rode on it. It shows freight per unit and as a percent of sales value, and drafts the reclass journal from the freight clearing account to the right GL account and cost center. It never posts to your ledger and never writes cost back into orders.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y castor-of-allocations demo
npx -y castor-of-allocations mcp --root ./close
```

## How the split works

- Choose a basis: `weight` (default), `cube`, `value`, `pallets` or `units`.
- If any line on a shipment lacks that measure, the whole shipment falls back to the next one in `fallback` (default cube, value, units), then equal shares. Each fallback is listed as a problem.
- The last line on each shipment takes the rounding cent, so every shipment allocates to the cent.
- A shipment with no order lines is not allocated and is listed.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `castor_allocate` | read | allow |
| `castor_write_report` | report: `castor-allocation.csv`, `.html`, `allocation-journal-draft.csv` (with its sha256) | allow |
| `castor_request_post` | action: records that the reviewed journal (by sha256) may be posted | one named click |
| `erp_post_journal`, `erp_update_order_cost` | refused | block |

## Limits

- An allocation is a method choice, not a fact. Different bases give different answers; the basis is on every line.
- Matching is by shipment id only. Order lines under another reference look unshipped.
- Not accounting advice. Your controller decides the method and posts the entry.
