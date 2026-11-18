import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairhaul-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)));
  process.stdout.write(`Fairhaul EDI Files demo (fictional X12 between a shipper and two carriers) in ${rt.root}\n`);
  const files = ['tenders-204.edi', 'responses-990.edi', 'status-214.edi', 'invoices-210.edi', 'ack-997.edi'];
  printStep('Check the structure of five X12 files', await rt.call('edi_inspect', { files }));
  printStep('A file with a wrong SE count and a wrong GE count, and a file that is not EDI', await rt.call('edi_inspect', { files: ['broken-210.edi', 'not-edi.txt'] }));
  const r = await rt.call('edi_reconcile', { files });
  printStep('Reconcile tenders, responses, status, invoices and acknowledgements', r);
  for (const f of r.result.findings) process.stdout.write(`    ${f.code.padEnd(33)} ${String(f.ref).padEnd(9)} ${f.detail}\n`);
  printStep('Tender acceptance by carrier', await rt.call('edi_tender_stats', { files }));
  printStep('Convert everything to spreadsheets', await rt.call('edi_convert', { files }));
  printStep('Agent tries to transmit EDI itself', await rt.call('edi_transmit', {}));
}
