# Vega of Detention (`vega-of-detention`)

Checks detention, layover and lumper charges against your own dock log: when the truck arrived, when the appointment was, when it left, and whether a lumper receipt exists. It works out what each charge should have been under your terms, drafts disputes for the difference, and ranks your facilities by dwell time and detention cost, which is usually the bigger saving.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y vega-of-detention demo
npx -y vega-of-detention mcp --root ./dock-data
```

## How a charge is checked

- **Detention**: the clock starts at the appointment (or at arrival if there was none, or if the truck came later but within the grace period). A truck that arrived after the appointment plus grace earns nothing. Free time is taken off, the rest is rounded up to the billing increment, priced at the hourly rate and capped per stop. Hours billed above the time actually on site are flagged too.
- **Layover**: earned only after `layover_min_hours` on site, at the agreed amount.
- **Lumper**: needs a receipt when `lumper_requires_receipt` is on (default), and may not exceed the receipt.
- No dock times means **review**, never "fine".

Defaults (each stated in the report): 2 free hours, 50 per hour, 15-minute grace, 15-minute increments, layover after 16 hours. Per-carrier overrides go under `carriers` in the terms file.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `vega_audit`, `vega_explain` | read | allow |
| `vega_facilities` | read: dwell, share over free time, late carrier arrivals and detention billed per facility | allow |
| `vega_write_report` | report: `vega-audit.csv` and `.html` | allow |
| `vega_draft_dispute` | write: one letter per carrier | ask |
| `vega_request_send` | action, `binding_send`, tied to the draft hash | one named click, even in Auto |
| `ap_pay_invoice`, `email_send` | refused | block |

## Limits

- It trusts the dock log you give it. If gate times are typed by hand, check them before disputing.
- Allowed amounts follow your terms file, not your carrier's tariff.
- Yard and dock column names (*Gate In*, *Gate Out*, *Receipt #*) were written from knowledge of common exports, not tested against a live system.
- Not legal advice. A person decides what to dispute.
