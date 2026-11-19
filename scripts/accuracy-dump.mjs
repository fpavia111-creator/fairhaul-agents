#!/usr/bin/env node
// Helper for writing fixtures/accuracy.json: runs each agent's first hand-written eval case on its
// read tool and prints every item (fields, no "why") with its finding code(s).
// Fictional data only; no network.   node scripts/accuracy-dump.mjs [agent ...]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const { AgentRuntime } = await import(pathToFileURL(join(PK, 'fairhaul-core', 'src', 'index.js')).href);
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
for (const n of readdirSync(PK).filter((x) => x !== 'fairhaul-core' && (!only.length || only.includes(x))).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const file = join(PK, n, 'evals', existsSync(join(PK, n, 'evals', 'own.json')) ? 'own.json' : 'cases.json');
  const cases = JSON.parse(readFileSync(file, 'utf8')).cases.filter((c) => !/^(policy|intl|security|sec)-/.test(c.id));
  const scan = manifest.tools.find((t) => t.kind === 'read');
  const c = cases.find((x) => x.tool === scan.name);
  const rt = new AgentRuntime(manifest, { root: join(PK, n), stateDir: null, audit: false });
  const r = await rt.call(c.tool, c.args);
  const items = (r.result && r.result.items) || [];
  console.log(`\n## ${n}  tool=${c.tool} case=${c.id} status=${r.status} items=${items.length} args=${JSON.stringify(c.args)}`);
  console.log('keys:', Object.keys(items[0] || {}).join(','));
  for (const it of items) console.log('  ', JSON.stringify(Object.fromEntries(Object.entries(it).filter(([k, v]) => k !== 'why' && (typeof v !== 'object' || v === null || Array.isArray(v))))));
}
