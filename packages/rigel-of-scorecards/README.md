# Rigel of Scorecards (`rigel-of-scorecards`)

Scores each carrier from your own shipment history: on-time delivery and pickup, tender acceptance, billing accuracy, claim-free loads, tracking and cost per mile. It weights them your way, ranks the carriers, shows on-time delivery by quarter and drafts the review note for a carrier. It never sends the note and never changes your routing guide.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y rigel-of-scorecards demo
npx -y rigel-of-scorecards mcp --root ./carriers
```

## How the score works

| Measure | Counts as good | Default weight | Default target |
|---|---|---|---|
| On-time delivery | delivered by the planned day, or within the grace minutes when both times are known | 30 | 95% |
| On-time pickup | the same, for pickup | 15 | 95% |
| Tender acceptance | accepted out of tenders with a response | 20 | 85% |
| Billing accuracy | billed within 2% of the expected amount | 15 | 95% |
| Claim-free loads | loads with no claim amount | 10 | 98% |
| Tracking | loads with at least one tracking update | 5 | 90% |
| Cost per mile | relative to the cheapest carrier (100 = cheapest) | 5 | none |

A measure with no data for a carrier drops out and the other weights are rescaled, so missing data never counts as a zero. Carriers with fewer than 5 loads are listed but not ranked. Change any of this in a settings file (see `fixtures/scorecard.json`).

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `rigel_score` | read | allow |
| `rigel_write_report` | report: `rigel-scorecard.csv`, `.html` | allow |
| `rigel_draft_review` | write: `drafts/review-<carrier>.md`, marked DRAFT | ask |
| `rigel_request_send` | action (binding_send): records that the reviewed note (by sha256) may be sent | one named click, even in Auto |
| `email_send`, `tms_update_routing_guide` | refused | block |

## Limits

- Scores are only as good as your TMS dates. A late delivery caused by your own dock still counts against the carrier; check late loads before you share the note.
- Cost per mile ignores lane mix, so a carrier on long lanes looks cheaper per mile.
- It does not score carriers you have no history with.
