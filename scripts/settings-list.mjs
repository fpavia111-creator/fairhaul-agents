#!/usr/bin/env node
// Every rule an agent applies that a store may need to change: each setting of each read tool, its
// default and where it lives. Writes docs/settings.md.   npm run settings
// None of these is a law, standard or vendor term built into the code: they are working examples,
// written for version 0.1.0 on 18 Nov 2026 and not reviewed by a dealer, controller or lawyer yet.
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const FILE_ARGS = new Set(['as_of', 'out_dir', 'lang', 'format']);
const rows = []; let n = 0;
for (const a of readdirSync(PK).filter((x) => x !== 'fairhaul-core' && existsSync(join(PK, x, 'src', 'index.js'))).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, a, 'src', 'index.js')).href);
  const scan = manifest.tools.find((t) => t.kind === 'read');
  const files = new Set(Object.values(manifest.sources || {}).flatMap((s) => s.args));
  for (const [k, p] of Object.entries(scan.inputSchema.properties || {})) {
    if (files.has(k) || FILE_ARGS.has(k)) continue;
    const def = /\(default ([^)]*)\)/i.exec(p.description || '');
    rows.push(`| ${a.replace(/^fairhaul-/, '')} | \`${k}\` | ${def ? def[1] : (p.default !== undefined ? JSON.stringify(p.default) : 'none')} | ${(p.description || '').replace(/\s*\(default [^)]*\)/i, '').replace(/\|/g, '/')} |`); n++;
  }
  for (const k of files) if (/rates|plans|requirements/.test(k)) { rows.push(`| ${a.replace(/^fairhaul-/, '')} | \`${k}\` (file) | the store's own file | ${(scan.inputSchema.properties[k] || {}).description || ''} |`); n++; }
}
const md = [
  '# Rules and settings (Fairhaul)', '',
  'Written by `npm run settings` from the agents themselves. Every day count, rate, percentage and limit below is a **working example**, not a law, a standard, or the terms of any lender, manufacturer, provider or state. They were written for version 0.1.0 (18 Nov 2026) from general knowledge of dealership practice and have not been reviewed by a dealer, controller or lawyer yet.', '',
  '- **Where they live:** the default is in each agent\'s `src/check.js`; each one is a named argument of the agent\'s check tool. Tax rates, pay plans and the deal-jacket checklist additions come from the store\'s own files and arguments; there is no built-in tax table or pay plan.',
  '- **How a store changes one:** pass the argument when the assistant calls the tool (or ask the assistant to always use it). Every result lists the settings it used. Defaults change only in a new release, with a CHANGELOG line.',
  '- **Who maintains them:** Mythos Machines (Kurt Francisco Pavia) in releases; the support plan includes settings updates when a store\'s lender, manufacturer or state rules change.', '',
  `${n} settings in 31 agents.`, '',
  '| Agent | Setting | Default | What it is |', '| --- | --- | --- | --- |', ...rows, '',
];
mkdirSync(join(ROOT, 'docs'), { recursive: true }); writeFileSync(join(ROOT, 'docs', 'settings.md'), md.join('\n'));
console.log(`docs/settings.md: ${n} settings`);
