import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'lodestar-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)));
  process.stdout.write(`Arcturus of EDI demo (fictional X12 between a shipper and two carriers) in ${rt.root}\n`);
  const files = ['tenders-204.edi', 'responses-990.edi', 'status-214.edi', 'invoices-210.edi', 'ack-997.edi'];
  printStep('Check the structure of five X12 files', await rt.call('arcturus_inspect', { files }));
  printStep('A file with a wrong SE count and a wrong GE count, and a file that is not EDI', await rt.call('arcturus_inspect', { files: ['broken-210.edi', 'not-edi.txt'] }));
  const r = await rt.call('arcturus_reconcile', { files });
  printStep('Reconcile tenders, responses, status, invoices and acknowledgements', r);
  for (const f of r.result.findings) process.stdout.write(`    ${f.code.padEnd(33)} ${String(f.ref).padEnd(9)} ${f.detail}\n`);
  printStep('Tender acceptance by carrier', await rt.call('arcturus_tender_stats', { files }));
  printStep('Convert everything to spreadsheets', await rt.call('arcturus_convert', { files }));
  printStep('Agent tries to transmit EDI itself', await rt.call('edi_transmit', {}));
}
