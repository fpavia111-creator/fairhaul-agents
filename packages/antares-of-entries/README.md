# Antares of Entries (`antares-of-entries`)

Checks your customs broker's entry lines against your commercial invoices. It looks at entered value (with the exchange rate), quantity, origin and duty arithmetic. It finds invoice lines entered twice or not at all, and the same SKU or code entered differently across entries. It estimates duty possibly over or underpaid and counts the days left to ask for a correction. **It gives no classification advice and files nothing.**

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y antares-of-entries demo
npx -y antares-of-entries mcp --root ./customs
```

## Checks

| Code | Meaning |
|---|---|
| `value_below_invoice`, `value_above_invoice` | Entered value differs from the invoice (converted at the entry's exchange rate) by more than `tolerance_pct` (default 1%) |
| `quantity_mismatch`, `origin_mismatch` | Entry and invoice disagree |
| `duty_math` | Entered value times the line's rate is not the duty on the line |
| `entered_twice` | The same invoice and SKU is on two entries |
| `invoice_line_not_entered` | On an entered invoice but on no entry line |
| `missing_data` | No tariff code, origin or quantity |
| `code_inconsistent` | The same SKU under different tariff codes. Antares does not say which is right |
| `rate_inconsistent` | The same code and origin at different rates. Dates or programs may explain it |

`duty_impact` uses the rate on the entry line: positive may be owed, negative may have been overpaid.

The correction countdown runs only when you pass `correction_window_days`, the window your broker advises. Antares has no built-in deadline.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `antares_check` | read | allow |
| `antares_write_report` | report: `antares-entries.csv`, `.html` | allow |
| `antares_draft_correction_request` | write: a note to the broker, marked DRAFT | allow |
| `antares_request_send` | action (`binding_send`) | one named click, even in Auto |
| `customs_file_correction`, `customs_classify_item`, `ap_pay_duty` | refused | block |

## Limits

- Matching is by invoice number and SKU. Entries summarised to fewer lines than the invoice will show differences.
- Duty figures are estimates from your files, not liability figures. Fees, other duties and special programs are not computed.
- Not customs, legal or tax advice. Your broker or a licensed customs professional decides classification, origin and corrections.
