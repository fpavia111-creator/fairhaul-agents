// Personal-data masking (ported from fairdrive-core in the final pass, 19 Nov 2026). Every
// Fairhaul tool result passes through here before it leaves the runtime, so the AI model that
// called the tool sees stable pseudonyms (CU-3f2a9c1d for customers, consignees, recipients and
// people who signed for a delivery; ST-8cea1a2d for drivers, dispatchers and other staff) and
// placeholders for phone numbers, e-mails and street addresses. Files the tools write on this
// machine (worklists, drafts) keep the real values, because the people working them need them.
//
// What it is, honestly:
//   - In the default "mask" mode, carrier, vendor and lane names, PRO, BOL, load, container and
//     invoice numbers, cities, states, dates, weights and amounts still reach the model, because
//     the checks are about them. "customer", "consignee" and "shipper" columns hold company names
//     in freight files and are sent as they are; "strict" pseudonymises them (CO-...) and cuts ZIP
//     and postal codes to three digits.
//   - It works from column and field names plus a few text patterns (SSN, e-mail, phone). A name
//     typed into a free-text column the agent does not know about (notes, memo, description) can
//     get through.
//   - The checks run on the real values before masking; only the result is masked.
//
// Pseudonyms are HMAC-SHA256 of the value with a per-installation key
// (<stateDir>/pii.key, created on first use, never returned), so the same person
// gets the same pseudonym in every result, and a pseudonym cannot be reversed
// without the key. Runs that keep no state (tests, evals) use a key made once per process.

import { createHmac, createSecretKey, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const PII_MODES = Object.freeze(['mask', 'strict', 'off']);
export const PII_KEY_FILE = 'pii.key';
const PROCESS_KEY = randomBytes(32);

/** Keys whose values describe the file's columns (field → header), never customer data. Free-text scrubbing still applies. */
const META_KEYS = new Set(['mapped', 'unmapped', 'missing', 'translated', 'translated_columns', 'columns', 'recognised_by', 'signature']);
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
const keys = (kind, list) => list.map((k) => [norm(k), kind]);

// Field names (any case or punctuation) → kind. Kinds marked strict are masked only in strict mode.
const KEY_KIND = new Map([
  ...keys('company', ['customer', 'customer_name', 'customers', 'consignee', 'shipper']),
  ...keys('name', ['buyer', 'buyer_name', 'co_buyer', 'cobuyer', 'co_buyer_name', 'purchaser', 'first_name', 'last_name', 'middle_name', 'customer_first', 'customer_last', 'owner_name', 'vehicle_owner', 'registered_owner', 'insured', 'insured_name', 'claimant', 'lessee', 'borrower', 'guarantor', 'contract_holder', 'customer_full_name', 'recipient', 'recipient_name', 'consignee_contact', 'contact', 'contact_name', 'ship_to_name', 'ship_to_contact', 'signed_by', 'signer', 'received_by', 'end_customer']),
  ...keys('dob', ['dob', 'date_of_birth', 'birth_date', 'birthdate', 'buyer_dob', 'customer_dob']),
  ...keys('ssn', ['ssn', 'social_security_number', 'social_security', 'ssn_last4', 'tax_id_customer']),
  ...keys('license', ['drivers_license', 'driver_license', 'dl_number', 'license_number_customer', 'dl', 'id_number']),
  ...keys('address', ['address', 'customer_address', 'street', 'street_address', 'address1', 'address2', 'address_line_1', 'address_line_2', 'home_address', 'buyer_address', 'recipient_address', 'ship_to_address', 'delivery_address']),
  ...keys('phone', ['phone', 'phone_number', 'home_phone', 'mobile_phone', 'mobile', 'cell_phone', 'cell', 'telephone', 'customer_phone', 'work_phone', 'dispatch_phone', 'contact_phone', 'driver_phone']),
  ...keys('email', ['email', 'email_address', 'customer_email', 'buyer_email', 'dispatch_email', 'contact_email', 'remit_email']),
  ...keys('account', ['customer_number', 'customer_id', 'customer_no', 'loan_number', 'account_number', 'lender_account', 'bank_account', 'routing_number', 'iban']),
  ...keys('staff', ['salesperson', 'salespeople', 'split_with', 'technician', 'tech', 'technician_name', 'advisor', 'service_advisor', 'writer', 'fi_manager', 'finance_manager', 'sales_manager', 'performed_by', 'employee', 'employee_name', 'driver', 'driver_name', 'dispatcher', 'requested_by', 'requester', 'entered_by']),
  ...keys('zip', ['zip', 'zip_code', 'postal_code', 'customer_zip', 'zipcode', 'recipient_postal', 'ship_to_zip']),
  ...keys('vin', ['vin', 'vins', 'vehicle_vin', 'trade_vin']),
]);
const STRICT_ONLY = new Set(['zip', 'vin', 'company']);
const PREFIX = { company: 'CO', name: 'CU', staff: 'ST', account: 'ACCT', license: 'DL', vin: 'VIN' };
const FIXED = { ssn: '[SSN]', address: '[ADDRESS]', phone: '[PHONE]', email: '[EMAIL]' };
// Minimum length before a registered value is also searched for inside free text.
const MIN_TEXT = { company: 4, name: 4, staff: 4, account: 5, license: 5, dob: 8, vin: 8 };

const TEXT_PATTERNS = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]'],
  [/(?<![\d-])\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g, '[PHONE]'],
];

