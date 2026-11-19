#!/usr/bin/env node
// Accuracy on fictional data, per agent and for the family.
//
//   node scripts/accuracy.mjs [agent ...] [--show] [--json]
//
// Each agent's fixtures/accuracy.json says:
//   case       the hand-written eval case that reads the planted fixtures
//   extract    where findings are in the result: a list of
//              { list, id: [fields], codes: "<path>", flags: { code: "<test>" }, ignore: [codes] }
//              codes paths: "status" (a string field), "findings.code" (a list of objects),
//              "flags" (a list of strings, or one string of space-separated codes)
//              flags tests: "field=value", "field>0", "field" (true), joined with "&"
//   planted    every problem planted in the fixtures, as [item id, code]; each was checked by hand
//              against the fixture rows and the "fixtures/README.md" description
//   clean      edits that turn the planted files into a clean set: drop the rows that carry a planted
//              problem, or repair one cell. The clean set must give no finding at all.
//   mutations  one fact changed in the clean set; every finding under "expect" must appear and no other.
//   not_measured  a reason, for an agent that ranks or plans rather than finds problems
//
// Recall = planted findings returned / planted findings. False positives = findings on the planted set
// that are not planted, plus findings on the clean set. The rules and these specs were written by the
// same author, so this measures the rules on known layouts, not on real exports.
// Writes docs/accuracy.md and docs/accuracy.json. Fictional data only; no network.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const { AgentRuntime, parseCsv, toCsv } = await import(pathToFileURL(join(PK, 'fairhaul-core', 'src', 'index.js')).href);
const argv = process.argv.slice(2); const only = argv.filter((a) => !a.startsWith('--')); const show = argv.includes('--show');
const all = readdirSync(PK).filter((n) => n !== 'fairhaul-core' && existsSync(join(PK, n, 'src', 'index.js'))).sort();
const agents = all.filter((n) => existsSync(join(PK, n, 'fixtures', 'accuracy.json')) && (!only.length || only.includes(n)));

const key = ([id, code]) => `${id} :: ${code}`;
const idOf = (it, f) => [].concat(f).map((k) => Array.isArray(it[k]) ? it[k].join('+') : String(it[k] ?? '')).join('/');
const test = (it, expr) => expr.split('&').every((t) => { const m = /^([a-z_0-9.]+)\s*(=|>|<)?\s*(.*)$/i.exec(t.trim()); if (!m) return false; const v = it[m[1]]; if (!m[2]) return !!v; if (m[2] === '>') return Number(v) > Number(m[3]); if (m[2] === '<') return Number(v) < Number(m[3]); return String(v) === m[3]; });
function codesAt(it, path) {
  const [a, b] = path.split('.'); const v = it[a];
  if (v === undefined || v === null || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? x[b || 'code'] : x)).filter((x) => x !== undefined && x !== null && x !== '').map(String);
  if (typeof v === 'string') return b ? [] : v.split(/\s+/).filter(Boolean);
  if (typeof v === 'object' && b) return v[b] ? [String(v[b])] : [];
  return [String(v)];
}
function findingsOf(r, spec) {
  const out = [];
  for (const ex of spec.extract) {
    for (const it of (r.result && r.result[ex.list]) || []) {
      const codes = [];
      if (ex.codes) codes.push(...codesAt(it, ex.codes));
      for (const [code, expr] of Object.entries(ex.flags || {})) if (test(it, expr)) codes.push(code);
      if (ex.code && !codes.length) codes.push(ex.code);
      for (const c of codes) if (!(ex.ignore || []).includes(c)) out.push([idOf(it, ex.id), c]);
    }
  }
  return out;
}

