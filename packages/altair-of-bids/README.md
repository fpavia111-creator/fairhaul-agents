# Altair of Bids (`altair-of-bids`)

Scores carrier bids from a freight RFP lane by lane against your incumbent rates and volumes. It builds an award scenario with your rules, flags bids that look like errors, shows savings, carrier shares and lanes nobody covered, and drafts the award letters. It never loads rates into your TMS and never sends awards.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y altair-of-bids demo
npx -y altair-of-bids mcp --root ./rfp
```

## Award rules

| Rule | Default | Effect |
|---|---|---|
| `max_share_pct` | 100 | No carrier gets more than this share of all annual loads |
| `prefer_incumbent_pct` | 0 | Keep the incumbent when its bid is within this percent of the best |
| `backup` | true | Name the next eligible carrier as backup on each lane |
| `exclude` | none | Carriers not to award |
| `outlier_pct` | 25 | A bid this far below the lane median (with 3 or more bids) is flagged and not awarded |

Bid capacity splits a lane across carriers. Lanes are awarded in order of the savings they offer, so a share cap falls on the later lanes. Run it with different rules and compare.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `altair_award` | read | allow |
| `altair_write_report` | report: `altair-award.csv`, `.html` | allow |
| `altair_draft_award` | write: `drafts/award-<carrier>.md`, marked DRAFT | ask |
| `altair_request_send` | action (binding_send): records that the reviewed letter (by sha256) may be sent | one named click, even in Auto |
| `tms_load_rates`, `email_send` | refused | block |

## Limits

- Savings assume your estimated volumes move at the bid rates. Rates are compared per load; it does not convert per-mile bids.
- The award is a starting point for a person's decision, not an optimal solver.
