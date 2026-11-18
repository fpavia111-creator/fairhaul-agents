# Fairhaul Freight Emissions fixtures

Fictional shipments and **example factors for the demo only**. The factor values are round numbers chosen to make the demo readable. They are not taken from any published framework. Replace them with the factors your sustainability team has chosen and name that source in `source`.

- `shipments.csv`: nine shipments across truckload, LTL, parcel, ocean and air, mixing lb/kg and mi/km. S-805 has no distance; S-809 uses a mode with no factor.
- `factors.json`: grams CO2e per tonne-km by mode, aliases for mode names, and a what-if moving truckloads over 1200 km to intermodal with 15% extra distance.
