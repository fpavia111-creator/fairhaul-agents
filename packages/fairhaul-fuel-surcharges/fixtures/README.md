# Fairhaul Fuel Surcharges fixtures

Fictional carriers, invoices and diesel prices, September to November 2026.

- `contract.json`: four carriers. Ridgeline Freight and Prairie Express charge fuel as a percent of linehaul, Coastal Line Haul per mile, and Summit Carriers has no fuel table. `fuel_index` has nine weekly diesel prices; the week of 2026-11-09 is missing on purpose.
- `invoices.csv`: eleven invoices, one row per charge. Three match the table; Coastal Line Haul and Prairie Express each bill one load at a later week's price (the week they invoiced, not the week they shipped); Prairie Express bills one load above any row of its table; one Ridgeline load shipped after the last index week; one Coastal invoice has no miles; Summit bills fuel it has no table for; one Ridgeline invoice is under the table; and one carrier has no contract.
