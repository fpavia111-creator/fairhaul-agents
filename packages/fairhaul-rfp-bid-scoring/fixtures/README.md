# Fairhaul RFP Bid Scoring fixtures

Fictional carriers, lanes, volumes and bids.

- `lanes.csv`: six dry van lanes with annual loads, incumbent carrier and rate. One lane has no incumbent.
- `bids.csv`: fourteen bids. One carrier bids far below everyone on lane L01 (a likely error); one carrier caps its capacity on L03; lane L06 gets no bids.
- `rules.json`: no carrier above 40% of loads, keep the incumbent within 2% of the best bid, name a backup per lane.
