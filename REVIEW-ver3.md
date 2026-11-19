# Fairhaul freight agents: ver 3 review

Date: 2026-11-17. Goal: go through all 30 freight agents again against the bar the Mythos agents reached in ver 6, and go past it where that was possible.
Status: see the final pass (19 Nov 2026) at the end for the current numbers.

## Result

| | ver 2 | ver 3 |
|---|---|---|
| Tests (all packages, core included) | 788 | 915 |
| Tests per agent | 19 to 32 | 21 to 36 |
| Shared contract tests per agent | 7 to 8 | 4 more for every agent that reads spreadsheets |
| Eval cases | 520 | 520 (14 to 22 per agent) |
| Report pages | English | nine languages, for all 30 agents |
| Results that changed with the order of the rows | 12 agents | 0, tested for every agent |
| Carrier names | sister companies could merge | kept apart, tested |

All 915 tests pass on Node 20, 22 and 24. For comparison, Mythos ver 6 has 746 tests and 441 eval cases, and report pages in nine languages for two of its 30 agents.

## What ver 3 found and fixed

### 1. Carrier matching was too loose (introduced in ver 2)

Ver 2 matched carriers across spellings by dropping words such as "Freight", "Express" and legal forms wherever they stood in the name. Two things went wrong:

- "FedEx Freight" and "FedEx Express" became one carrier. They bill separately and have separate contracts.
- A legal form in the middle of a name was dropped, so "SL Green Freight" became "Green".

Ver 3 rebuilt it in the core:

- A legal form is dropped only at the end of a name, the rule Mythos ver 6 uses.
- Division words (freight, express, logistics, ground, air, ocean and others) are kept. A short name ("Ridgeline") joins a longer one ("Ridgeline Freight Inc.") only when exactly one carrier fits. When two fit, nothing is merged.
- A SCAC is matched as a SCAC.

This changed 15 agents: Adhara, Alcor, Aldebaran, Algol, Alnilam, Altair, Bellatrix, Canopus, Capella, Fomalhaut, Nunki, Rigel, Sirius, Spica and Vega use the new matching. New tests cover sister companies, legal forms inside a name and a notice of assignment filed under the full legal name.

### 2. Results depended on the order of the rows

A new experiment reversed and rotated the rows of every input file and compared the whole result. Twelve agents gave a different answer. The serious ones:

- **Polaris:** which of two invoices for one PRO was called the duplicate depended on which row came first. Now the original is the earlier invoice by date, then by number.
- **Sirius:** the same for a tracking number billed twice and for repeat address corrections.
- **Achernar:** the amount to dispute on return freight billed twice was "everything after the first row". Now it is everything after the earliest invoice. The summary also named a "costliest reason" when all were zero.
- **Antares:** which entry line was "entered twice" depended on row order. Now the earliest entry is the original.
- **Algol:** the vendor name and invoice list shown for a duplicate group changed with row order.

The others listed the same items in a different order (Adhara, Alnilam, Betelgeuse, Canopus, Hadar, Rigel, Shaula). All now sort the same way every time. Rigel's summary no longer reads "0 ranked: ." when no carrier has enough loads.

### 3. Files written differently

Four new contract tests run for every agent, on every eval case that reads a spreadsheet:

- the same file with its columns reversed, an extra unknown column, a byte-order mark and Windows line endings, spaces around values and blank lines at the end gives the same result;
- the same file with its rows reversed or rotated gives the same result, findings and wording included;
- a file with a header and no rows gets an answer or a readable error, never a crash, "NaN" or "[object Object]";
- the report page follows `--lang` and the CSV does not change.

These found one more bug: Vega's explain tool passed unknown columns from the input file through to its result.

### 4. Report pages in nine languages

`--lang` already set the approvals page. The report pages were English only, although the help text said otherwise. Now, for all 30 agents, the page title, section headings, the 70 most common column headings and the page footer follow `--lang` in English, German, French, Spanish, Brazilian Portuguese, Italian, Japanese, Simplified Chinese and Korean.

What stays in English on a translated page, and the page says so in its footer: the summary sentence, the finding sentences, codes and status values, the notes under "Limits", and column names used by a single agent. The CSV file is identical in every language, so a script reads the same columns everywhere.

