#!/usr/bin/env node
// Real-data checks on public files (final pass, 19 Nov 2026). Public, lawful data only; never a
// shipper's, carrier's or broker's private data. Downloads go to _realdata/ (git-ignored, never
// committed); the results go to docs/realdata.md and docs/realdata.json.
//
//   node scripts/realdata.mjs --download   fetch the public files (network; two requests)
//   node scripts/realdata.mjs              run the checks on the files already in _realdata/ (no network)
//
// 1. U.S. EIA weekly retail diesel price (U.S. average, No. 2 diesel), as published on FRED
//    (series GASDESW). fairhaul-fuel-surcharges runs with the real weekly index in its contract and a
//    common fuel table (1% of linehaul per 6 cents above 1.20); one fictional invoice ships on the
//    Wednesday of every week since 2024-01-01. Most are billed exactly by the table; every 7th is
//    billed at the following week's price (a real carrier mistake). An independent calculation in this
//    script gives the expected week, price, band and status for each invoice; disagreements are bugs.
// 2. FMCSA Company Census File (data.transportation.gov, az4n-8mr2): the 5,000 most recently registered
//    active interstate carriers (DOT number, legal name, phone, e-mail, registration date, state and
//    safety rating only; no officer names). fairhaul-carrier-vetting runs on them as a carrier master.
//    An independent count in this script gives the carriers sharing a phone, using a free mailbox and
//    registered within 180 days; the agent's signals are compared with it.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages'); const RD = join(ROOT, '_realdata');
const { parseCsv, toCsv, AgentRuntime } = await import(pathToFileURL(join(PK, 'fairhaul-core', 'src', 'index.js')).href);
const TODAY = new Date().toISOString().slice(0, 10);
const SRC = {
  diesel: { name: 'U.S. EIA weekly retail diesel price (No. 2, U.S. average), via FRED series GASDESW', page: 'https://fred.stlouisfed.org/series/GASDESW', url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GASDESW', licence: 'EIA data, US government work (public domain); FRED terms of use', file: 'eia-diesel-weekly.csv' },
  // Two slices of 2,500: the newest registrations and those registered before 2026-01-01, so both sides
  // of the 180-day "new authority" line are in the sample.
  census: { name: 'FMCSA Company Census File', page: 'https://data.transportation.gov/Trucking-and-Motorcoaches/Company-Census-File/az4n-8mr2', url: ["status_code='A' AND carrier_operation='A'", "status_code='A' AND carrier_operation='A' AND add_date < '20260101'"].map((w) => 'https://data.transportation.gov/resource/az4n-8mr2.csv?' + new URLSearchParams({ $select: 'dot_number,legal_name,phone,email_address,add_date,phy_state,safety_rating,docket1prefix,docket1', $where: w, $order: 'add_date DESC', $limit: '2500' }).toString()), licence: 'US government open data (data.transportation.gov; the dataset metadata names no separate licence)', file: 'fmcsa-census-sample.csv' },
};

async function download() {
  mkdirSync(RD, { recursive: true });
  for (const s of Object.values(SRC)) {
    const parts = [];
    for (const u of [].concat(s.url)) { const r = await fetch(u); if (!r.ok) throw new Error(`${s.name}: HTTP ${r.status}`); parts.push(await r.text()); }
    writeFileSync(join(RD, s.file), parts.map((t, i) => (i ? t.split('\n').slice(1).join('\n') : t.trimEnd())).join('\n'));
  }
  writeFileSync(join(RD, 'sources.json'), JSON.stringify({ downloaded: new Date().toISOString(), sources: SRC }, null, 2));
  console.log('downloaded into _realdata/');
}

async function runAgent(name, tool, files, args) {
  const parent = mkdtempSync(join(tmpdir(), 'realdata-')); const root = join(parent, 'root'); mkdirSync(root, { recursive: true });
  try {
    for (const [f, data] of Object.entries(files)) writeFileSync(join(root, f), typeof data === 'string' ? data : toCsv(data, Object.keys(data[0]), { raw: true }));
    const { manifest } = await import(pathToFileURL(join(PK, name, 'src', 'index.js')).href);
    const r = await new AgentRuntime(manifest, { root, stateDir: null, audit: false, pii: 'off' }).call(tool, args);
    if (r.status !== 'executed') throw new Error(`${name}: ${r.status} ${r.reason || ''}`);
    return r.result;
  } finally { rmSync(parent, { recursive: true, force: true }); }
}
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const count = (l) => l.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});

