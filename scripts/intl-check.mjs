#!/usr/bin/env node
// International check: every agent's eval cases, run again on its fixtures as
// they would arrive from Germany, France, Spain, Brazil, Italy, Japan, China and Korea.
//
//   node scripts/intl-check.mjs [agent ...] [--lang de,ja] [--verbose]
//
// For each language the CSV fixtures an eval case reads are rewritten the way a
// local export writes them: column names from the agent's own dictionary entry in
// that language, day-first or year-first dates, comma decimals, kilograms and
// kilometres instead of pounds and miles, semicolons, and the usual legacy text
// encoding (Windows-1252, Shift_JIS, GBK, EUC-KR). Values are not translated.
// Every case that passes in English must pass the same way.
//
// A column with no word in the dictionary keeps its English name, and the report
// counts how many columns were translated, so coverage is visible. Exit code 1
// when any case passes in English and fails in another language.

import { readdirSync, readFileSync, writeFileSync, cpSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runEvals, parseCsv, normHeader, namesFor, conceptOf, kindsByArg, DEFAULT_UNITS } from '../packages/lodestar-core/src/index.js';
import { encodeText } from './lib/encode.mjs';

const PK = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages');
const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose'); const showMissing = argv.includes('--missing'); const missing = new Map();
const li = argv.indexOf('--lang'); const langArg = li >= 0 ? argv[li + 1] : null;
const only = argv.filter((a, i) => !a.startsWith('--') && (li < 0 || i !== li + 1));
const agents = readdirSync(PK).filter((n) => n !== 'lodestar-core' && existsSync(join(PK, n, 'src', 'manifest.js')) && (!only.length || only.includes(n))).sort();

