# Adhara fixtures

Fictional lines, contracts, ports and amounts, 2026.

- `contract.json`: Blue Meridian Line's contract (two lanes into Los Angeles, BAF, a peak season surcharge valid August to October, a documentation fee, ISPS, and origin terminal handling included in the rate) and a Northsea Container Line contract that expired on 2026-06-30.
- `ocean-invoices.csv`: six bills of lading. One matches the contract (with a "bunker recovery charge" mapped to BAF by `code_aliases`). One has ocean freight above the contract rate, a peak season surcharge after its window and origin terminal handling that is included. One has the documentation fee twice and a congestion surcharge the contract does not have. One bills ocean freight for three containers on a two-container B/L. One sailed after its contract expired, and one is billed in EUR against a USD contract.
