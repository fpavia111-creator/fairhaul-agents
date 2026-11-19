# Rules and settings (Fairhaul)

Written by `npm run settings` from the agents themselves. Every day count, rate, percentage and limit below is a **working example**, not a law, a standard, or the terms of any lender, manufacturer, provider or state. They were written for version 0.1.0 (18 Nov 2026) from general knowledge of dealership practice and have not been reviewed by a dealer, controller or lawyer yet.

- **Where they live:** the default is in each agent's `src/check.js`; each one is a named argument of the agent's check tool. Tax rates, pay plans and the deal-jacket checklist additions come from the store's own files and arguments; there is no built-in tax table or pay plan.
- **How a store changes one:** pass the argument when the assistant calls the tool (or ask the assistant to always use it). Every result lists the settings it used. Defaults change only in a new release, with a CHANGELOG line.
- **Who maintains them:** Mythos Machines (Kurt Francisco Pavia) in releases; the support plan includes settings updates when a store's lender, manufacturer or state rules change.

43 settings in 31 agents.

| Agent | Setting | Default | What it is |
| --- | --- | --- | --- |
| accessorial-charges | `contract` | none | Optional freight contract JSON with accessorial rates, to find charges above the agreed amount |
| accessorial-charges | `repeat_at` | 2 | Same charge at the same location on this many invoices counts as a repeat |
| air-freight-audit | `rates` | none | Rate sheet JSON: per forwarder, lanes with weight-break rates per kg and a minimum, surcharges per kg or flat, volumetric factor |
| broker-settlements | `quick_pay_pct` | 3 | Quick-pay fee percent taken from the carrier |
| broker-settlements | `default_terms_days` | 30 | Pay terms when the rate confirmation has none |
| carrier-scorecards | `settings` | none | Optional scorecard settings JSON: weights, targets, grace minutes, billing tolerance, minimum loads to rank |
| carrier-vetting | `new_authority_days` | 180 | Authority younger than this many days is a signal |
| carton-sizing | `cartons` | none | Carton catalog JSON: carton names and inside dimensions in inches, plus divisor, padding and average cost per billable lb |
| container-demurrage | `terms` | none | Free time terms JSON per line: demurrage and detention free days, calendar or business days, tiered daily rates, excluded dates |
| contract-rerating | `contracts` | none | Freight contract JSON with every carrier you hold a contract with (the Fairhaul contract format): lanes, minimums, discounts, fuel tables, fuel index, accessorials |
| customs-entries | `correction_window_days` | none | Days after the entry date during which you can still ask for a correction, as your broker advises; leave out to skip the countdown |
| customs-entries | `tolerance_pct` | 1 | Percent difference in value to ignore |
| detention-and-lumper | `terms` | none | Optional detention terms JSON: free_hours, rate_per_hour, grace_minutes, bill_increment_minutes, max_per_stop, layover rules, per-carrier overrides |
| dock-scheduling | `dock` | none | Dock settings JSON: doors and the trailer types each takes, hours, crews, minutes per pallet |
| dock-scheduling | `date` | none | The day being planned, YYYY-MM-DD |
| duplicate-payments | `date_window_days` | 3 | Same carrier and amount with invoice dates this close counts as a low-confidence look-alike |
| edi-files | `files` | none | X12 files under --root (.edi, .x12, .txt): any mix of 204, 210, 214, 990, 997 and 999 |
| freight-accruals | `period_end` | none | Last day of the period being closed, YYYY-MM-DD |
| freight-accruals | `contract` | none | Optional freight contract JSON used to estimate shipments with no quote |
| freight-allocation | `basis` | weight | Measure to split each shipment's cost by |
| freight-allocation | `fallback` | cube, value, units; equal shares last | Measures to try, in order, when a line lacks the basis |
| freight-bill-audit | `contract` | none | Freight contract JSON (lanes, fuel table, accessorials, fuel_index); validated against the freight_contract schema |
| freight-bill-audit | `tolerance` | none | Difference ignored per check, in currency units (default: the contract tolerance, else 1.00) |
| freight-claims | `terms` | none | Optional claim terms JSON: filing window, concealed-damage report days, expected acknowledgement and resolution days, per-carrier windows and liability limits |
| freight-emissions | `factors` | none | Emission factors JSON you choose: source name, grams CO2e per tonne-km by mode, mode aliases, default units and an optional mode-shift what-if |
| freight-margins | `threshold` | none | Your free-shipping threshold in order value, if you have one |
| freight-margins | `alternatives` | none | Other thresholds to estimate, for comparison |
| freight-margins | `max_freight_pct` | 10 | Flag orders whose freight is more than this percent of order value and not fully charged |
| fuel-surcharges | `contract` | none | Freight contract JSON with each carrier's fuel table and fuel_index (weekly diesel prices you copied from your index source) |
| lane-spend | `settings` | none | Optional settings JSON: lane level, days apart that can combine, truckload rate per mile and minimum, truckload weight and pallet thresholds, truck capacity |
| lane-spend | `window_days` | none | Override: shipments this many days apart on one lane can combine |
| lane-spend | `tl_rate_per_mile` | none | Override: your typical truckload rate per mile |
| load-tracking | `stale_hours` | 4 | Hours without an update before a moving load counts as stale |
| ltl-reweighs | `terms` | none | Optional settings JSON: weight tolerance, density scale, how many repeats mean your own data is wrong |
| ocean-freight-audit | `contract` | none | Ocean contract JSON: per carrier, lanes with rates per container type, allowed surcharges with amounts and validity dates, included charges |
| parcel-refunds | `terms` | none | Optional parcel terms JSON: dim_divisor, guarantee_waived, guaranteed_services, claim_window_days, commercial_addresses |
| proof-of-delivery | `chase_after_days` | 3 | Days after delivery before a missing POD is chased |
| returns-tracking | `unused_days` | 30 | Days after authorisation with nothing received before the label counts as unused |
| returns-tracking | `credit_days` | 7 | Days after receipt by which a credit is expected |
| rfp-bid-scoring | `rules` | none | Optional award rules JSON: max share per carrier, incumbent preference, backup carriers, carriers to exclude, outlier threshold |
| spot-quotes | `settings` | none | Optional settings JSON: fuel per mile or percent for linehaul-only quotes, allowances per accessorial, history threshold |
| standard-freight-cost | `threshold_pct` | 10 | Percent difference from standard that counts as stale |
| standard-freight-cost | `min_units` | 20 | Fewest units shipped before Fairhaul Standard Freight Cost proposes a new standard |
