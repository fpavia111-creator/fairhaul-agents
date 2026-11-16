# Mira of Tracking (`mira-of-tracking`)

Reads your open loads and their tracking events and finds the ones that need a call: late (appointment passed, pickup missed), at risk (ETA past the appointment, delay reported), blind (stale or no tracking) and delivered but still open. It ranks carriers on tracking and drafts the delay notice to your customer. It never messages anyone and never changes your TMS.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y mira-of-tracking demo
npx -y mira-of-tracking mcp --root ./visibility
```

Tracking events can come from a visibility platform export, a carrier API dump or EDI 214 files converted with Arcturus of EDI (`arcturus_convert` writes the status events as CSV).

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `mira_assess` | read | allow |
| `mira_write_report` | report: `mira-exceptions.csv`, `.html` | allow |
| `mira_draft_delay_notice` | write: `drafts/delay_notice-<customer>.md`, marked DRAFT | ask |
| `mira_request_send` | action (binding_send): records that the reviewed notice (by sha256) may be sent | one named click, even in Auto |
| `email_send`, `sms_send`, `tms_update_status` | refused | block |

## Limits

- A snapshot of the files you give it, not live tracking. Run it again with fresh exports.
- Times are compared as written. Put every file in one time zone, or the hours will be off.
- Event wording varies by carrier; Mira recognises common words for picked up, delivered, arrived and delayed.
