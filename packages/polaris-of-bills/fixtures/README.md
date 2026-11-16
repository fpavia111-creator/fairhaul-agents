# Polaris fixtures

Everything here is fictional: carriers (Example Linehaul / EXLT, Sample Freightways / SMPF, Test Carrier Co / TSTC), places, rates and invoice numbers.

- `contract.json`: lanes, fuel tables, accessorial terms and a weekly diesel index.
- `contract-typo.json`: the same contract with a bad lane basis, to show the schema error.
- `invoices.csv`: eleven invoices, one row per charge line, each planted with one issue (or none).
- `shipments.csv`: BOL weights, accessorials ordered, a quote and dock times.
- `paid.csv`: one earlier payment for PRO-55505 under another invoice number.
- `invoices-210.edi`: two invoices as an X12 210 file.
- `exports/tms-freight-bills.csv`: the first eight charge lines with TMS-style column names and US dates.
