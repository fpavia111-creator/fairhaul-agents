# Adhara of Ocean (`adhara-of-ocean`)

Audits ocean freight invoices line by line against your service contract: the base rate per container by port pair, BAF, peak season and other surcharges with their validity dates, charges the contract includes in the rate, charges the contract does not have, duplicates, and container counts against the bill of lading. It drafts disputes to the line or forwarder. It never pays or sends.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y adhara-of-ocean demo
npx -y adhara-of-ocean mcp --root ./ocean
```

## Contract format

One entry per line or forwarder: `lanes` with `pol`, `pod` (UN/LOCODE or as written on your invoices) and `rates` per container type (`20GP`, `40GP`, `40HC`...), and `surcharges` by code with `per_container` or `flat` (per B/L), optional `valid_from` and `valid_to`, or `included: true`. `code_aliases` maps your invoice wording to a code. See `fixtures/contract.json`.

Codes recognised without aliases: OFR (ocean freight), BAF, LSS, CAF, PSS (also GRI), THC_O, THC_D, DOC, ISPS, EBS, CSC, SEAL.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `adhara_audit` | read | allow |
| `adhara_write_report` | report: `adhara-ocean.csv`, `.html` | allow |
| `adhara_draft_dispute` | write: `drafts/dispute-<carrier>.md`, marked DRAFT | ask |
| `adhara_request_send` | action (binding_send): records that the reviewed dispute (by sha256) may be sent | one named click, even in Auto |
| `ap_pay_invoice`, `email_send` | refused | block |

## Limits

- Compared against your contract file, not the line's published tariff or a rate index.
- Charges in another currency are flagged, not converted.
- Demurrage and detention are handled by Fomalhaut of Demurrage.
