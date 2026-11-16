# Fomalhaut of Demurrage (`fomalhaut-of-demurrage`)

Tracks each import container's free time at the port (demurrage) and with the line (detention or per diem) from your own terms. It counts the days left, prices what is accruing through your rate tiers, warns before the last free day, writes a calendar of last free days and return-by dates, checks the line's D&D invoices and drafts disputes. It never pays and never books appointments.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y fomalhaut-of-demurrage demo
npx -y fomalhaut-of-demurrage mcp --root ./imports
```

## How days are counted

- Demurrage free time starts the day after discharge (`start_offset_days`, default 1) and ends at gate out.
- Detention starts on the gate-out day and ends when the empty is returned.
- Calendar days by default; set `business_days` per clock to skip weekends. `excluded_dates` (terminal closures, holidays your agreement allows) never count.
- Chargeable days are priced through `tiers` in order, or `tiers_by_size` when the container size matches (e.g. `40HC`).

See `fixtures/terms.json` for the format.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `fomalhaut_clocks` | read | allow |
| `fomalhaut_write_report` | report: `fomalhaut-containers.csv`, `.html`, `free-time.ics` | allow |
| `fomalhaut_draft_dispute` | write: `drafts/dispute-<line>.md`, marked DRAFT | ask |
| `fomalhaut_request_send` | action (binding_send): records that the reviewed dispute (by sha256) may be sent | one named click, even in Auto |
| `ap_pay_invoice`, `terminal_book_appointment`, `email_send` | refused | block |

## Limits

- Free time and rates come from your terms file, not the line's or terminal's live tariff. Combined demurrage-and-detention clocks need two entries.
- Where the line's last free day differs from yours, Fomalhaut shows both and does not decide who is right.
- Not legal advice.
