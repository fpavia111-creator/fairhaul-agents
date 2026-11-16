# Bellatrix of Reweighs (`bellatrix-of-reweighs`)

Checks LTL weight and class corrections (reweighs and reclasses) against your declared dimensions, the density scale, normal scale tolerance and whether the carrier sent an inspection certificate. It separates the corrections worth challenging from the ones that mean your own product data is wrong, lists the item-master fixes, and drafts disputes. It never pays, sends or edits your item master.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y bellatrix-of-reweighs demo
npx -y bellatrix-of-reweighs mcp --root ./freight
```

## Statuses

| Status | When |
|---|---|
| `challenge` | Reweighed within scale tolerance (default the larger of 2% or 25 lb), or reclassed higher when your dimensions and the corrected weight give a density class at or below the one you declared |
| `ask_for_certificate` | No other reason to challenge, but no inspection certificate or photos on file |
| `fix_our_data` | The same product corrected at least twice with the carrier's figures standing up: update the item master |
| `accept` | The correction looks right |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `bellatrix_review` | read | allow |
| `bellatrix_write_report` | report: `bellatrix-corrections.csv`, `.html` | allow |
| `bellatrix_draft_dispute` | write: `drafts/dispute-<carrier>.md`, marked DRAFT | ask |
| `bellatrix_request_send` | action (binding_send): records that the reviewed dispute (by sha256) may be sent | one named click, even in Auto |
| `ap_pay_invoice`, `email_send`, `erp_update_item_master` | refused | block |

## Limits

- The density scales (`nmfc_2025_13`, `classic_11`) are recalled from public material and not checked against the current NMFC tariff. They matter only for density-rated items. Bellatrix does not assign NMFC items or classes.
- Dimensions are per handling unit and the units are assumed side by side; stacked or odd-shaped freight needs a person.
- Not legal or tariff advice.
