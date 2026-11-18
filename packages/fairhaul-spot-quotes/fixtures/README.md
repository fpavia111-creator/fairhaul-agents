# Fairhaul Spot Quotes fixtures

Fictional loads, carriers and quotes. As of date for the demo and evals: 2026-11-16.

- `loads.csv`: five loads needing a truck, with the delivery date, miles, accessorials and what the lane usually costs.
- `quotes.csv`: eight quotes. On Q-701 the lowest number is linehaul only and costs more all-in, and the next is expired. On Q-702 the cheaper quote misses the delivery date and the one left is well above the lane history. On Q-703 the cheaper quote leaves out tarping. Q-704's only quote has expired, and Q-705 has none.
- `settings.json`: fuel per mile for linehaul-only quotes, allowances for tarping and liftgate, and the history threshold.
