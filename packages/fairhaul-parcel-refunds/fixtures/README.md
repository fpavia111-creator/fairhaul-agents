# Fairhaul Parcel Refunds fixtures

Fictional tracking numbers, addresses, invoices and terms.

- `parcel-invoices.csv`: eleven package lines across UPS and FedEx invoices, one charge per row, with a late overnight, a residential charge on a business address, a dimensional-weight overbill, a duplicate tracking number, a voided label, two address corrections to the same address, a late package whose claim window has closed, and a package with no delivery scan.
- `terms.json`, `terms-waived.json`: parcel terms (divisor, claim window, business addresses), and the same with the guarantee waived.
- `voids.csv`: one voided label.
- `exports/fedex-style-invoice.csv`: the FedEx rows with carrier-style column names. Written from knowledge of the export, not checked against a live account.
