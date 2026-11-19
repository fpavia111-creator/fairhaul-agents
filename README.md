# Fairhaul freight agents

Thirty small MCP agents for freight and shipping cost. Each one owns **one job**, such as auditing a freight bill, building the month-end accrual, settling carrier pay or checking a customs entry, and cannot act outside it. They read the files you already export from your TMS, ERP, WMS, carrier portals and EDI provider, write reports on your machine, and wait for a named person before anything that moves money, sends a message or changes a live system.

MIT licence · Node 20 or newer · local files only · no credentials · no dependencies

Also in: [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (translated by Claude; native review pending)

## Try one

```bash
npx -y fairhaul-freight-bill-audit demo        # freight bill audit on fictional data
npx -y fairhaul-freight-accruals demo     # month-end freight accrual on fictional data
```

Every agent has a `demo` that runs on fictional files, an `eval` that checks it against its own test cases, and an MCP server (`npx -y <agent> mcp --root <folder>`) for Claude Desktop, Claude Code, Cursor and other MCP hosts. Each agent's README lists its tools.

## The agents

**Audit what carriers bill**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairhaul-freight-bill-audit`](packages/fairhaul-freight-bill-audit) | Truckload and LTL bills (CSV, Excel or X12 210) against your contract rates, fuel table and accessorial terms; duplicates and math errors | Sending a dispute or approving payment |
| [`fairhaul-parcel-refunds`](packages/fairhaul-parcel-refunds) | UPS, FedEx, DHL and USPS invoice data: late deliveries, duplicates, surcharges, address corrections | Submitting refund claims |
| [`fairhaul-detention-and-lumper`](packages/fairhaul-detention-and-lumper) | Detention, layover and lumper charges against your dock times and free time | Sending a dispute |
| [`fairhaul-fuel-surcharges`](packages/fairhaul-fuel-surcharges) | Every fuel surcharge against the carrier's fuel table and the diesel price for the right week | Sending a dispute |
| [`fairhaul-accessorial-charges`](packages/fairhaul-accessorial-charges) | Where accessorial charges come from (liftgate, residential, limited access) and the address or order fixes that stop them | Changing addresses or order rules |
| [`fairhaul-ltl-reweighs`](packages/fairhaul-ltl-reweighs) | LTL weight and class corrections against your declared dimensions and density | Sending a challenge |
| [`fairhaul-duplicate-payments`](packages/fairhaul-duplicate-payments) | Years of freight payments for invoices paid twice, under variant numbers or two vendor records | Sending a recovery request |
| [`fairhaul-ocean-freight-audit`](packages/fairhaul-ocean-freight-audit) | Ocean invoices line by line against your service contract, surcharges and validity windows | Sending a dispute |
| [`fairhaul-air-freight-audit`](packages/fairhaul-air-freight-audit) | Air freight invoices: chargeable weight, rate breaks and surcharges | Sending a dispute |
| [`fairhaul-proof-of-delivery`](packages/fairhaul-proof-of-delivery) | Every delivered or invoiced shipment matched to its proof of delivery; what to chase and what to hold | Sending POD requests |
| [`fairhaul-container-demurrage`](packages/fairhaul-container-demurrage) | Container free time at the port and with the line, demurrage and detention exposure, charges to dispute | Sending a dispute |
| [`fairhaul-customs-entries`](packages/fairhaul-customs-entries) | Customs entry lines against commercial invoices: value, quantity, origin, duty arithmetic, codes used inconsistently. No classification advice | Sending a note to the broker |

**Plan, buy and run freight**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairhaul-rfp-bid-scoring`](packages/fairhaul-rfp-bid-scoring) | RFP bids scored lane by lane with share caps, incumbents, backups and capacity | Sending awards |
| [`fairhaul-contract-rerating`](packages/fairhaul-contract-rerating) | Your shipment history re-rated under every contract you hold, lanes ranked by money left on the table | Changing the routing guide |
| [`fairhaul-spot-quotes`](packages/fairhaul-spot-quotes) | Spot quotes on one all-in basis (fuel, accessorials, expiry, transit) | Tendering the load |
| [`fairhaul-lane-spend`](packages/fairhaul-lane-spend) | Spend by lane and mode, cost per hundredweight trends, consolidation opportunities | Sending a consolidation plan |
| [`fairhaul-carrier-scorecards`](packages/fairhaul-carrier-scorecards) | Carrier scorecards on on-time, tender acceptance, claims and cost | Sending a scorecard |
| [`fairhaul-carrier-vetting`](packages/fairhaul-carrier-vetting) | Warning signs of fraud and double brokering in the carrier master and booked loads | Sending a verification request |
| [`fairhaul-load-tracking`](packages/fairhaul-load-tracking) | Open loads with stale or late tracking, at risk of missing delivery | Sending delay notices |
| [`fairhaul-dock-scheduling`](packages/fairhaul-dock-scheduling) | A day of dock appointments across doors, crews and hours; no-shows and waits in past appointments | Publishing the schedule |
| [`fairhaul-carton-sizing`](packages/fairhaul-carton-sizing) | Every parcel's carton against its contents, dimensional weight saved by a better fit | Changing packing rules |
| [`fairhaul-edi-files`](packages/fairhaul-edi-files) | X12 204, 210, 214, 990 and 997 files read, converted and reconciled | Never transmits EDI |

