# Aldebaran of Carriers (`aldebaran-of-carriers`)

Checks your carrier master and booked loads for warning signs of fraud and double brokering. It looks for bank accounts, phones, emails or MC numbers shared across carriers, new authority, lapsed insurance, recent payment detail changes, free-mail contacts, and dispatch contacts on a load that differ from the master. It scores each carrier, lists the loads to hold or verify before pickup, and drafts a verification request. **A person verifies and decides.**

MIT · Node 20 or newer · local files only · built on [`lodestar-core`](../lodestar-core)

```bash
npx -y aldebaran-of-carriers demo
npx -y aldebaran-of-carriers mcp --root ./carriers
```

## Signals and weights

| Signal | Weight |
|---|---|
| `shared_bank`, `unsatisfactory_rating` | 5 |
| `duplicate_mc`, `contact_differs_on_load`, `insurance_expired` | 4 |
| `shared_phone`, `shared_email`, `bank_changed_recently` (30 days) | 3 |
| `new_authority` (180 days, adjustable), `missing_mc_dot` | 2 |
| `insurance_expiring` (30 days), `remit_to_other_name`, `free_email`, `shared_address`, `conditional_rating` | 1 |

Level: 5 or more is high, 2 to 4 medium, 1 low. Loads on high or inactive carriers are held; loads on medium carriers, or whose own contacts or dates raise a sign, are verified before pickup. A carrier not in the master is held.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `aldebaran_vet` | read | allow |
| `aldebaran_write_report` | report: `aldebaran-carriers.csv`, `.html` | allow |
| `aldebaran_draft_verification_request` | write: a request for documents, marked DRAFT, with an internal note to remove | allow |
| `aldebaran_request_send` | action (`binding_send`) | one named click, even in Auto |
| `tms_block_carrier`, `ap_change_remit_to`, `email_send` | refused | block |

## Limits

- Warning signs are not findings of fraud. Shared addresses can be a shared yard; a factoring company is normal.
- Reads only your files. It does not query government registries, insurers or any outside service. Check authority and insurance at the source.
- Verify by calling a number you already had, not one from an email or a change request.
