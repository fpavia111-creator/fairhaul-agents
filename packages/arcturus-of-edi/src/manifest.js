import { defineManifest, MODEL_PIN, writeWorklist, refusedTools, LIMITS, toCsv, filesHash } from 'lodestar-core';
import { readFileSync } from 'node:fs';
import { readAll, tables, reconcile, tenderStats } from './edi.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'lodestar-out/arcturus';
const filesArg = { files: { type: 'array', minItems: 1, maxItems: 200, items: { type: 'string' }, description: 'X12 files under --root (.edi, .x12, .txt): any mix of 204, 210, 214, 990, 997 and 999' } };
const load = (a, ctx) => readAll(a.files.map((name) => ({ name, text: ctx.readText(name) })));
const okLine = (b) => `${b.files.length} file(s), ${b.records.length} transaction(s) read; ${b.files.filter((f) => !f.ok).length} file(s) with problems.`;

const refused = refusedTools([
  { name: 'edi_transmit', category: 'binding_send', description: 'Arcturus never sends EDI to a trading partner or VAN; your EDI provider does.' },
  { name: 'van_upload', category: 'binding_send', description: 'Arcturus never uploads to a VAN, AS2 endpoint or SFTP mailbox.' },
]);

export const manifest = defineManifest({
  name: 'arcturus-of-edi', version: pkg.version,
  description: 'Reads X12 transport files (204 load tenders, 210 freight invoices, 214 shipment status, 990 tender responses, 997/999 acknowledgements), checks envelopes, control numbers and segment counts, converts them to spreadsheets, and reconciles invoices against tenders, delivery status and partner rejections. Never transmits.',
  model: MODEL_PIN, caps: { maxSteps: 60, maxSpendUsd: 0 },
  argDocs: { tolerance: 'Amount difference ignored between an invoice and its tender, in currency units (default 1.00)' },
  prompts: [{ name: 'edi_reconcile', title: 'Read and reconcile freight EDI', description: 'Walks the host model through reading X12 transport files with Arcturus.', arguments: [{ name: 'files', description: 'Comma-separated X12 file paths under --root', required: true }], text: `You are helping an EDI or logistics analyst with arcturus-of-edi. Files: {{files}}.

Rules: Arcturus reads files only. edi_transmit and van_upload are blocked; a person resends through the EDI provider.

1. Call arcturus_inspect with the files. Report structural problems first (counts, control numbers, unclosed envelopes) with the segment number.
2. Call arcturus_reconcile and group the findings: invoices without tenders, invoices over the tender, invoices with no delivery status, tenders declined or unanswered, transactions the partner rejected.
3. Call arcturus_tender_stats when there are 990s.
4. Call arcturus_convert when the person wants spreadsheets.` }],
  tools: [
    { name: 'arcturus_inspect', kind: 'read', title: 'Check X12 structure', description: 'Detect delimiters and check ISA/IEA, GS/GE and ST/SE pairs, control numbers and counts for each file. Lists transaction sets found and every problem with its segment number.', inputSchema: { type: 'object', additionalProperties: false, required: ['files'], properties: filesArg }, handler: async (a, ctx) => { const b = load(a, ctx); return { summary: `${okLine(b)} ${b.files.map((f) => `${f.file}: ${f.ok ? 'ok' : f.error || `${f.problems.length} problem(s)`} ${f.sets ? JSON.stringify(f.sets) : ''}`).join('; ')}`, files: b.files }; } },
    { name: 'arcturus_reconcile', kind: 'read', title: 'Reconcile tenders, invoices, status and acknowledgements', description: 'Match 210 invoices to 204 tenders and 990 acceptances, compare amounts, look for 214 delivery events, and list transactions a 997/999 rejected. Each finding names the document and what to do.', inputSchema: { type: 'object', additionalProperties: false, required: ['files'], properties: { ...filesArg, tolerance: { type: 'number', minimum: 0, maximum: 1000 } } }, handler: async (a, ctx) => { const b = load(a, ctx); const r = reconcile(b.records, { tolerance: a.tolerance ?? 1 }); return { summary: `${r.tenders} tender(s), ${r.invoices} invoice(s), ${r.status_events} status event(s), ${r.responses} response(s): ${r.findings.length} finding(s) ${JSON.stringify(r.by_finding)}.`, ...r, file_problems: b.files.filter((f) => !f.ok).map((f) => ({ file: f.file, error: f.error, problems: f.problems })) }; } },
    { name: 'arcturus_tender_stats', kind: 'read', title: 'Tender acceptance by carrier', description: 'Accepted and declined 990 responses per carrier SCAC, lowest acceptance first.', inputSchema: { type: 'object', additionalProperties: false, required: ['files'], properties: filesArg }, handler: async (a, ctx) => { const s = tenderStats(load(a, ctx).records); return { summary: s.map((x) => `${x.scac}: ${x.accepted}/${x.responses} accepted (${x.acceptance_pct}%)`).join('; ') || 'No 990 responses in these files.', carriers: s }; } },
    { name: 'arcturus_convert', kind: 'report', title: 'Convert EDI to spreadsheets', description: 'Write one CSV per kind (tenders, invoices, invoice lines, status events, responses, acknowledgements) plus edi-reconcile.csv and .html into out_dir (default lodestar-out/arcturus).', inputSchema: { type: 'object', additionalProperties: false, required: ['files'], properties: { ...filesArg, out_dir: { type: 'string' } } }, handler: async (a, ctx) => { const b = load(a, ctx); const t = tables(b.records); const dir = a.out_dir || OUT; const out = ctx.outDir(dir); const written = []; for (const [k, rows] of Object.entries(t)) if (rows.length) written.push(ctx.writeFile(out, `edi-${k.replace(/_/g, '-')}.csv`, toCsv(rows, Object.keys(rows[0])))); const r = reconcile(b.records); const w = writeWorklist(ctx, dir, 'edi-reconcile', { title: 'Freight EDI reconciliation', intro: `${okLine(b)} ${r.findings.length} finding(s).`, rows: r.findings, columns: ['code', 'ref', 'amount', 'detail'], sections: [{ title: 'Files', rows: b.files.map((f) => ({ file: f.file, ok: f.ok, transactions: f.transaction_count ?? '', problems: f.error || f.problems.map((p) => `seg ${p.segment}: ${p.message}`).join('; ') })), columns: ['file', 'ok', 'transactions', 'problems'] }], limits: [LIMITS.files, 'Element positions follow the public X12 004010 structure as recalled; they were not checked against the licensed implementation guides, and trading partners differ.'] }); const all = [...written, ...w.files]; return { summary: `${written.length} CSV file(s) and the reconciliation written.`, files: all, output_sha256: filesHash(all) }; } },
    ...refused.tools,
  ],
  policy: { rules: [
    { tool: 'arcturus_inspect', decision: 'allow' }, { tool: 'arcturus_reconcile', decision: 'allow' }, { tool: 'arcturus_tender_stats', decision: 'allow' }, { tool: 'arcturus_convert', decision: 'allow' },
    ...refused.rules,
    { tool: '*', decision: 'block', reason: 'Not on the Arcturus allowlist.' },
  ] },
});
