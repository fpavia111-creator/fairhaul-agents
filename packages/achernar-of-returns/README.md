# Achernar of Returns (`achernar-of-returns`)

Follows every return from authorisation to credit. It finds labels never used, returns received but not credited, credits issued for goods that never came back or for more than came back, and return freight billed twice or with no return authorised. It shows which reasons, customers and SKUs cost the most freight to bring back. **It never issues credits or voids labels.**

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y achernar-of-returns demo
npx -y achernar-of-returns mcp --root ./returns
```

## Checks

| Code | Meaning |
|---|---|
| `label_unused` | Authorised more than `unused_days` (default 30) ago; nothing received or credited |
| `received_not_credited` | Received more than `credit_days` (default 7) ago; no credit. The customer is waiting |
| `credited_not_received` | Credit issued; nothing received |
| `short_received` | Fewer units back than authorised |
| `over_credited` | Credit above the value of what came back |
| `freight_billed_twice` | Same return tracking on two carrier charges |
| `freight_without_rma` | Return freight on tracking that matches no RMA |

Only the RMA file is required. Each extra file (receipts, credits, return freight) turns on the checks that need it.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `achernar_track` | read | allow |
| `achernar_write_report` | report: `achernar-returns.csv`, `.html` | allow |
| `achernar_draft_carrier_dispute` | write: a dispute to one carrier, marked DRAFT | allow |
| `achernar_request_send` | action (`binding_send`) | one named click, even in Auto |
| `erp_issue_credit`, `carrier_void_label`, `email_send` | refused | block |

## Limits

- Receipts match by RMA or tracking, credits by RMA, freight by tracking. Other references will look unmatched.
- A credit before receipt may be deliberate goodwill. Check before reversing anything.
- Whether an unused label costs money depends on your carrier agreement.