Translations are Claude's. A native speaker has not reviewed them.

## Checks run for ver 3

| Check | Result |
|---|---|
| `npm test` on Node 20, 22, 24 | 915 tests, 0 failures on each |
| `npm run intl` on Node 20, 22, 24 | 305 spreadsheet cases in 8 languages; every case that passes in English passes in all |
| `npm run hostile:args` | 13,694 calls, 545 planted values, 0 findings |
| `npm run mcp:check` | 30 agents, 270 tools, 0 issues |
| `npm run plugin:check` | 61 plugin files, passes |
| `npm run readme:check` | passes |
| `npm run bench` | 65 tools at 10,000 rows; slowest 1.5 s (Vega report) |
| `npm run release:check:offline` | passes |

## Not done, and why

- **Export layouts are still unchecked against vendor documentation.** I tried to read the vendors' own pages for the FedEx Billing Online download, the UPS billing data file and the Shopify order export. This build environment blocks those sites, so all 13 named layouts stay marked "written from knowledge, not checked", and each report says so. Mythos ver 6 has 2 of 39 checked. This is the one place Fairhaul is behind.
- **The finding sentences are not translated.** Each agent builds them from the data; translating them means rewriting each agent's wording in nine languages. It is the natural next round.
- **Real-model evaluations** (a model calling the tools) need an API key and were not run.
- **The CI matrix** (Linux and Windows) has not run, because there is no GitHub repository yet. Tests were run here on Linux only.
- **No real exports.** Every file used is fictional.

## Still open (owner decisions)

- Publishing to GitHub and npm: waiting for Francisco's go-ahead.
- Prices for the five setup packages are proposals.
- Native-speaker review of the translated READMEs, sales copy and report pages.

## Final pass (19 Nov 2026)

Run on request from the main session, following `FINAL-PASS-REQUEST.md` (with its section 4 lessons) and the brief's
"Final pass" list, to bring Fairhaul up to the bar of the later families. Everything below was run on Windows 10,
Node 24.20.0, from a **fresh clone** of this folder (`git clone`, `npm install --offline`), unless it says otherwise.
Fictional data only, apart from the public files under "Real data".

### The bar, from a fresh clone

| Check | Result |
|---|---|
| Fresh clone, `npm install --offline` | 31 packages linked, no network; the working tree stays clean |
| `try_it` | `node packages/fairhaul-freight-bill-audit/bin/fairhaul-freight-bill-audit.js demo` runs offline with no setup |
| `npm test` (31 workspaces) | **953 tests, 953 pass** (915 at ver 3; masking, long-path, scaffolder-name and free-mail tests added) |
| `npm run evals` (new) | **551/551** |
| `npm run accuracy` (new) | **174/174 planted found, 0 not planted, 197 clean rows with 0 findings, 46/46 mutations caught** (26 of 30 agents) |
| `npm run hostile` | 2,763 calls, 646 planted values, **0 findings** (65 results correctly flagged for instruction-like text) |
| `npm run hostile:args` (6 workers) | 30 agents, 13,848 calls, **0 findings** (this pass is the one that would have hung on Windows before the long-path fix) |
| `npm run intl` | 30 agents, 334 cases × 8 languages: **every case that passes in English passes in every language** |
| `npm run bench` (1,000 and 10,000 rows) | 65 tools in 29 agents, **0 need attention**; median 0.65 s and slowest 2.7 s (carrier vetting) at 10,000 rows, peak 304 MB. The EDI reader has no spreadsheet input to grow and is not benched |
| `npm run release:check:offline` | **Ready to publish (dry run passed)**: git clean, secret scan 955 files clean, honest copy 94 files clean, one-click policy clean, 953 tests, 551/551 evals, hostile 0, pack of 31 packages (670 KB) with no tests, state, output, keys or `.npmrc`; npm names skipped offline |
| `readme:check`, `plugin:check` | pass on the fresh Windows clone |
| Masking canaries (contract test in all 30 agents) | 18 fictional values in 3 agents: **0 reached a result**; 27 agents read no personal column and say so |
| `npm run realdata` | see "Real data" |

### What Fairhaul lacked, and what was done