// A value that is already a pseudonym or placeholder is left alone (results pass the masker more than once).
const ALREADY = /^((CO|CU|ST|ACCT|DL|VIN)-[0-9a-f]{8}|\[(SSN|ADDRESS|PHONE|EMAIL|DOB|ZIP)\]|\d{4} \(birth year\)|\d{3}XX)$/;

/** Kind of a field name, or null. */
export const piiKindOf = (key, mode = 'mask') => { const k = KEY_KIND.get(norm(key)); return !k || (STRICT_ONLY.has(k) && mode !== 'strict') ? null : k; };

/** Name variants a person's name appears as in text: as given, "First Last" and "Last, First". */
function nameVariants(raw) {
  const s = String(raw).trim(); if (!s) return [];
  const out = new Set([s]);
  const m = /^([^,]+),\s*(.+)$/.exec(s);
  if (m) out.add(`${m[2]} ${m[1]}`.trim());
  else { const p = s.split(/\s+/); if (p.length >= 2) out.add(`${p.at(-1)}, ${p.slice(0, -1).join(' ')}`); }
  return [...out];
}
const nameKey = (s) => String(s).toLowerCase().split(/[^a-z0-9À-￿]+/).filter(Boolean).sort().join(' ');

/** Read or create the per-installation pseudonym key. */
export function loadPiiKey(stateDir) {
  if (!stateDir) return PROCESS_KEY;
  const f = join(stateDir, PII_KEY_FILE);
  if (existsSync(f)) { const h = readFileSync(f, 'utf8').trim(); if (/^[0-9a-f]{64}$/.test(h)) return Buffer.from(h, 'hex'); throw new Error(`${PII_KEY_FILE} in the state folder is not a 64-character hex key; restore it from backup or delete it (pseudonyms will change)`); }
  mkdirSync(dirname(f), { recursive: true });
  const k = randomBytes(32);
  writeFileSync(f, k.toString('hex') + '\n', { mode: 0o600 });
  try { chmodSync(f, 0o600); } catch { /* Windows */ }
  return k;
}

export class PiiMasker {
  constructor({ mode = 'mask', key = null } = {}) {
    if (!PII_MODES.includes(mode)) throw new Error(`pii mode must be one of ${PII_MODES.join(', ')}`);
    this.mode = mode;
    this.key = key || PROCESS_KEY;
    // One key object and a token cache: turning a raw key into a key object on every HMAC cost about
    // 0.3 ms a value (10 s for 10,000 deal lines in the final-pass bench).
    this.hmacKey = createSecretKey(this.key);
    this.tokens = new Map();
    this.reset();
  }

  /** Forget the values registered for the last call. */
  reset() { this.seen = new Map(); this.counts = {}; this.index = null; }

  get on() { return this.mode !== 'off'; }

  /** Stable pseudonym for a value of one kind. */
  token(kind, value) {
    const v = kind === 'name' || kind === 'staff' || kind === 'company' ? nameKey(value) : String(value).trim().toUpperCase();
    const id = `${kind}|${v}`; let t = this.tokens.get(id);
    if (t === undefined) { t = `${PREFIX[kind] || 'ID'}-${createHmac('sha256', this.hmacKey).update(id).digest('hex').slice(0, 8)}`; this.tokens.set(id, t); }
    return t;
  }

  /** What the model sees for one value of one kind. */
  maskValue(kind, value) {
    if (value === null || value === undefined || value === '' || !this.on) return value;
    if (Array.isArray(value)) return value.map((v) => this.maskValue(kind, v));
    if (typeof value === 'object') return value;
    const s = String(value);
    if (ALREADY.test(s)) return value;
    this.counts[kind] = (this.counts[kind] || 0) + 1;
    if (FIXED[kind]) { this.register(kind, s); return FIXED[kind]; }
    if (kind === 'dob') { this.register(kind, s); const y = /(\d{4})/.exec(s); return this.mode === 'strict' || !y ? '[DOB]' : `${y[1]} (birth year)`; }
    if (kind === 'zip') { const d = s.replace(/\D/g, ''); return d.length >= 3 ? `${d.slice(0, 3)}XX` : '[ZIP]'; }
    this.register(kind, s);
    return this.token(kind, s);
  }