// Edits to the files of one case, in a sandbox root. CSV: dropWhere {column: [values]},
// set [{where: [column, value] or [[column, value], ...], column, value}]. JSON: json: { path, dropWhere, set }.
function edit(root, args, edits = []) {
  for (const e of edits) {
    const rel = args[e.arg]; if (!rel) throw new Error(`no argument "${e.arg}"`); const f = join(root, rel);
    if (e.json) {
      const j = JSON.parse(readFileSync(f, 'utf8')); const get = (o, p) => p.split('.').reduce((x, k) => x[k], o);
      const arr = e.json.path ? get(j, e.json.path) : j;
      if (e.json.dropWhere) { const [k, vals] = Object.entries(e.json.dropWhere)[0]; const keep = arr.filter((x) => !vals.includes(String(x[k]))); arr.length = 0; arr.push(...keep); }
      for (const s of e.json.set || []) { const x = s.where ? arr.find((y) => String(y[s.where[0]]) === String(s.where[1])) : j; if (!x) throw new Error(`${rel}: no entry ${s.where}`); const ks = s.key.split('.'); let o = x; for (const k of ks.slice(0, -1)) o = o[k]; o[ks.at(-1)] = s.value; }
      writeFileSync(f, JSON.stringify(j, null, 2)); continue;
    }
    const rows = parseCsv(readFileSync(f, 'utf8')); const cols = Object.keys(rows[0] || {}); let keep = rows;
    for (const [col, vals] of Object.entries(e.dropWhere || {})) { if (!cols.includes(col)) throw new Error(`${rel}: no column ${col}`); keep = keep.filter((r) => !vals.includes(String(r[col]))); }
    for (const s of e.set || []) {
      const conds = Array.isArray(s.where[0]) ? s.where : [s.where];
      const hit = keep.filter((r) => conds.every(([c, v]) => String(r[c]) === String(v)));
      if (hit.length !== 1) throw new Error(`${rel}: ${hit.length} rows match ${JSON.stringify(s.where)}`);
      if (!cols.includes(s.column)) throw new Error(`${rel}: no column ${s.column}`);
      hit[0][s.column] = s.value;
    }
    writeFileSync(f, toCsv(keep, cols, { raw: true }));
  }
}
const rowsIn = (root, args) => Object.values(args).flat().filter((v) => typeof v === 'string' && /\.csv$/i.test(v) && existsSync(join(root, v))).reduce((n, v) => n + parseCsv(readFileSync(join(root, v), 'utf8')).length, 0);

async function run(n, manifest, spec, c, edits) {
  const parent = mkdtempSync(join(tmpdir(), `acc-${n}-`)); const root = join(parent, 'root'); cpSync(join(PK, n, 'fixtures'), join(root, 'fixtures'), { recursive: true });
  try {
    edit(root, c.args, edits);
    // Masking off: findings are matched on the fixture's own ids (masking is checked by the canary tests).
    const rt = new AgentRuntime(manifest, { root, stateDir: null, audit: false, pii: 'off' });
    const r = await rt.call(c.tool, c.args); if (r.status !== 'executed') throw new Error(`${c.tool}: ${r.status} ${r.reason || ''}`);
    return { out: findingsOf(r, spec), rows: rowsIn(root, c.args) };
  } finally { rmSync(parent, { recursive: true, force: true }); }
}

const results = []; const skipped = [];
for (const n of agents) {
  const spec = JSON.parse(readFileSync(join(PK, n, 'fixtures', 'accuracy.json'), 'utf8'));
  if (spec.not_measured) { skipped.push({ agent: n, reason: spec.not_measured }); continue; }
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const c = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8')).cases.find((x) => x.id === spec.case); if (!c) throw new Error(`${n}: no eval case ${spec.case}`);
  const row = { agent: n, case: spec.case, problems: [] };
  const p = await run(n, manifest, spec, c, []); const got = new Set(p.out.map(key)); const want = new Set(spec.planted.map(key));
  if (want.size !== spec.planted.length) row.problems.push('planted list has duplicates');
  row.planted_rows = p.rows; row.planted_total = want.size; row.planted_found = [...want].filter((k) => got.has(k)).length;
  const extra = [...got].filter((k) => !want.has(k)); row.planted_extra = extra.length;
  for (const k of [...want].filter((x) => !got.has(x))) row.problems.push(`missed: ${k}`);
  for (const k of extra) row.problems.push(`not planted: ${k}`);
  const cl = await run(n, manifest, spec, c, spec.clean); row.clean_rows = cl.rows; row.clean_findings = cl.out.length;
  for (const f of cl.out) row.problems.push(`clean set: ${key(f)}`);
  row.mutations = (spec.mutations || []).length; row.mutations_caught = 0;
  for (const m of spec.mutations || []) {
    const r = await run(n, manifest, spec, c, [...spec.clean, ...m.edits]); const g = new Set(r.out.map(key)); const e = new Set(m.expect.map(key));
    const miss = [...e].filter((k) => !g.has(k)); const more = [...g].filter((k) => !e.has(k));
    if (!miss.length && !more.length) row.mutations_caught++;
    for (const k of miss) row.problems.push(`mutation "${m.name}" missed: ${k}`);
    for (const k of more) row.problems.push(`mutation "${m.name}" also gave: ${k}`);
    if (show) console.log(`   mutation ${m.name}: ${[...g].join(' | ') || '(none)'}`);
  }
  if (show) console.log(`\n## ${n}\n planted run: ${p.out.map(key).join(' | ')}\n clean run: ${cl.out.map(key).join(' | ') || '(none)'}`);
  results.push(row);
}

