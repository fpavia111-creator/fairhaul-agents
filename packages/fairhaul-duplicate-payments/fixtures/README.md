# Fairhaul Duplicate Payments fixtures

Fictional carriers, invoices and payments, March 2025 to June 2026. As of date for the demo and evals: 2026-11-16.

- `payments.csv`: fifteen AP lines. Ridgeline Freight is paid for invoice INV-00418 and again as "418"; INV-00519 is paid again under a second vendor record (Ridgeline Freight Inc, V187). Coastal Line Haul bills PRO CL-55311 twice under two invoice numbers for the same amount, and PRO CL-55402 twice for different amounts (a likely balance-due bill). Prairie Express has two 1,200 invoices two days apart with no PRO, and a duplicate already refunded by credit memo CM-3101. Summit Carriers has two equal invoices for two different PROs, which are not duplicates.
