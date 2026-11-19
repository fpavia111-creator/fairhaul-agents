#!/usr/bin/env node
// Lists, per agent, the source columns the masker treats as personal data and the fictional values
// in the fixtures that fill them. With --write it puts them in evals/cases.json as "pii_canaries"
// (each one is then proven by the contract test never to reach a result), or writes "pii_none"
// with the reason when the agent reads no such column.   node scripts/pii-canaries.mjs [--write]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PK = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages');
const { piiKindOf, parseCsv } = await import(pathToFileURL(join(PK, 'fairhaul-core', 'src', 'index.js')).href);
const write = process.argv.includes('--write');
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const FIXED = new Set(['phone', 'email', 'address', 'ssn']);

function fixtureRecords(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f); if (f === 'intl' || f === 'README.md') continue;
    if (extname(f) === '.csv') out.push(...parseCsv(readFileSync(p, 'utf8')));
    else if (extname(f) === '.json') { const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { out.push(v); Object.values(v).forEach(walk); } }; try { walk(JSON.parse(readFileSync(p, 'utf8'))); } catch { /* not JSON data */ } }
  }
  return out;
}

for (const n of readdirSync(PK).filter((x) => x !== 'fairhaul-core' && existsSync(join(PK, x, 'evals', 'cases.json'))).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const fields = new Map();
  for (const s of Object.values(manifest.sources || {})) for (const [f, fd] of Object.entries(s.fields || {})) { const kind = (fd && fd.pii) || piiKindOf(f); if (kind) fields.set(f, { kind, aliases: [f, ...((fd && fd.aliases) || [])] }); }
  const file = join(PK, n, 'evals', 'cases.json'); const data = JSON.parse(readFileSync(file, 'utf8'));
  let canaries = [];
  if (fields.size) {
    const recs = fixtureRecords(join(PK, n, 'fixtures'));
    for (const [, { kind, aliases }] of fields) {
      const keys = new Set(aliases.map(norm));
      for (const r of recs) for (const [k, v] of Object.entries(r)) if (keys.has(norm(k)) && typeof v === 'string' && v.trim().length >= 4 && !/^\d+$/.test(v.trim())) canaries.push(FIXED.has(kind) ? v.trim() : v.trim());
    }
    canaries = [...new Set(canaries)].slice(0, 6);
  }
  console.log(`${n.padEnd(36)} ${fields.size ? [...fields].map(([f, x]) => `${f}:${x.kind}`).join(', ') : '-'}  canaries: ${canaries.length ? canaries.join(' | ') : (fields.size ? 'NONE FOUND' : 'pii_none')}`);
  if (!write) continue;
  const next = { ...data };
  if (fields.size && canaries.length >= 3) { delete next.pii_none; next.pii_canaries = canaries; }
  else if (!fields.size) { delete next.pii_canaries; next.pii_none = next.pii_none || `Reads ${Object.values(manifest.sources || {}).map((s) => s.label).filter(Boolean).join(', ').toLowerCase() || 'freight files'}: carriers, loads, amounts and dates; no column holds a person's name or contact details.`; }
  else { console.log(`   ${n}: fewer than 3 canaries found; add them by hand`); continue; }
  // Keep the key order: suite, root, data_note, pii_*, cases.
  const ordered = {}; for (const k of Object.keys(next)) if (k !== 'cases') ordered[k] = next[k]; ordered.cases = next.cases;
  writeFileSync(file, JSON.stringify(ordered, null, 2) + '\n');
}