**Close the books and cost the business**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`fairhaul-freight-accruals`](packages/fairhaul-freight-accruals) | Month-end freight accrual with the basis of every estimate and a draft journal | Approving the journal for posting |
| [`fairhaul-freight-allocation`](packages/fairhaul-freight-allocation) | Freight bills split across orders, customers, SKUs and cost centers, with a draft reclass journal | Approving the journal for posting |
| [`fairhaul-standard-freight-cost`](packages/fairhaul-standard-freight-cost) | Standard freight in item costs against actual freight per unit; stale standards and proposals | Loading new standards |
| [`fairhaul-freight-margins`](packages/fairhaul-freight-margins) | Freight charged to customers against what it cost; collect orders you paid, free-shipping leaks | Changing customer terms |
| [`fairhaul-broker-settlements`](packages/fairhaul-broker-settlements) | For brokers: carrier pay against rate confirmations, quick pay and notices of assignment | Releasing a payment batch |
| [`fairhaul-freight-claims`](packages/fairhaul-freight-claims) | Loss, shortage and damage claims with liability caps and filing deadlines | Filing a claim |
| [`fairhaul-returns-tracking`](packages/fairhaul-returns-tracking) | Returns from authorisation to credit, and return freight billed twice | Sending a carrier dispute |
| [`fairhaul-freight-emissions`](packages/fairhaul-freight-emissions) | Shipment emissions estimated from weight, distance and the factors you choose. Estimates only | Sending a customer statement |

## How they stay safe

- **Allowlist per agent.** Each agent can call only its own tools. Anything else is blocked, including tools a host model invents.
- **Refused tools.** Each agent names the live actions near its job (paying, emailing, changing the TMS, posting to the ledger, filing with customs) and blocks them, so a model asking for them gets a clear refusal.
- **One named click.** Approving a payment, a send, a production change or a journal waits for a named person, even in Auto mode. The approval is tied to the sha256 of the reviewed draft; if the draft changes, the approval no longer matches.
- **Audit log.** Every call is written to a hash-chained log under `.fairhaul/`, signed with an Ed25519 key when you configure one.
- **Kill switch.** `<agent> kill` stops every tool until `<agent> unkill`.
- **Hostile input tested.** Spreadsheet formulas, HTML, path tricks and text aimed at the model are planted in every agent's data in CI (`npm run hostile`).

## Use with Claude Code

This repository is a Claude Code plugin marketplace. Each agent is a plugin that starts its MCP server with `npx`:

```text
/plugin marketplace add <path or git URL of this repository>
/plugin install fairhaul-freight-bill-audit@fairhaul-freight
```

The plugins start `npx -y <agent>@<version>`, so they need that version on npm. Until then, add an agent from a local checkout:

```bash
claude mcp add fairhaul-freight-bill-audit -- node /path/to/fairhaul-agents/packages/fairhaul-freight-bill-audit/bin/fairhaul-freight-bill-audit.js mcp --root .
```

## Develop

```bash
npm ci
npm test                       # every package's tests and evals
npm run intl                   # every spreadsheet eval case in 8 languages
npm run hostile                # planted hostile inputs in every agent
npm run mcp:check              # the official MCP SDK client against every agent
npm run readme:check           # generated README sections are up to date
npm run bench                  # speed at 1,000 and 10,000 rows
npm run plugin:check           # plugin files match the packages
npm run release:check:offline  # pack contents, licences, docs and versions
node scripts/new-agent.mjs <star>-of-<word> "<description>" kw1,kw2 <module>
```

CI runs on Node 20, 22 and 24, on Linux and Windows.

## How they are tested

Each agent has hand-written tests for its own rules, the same contract tests as every other agent (arguments, files outside `--root`, Review mode, the kill switch, draft approval, repeatable results) and 14 to 22 eval cases on fictional files. Every spreadsheet case is run again as a German, French, Spanish, Brazilian, Italian, Japanese, Chinese and Korean export, and hostile data is planted in every agent's files. In total: 915 tests and 520 eval cases, passing on Node 20, 22 and 24. [REVIEW-ver3.md](REVIEW-ver3.md) lists what changed in ver 2 and the bugs the tests found.

## Limits

- Every agent works from the files you give it. None of them logs in to a carrier, TMS, ERP, bank or government system.
- Findings and estimates are only as good as those files. Each report says what it assumed.
- Not legal, tax, customs or accounting advice. People decide and act.
