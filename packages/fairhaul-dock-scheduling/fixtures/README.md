# Fairhaul Dock Scheduling fixtures

A fictional distribution center with four doors and three crews, open 06:00 to 14:00.

- `dock.json`: doors D1 to D3 take dry vans, D4 takes reefer and dry. Settings for setup and minutes per pallet.
- `requests.csv`: ten requests for 2026-11-18. Two reefers compete for D4; two are floor loaded; a flatbed fits no door; a late floor load cannot finish before close.
- `history.csv`: ten past appointments in early November, with one no-show, two late arrivals and long waits at 07:00.
