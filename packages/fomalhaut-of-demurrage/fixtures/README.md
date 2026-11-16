# Fomalhaut fixtures

Fictional lines, containers and charges. As of date for the demo and evals: 2026-11-16 (a Monday). 2026-11-11 is a terminal closure that does not count.

- `terms.json`: Blue Meridian Line (4 calendar days at the port with tiered rates, higher for 40HC; 4 days detention) and Northsea Container Line (5 business days at the port; 7 days detention).
- `containers.csv`: seven containers. One at its last free day today; one accruing demurrage at the port; one out but not yet returned, accruing detention; one whose line shows a last free day earlier than the business-day terms give; one returned and closed; one just discharged; one from a line with no terms on file.
- `charges.csv`: four D&D charges. The line counts the closure day on one, bills two extra detention days on another, one matches, and one cannot be checked.
