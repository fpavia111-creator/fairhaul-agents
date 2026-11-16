# Procyon of Accruals (`procyon-of-accruals`)

Builds the month-end freight accrual: every shipment that went out by period end with no carrier invoice dated by period end, with an estimate and where the estimate came from, totalled by GL account and cost center, and a draft journal entry. It also checks how accurate last month's accrual was. It never posts to your ledger.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y procyon-of-accruals demo
npx -y procyon-of-accruals mcp --root ./close
```

## How each shipment is estimated

1. **Invoice after period end**: the invoice arrived after the cut-off, so its amount is used.
2. **Quote**: the quoted or rate-confirmation amount on the shipment.
3. **Contract**: lane rate plus fuel from your contract file (the same format as Polaris of Bills).
4. **Lane average**: the average of at least two invoices on the same carrier and lane.
5. **Carrier average**: the average of at least three invoices from the carrier.
6. Otherwise **no estimate**: listed with no amount so a person fills it in.

Cancelled shipments and shipments after period end are skipped and counted. Shipments older than 60 days with no invoice are called out; they are often lost bills or a carrier that never invoices.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `procyon_accrue` | read | allow |
| `procyon_write_report` | report: `procyon-accrual.csv`, `.html`, `journal-entry-draft.csv` (with its sha256) | allow |
| `procyon_request_post` | action: records that the reviewed journal (by sha256) may be posted | one named click |
| `erp_post_journal` | refused | block |

## Limits

- Estimates are estimates. The basis is shown on every line so a reviewer can challenge it.
- Matching uses shipment id, PRO, BOL and PO. A carrier that invoices under another reference will look unbilled.
- Not accounting advice. Your controller decides the accrual and posts it.
