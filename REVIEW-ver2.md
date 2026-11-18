# Fairhaul freight agents: ver 2 review

Date: 2026-11-16. Goal: bring the 30 freight agents up to the bar the 30 Mythos agents reached in their ver 6.
Status: unpublished. Nothing has been pushed, published or sent.

## What ver 2 adds

| | ver 1 | ver 2 |
|---|---|---|
| Tests (all packages, core included) | 370 | 788 |
| Tests per agent | 7 to 14 | 19 to 32 |
| Eval cases | 231 | 520 |
| Eval cases per agent | 6 to 10 | 14 to 22 (median 17) |
| Tools that run with no eval case | 39 of 128 | 0 (the memory tools are covered by the core's memory tests) |
| Shared contract tests | none | 7 to 8 per agent, from `fairhaul-core/testkit` |
| Bugs found and fixed | | 42: 38 wrong results and 4 slow tools, listed below |
| International files | English only | 8 markets, 13 named export layouts, kg and km |
| Memory | none | Polaris, Aldebaran and Algol learn facts, accepted by a named person |

Mythos ver 6 for comparison: about 15 to 40 tests per agent (median about 20) and 12 to 22 eval cases (median about 14).

## How each agent is now tested

1. **Contract tests** (`packages/fairhaul-core/src/testkit.js`), the same for every agent:
   - every tool that runs has an eval case;
   - a missing or wrongly typed argument gives a readable error that names it;
   - a file outside `--root` is refused before it is read (`../`, absolute paths, `fixtures/../../`);
   - Review mode refuses writes and actions, the kill switch stops every tool, and one-click tools cannot be put on Auto;
   - a draft is approved only with its own sha256, open markers need a note, and an edited draft needs a new review;
   - the same call on the same files gives the same result;
   - a file already in the agent's own column names is read as it is.
2. **Domain tests** (`test/domain.test.js`, 6 to 8 per agent), written by hand against the agent's own rules: the edge cases a freight auditor would raise.
3. **Eval cases** (`evals/cases.json`) on the fictional fixtures: totals, every planted issue found, refused tools, invented tool names, files outside the root, Review mode, missing arguments, drafts waiting for a person, and German and Japanese versions of the main case.
4. **Repo-wide checks**:
   - `npm run intl`: every spreadsheet case again in 8 languages, legacy encodings, comma decimals, kg and km;
   - `npm run hostile:args`: planted formulas, HTML, path tricks and AI-directed text (12,794 calls, 0 findings);
   - `npm run mcp:check`: the official MCP SDK client over stdio (270 tools, 0 issues);
   - `npm run readme:check`, `plugin:check` and `release:check:offline`.

All of it passes on Node 20, 22 and 24.

## Bugs the new tests found (fixed)

**Carrier names and contract terms**

- **Core:** a carrier's aliases and SCAC now apply across every one of its contract terms.
- **Core:** carrier names with international legal forms now match (GmbH, AG, B.V., S.A., S.r.l., Ltda, Oy, K.K., Pty and others).
- **Adhara:** a carrier's aliases now apply across all its contract terms.
- **Canopus:**
  - forwarder aliases now apply across all its rate-sheet terms;
  - a lane for the specific service is preferred over a general lane.
- **Capella:** carrier terms are now matched by carrier key.
- **Polaris:** a SCAC and a full carrier name now count as the same carrier for duplicate and already-paid checks.
- **Regulus:** a carrier with several contract terms now appears once in the carrier list.
- **Rigel:** "Ridgeline Freight Inc." and "Ridgeline Freight" are now scored as one carrier.
- **Spica:** the table comparison now shows one row per carrier, the terms in force.

**Money counted twice, or in the wrong place**

- **Alnilam:**
  - who is owed now uses the notice of assignment in force on the day the money moves;
  - a payment is checked against the notice in force on its payment date.
- **Antares:** entry lines that split one invoice line are now compared once, as a group.
- **Castor:** credit notes now go on the credit side of the journal.
- **Fomalhaut:** a second invoice for the same container now counts what was already billed.
- **Mizar:** shipments already in a worthwhile consolidation are no longer counted again as heavy LTL.
- **Procyon:**
  - an invoice dated after period end is now accrued;
  - shipments are counted once each.
- **Vega:**
  - a stop's detention is allowed once across rebills;
  - a charge with no stop number is now checked against every stop on the load.

**Wrong findings**

- **Aldebaran:**
  - blocked and inactive carriers are now included in shared-detail checks;
  - each kind of signal counts once in the score.
- **Altair:** a carrier that bid twice on a lane is now counted once, at its lowest bid.
- **Arcturus:**
  - a cancelled 204 now cancels the tender;
  - an invoice on a cancelled tender is now held.
- **Betelgeuse:** a repeat charge is now an address-book fix only when a charge was not ordered.
- **Capella:** withdrawn and closed claims are no longer chased.
- **Elnath:** parcel bill-recipient and bill-sender terms are now read correctly.
- **Hadar:** dock times written as 12-hour AM/PM are now read.
- **Mira:** a failed delivery attempt is now a delay, not a delivery.
- **Nunki:** accessorial names are now matched regardless of punctuation.
- **Pollux:** freight with a zero standard cost is now flagged.
- **Shaula:**
  - tonnes and metric tons are now read;
  - an unknown unit is no longer read as pounds.
- **Sirius:**
  - a commitment with no time now runs to the end of that day;
  - economy services are no longer treated as guaranteed;
  - an adjustment-only invoice is no longer called a duplicate;
  - dimensional weight is no longer disputed without your own dimensions.

**Drafts and safety:** Aldebaran's internal note in a verification request is now an open marker, so it has to be dealt with before the request can be approved.

**Speed at 10,000 rows**

| Agent and tool | Before | After |
|---|---|---|
| Aldebaran carrier vetting | 58 s, 1.4 GB | under 1 s |
| Alnilam settlement | 56 s | 0.6 s |
| Antares entry check | 15 s | 0.3 s |
| Vega facility report | 6.4 s | 0.6 s |

Every other tool runs in under 2 seconds at 10,000 rows. The speed test (`npm run bench`) now treats tracking, PRO, B/L, RMA and container numbers as ids, the way real files do.

## Housekeeping

- Leftover Mythos names were removed from scripts, the core README and error messages.
- The MCP checklist was rewritten with the Fairhaul results.
- CI now also runs the README check and MCP conformance.
- The international check no longer re-translates cases that already read German or Japanese files.

## Still open (owner decisions)

- Publishing to GitHub and npm: not done; waiting for Francisco's go-ahead.
- Translated READMEs and sales copy were translated by Claude; a native speaker has not reviewed them yet.
- The 13 named export layouts were written from knowledge and have not been checked against vendor documentation or a live account. Each report says so.
- Real-model evaluations, with a model calling the tools, need an API key and were not run.
