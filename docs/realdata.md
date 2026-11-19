# Fairhaul on public real data

Written by `node scripts/realdata.mjs` on 2026-11-19 from files downloaded 2026-11-19 into `_realdata/` (git-ignored; `--download` fetches them again). Public data only.

## Sources

- **U.S. EIA weekly retail diesel price (No. 2, U.S. average), via FRED series GASDESW**: <https://fred.stlouisfed.org/series/GASDESW>. Licence: EIA data, US government work (public domain); FRED terms of use.
- **FMCSA Company Census File**: <https://data.transportation.gov/Trucking-and-Motorcoaches/Company-Census-File/az4n-8mr2>. Licence: US government open data (data.transportation.gov; the dataset metadata names no separate licence). Downloaded: DOT number, legal name, phone, e-mail, registration date, state, safety rating and docket number of the 5000 most recently registered active interstate carriers; no officer names.

## Results

- **fairhaul-fuel-surcharges with the real diesel index** (151 weeks, 2024-01-01 to 2026-11-16, 3.451 to 6.529 a gallon; a 1%-per-6-cents table): 151 fictional invoices, one shipping each Wednesday. 7 were billed at the next week's higher price and 9 at its lower price (the other weeks of that kind fell in the same band, so the bill was right). Agent statuses: ok 135, wrong_week 7, fuel_under 9. **Disagreements with the independent calculation (week, expected amount and status): 0.**
- **fairhaul-carrier-vetting on 5000 real carriers** (registered 2025-12-16 to 2026-11-17): carriers sharing a phone with another 22 (independent count 22; agent only 0, independent only 0); free mailboxes 3954 (independent count 3954; agent only 0, independent only 0); authority under 180 days 2500 (independent count 2500; agent only 0, independent only 0). Levels: high 13, medium 2505, low 1952, none 530. These are signals to check, not findings of fraud: many real carriers share a phone with a related company, and a new registration is normal.

## What this does not show

- No shipper, carrier, broker, TMS, parcel, ocean, air, customs or warehouse export was read: none is published. The invoices in the fuel run and the loads in the vetting run are fictional; only the diesel prices and the carrier records are real.
- IFTA tax rates and FMCSA inspection data were looked at; no Fairhaul agent reads them (there is no IFTA or safety-score agent), so they were not run.
