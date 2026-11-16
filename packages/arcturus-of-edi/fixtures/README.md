# Arcturus fixtures

Fictional X12 004010 files between a shipper (SHIPPERTEST) and two carriers (EXLT, SMPF).

- `tenders-204.edi`: three load tenders, SH-1001 to SH-1003, with pickup and delivery stops.
- `responses-990.edi`: EXLT accepts SH-1001 and SH-1002, declines SH-1003; SMPF accepts SH-1003.
- `status-214.edi`: SH-1001 picked up, arrived and unloaded; SH-1002 only picked up.
- `invoices-210.edi`: INV-7101 matches its tender plus fuel; INV-7102 adds a residential charge; INV-7103 names a shipment that was never tendered.
- `ack-997.edi`: the carrier's acknowledgement of the invoice group, rejecting the third invoice.
- `broken-210.edi`: the invoice file with a wrong SE count and a wrong GE count.
- `not-edi.txt`: plain text.
