# Canopus fixtures

Fictional forwarder, airports pairs, rates and amounts, autumn 2026.

- `rates.json`: one forwarder's rate sheet with weight breaks on two lanes, a minimum charge per lane, fuel and security surcharges per chargeable kilo, screening per actual kilo and a flat AWB fee.
- `air-invoices.csv`: five air waybills. One matches. One is volumetric (2.4 m³ outweighs 180 kg) and billed at a lighter break's higher rate. One is billed on 300 kg when it is 260 kg chargeable, with fuel on the wrong weight. One misses the break point (90 kg costs less charged as 100 kg at the +100 rate). One is at the minimum charge with a handling fee not on the rate sheet.
