# What reaches the AI model (Fairhaul)

Written by `npm run model-view` from each agent's own source fields and the core masker in its default mode (`--pii mask`). Every tool result passes through the masker before it leaves the agent.

- **Masked:** names of people (parcel and return recipients, people who signed for a delivery, contacts), drivers and dispatchers (`ST-` pseudonyms), phone numbers, e-mails and street addresses (placeholders), account and routing numbers. A masked value is also replaced wherever it appears inside other text.
- **Sent as they are:** carrier, vendor and lane names; PRO, BOL, load, shipment, container, invoice and tracking numbers; cities and states; dates; weights and amounts. Customer, consignee and shipper columns hold company names in these files and are sent as they are; `--pii strict` pseudonymises them and cuts postal codes to three digits.
- **Free text** (charge descriptions, notes, exceptions, reasons) is sent as written, with known names and phone, e-mail and SSN patterns replaced. Anything else a person typed there reaches the model.
- Results go to whatever model the user's AI assistant uses. For data that may not be shared with that provider, use a local model or one covered by the user's agreements. No claim of compliance with any law or standard is made.

Masking canaries: 18 fictional phone numbers, e-mails, addresses and signer names in 3 agents, each proven by a contract test never to reach a result; 27 agents read no personal column and say so.

| Agent | Masked | Company names and postal codes (strict only) | Ids, codes, places, businesses | Dates, amounts | Free text sent | Canaries |
| --- | --- | --- | --- | --- | --- | --- |
| accessorial-charges | none read | - | invoice_number, carrier, pro, bol, po, mode, origin_city, origin_state, origin_postal, dest_city, dest_state, dest_postal, currency, shipment_id, accessorials_ordered, cost_center, gl_account, status | 5 dates, 7 amounts | charge_description | none read |
| air-freight-audit | none read | - | invoice_number, forwarder, awb, origin, destination, service, charge_code, currency | 1 dates, 5 amounts | none | none read |
| broker-settlements | none read | - | load_id, carrier, pod, quick_pay, invoice_number, payee, reference, factor | 5 dates, 4 amounts | none | none read |
| carrier-scorecards | none read | - | shipment_id, carrier, tender, tracking_updates, mode | 4 dates, 4 amounts | none | none read |
| carrier-vetting | phone (phone), email (e-mail), address (street address), dispatch_phone (phone), dispatch_email (e-mail) | - | carrier_id, name, mc, dot, remit_to, bank_last4, safety_rating, status, load_id | 5 dates, 1 amounts | none | 6 |
| carton-sizing | none read | - | package_id, carton, sku | 0 dates, 8 amounts | none | none read |
| container-demurrage | none read | - | container, line, bl, size, invoice_number, charge_type | 4 dates, 2 amounts | none | none read |
| contract-rerating | none read | - | shipment_id, carrier, mode, origin_city, origin_state, origin_postal, dest_city, dest_state, dest_postal, accessorials | 1 dates, 5 amounts | none | none read |
| customs-entries | none read | - | entry_number, line, invoice_number, sku, hts, origin, currency | 1 dates, 6 amounts | none | none read |
| detention-and-lumper | none read | - | load_id, carrier, stop, charge_type, invoice_number, facility, lumper_receipt | 3 dates, 3 amounts | none | none read |
| dock-scheduling | none read | - | load_id, carrier, direction, door_type, floor_loaded, window_start, window_end, load_type | 4 dates, 2 amounts | none | none read |
| duplicate-payments | none read | - | vendor, vendor_id, invoice_number, payment_ref, pro, bol | 2 dates, 1 amounts | memo | none read |
| edi-files | none read | - |  | 0 dates, 0 amounts | none | none read |
| freight-accruals | none read | - | shipment_id, pro, bol, carrier, accessorials_ordered, origin_city, origin_state, origin_postal, dest_city, dest_state, dest_postal, mode, cost_center, gl_account, status, invoice_number, po, currency | 5 dates, 7 amounts | charge_description | none read |
| freight-allocation | none read | customer | shipment_id, invoice_number, carrier, order_id, sku, cost_center, gl_account | 1 dates, 6 amounts | none | none read |
| freight-bill-audit | none read | - | invoice_number, carrier, pro, bol, po, mode, origin_city, origin_state, origin_postal, dest_city, dest_state, dest_postal, currency, shipment_id, accessorials_ordered, cost_center, gl_account, status | 5 dates, 7 amounts | charge_description | none read |
| freight-claims | none read | - | shipment_id, pro, carrier, exception_type, noted_on_pod, claim_id, carrier_claim_number, status | 5 dates, 7 amounts | notes, decline_reason | none read |
| freight-emissions | none read | customer | shipment_id, mode, carrier, origin, destination, weight_unit, distance_unit, distance_source | 0 dates, 2 amounts | none | none read |
| freight-margins | none read | customer | order_id, shipment_id, terms | 0 dates, 4 amounts | none | none read |
| fuel-surcharges | none read | - | invoice_number, carrier, pro, bol, po, mode, origin_city, origin_state, origin_postal, dest_city, dest_state, dest_postal, currency | 3 dates, 6 amounts | charge_description | none read |
| lane-spend | none read | - | shipment_id, mode, carrier, origin_city, origin_state, origin_postal, dest_city, dest_state, dest_postal | 1 dates, 4 amounts | none | none read |
| load-tracking | none read | customer | shipment_id, carrier, status, destination, location | 4 dates, 0 amounts | event | none read |
| ltl-reweighs | none read | - | pro, carrier, shipment_id, product, certificate | 1 dates, 9 amounts | none | none read |
| ocean-freight-audit | none read | - | invoice_number, carrier, bl, pol, pod, equipment, charge_code, currency | 1 dates, 4 amounts | none | none read |
| parcel-refunds | recipient_address (street address) | recipient_postal | tracking, invoice_number, carrier, service, zone | 4 dates, 6 amounts | charge_description | 6 |
| proof-of-delivery | signed_by (person's name) | - | shipment_id, pro, carrier, invoice_number, pod_required, document | 4 dates, 3 amounts | exceptions | 6 |
| returns-tracking | none read | customer | rma, sku, tracking, status, credit_number, carrier, invoice_number | 4 dates, 5 amounts | reason, condition | none read |
| rfp-bid-scoring | none read | - | lane_id, origin, destination, incumbent, equipment, carrier | 0 dates, 4 amounts | notes | none read |
| spot-quotes | none read | - | load_id, origin, destination, equipment, accessorials, carrier, all_in, accessorials_included | 3 dates, 4 amounts | notes | none read |
| standard-freight-cost | none read | - | sku, shipment_id | 1 dates, 5 amounts | description | none read |
