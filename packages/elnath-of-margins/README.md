# Elnath of Margins (`elnath-of-margins`)

Compares the freight you charged each customer with what the freight actually cost. It shows recovery by customer and by freight terms, and finds collect orders you paid for, prepaid-and-add orders with no freight on the invoice, and orders shipped free below your threshold. It estimates how other free-shipping thresholds would change recovery. **It never changes terms or bills customers.**

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y elnath-of-margins demo
npx -y elnath-of-margins mcp --root ./sales
```

## What it reads

- Orders with value, freight charged and terms. Cost can be on the order or come from a shipment cost file; a shipment with several orders is split by order value.
- Terms are read from your wording: prepaid, delivered or free terms count as `prepaid`; prepaid and add (PP&A) as `prepaid_add`; collect, FOB origin, ex works or third party as `collect`.

## Flags

`collect_but_we_paid`, `prepaid_add_not_billed`, `free_below_threshold`, `freight_over_pct` (freight above `max_freight_pct`, default 10% of order value, and not fully charged), `no_cost`.

Threshold estimates assume every prepaid order below the threshold is charged the average rate of the orders that paid freight, and that customers do not change behaviour.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `elnath_margins` | read | allow |
| `elnath_write_report` | report: `elnath-margins.csv`, `.html` | allow |
| `elnath_draft_terms_change` | write: a terms review with proposals left for a person, marked DRAFT | allow |
| `elnath_request_apply` | action (`production_deploy`) | one named click, even in Auto |
| `erp_update_customer_terms`, `ar_rebill_freight` | refused | block |

## Limits

- Freight cost must come from your files; orders without one are listed and left out of totals.
- Threshold figures are estimates, not forecasts.
- Not pricing or accounting advice.
