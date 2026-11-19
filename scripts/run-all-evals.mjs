#!/usr/bin/env node
// Runs every agent's eval cases (`<agent> eval`) and prints the totals.   npm run evals [-- agent ...]
// Fictional fixtures only; no network.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PK = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let pass = 0, total = 0; const fail = [];
for (const n of readdirSync(PK).filter((x) => x !== 'fairhaul-core' && existsSync(join(PK, x, 'bin', `${x}.js`)) && (!only.length || only.includes(x))).sort()) {
  const r = spawnSync(process.execPath, [join('bin', `${n}.js`), 'eval'], { cwd: join(PK, n), encoding: 'utf8' });
  const last = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').pop() || '';
  const m = /(\d+)\/(\d+)/.exec(last);
  if (!m) { fail.push(`${n}: no eval result`); console.log(`FAIL ${n}: no eval result`); continue; }
  pass += +m[1]; total += +m[2];
  const ok = m[1] === m[2] && r.status === 0; if (!ok) fail.push(`${n}: ${m[1]}/${m[2]}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n.padEnd(42)} ${m[1]}/${m[2]}`);
}
console.log(`\n${pass}/${total} eval cases pass${fail.length ? `; failing: ${fail.join(', ')}` : ''}`);
process.exitCode = fail.length ? 1 : 0;
