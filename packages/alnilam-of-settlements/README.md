# Alnilam of Settlements (`alnilam-of-settlements`)

For freight brokers. Settles every carrier payment against its rate confirmation, approved accessorials, quick-pay fee, pay terms, proof of delivery and notice of assignment. It finds invoices above the rate confirmation, double and over payments, payments to the wrong party, past-due loads and invoices with no rate confirmation. It drafts the next payment batch by payee. **A person releases every payment.**

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y alnilam-of-settlements demo
npx -y alnilam-of-settlements mcp --root ./carrier-pay
```

## How a load is settled

- Owed is the rate plus approved accessorials, less the quick-pay fee (`quick_pay_pct`, default 3%) on quick-pay loads.
- The party to pay is the factor on a notice of assignment in effect when the invoice arrived, unless it was released; otherwise the carrier.
- Due is the invoice date plus the pay terms (2 days on quick pay, else the rate confirmation's terms or `default_terms_days`, default 30).
- Status: `awaiting_invoice`, `hold_no_pod`, `ready`, `past_due` or `paid`. Ready and past-due loads form the next batch, each capped at the rate confirmation.

## Findings

`invoice_over_ratecon`, `two_invoices`, `paid_twice`, `overpaid`, `paid_wrong_party`, `past_due`, `no_pod`, `invoice_without_ratecon`, `payment_without_ratecon`.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `alnilam_settle` | read | allow |
| `alnilam_write_report` | report: `alnilam-settlements.csv`, `.html` | allow |
| `alnilam_draft_payment_batch` | write: the batch by payee, marked DRAFT | allow |
| `alnilam_request_release` | action (`move_money`) | one named click, even in Auto |
| `ap_release_payment`, `bank_transfer`, `tms_update_carrier_pay` | refused | block |

## Limits

- Notices are matched by carrier name. Confirm a notice or release with the factor before changing who you pay.
- Extra charges count only if they are in the approved accessorials column.
- Not legal or accounting advice.