  /** Remember a raw value so it is also replaced where it appears inside other text. */
  register(kind, raw) {
    if (!this.on || raw === null || raw === undefined) return;
    if (STRICT_ONLY.has(kind) && this.mode !== 'strict') return;
    const vals = kind === 'name' || kind === 'staff' ? nameVariants(raw) : [String(raw).trim()];
    const rep = FIXED[kind] || (kind === 'dob' ? '[DOB]' : this.token(kind, raw));
    // Leading and trailing punctuation is dropped for matching, so a value with junk in front of it
    // (a spreadsheet formula, a quote, a bullet) is still found where it appears in text.
    for (const v0 of vals) { const v = v0.replace(/^[^a-z0-9À-￿]+|[^a-z0-9À-￿]+$/gi, ''); if (v.length >= (MIN_TEXT[kind] || 4) && !this.seen.has(v.toLowerCase())) { this.seen.set(v.toLowerCase(), { value: v, rep }); this.index = null; } }
  }

  /** Register every customer-data field of plain records (used when a tool reads a source file). */
  registerRecords(rows, fieldKinds = {}) {
    if (!this.on || !Array.isArray(rows)) return;
    const cols = new Map();
    for (const r of rows.slice(0, 1)) if (r && typeof r === 'object') for (const k of Object.keys(r)) { const kind = fieldKinds[k] || piiKindOf(k, this.mode); if (kind && (!STRICT_ONLY.has(kind) || this.mode === 'strict')) cols.set(k, kind); }
    if (!cols.size) return;
    for (const r of rows) if (r && typeof r === 'object') for (const [k, kind] of cols) if (r[k] !== null && r[k] !== undefined && r[k] !== '') this.register(kind, r[k]);
  }

  #buildIndex() {
    const idx = new Map();
    for (const [low, e] of this.seen) {
      const first = (/[a-z0-9À-￿]+/.exec(low) || [low])[0];
      if (!idx.has(first)) idx.set(first, []);
      idx.get(first).push({ low, ...e });
    }
    for (const list of idx.values()) list.sort((a, b) => b.low.length - a.low.length);
    this.index = idx;
  }

  /** Replace registered values and SSN/e-mail/phone patterns inside free text. */
  maskText(s) {
    if (!this.on || typeof s !== 'string' || !s) return s;
    let out = s;
    for (const [re, rep] of TEXT_PATTERNS) out = out.replace(re, () => { this.counts.pattern = (this.counts.pattern || 0) + 1; return rep; });
    if (!this.seen.size) return out;
    if (!this.index) this.#buildIndex();
    const low = out.toLowerCase(); let res = ''; let i = 0;
    const word = /[a-z0-9À-￿]+/g; let m;
    while ((m = word.exec(low))) {
      if (m.index < i) continue;
      const before = m.index === 0 || !/[a-z0-9À-￿]/.test(low[m.index - 1]);
      const cands = before ? this.index.get(m[0]) : null;
      if (cands) {
        const hit = cands.find((c) => low.startsWith(c.low, m.index) && !/[a-z0-9À-￿]/.test(low[m.index + c.low.length] || ' '));
        if (hit) { res += out.slice(i, m.index) + hit.rep; i = m.index + hit.low.length; word.lastIndex = i; this.counts.text = (this.counts.text || 0) + 1; continue; }
      }
    }
    return res + out.slice(i);
  }

  /** Masked deep copy of a tool result: customer-data fields first, then free text everywhere. */
  maskResult(value) {
    if (!this.on) return value;
    const byKey = (v, key, depth) => {
      if (depth > 40) return v;
      const kind = key === null ? null : piiKindOf(key, this.mode);
      if (Array.isArray(v)) return v.map((x) => (kind && (typeof x !== 'object' || x === null) ? this.maskValue(kind, x) : byKey(x, kind ? null : key, depth + 1)));
      if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = META_KEYS.has(k) ? x : byKey(x, k, depth + 1); return o; }
      // Counts and flags under a customer-named key (by_check.customer: 3) are not identifiers.
      if (kind && (typeof v === 'boolean' || (typeof v === 'number' && Math.abs(v) < 100000))) return v;
      return kind ? this.maskValue(kind, v) : v;
    };
    const keyed = byKey(value, null, 0);
    const text = (v, depth) => {
      if (depth > 40) return v;
      if (typeof v === 'string') return this.maskText(v);
      if (Array.isArray(v)) return v.map((x) => text(x, depth + 1));
      if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[this.maskText(k)] = text(x, depth + 1); return o; }
      return v;
    };
    return text(keyed, 0);
  }

  /** Does a value the model passed back (a pseudonym or the raw value) name this raw value? */
  same(raw, given, kind = 'name') {
    const r = String(raw ?? '').trim(), g = String(given ?? '').trim();
    if (!r || !g) return false;
    if (r.toLowerCase() === g.toLowerCase()) return true;
    return this.on && PREFIX[kind] && g.toUpperCase().startsWith(`${PREFIX[kind]}-`) && this.token(kind, r).toLowerCase() === g.toLowerCase();
  }

  /** Summary of what was masked in the last result (counts by kind, no values). */
  report() { return { mode: this.mode, masked: { ...this.counts } }; }
}
