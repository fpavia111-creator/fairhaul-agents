#!/usr/bin/env node
// Helper for writing fixtures/accuracy.json: runs each agent's first hand-written eval case on its
// read tool and prints every list in the result (rows, items, ...) with each row's short fields.
// Fictional data only; no network.   node scripts/accuracy-dump.mjs [agent ...]
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const { AgentRuntime } = await import(pathToFileURL(join(PK, 'fairhaul-core', 'src', 'index.js')).href);
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
for (const n of readdirSync(PK).filter((x) => x !== 'fairhaul-core' && (!only.length || only.includes(x))).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const cases = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8')).cases.filter((c) => !/^(policy|intl|security|sec)-/.test(c.id));
  const scan = manifest.tools.find((t) => t.kind === 'read');
  const c = cases.find((x) => x.tool === scan.name);
  const r = await new AgentRuntime(manifest, { root: join(PK, n), stateDir: null, audit: false, pii: 'off' }).call(c.tool, c.args);
  console.log(`\n## ${n}  tool=${c.tool} case=${c.id} status=${r.status} args=${JSON.stringify(c.args)}`);
  for (const [k, v] of Object.entries(r.result || {})) {
    if (!Array.isArray(v)) { if (typeof v !== 'object') console.log(`  ${k} = ${JSON.stringify(v)}`); continue; }
    if (/^by_/.test(k)) continue;
    console.log(`  [${k}] ${v.length} row(s)`);
    for (const it of v.slice(0, 40)) console.log('     ', typeof it !== 'object' ? JSON.stringify(it) : JSON.stringify(Object.fromEntries(Object.entries(it).filter(([, x]) => x !== null && x !== '' && (typeof x !== 'object' || Array.isArray(x))).map(([a, x]) => [a, typeof x === 'string' && x.length > 60 ? x.slice(0, 60) + '…' : x]))));
  }
}