const sum = (k) => results.reduce((s, r) => s + (r[k] || 0), 0);
const family = { agents_measured: results.length, agents_in_family: all.length, planted_found: sum('planted_found'), planted_total: sum('planted_total'), planted_extra: sum('planted_extra'), clean_rows: sum('clean_rows'), clean_false_positives: sum('clean_findings'), mutation_cases: sum('mutations'), mutation_caught: sum('mutations_caught'), not_measured: skipped, date: new Date().toISOString().slice(0, 10) };
const md = [
  '# Fairhaul accuracy on fictional test data', '',
  `Written by \`npm run accuracy\` (scripts/accuracy.mjs) on ${family.date}. Fictional fixtures only; no real shipper, carrier or broker data. The rules and these test sets were written by the same author.`, '',
  `**Family:** ${family.agents_measured} of ${family.agents_in_family} agents measured. Planted problems found: **${family.planted_found} of ${family.planted_total}**; findings on the planted set that were not planted: **${family.planted_extra}**. Clean set: **${family.clean_rows} rows, ${family.clean_false_positives} findings** (false positives). One-fact mutations caught: **${family.mutation_caught} of ${family.mutation_cases}**.`, '',
  'Planted: every problem written into the fixtures on purpose, listed in each agent\'s `fixtures/accuracy.json` and described in its `fixtures/README.md`. Clean: the same files with those rows dropped or the one wrong cell repaired; it must give no finding. Mutation: one fact changed in the clean set; exactly the named finding must appear.', '',
  '| Agent | Planted found | Not planted | Clean rows | Clean findings | Mutations caught |', '| --- | --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.agent} | ${r.planted_found} / ${r.planted_total} | ${r.planted_extra} | ${r.clean_rows} | ${r.clean_findings} | ${r.mutations_caught} / ${r.mutations} |`),
  '', skipped.length ? `Not measured (they rank, plan or score rather than find problems; their evals check the ranking): ${skipped.map((s) => `${s.agent} (${s.reason})`).join('; ')}.` : '', '',
  results.some((r) => r.problems.length) ? '## Problems\n\n' + results.filter((r) => r.problems.length).map((r) => `- ${r.agent}: ${r.problems.join('; ')}`).join('\n') : 'No problems: every planted finding found, nothing else on the planted set, nothing on the clean set, every mutation caught.', '',
];
if (!only.length) { mkdirSync(join(ROOT, 'docs'), { recursive: true }); writeFileSync(join(ROOT, 'docs', 'accuracy.md'), md.join('\n')); writeFileSync(join(ROOT, 'docs', 'accuracy.json'), JSON.stringify({ family, agents: results }, null, 2) + '\n'); }
if (argv.includes('--json')) console.log(JSON.stringify({ family, agents: results }, null, 2));
else {
  for (const r of results) console.log(`${r.problems.length ? 'FAIL' : 'ok  '} ${r.agent.padEnd(36)} planted ${r.planted_found}/${r.planted_total} (+${r.planted_extra})  clean ${r.clean_rows} rows ${r.clean_findings} findings  mutations ${r.mutations_caught}/${r.mutations}${r.problems.length ? '\n       ' + r.problems.join('\n       ') : ''}`);
  for (const s of skipped) console.log(`skip ${s.agent.padEnd(36)} ${s.reason}`);
  console.log(`\nFamily: planted ${family.planted_found}/${family.planted_total}, not planted ${family.planted_extra}, clean ${family.clean_rows} rows ${family.clean_false_positives} findings, mutations ${family.mutation_caught}/${family.mutation_cases}; ${skipped.length} not measured`);
}
process.exitCode = results.some((r) => r.problems.length) ? 1 : 0;
