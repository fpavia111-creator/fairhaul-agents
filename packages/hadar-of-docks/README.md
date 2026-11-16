# Hadar of Docks (`hadar-of-docks`)

Plans a day of dock appointments across your doors, trailer types, crews and hours. Each appointment is sized by pallets and whether the trailer is floor loaded, and requests that need another window are listed with the reason. It also reviews past appointments for no-shows, late arrivals, waits by hour and how long each kind of load really takes, so you can set slot lengths from fact. **It never books or confirms an appointment.**

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y hadar-of-docks demo
npx -y hadar-of-docks mcp --root ./receiving
```

## How the plan works

- Duration is `setup_minutes` plus pallets times `minutes_per_pallet`, or `minutes_per_floor_pallet` when floor loaded.
- Requests with the earliest window end go first; `priority` breaks ties.
- Each goes on the earliest door of its trailer type, on the `slot_minutes` grid, within its window and dock hours, while fewer than `crews` loads are being worked.
- It is a first fit, not an optimum. Move loads by hand where it helps.

`hadar_review` gives minutes per pallet by load type and the 80th percentile work time. Use them to update the dock settings.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `hadar_plan`, `hadar_review` | read | allow |
| `hadar_write_report` | report: `hadar-plan.csv`, `.html`, and with history `hadar-review.csv`, `.html` | allow |
| `hadar_draft_schedule` | write: the day's schedule for carriers, marked DRAFT | allow |
| `hadar_request_publish` | action (`binding_send`) | one named click, even in Auto |
| `yms_book_appointment`, `email_send` | refused | block |

## Limits

- Durations follow your settings, not the actual freight; check them against `hadar_review`.
- One day at a time, in local time, with no lunch breaks or shift changes.
- Labor is counted as crews working at once, not by skill or equipment.
