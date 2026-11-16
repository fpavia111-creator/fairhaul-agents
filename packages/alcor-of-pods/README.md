# Alcor of PODs (`alcor-of-pods`)

Matches every delivered or invoiced load to its proof of delivery. It flags missing, unsigned, short and exception-noted PODs and delivery dates that disagree with the invoice, lists the invoices to hold for review, scores carriers on how fast and how cleanly they send PODs, and drafts POD requests. It never holds, releases or pays an invoice and never sends anything.

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y alcor-of-pods demo
npx -y alcor-of-pods mcp --root ./pods
```

## Statuses

| Status | When |
|---|---|
| `ok` | Signed POD, pieces and date match, no exceptions |
| `chase` | No POD more than 3 days (configurable) after delivery |
| `waiting` | No POD yet, still within the wait period |
| `claim_review` | The POD shows fewer pieces or a receiver's exception note; see Capella of Claims |
| `fix` | Unsigned, or the POD's delivery date differs from the invoice's |

An invoiced load that is missing its POD, unsigned, short or exception-noted is marked `hold_invoice` for a person to review.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `alcor_match` | read | allow |
| `alcor_write_report` | report: `alcor-pods.csv`, `.html` | allow |
| `alcor_draft_pod_request` | write: `drafts/pod_request-<carrier>.md`, marked DRAFT | ask |
| `alcor_request_send` | action (binding_send): records that the reviewed request (by sha256) may be sent | one named click, even in Auto |
| `ap_hold_invoice`, `ap_release_payment`, `email_send` | refused | block |

## Limits

- Alcor reads a POD log (the fields your document system or carrier portal exports), not the images. A person should look at the POD itself before an invoice is released or disputed.
- Matching is by PRO and shipment id.
