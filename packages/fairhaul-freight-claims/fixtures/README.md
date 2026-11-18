# Fairhaul Freight Claims fixtures

Fictional shipments, carriers, people and amounts. As of date for the demo and evals: 2026-11-16.

- `exceptions.csv`: nine exceptions. A damage claim with salvage, a shortage on a clean POD, concealed damage reported ten days after delivery (capped by the carrier's liability limit in the terms), a damage claim nine days from its deadline, one past the window, an overage, one already filed, a shortage with no goods value, and one below the minimum claim amount.
- `claims-log.csv`: five filed claims. One with no acknowledgement, one open past the expected resolution time, one short paid, one declined and one paid in full.
- `terms.json`: a 270-day window, 5 days to report concealed damage, a 75 minimum, and a 180-day window and 1000 per-shipment limit for Coastal Line Haul.
- `exports/osd-log-style.csv`: two rows with OS&D-log-style column names, US dates and currency symbols, to show the column mapping.
