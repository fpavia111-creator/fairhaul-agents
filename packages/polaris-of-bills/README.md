# Polaris of Bills (`polaris-of-bills`)

Audits truckload and LTL freight bills against **your own contract** and tells you how much to dispute, invoice by invoice. It reads the files you already have (carrier invoices as CSV, Excel, JSON or X12 210, your contract as JSON, and optionally your shipment list and paid history), writes a worklist, and drafts dispute letters. It never pays a carrier and never sends anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y polaris-of-bills demo      # fictional carriers and invoices
npx -y polaris-of-bills mcp --root ./freight
```

## What it checks

| Finding | Meaning | Counted as disputable |
|---|---|---|
| `duplicate_invoice`, `duplicate_pro` | Same invoice number, or the same PRO billed twice | Whole invoice |
| `already_paid` | Invoice number or PRO is in your paid history | Whole invoice |
| `lines_do_not_add_up` | Charge lines do not add up to the invoice total | The difference |
| `linehaul_over` | Linehaul above the contract lane (flat, per mile, per cwt, per lb, per pallet, with minimums and discount) | The excess |
| `fuel_over` | Fuel above your fuel table at the diesel price for that week | The excess |
| `accessorial_not_allowed` | The contract says the charge is not allowed | The charge |
| `accessorial_over` | Above the contract amount, hourly rate after free time, or cap | The excess |
| `accessorial_not_ordered` | Liftgate, residential, inside delivery and similar charges that your shipment record does not list | The charge |
| `accessorial_unpriced` | A charge the contract does not price | Needs review |
| `weight_over_bol`, `quote_exceeded` | Billed weight more than 5% over the BOL, or the total above the quote | Needs review |
| `no_contract`, `contract_expired`, `no_lane`, `rate_needs_data`, `fuel_not_checked` | Polaris could not check the bill and says what is missing | Needs review |

An invoice with anything it could not check is marked **review**, never **ok**.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `polaris_audit` | read | allow |
| `polaris_explain` | read | allow |
| `polaris_write_report` | report: `polaris-audit.csv` (blank decision columns) and `.html` | allow |
| `polaris_draft_dispute` | write: one dispute letter per carrier, marked DRAFT | ask (a person says yes, or Auto is opted in) |
| `polaris_request_send` | action, `binding_send` | one named click, even in Auto; tied to the draft's sha256 |
| `polaris_request_pay` | action, `move_money`: records the amount AP may pay | one named click, even in Auto |
| `ap_pay_invoice`, `email_send`, `carrier_portal_submit` | refused | block |

## Files it reads

- **Invoices**: one row per invoice or per charge line. Column names such as *Freight Bill Number*, *Pro #*, *Charge Type*, *Line Amount*, *Shipper Zip* are recognised; `polaris-of-bills inspect <file>` shows how a file is read without printing values. X12 210 files (`.edi`, `.x12`) are read directly, with envelope and segment-count checks.
- **Contract** (`freight_contract` schema): carriers with SCAC and aliases, effective dates, lanes (ZIP, ZIP3, ZIP3 range, state or "City, ST"), minimums, discount, fuel table (percent of linehaul or per mile), accessorial terms, and a `fuel_index` of weekly diesel prices that you copy from your index source. See [`fixtures/contract.json`](fixtures/contract.json).
- **Shipments** (optional): BOL weight, quoted amount, accessorials ordered, arrival and departure times (for detention).
- **Paid history** (optional): invoice number, carrier, PRO.

## Limits

- It checks bills against the contract file you give it. It is not a tariff service, does not know your carrier's rules tariff, and does not look anything up online.
- X12 element positions follow the public 004010 structure as recalled; they were not checked against the licensed implementation guides, and trading partners differ.
- The TMS column names were written from knowledge of common exports and were not tested against a live account.
- Not legal or accounting advice. A person decides what to dispute and what to pay.