// How each market writes a file. Dates: d = day-first with the separator, y = year-first.
const MARKETS = {
  de: { enc: 'windows-1252', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}.${m}.${y}`, unitInName: true },
  fr: { enc: 'utf-8-bom', sep: ';', dec: ',', grp: ' ', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true },
  es: { enc: 'utf-8', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true, unitInName: true },
  pt: { enc: 'utf-8', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true },
  it: { enc: 'utf-8', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true, unitInName: true },
  ja: { enc: 'shift_jis', sep: ',', dec: '.', grp: ',', date: (y, m, d) => `${y}/${m}/${d}` },
  zh: { enc: 'gbk', sep: ',', dec: '.', grp: ',', date: (y, m, d) => `${y}-${m}-${d}`, unitInName: true },
  ko: { enc: 'euc-kr', sep: ',', dec: '.', grp: ',', date: (y, m, d) => `${y}.${m}.${d}` },
};
const LANGS = langArg ? langArg.split(',') : Object.keys(MARKETS);
const TO_METRIC = { lb: ['kg', 0.45359237], mi: ['km', 1.609344], in: ['cm', 2.54] };
const unitOf = (f, fd) => (fd && fd.unit === false ? null : (fd && fd.unit) || DEFAULT_UNITS[f] || null);

const walk = (v, out = []) => { if (typeof v === 'string') { if (/\.csv$/i.test(v)) out.push(v); } else if (Array.isArray(v)) v.forEach((x) => walk(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, out)); return out; };
const argFiles = (args) => Object.entries(args || {}).flatMap(([a, v]) => walk(v).map((f) => [a, f]));

function fmtNumber(s, mk, decimals) {
  const n = Number(s); if (!Number.isFinite(n)) return s;
  const neg = n < 0; const fixed = Math.abs(n).toFixed(decimals);
  const [i, f] = fixed.split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, mk.grp);
  return (neg ? '-' : '') + grouped + (f ? mk.dec + f : '');
}
function fmtDate(s, mk) {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})( \d{1,2}:\d{2})?$/.exec(String(s).trim()); // the English fixtures write US dates too
  if (us) return mk.date(us[3], us[1].padStart(2, '0'), us[2].padStart(2, '0')) + (us[4] || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(String(s).trim());
  if (!m || m[5]) return s; // keep zoned timestamps exactly
  return mk.date(m[1], m[2], m[3]) + (m[4] ? ` ${m[4]}` : '');
}
const quote = (v, sep) => { const s = String(v ?? ''); return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Rewrite one CSV for a language. Returns { text, translated, columns }. */
function localise(csvText, def, lang) {
  const mk = MARKETS[lang]; const rows = parseCsv(csvText); if (!rows.length) return null;
  const headers = Object.keys(rows[0]); const fields = def.fields || {};
  const english = new Set(); for (const [f, fd] of Object.entries(fields)) { english.add(normHeader(f)); for (const a of (fd && fd.aliases) || []) english.add(normHeader(a)); }
  // Same order as the adapter: a field's own name first, then its aliases, one column per field.
  const owner = new Map(); const taken = new Set();
  for (const [f] of Object.entries(fields)) { const h = headers.find((x) => normHeader(x) === normHeader(f)); if (h !== undefined) { owner.set(h, f); taken.add(f); } }
  for (const [f, fd] of Object.entries(fields)) { if (taken.has(f)) continue; for (const a of (fd && fd.aliases) || []) { const h = headers.find((x) => !owner.has(x) && normHeader(x) === normHeader(a)); if (h !== undefined) { owner.set(h, f); taken.add(f); break; } } }
  const fieldOf = (h) => (owner.has(h) ? [owner.get(h), fields[owner.get(h)] || {}] : [null, null]);
  const used = new Set(); const plan = []; let translated = 0;
  for (const h of headers) {
    const [f, fd] = fieldOf(h); let name = h; let unit = null;
    if (f) {
      const word = namesFor(conceptOf(f, fd), lang).find((w) => !english.has(normHeader(w)) && !used.has(normHeader(w)));
      if (word) { name = word; used.add(normHeader(word)); translated++; } else if (lang === 'de') missing.set(f, (missing.get(f) || 0) + 1);
      const u = unitOf(f, fd);
      if (u && TO_METRIC[u] && (fd.type === 'number' || fd.type === 'money')) { unit = TO_METRIC[u]; if (word && mk.unitInName) name = `${word} (${unit[0]})`; if (!word) name = `${h} (${unit[0]})`; }
    }
    plan.push({ h, name, fd: fd || {}, unit });
  }
  const lines = [plan.map((p) => quote(p.name, mk.sep)).join(mk.sep)];
  for (const r of rows) lines.push(plan.map((p) => {
    let v = r[p.h]; const s = String(v ?? '').trim();
    if (s === '') return '';
    const type = p.fd.type;
    if (type === 'date' || type === 'datetime') v = fmtDate(s, mk);
    else if ((type === 'money' || type === 'number') && /^-?\d+(\.\d+)?$/.test(s)) {
      if (p.unit) v = fmtNumber(String(Number(s) * p.unit[1]), mk, 4);
      else v = fmtNumber(s, mk, type === 'money' ? 2 : (s.split('.')[1] || '').length);
    }
    return quote(v, mk.sep);
  }).join(mk.sep));
  return { text: lines.join('\r\n') + '\r\n', translated, columns: headers.length };
}

const strip = (o) => JSON.parse(JSON.stringify(o));
let regressions = 0; const summary = [];
for (const n of agents) {
  const manifest = (await import(pathToFileURL(join(PK, n, 'src', 'manifest.js')).href)).manifest;
  const data = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8')); const cases = data.cases || data;
  const csvCases = cases.filter((c) => argFiles(c.args).length);
  if (!csvCases.length) { summary.push({ agent: n, cases: 0 }); continue; }
  const base = await runEvals(manifest, strip(csvCases), { root: join(PK, n) });
  const passedEn = new Set(base.results.filter((r) => r.pass).map((r) => r.id));
  const row = { agent: n, cases: csvCases.length, english: passedEn.size, columns: 0, translated: 0, langs: {} };
  for (const lang of LANGS) {
    const parent = mkdtempSync(join(tmpdir(), `lodestar-intl-${lang}-`)); const root = join(parent, 'root');
    cpSync(join(PK, n, 'fixtures'), join(root, 'fixtures'), { recursive: true });
    const done = new Map(); const dmyKinds = new Set(); const fileOv = {};
    for (const c of csvCases) {
      const kinds = kindsByArg(manifest, c.tool);
      for (const [arg, file] of argFiles(c.args)) {
        if (done.has(file)) continue;
        const kind = kinds.get(arg); const def = kind && manifest.sources[kind];
        const src = join(PK, n, file); if (!def || !existsSync(src)) { done.set(file, null); continue; }
        const out = localise(readFileSync(src, 'utf8'), def, lang); if (!out) { done.set(file, null); continue; }
        let buf; let enc = MARKETS[lang].enc;
        try { buf = encodeText(out.text, enc); } catch { enc = 'utf-8'; buf = encodeText(out.text, enc); }
        writeFileSync(join(root, file), buf);
        done.set(file, out); if (lang === LANGS[0] || !row.columns) { /* counted below */ }
        if (MARKETS[lang].dmy) fileOv[file] = { date_order: 'dmy' };
        if (lang === 'de') { row.columns += out.columns; row.translated += out.translated; }
      }
    }
    if (Object.keys(fileOv).length) writeFileSync(join(root, 'lodestar-sources.json'), JSON.stringify({ note: 'Day-first dates, as the buyer would set them once.', files: fileOv }, null, 2));
    const res = await runEvals(manifest, strip(csvCases), { root });
    const bad = res.results.filter((r) => passedEn.has(r.id) && !r.pass);
    row.langs[lang] = `${res.results.filter((r) => passedEn.has(r.id) && r.pass).length}/${passedEn.size}`;
    if (bad.length) { regressions += bad.length; for (const b of bad) console.log(`  FAIL ${n} [${lang}] ${b.id}: ${b.fails.slice(0, 3).join('; ')}`); }
    if (verbose) console.log(`  ${n} [${lang}] kept at ${root}`); else rmSync(parent, { recursive: true, force: true });
  }
  summary.push(row);
}
const pad = (s, w) => String(s).padEnd(w);
console.log(`\n${pad('agent', 28)}${pad('cases', 7)}${pad('columns translated', 20)}${LANGS.map((l) => pad(l, 8)).join('')}`);
let cols = 0, tr = 0, cs = 0;
for (const r of summary) { cols += r.columns || 0; tr += r.translated || 0; cs += r.cases || 0; console.log(`${pad(r.agent, 28)}${pad(r.cases, 7)}${pad(r.cases ? `${r.translated}/${r.columns}` : '-', 20)}${LANGS.map((l) => pad((r.langs && r.langs[l]) || '-', 8)).join('')}`); }
console.log(`\n${agents.length} agent(s), ${cs} case(s) with spreadsheet inputs, ${tr}/${cols} column names translated (German count), ${LANGS.length} language(s). ${regressions ? `${regressions} case(s) passed in English and failed in another language.` : 'Every case that passes in English passes in every language.'}`);
if (showMissing) console.log(`\nFields with no German word: ${[...missing.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}${n > 1 ? ` x${n}` : ''}`).join(', ')}`);
process.exit(regressions ? 1 : 0);