| Missing or wrong at the start of the pass | Now |
|---|---|
| **No masking at all.** Every result went to the model with recipients' names and addresses, POD signers and carrier contact phones and e-mails in clear. | `pii.js` ported from fairdrive-core into fairhaul-core and wired into every result, error and audit summary (`--pii mask\|strict\|off`, `FAIRHAUL_PII`). People are masked; company names (customer, consignee, shipper) are sent as they are because the margin, allocation and tracking answers are about them, and are pseudonymised only with `--pii strict`. Canaries in 3 agents, `pii_none` with the reason in 27; a contract test in every agent. |
| **`hostile:args` would hang on Windows** (the long-path `mkdir` found in Fairdrive). | `safePath` refuses paths over 1,024 characters or names over 255; test added. |
| Two core bugs found in Fairdrive and Fairmake: one file given for two arguments was read with the first argument's columns; a header differing only in case was read as blank. | Both fixed in fairhaul-core. |
| **The old family name was everywhere** (518 mentions of `lodestar` in 211 files): bins `lodestar-*`, MCP tools `lodestar_info` and `lodestar_inspect_input`, `LODESTAR_*` settings, `.lodestar/` state, `lodestar-out/` reports. Star names in 14 fixture notes; both scaffolders still required `<star>-of-<process>` names and the core README showed `iris-of-tests`. | All renamed to `fairhaul` (not on npm yet, so nothing breaks for users); scaffolders take `fairhaul-<job words>`; fixture notes say "for the demo". |
| No `npm run evals`, no accuracy measure, no list of what reaches the model, no list of settings, no real-data test. | `npm run evals`, `accuracy`, `model-view`, `settings`, `realdata` (docs in `docs/`). |
| Fresh Windows clones: `readme:check` and `plugin:check` compared bytes and failed on CRLF; README demo blocks printed this machine's temp folder (`C:\Users\...`); 22 plugin files and 4 README tool tables were stale. | `.gitattributes`; checks ignore CR; temp paths hidden on every OS; files regenerated. |
| No `sales/` folder, no `sales/site.json`, no pricing page and no `sample-reports/` in this repo (the site pages were built elsewhere). | `sales/final-pass.json` added. **Still missing:** `site.json`, pricing page and sample reports in this repo. |
| `scripts/make-intl-fixtures.mjs --check` stops with a TypeError on an agent with no declared sources. | **Not fixed** (it is not one of the npm scripts and does not affect `npm run intl`); noted for ver 4. |

### The final-pass list

1. **Names:** see the table above. A search for the star names and `<word>-of-<word>` finds nothing outside CHANGELOG
   rename notes and the ver 2 and ver 3 reviews.
2. **Each agent read as a buyer:** every README says what it finds, what it reads, its refused tools, and shows a
   captured demo; a generated **"What the AI model sees"** section now lists, per agent, the masked fields, the fields
   sent as they are and the free text.
3. **Honest copy:** no compliance, certification, savings or legal and tax advice claims in READMEs (9 languages),
   `docs/` or `sales/`; the release check's honest-copy scan passes. The emissions agent says its factors are example
   values and certifies nothing.
4. **Binding actions:** payments, sends, journals and filings wait for one named person even in Auto (one-click
   categories) or are refused; anything not listed is blocked. Checked by every agent's contract tests and the release
   check.
5. **Full bar from a clean install:** table above.
6. **Fixtures fictional:** carriers, shippers, people and addresses are invented ("Example Ave, Springfield",
   `555-01xx` phone numbers, `.example` domains). **Masking on:** see above.
7. **site.json and pricing page:** not in this repo (see above); `human_review` in `sales/final-pass.json` uses the five
   packages on the product page (Freight close, Carrier pay, Bill recovery, Import and ocean, Procurement).
8. **Package contents:** `npm pack` of every package has no tests, state, output or keys; `_realdata/` is git-ignored.

### Kurt's five questions

