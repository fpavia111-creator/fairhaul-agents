# Fairhaul Customs Entries fixtures

Fictional entries from a fictional broker, and the commercial invoices behind them. Use as of 2026-11-16 with a 300-day correction window.

- `entries.csv`: three entries.
  - ABC-1001001-1 is 8 days from the end of the window.
  - ABC-1002002-2 has a euro invoice entered below its converted value, and a duty figure that does not match its rate.
  - ABC-1003003-3 has bookends entered with the wrong quantity, value and origin, and repeats a mirror line from the first entry at a different rate.
- `commercial-invoices.csv`: the invoices. PLANTER is on CI-2201 but on no entry. LAMP-SHADE appears under two tariff codes.
