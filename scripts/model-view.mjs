#!/usr/bin/env node
// What reaches the AI model, per agent: masked fields, fields sent as they are, and free text.
// Also counts the masking canaries (fictional values each agent's contract test proves never reach
// a result). Writes docs/model-view.md.   npm run model-view
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { modelView } from './lib/model-view.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const rows = []; let canaries = 0, withCanaries = 0, none = 0;
for (const n of readdirSync(PK).filter((x) => x !== 'fairhaul-core' && existsSync(join(PK, x, 'src', 'index.js'))).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const data = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8'));
  const c = (data.pii_canaries || []).length; canaries += c; if (c) withCanaries++; if (data.pii_none) none++;
  const v = modelView(manifest);
  rows.push(`| ${n.replace(/^fairhaul-/, '')} | ${v.masked.map((m) => `${m.field} (${m.label})`).join(', ') || 'none read'} | ${[...v.strict, ...v.zip].join(', ') || '-'} | ${v.clear.join(', ')} | ${v.dates.length} dates, ${v.amounts.length} amounts | ${v.free_text.join(', ') || 'none'} | ${c || 'none read'} |`);
}
const md = [
  '# What reaches the AI model (Fairhaul)', '',
  'Written by `npm run model-view` from each agent\'s own source fields and the core masker in its default mode (`--pii mask`). Every tool result passes through the masker before it leaves the agent.', '',
  '- **Masked:** names of people (parcel and return recipients, people who signed for a delivery, contacts), drivers and dispatchers (`ST-` pseudonyms), phone numbers, e-mails and street addresses (placeholders), account and routing numbers. A masked value is also replaced wherever it appears inside other text.',
  '- **Sent as they are:** carrier, vendor and lane names; PRO, BOL, load, shipment, container, invoice and tracking numbers; cities and states; dates; weights and amounts. Customer, consignee and shipper columns hold company names in these files and are sent as they are; `--pii strict` pseudonymises them and cuts postal codes to three digits.',
  '- **Free text** (charge descriptions, notes, exceptions, reasons) is sent as written, with known names and phone, e-mail and SSN patterns replaced. Anything else a person typed there reaches the model.',
  '- Results go to whatever model the user\'s AI assistant uses. For data that may not be shared with that provider, use a local model or one covered by the user\'s agreements. No claim of compliance with any law or standard is made.', '',
  `Masking canaries: ${canaries} fictional phone numbers, e-mails, addresses and signer names in ${withCanaries} agents, each proven by a contract test never to reach a result; ${none} agents read no personal column and say so.`, '',
  '| Agent | Masked | Company names and postal codes (strict only) | Ids, codes, places, businesses | Dates, amounts | Free text sent | Canaries |', '| --- | --- | --- | --- | --- | --- | --- |',
  ...rows, '',
];
mkdirSync(join(ROOT, 'docs'), { recursive: true }); writeFileSync(join(ROOT, 'docs', 'model-view.md'), md.join('\n'));
console.log(`docs/model-view.md: ${rows.length} agents, ${canaries} canaries in ${withCanaries} agents, ${none} with no personal column`);