async function diesel() {
  const rows = parseCsv(readFileSync(join(RD, SRC.diesel.file), 'utf8')).map((r) => ({ week_of: r.observation_date, price: Number(r.GASDESW) })).filter((r) => r.week_of >= '2024-01-01' && Number.isFinite(r.price));
  // A common table: 1% of linehaul for every 6 cents above 1.20 (bands in thousandths of a dollar, written to 2 decimals).
  const table = []; for (let i = 0; i < 120; i++) table.push({ min: (1200 + 60 * i) / 1000, max: (1260 + 60 * i) / 1000, value: i });
  const contract = { note: 'Real EIA weekly diesel index; fictional carrier and table.', currency: 'USD', tolerance: 1, fuel_index: rows, carriers: [{ carrier: 'Index Test Carrier', effective: '2024-01-01', expires: '2027-12-31', lanes: [{ origin: '*', destination: '*', basis: 'flat', rate: 1000 }], fuel: { basis: 'pct_of_linehaul', table } }] };
  // Independent: band by integer thousandths.
  const band = (p) => { const m = Math.round(p * 1000); const i = Math.floor((m - 1200) / 60); return i >= 0 && i < 120 ? i : null; };
  const inv = []; const want = [];
  rows.forEach((w, k) => {
    const ship = addDays(w.week_of, 2); const next = rows[k + 1];
    const wrong = k % 7 === 6 && next; const billedPct = band(wrong ? next.price : w.price); const right = band(w.price);
    if (billedPct === null || right === null) return;
    const id = `D-${String(k + 1).padStart(4, '0')}`;
    inv.push({ invoice_number: id, carrier: 'Index Test Carrier', ship_date: ship, invoice_date: addDays(ship, 2), amount: 1000 + billedPct * 10, miles: 500, charge_description: 'Linehaul', charge_amount: 1000 });
    inv.push({ invoice_number: id, carrier: 'Index Test Carrier', ship_date: ship, invoice_date: addDays(ship, 2), amount: 1000 + billedPct * 10, miles: 500, charge_description: 'Fuel Surcharge', charge_amount: billedPct * 10 });
    want.push({ id, week: w.week_of, expected: right * 10, status: billedPct === right ? 'ok' : (billedPct > right ? 'wrong_week' : 'fuel_under') });
  });
  const r = await runAgent('fairhaul-fuel-surcharges', 'fuel_check', { 'invoices.csv': inv, 'contract.json': JSON.stringify(contract) }, { invoices: 'invoices.csv', contract: 'contract.json' });
  const by = new Map(r.items.map((i) => [i.invoice_number, i])); const diffs = [];
  for (const w of want) { const g = by.get(w.id); if (!g || g.index_week !== w.week || g.expected !== w.expected || g.status !== w.status) diffs.push({ id: w.id, want: w, got: g && { week: g.index_week, expected: g.expected, status: g.status } }); }
  return { weeks: rows.length, from: rows[0].week_of, to: rows.at(-1).week_of, price_min: Math.min(...rows.map((x) => x.price)), price_max: Math.max(...rows.map((x) => x.price)), invoices: want.length, planted_wrong_week: want.filter((w) => w.status === 'wrong_week').length, planted_under: want.filter((w) => w.status === 'fuel_under').length, same_band_next_week: Math.floor(rows.length / 7) - want.filter((w) => w.status !== 'ok').length, agent_status: count(r.items.map((i) => i.status)), disagreements: diffs.length, examples: diffs.slice(0, 5) };
}

// Reference list of consumer mailbox domains, written out here so the check does not import the agent's.
const FREE_DOMAINS = ['gmail', 'googlemail', 'yahoo', 'ymail', 'rocketmail', 'myyahoo', 'hotmail', 'outlook', 'live', 'msn', 'aol', 'icloud', 'me', 'mac', 'proton', 'protonmail', 'gmx', 'mail', 'yandex', 'zoho', 'comcast', 'att', 'sbcglobal', 'bellsouth', 'verizon', 'charter', 'cox', 'earthlink', 'juno'];
const isFree = (e) => { const m = /@([^.@\s]+)\./.exec(String(e || '').toLowerCase()); return !!m && FREE_DOMAINS.includes(m[1]); };
async function census() {
  const rows = parseCsv(readFileSync(join(RD, SRC.census.file), 'utf8'));
  const iso = (d) => (/^\d{8}$/.test(String(d)) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : String(d || '').slice(0, 10));
  const carriers = rows.map((r) => ({ carrier_id: `D${r.dot_number}`, name: r.legal_name, mc: r.docket1 ? `${r.docket1prefix || 'MC'}-${r.docket1}` : '', dot: r.dot_number, phone: r.phone, email: r.email_address, address: '', remit_to: r.legal_name, bank_last4: '', bank_changed: '', authority_date: iso(r.add_date), insurance_expiry: '', safety_rating: r.safety_rating || '', status: 'active' }));
  const loads = [{ load_id: 'L-1', carrier_id: carriers[0].carrier_id, pickup_date: TODAY, booked_at: TODAY, cargo_value: 1000, dispatch_phone: '', dispatch_email: '' }];
  const r = await runAgent('fairhaul-carrier-vetting', 'vetting_vet', { 'carriers.csv': carriers, 'loads.csv': loads }, { carriers: 'carriers.csv', loads: 'loads.csv', as_of: TODAY });
  const sig = (code) => new Set(r.rows.filter((x) => (x.signal_list || []).some((s) => s.code === code)).map((x) => x.carrier_id));
  // Independent counts.
  const digits = (p) => String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  // A phone on two or more records counts unless every record has the same company name (one company, two DOT numbers).
  const nameKey = (s) => String(s || '').toLowerCase().replace(/\b(inc|llc|ltd|corp|co|company|corporation)\b/g, '').replace(/[^a-z0-9]/g, '');
  const byPhone = new Map(); for (const c of carriers) { const d = digits(c.phone); if (d.length >= 10) { if (!byPhone.has(d)) byPhone.set(d, []); byPhone.get(d).push(c); } }
  const groups = [...byPhone.values()].filter((l) => l.length > 1);
  const sameName = groups.filter((l) => new Set(l.map((c) => nameKey(c.name))).size < 2).length;
  const sharedPhone = new Set(groups.filter((l) => new Set(l.map((c) => nameKey(c.name))).size >= 2).flatMap((l) => l.map((c) => c.carrier_id)));
  const freeMail = new Set(carriers.filter((c) => isFree(c.email)).map((c) => c.carrier_id));
  const newAuth = new Set(carriers.filter((c) => c.authority_date && (new Date(TODAY) - new Date(c.authority_date)) / 864e5 < 180).map((c) => c.carrier_id));
  const cmp = (a, b) => ({ agent: a.size, independent: b.size, agent_only: [...a].filter((x) => !b.has(x)).length, independent_only: [...b].filter((x) => !a.has(x)).length });
  return { carriers: carriers.length, same_name_phone_groups: sameName, newest: carriers[0].authority_date, oldest: carriers.at(-1).authority_date, levels: count(r.rows.map((x) => x.level)), shared_phone: cmp(sig('shared_phone'), sharedPhone), free_email: cmp(sig('free_email'), freeMail), new_authority: cmp(sig('new_authority'), newAuth), all_signals: count(r.rows.flatMap((x) => (x.signal_list || []).map((s) => s.code))) };
}

