# Algol of Duplicates (`algol-of-duplicates`)

Searches years of freight payments for invoices paid more than once, nets off credits you already received, grades each find by confidence and drafts the refund request. It never voids, offsets or moves money, and never changes vendor records.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y algol-of-duplicates demo
npx -y algol-of-duplicates mcp --root ./ap-history
```

## Rules

| Rule | Confidence | What it means |
|---|---|---|
| `exact_duplicate` | high | Same carrier, invoice number and amount, paid twice |
| `invoice_number_variant` | high | The same invoice keyed two ways ("INV-00418" and "418") |
| `two_vendor_records` | high | The same invoice paid under two vendor records; merge or block one |
| `same_pro` | high or medium | One PRO paid under two invoice numbers; medium when the amounts differ (often a balance-due bill) |
| `same_amount_and_date` | low | Same carrier and amount a few days apart with no shared reference; could be two real loads |

Credit memos (negative lines) that name the invoice or PRO are netted off. A pair is reported once, under the strongest rule.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `algol_search` | read | allow |
| `algol_write_report` | report: `algol-duplicates.csv`, `.html` | allow |
| `algol_draft_recovery` | write: `drafts/recovery-<vendor>.md`, marked DRAFT, high confidence only unless asked | ask |
| `algol_request_send` | action (binding_send): records that the reviewed request (by sha256) may be sent | one named click, even in Auto |
| `ap_void_payment`, `email_send`, `erp_block_vendor` | refused | block |

## Limits

- Medium and low confidence finds need the bills pulled before anyone asks for money back.
- How far back you can recover depends on your agreements and the law that applies; Algol does not decide that.
- It reads only the payment history you give it. A duplicate paid through another system will not show up.
