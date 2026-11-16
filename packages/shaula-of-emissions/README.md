# Shaula of Emissions (`shaula-of-emissions`)

Estimates the greenhouse gas emissions of your shipments from weight, distance and mode, using emission factors you choose and name. It gives totals by mode, carrier, lane and customer, a data quality score and a labelled mode-shift what-if, and drafts a statement for a customer who asks. **Every figure is an estimate. Nothing is submitted anywhere.**

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y shaula-of-emissions demo
npx -y shaula-of-emissions mcp --root ./sustainability
```

## Method

kg CO2e = tonnes × km × factor (g CO2e per tonne-km) ÷ 1000.

- **You supply the factors** in a JSON file with a `source` that names where they came from. Shaula ships no official values; the demo factors are example numbers only.
- Weights in lb or kg and distances in mi or km are converted. Mode names map through `aliases`.
- A shipment with no weight, no distance or no factor for its mode is listed and left out, never guessed.
- Data quality: the share of shipments with a measured distance (`distance_source` of actual, GPS or telematics) rather than a planned one.
- The optional `shift` what-if moves long shipments in some modes to another, adding extra distance.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `shaula_estimate` | read | allow |
| `shaula_write_report` | report: `shaula-emissions.csv`, `.html` | allow |
| `shaula_draft_emissions_statement` | write: a customer statement with the method and source, marked DRAFT | allow |
| `shaula_request_send` | action (`binding_send`) | one named click, even in Auto |
| `esg_portal_submit`, `email_send` | refused | block |

## Limits

- Estimates only. Not verified or assured, not a certified footprint, and no claim of conformity with any reporting standard.
- No geocoding or routing: distances come from your files.
- Empty running, warehousing and packaging are excluded unless your factors include them.
