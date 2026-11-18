# Fairhaul Freight Allocation fixtures

Fictional October shipments and the order lines on them.

- `freight-costs.csv`: five shipments with their freight bill. S-805 has no order lines, so its cost is not allocated and is listed as a problem.
- `order-lines.csv`: nine order lines across four customers. One line on S-803 has no weight, so that shipment is split by cube. S-804 has no pallets.
