# Lodestar freight agents: ver 3 review

Date: 2026-11-17. Goal: go through all 30 freight agents again against the bar the Mythos agents reached in ver 6, and go past it where that was possible.
Status: unpublished. Nothing has been pushed, published or sent.

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

- **Export layouts are still unchecked against vendor documentation.** I tried to read the vendors' own pages for the FedEx Billing Online download, the UPS billing data file and the Shopify order export. This build environment blocks those sites, so all 13 named layouts stay marked "written from knowledge, not checked", and each report says so. Mythos ver 6 has 2 of 39 checked. This is the one place Lodestar is behind.
- **The finding sentences are not translated.** Each agent builds them from the data; translating them means rewriting each agent's wording in nine languages. It is the natural next round.
- **Real-model evaluations** (a model calling the tools) need an API key and were not run.
- **The CI matrix** (Linux and Windows) has not run, because there is no GitHub repository yet. Tests were run here on Linux only.
- **No real exports.** Every file used is fictional.

## Still open (owner decisions)

- Publishing to GitHub and npm: waiting for Francisco's go-ahead.
- Prices for the five setup packages are proposals.
- Native-speaker review of the translated READMEs, sales copy and report pages.