if (process.argv.includes('--download')) await download();
if (!existsSync(join(RD, SRC.diesel.file)) || !existsSync(join(RD, SRC.census.file))) { console.log('No real data yet: run  node scripts/realdata.mjs --download  first.'); process.exit(1); }
const src = existsSync(join(RD, 'sources.json')) ? JSON.parse(readFileSync(join(RD, 'sources.json'), 'utf8')) : {};
const res = { run: TODAY, downloaded: src.downloaded || null, diesel: await diesel(), census: await census() };
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'realdata.json'), JSON.stringify(res, null, 2) + '\n');
const d = res.diesel, c = res.census; const pc = (x) => `${x.agent} (independent count ${x.independent}; agent only ${x.agent_only}, independent only ${x.independent_only})`;
const md = [
  '# Fairhaul on public real data', '',
  `Written by \`node scripts/realdata.mjs\` on ${TODAY} from files downloaded ${res.downloaded ? res.downloaded.slice(0, 10) : '(date not recorded)'} into \`_realdata/\` (git-ignored; \`--download\` fetches them again). Public data only.`, '',
  '## Sources', '',
  `- **${SRC.diesel.name}**: <${SRC.diesel.page}>. Licence: ${SRC.diesel.licence}.`,
  `- **${SRC.census.name}**: <${SRC.census.page}>. Licence: ${SRC.census.licence}. Downloaded: DOT number, legal name, phone, e-mail, registration date, state, safety rating and docket number of the ${c.carriers} most recently registered active interstate carriers; no officer names.`, '',
  '## Results', '',
  `- **fairhaul-fuel-surcharges with the real diesel index** (${d.weeks} weeks, ${d.from} to ${d.to}, ${d.price_min} to ${d.price_max} a gallon; a 1%-per-6-cents table): ${d.invoices} fictional invoices, one shipping each Wednesday. ${d.planted_wrong_week} were billed at the next week's higher price and ${d.planted_under} at its lower price (the other weeks of that kind fell in the same band, so the bill was right). Agent statuses: ${Object.entries(d.agent_status).map(([k, v]) => `${k} ${v}`).join(', ')}. **Disagreements with the independent calculation (week, expected amount and status): ${d.disagreements}.**`,
  `- **fairhaul-carrier-vetting on ${c.carriers} real carriers** (registered ${c.oldest} to ${c.newest}): carriers sharing a phone with another ${pc(c.shared_phone)}; free mailboxes ${pc(c.free_email)}; authority under 180 days ${pc(c.new_authority)}. Levels: ${Object.entries(c.levels).map(([k, v]) => `${k} ${v}`).join(', ')}. These are signals to check, not findings of fraud: many real carriers share a phone with a related company, and a new registration is normal.`, '',
  '## What this does not show', '',
  '- No shipper, carrier, broker, TMS, parcel, ocean, air, customs or warehouse export was read: none is published. The invoices in the fuel run and the loads in the vetting run are fictional; only the diesel prices and the carrier records are real.',
  '- IFTA tax rates and FMCSA inspection data were looked at; no Fairhaul agent reads them (there is no IFTA or safety-score agent), so they were not run.', '',
];
writeFileSync(join(ROOT, 'docs', 'realdata.md'), md.join('\n'));
console.log(md.slice(9, 11).join('\n'));
