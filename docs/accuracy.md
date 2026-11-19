# Fairhaul accuracy on fictional test data

Written by `npm run accuracy` (scripts/accuracy.mjs) on 2026-11-19. Fictional fixtures only; no real shipper, carrier or broker data. The rules and these test sets were written by the same author.

**Family:** 26 of 30 agents measured. Planted problems found: **174 of 174**; findings on the planted set that were not planted: **0**. Clean set: **197 rows, 0 findings** (false positives). One-fact mutations caught: **46 of 46**.

Planted: every problem written into the fixtures on purpose, listed in each agent's `fixtures/accuracy.json` and described in its `fixtures/README.md`. Clean: the same files with those rows dropped or the one wrong cell repaired; it must give no finding. Mutation: one fact changed in the clean set; exactly the named finding must appear.

| Agent | Planted found | Not planted | Clean rows | Clean findings | Mutations caught |
| --- | --- | --- | --- | --- | --- |
| fairhaul-accessorial-charges | 7 / 7 | 0 | 15 | 0 | 2 / 2 |
| fairhaul-air-freight-audit | 6 / 6 | 0 | 12 | 0 | 2 / 2 |
| fairhaul-broker-settlements | 6 / 6 | 0 | 8 | 0 | 2 / 2 |
| fairhaul-carrier-vetting | 16 / 16 | 0 | 3 | 0 | 2 / 2 |
| fairhaul-carton-sizing | 6 / 6 | 0 | 3 | 0 | 2 / 2 |
| fairhaul-container-demurrage | 8 / 8 | 0 | 2 | 0 | 2 / 2 |
| fairhaul-customs-entries | 9 / 9 | 0 | 10 | 0 | 2 / 2 |
| fairhaul-detention-and-lumper | 9 / 9 | 0 | 13 | 0 | 2 / 2 |
| fairhaul-dock-scheduling | 2 / 2 | 0 | 8 | 0 | 1 / 1 |
| fairhaul-duplicate-payments | 6 / 6 | 0 | 7 | 0 | 1 / 1 |
| fairhaul-freight-accruals | 2 / 2 | 0 | 13 | 0 | 2 / 2 |
| fairhaul-freight-allocation | 2 / 2 | 0 | 13 | 0 | 1 / 1 |
| fairhaul-freight-bill-audit | 13 / 13 | 0 | 8 | 0 | 2 / 2 |
| fairhaul-freight-claims | 6 / 6 | 0 | 8 | 0 | 2 / 2 |
| fairhaul-freight-emissions | 2 / 2 | 0 | 7 | 0 | 2 / 2 |
| fairhaul-freight-margins | 12 / 12 | 0 | 4 | 0 | 2 / 2 |
| fairhaul-fuel-surcharges | 8 / 8 | 0 | 6 | 0 | 2 / 2 |
| fairhaul-lane-spend | 2 / 2 | 0 | 10 | 0 | 2 / 2 |
| fairhaul-load-tracking | 5 / 5 | 0 | 7 | 0 | 2 / 2 |
| fairhaul-ltl-reweighs | 7 / 7 | 0 | 1 | 0 | 1 / 1 |
| fairhaul-ocean-freight-audit | 8 / 8 | 0 | 4 | 0 | 1 / 1 |
| fairhaul-parcel-refunds | 9 / 9 | 0 | 3 | 0 | 1 / 1 |
| fairhaul-proof-of-delivery | 6 / 6 | 0 | 7 | 0 | 2 / 2 |
| fairhaul-returns-tracking | 8 / 8 | 0 | 10 | 0 | 2 / 2 |
| fairhaul-spot-quotes | 3 / 3 | 0 | 7 | 0 | 2 / 2 |
| fairhaul-standard-freight-cost | 6 / 6 | 0 | 8 | 0 | 2 / 2 |

Not measured (they rank, plan or score rather than find problems; their evals check the ranking): fairhaul-carrier-scorecards (ranks carriers on several measures; its evals check the ranking and the measures); fairhaul-contract-rerating (prices past shipments under every contract; its evals check the prices); fairhaul-edi-files (reads and validates EDI files; its evals check broken and non-EDI files); fairhaul-rfp-bid-scoring (chooses awards under your rules; its evals check the awards).

No problems: every planted finding found, nothing else on the planted set, nothing on the clean set, every mutation caught.