**1. Accuracy** (`npm run accuracy`, `docs/accuracy.md`, each agent's `fixtures/accuracy.json`). On fictional test data,
26 of 30 agents measured:

- **Planted problems found: 174 of 174**, and **0 findings on the planted files that were not planted**.
- **Clean set: 197 rows, 0 findings.** It is the same files with the planted rows dropped or the one wrong cell
  repaired. Statuses that mean "no action" (on track, in free time, already filed, accepted) are information, not
  findings.
- **One-fact mutations: 46 of 46 caught**, each giving exactly the named finding and nothing else.
- **Not measured:** carrier scorecards (ranks carriers), contract re-rating (prices history under each contract), RFP bid
  scoring (chooses awards) and EDI files (reads files); their evals check the ranking, prices, awards and broken files.
- Honest limits: the planted lists, clean sets and mutations were written by the same author as the rules, after the
  build, and checked by hand against each fixture README; the fixture files are small. Accuracy on real shipper and
  carrier files is **not measured yet**.

| Agent | Planted found | Clean rows / findings | Mutations |
|---|---|---|---|
| accessorial-charges | 7 / 7 | 15 / 0 | 2 / 2 |
| air-freight-audit | 6 / 6 | 12 / 0 | 2 / 2 |
| broker-settlements | 6 / 6 | 8 / 0 | 2 / 2 |
| carrier-vetting | 16 / 16 | 3 / 0 | 2 / 2 |
| carton-sizing | 6 / 6 | 3 / 0 | 2 / 2 |
| container-demurrage | 8 / 8 | 2 / 0 | 2 / 2 |
| customs-entries | 9 / 9 | 10 / 0 | 2 / 2 |
| detention-and-lumper | 9 / 9 | 13 / 0 | 2 / 2 |
| dock-scheduling | 2 / 2 | 8 / 0 | 1 / 1 |
| duplicate-payments | 6 / 6 | 7 / 0 | 1 / 1 |
| freight-accruals | 2 / 2 | 13 / 0 | 2 / 2 |
| freight-allocation | 2 / 2 | 13 / 0 | 1 / 1 |
| freight-bill-audit | 13 / 13 | 8 / 0 | 2 / 2 |
| freight-claims | 6 / 6 | 8 / 0 | 2 / 2 |
| freight-emissions | 2 / 2 | 7 / 0 | 2 / 2 |
| freight-margins | 12 / 12 | 4 / 0 | 2 / 2 |
| fuel-surcharges | 8 / 8 | 6 / 0 | 2 / 2 |
| lane-spend | 2 / 2 | 10 / 0 | 2 / 2 |
| load-tracking | 5 / 5 | 7 / 0 | 2 / 2 |
| ltl-reweighs | 7 / 7 | 1 / 0 | 1 / 1 |
| ocean-freight-audit | 8 / 8 | 4 / 0 | 1 / 1 |
| parcel-refunds | 9 / 9 | 3 / 0 | 1 / 1 |
| proof-of-delivery | 6 / 6 | 7 / 0 | 2 / 2 |
| returns-tracking | 8 / 8 | 10 / 0 | 2 / 2 |
| spot-quotes | 3 / 3 | 7 / 0 | 2 / 2 |
| standard-freight-cost | 6 / 6 | 8 / 0 | 2 / 2 |
| **Family (26 of 30 agents)** | **174 / 174** | **197 / 0** | **46 / 46** |

**2. Security: what reaches the model** (`npm run model-view`, `docs/model-view.md`, each README's "What the AI model
sees"). Masked: names of parcel and return recipients, people who signed for a delivery, contacts and drivers (`CU-`,
`ST-` pseudonyms); phones, e-mails and street addresses (placeholders); account and routing numbers. Sent as they are:
carrier, vendor and customer company names, PRO, BOL, load, container, invoice and tracking numbers, places, dates,
weights and amounts. Free text (charge descriptions, notes, exceptions) is sent with known names and phone, e-mail and
SSN patterns replaced. Carrier contact phones and e-mails are masked too, so the assistant says "the dispatch e-mail is
on your watch list" without quoting it; the report on disk shows it. Canaries: 18 fictional values in 3 agents, **0
reached a result**; 27 agents read no personal column and say so. Hostile passes: see the bar. Results go to whatever
model the user's assistant uses; for data that may not be shared with that provider, use a local model or one covered by
the user's agreements. No claim of compliance with any law or standard.

**3. Compatibility.** 13 named layouts (TMS freight bills, SAP TM settlements in English and German, FedEx Billing
Online, UPS Billing Center, ShipStation, container milestones, CBP ACE ES-003, NetSuite, QuickBooks Online, Xero, SAP
FBL1N, Shopify) plus X12 204/210/214/990/997 and the column aliases in every agent. **Tested against a real export: 0.
Checked against vendor documentation: 0. Written from knowledge of the export: all.** Real diesel prices and real carrier
records went through two agents (below), but in files this script built, not in a vendor's export layout.

**4. Commercial traction.** No paying customers; no checkout is live (the main session answers this for the suite).

**5. Support: rules that are dated settings** (`npm run settings`, `docs/settings.md`). Fairhaul has no built-in tariff:
rates, fuel tables, free time, claim windows and award rules come from the customer's own contract and terms files. 43
settings fill in what a file leaves out, for example 270 days to file a freight claim, 15 days to request a parcel
refund, 180 days for a new carrier authority, a 7-day stale fuel index. Dated rules inside the code: the **NMFC density
scale** (`nmfc_2025_13`, recalled from the 2025 NMFC density changes and not checked against the published tariff) and
the 11-tier scale it replaced. The emissions factors in the fixtures are labelled example values. **Where:** defaults in
each agent's `src/`; each is a named argument or a field in the customer's terms file. **Who maintains them:** Mythos
Machines in releases with a CHANGELOG line.

### Real data

`npm run realdata:download` fetches; `npm run realdata` runs offline; results in `docs/realdata.md` and
`docs/realdata.json`. Downloaded files stay in `_realdata/` (git-ignored, not committed).

| Source | Date | Licence | What ran and what it found |
|---|---|---|---|
| U.S. EIA weekly retail diesel price, U.S. average (FRED series GASDESW), <https://fred.stlouisfed.org/series/GASDESW> | 19 Nov 2026 | EIA data, US government work (public domain); FRED terms of use | 151 real weeks (2024-01-01 to 2026-11-16, 3.451 to 6.529 a gallon) as the fuel index of fairhaul-fuel-surcharges, with a common 1%-per-6-cents table and one test invoice each Wednesday; 7 billed at the next week's higher price, 9 at its lower price. **0 disagreements** with an independent calculation of the week, the expected amount and the status. Every real week is a Monday with no gaps. |
| FMCSA Company Census File, <https://data.transportation.gov/Trucking-and-Motorcoaches/Company-Census-File/az4n-8mr2> | 19 Nov 2026 | US government open data (no separate licence named) | 5,000 real active interstate carriers (the 2,500 newest and 2,500 registered before 2026) as the carrier master of fairhaul-carrier-vetting; only DOT number, name, phone, e-mail, registration date, state, rating and docket were downloaded. **Found a bug:** the free-mailbox list missed comcast.net, live.com, ymail.com, msn.com and att.net (31 carriers in the first sample). Widened and tested. After the fix, shared phones (22), free mailboxes (3,954) and new authorities (2,500) all agree with an independent count, 0 differences. Two carriers with one phone and the same company name are, by design, not a signal. |

**Nothing public fits** the other agents: no TMS, carrier invoice, parcel, ocean, air, customs, ERP or warehouse export is
published in a real layout. IFTA tax rates and FMCSA inspection data were considered; no Fairhaul agent reads them.

### Decide (Kurt)

1. **Format labels on the site:** all 13 layouts and X12 are "written from knowledge of the export; not yet checked
   against documentation or a real export".
2. **First real exports**, with a shipper's or broker's written permission (one TMS freight bill export, one UPS or FedEx
   billing file, one ocean invoice set), to turn "written from knowledge" into "tested" and measure accuracy on them.
3. **Company names reach the model** by default (customers, consignees, shippers); people do not. Keep, or mask
   company names by default (`--pii strict` behaviour) at the cost of answers like "worst margin: CO-1a2b3c4d".
4. **The product page** lists "Quote check: what was quoted against what was billed" and "Landed cost"; the agents are
   spot-quote comparison before booking (`fairhaul-spot-quotes`) and standard freight cost per SKU
   (`fairhaul-standard-freight-cost`). The main session may want to align the wording.
5. **sales/site.json, pricing page and sample reports** for this repo, if the site build expects them here.
