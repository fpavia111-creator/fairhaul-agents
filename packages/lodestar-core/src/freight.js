// Freight and shipping helpers shared by the Lodestar agents. Pure functions, no I/O.
//
// Nothing here is a carrier's tariff or a rule of law. Accessorial names,
// density classes and dimensional divisors are working defaults that a buyer
// overrides with their own contract file; every agent says which defaults it used.
import { normalizeName } from './text.js';
import { readNumber } from './intl.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const num = (v) => { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) ? v : null; const n = readNumber(v); return Number.isFinite(n) ? n : null; };
export const sum = (xs) => round2(xs.reduce((s, x) => s + (Number(x) || 0), 0));
export const str = (v) => String(v ?? '').trim();

// ---------------------------------------------------------------- carriers ----

const CARRIER_NOISE = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|lp|llp|plc|gmbh|sa|the)\b\.?/gi;
const CARRIER_WORDS = /\b(freight|freightways|trucking|transport|transportation|logistics|lines|line|express|carriers?|systems?|services?|motor|ltl)\b/gi;

/** Canonical key for a carrier name or SCAC, for matching across files. "XPO Logistics, Inc." and "XPO" give "xpo". */
export function carrierKey(v) {
  const s = str(v);
  if (!s) return '';
  if (/^[A-Z]{2,4}$/.test(s)) return s.toLowerCase();
  const k = normalizeName(s.replace(CARRIER_NOISE, ' ').replace(CARRIER_WORDS, ' '));
  return k || normalizeName(s);
}

/** True when two carrier names or SCACs plausibly name the same carrier. */
export function sameCarrier(a, b, aliases = {}) {
  const ka = carrierKey(aliases[str(a)] || a), kb = carrierKey(aliases[str(b)] || b);
  return !!ka && ka === kb;
}

// ------------------------------------------------------------------ places ----

/** US ZIP to ZIP3, Canadian postal code to FSA, otherwise the folded text. */
export function zoneOf(postal) {
  const s = str(postal).toUpperCase();
  let m = /^(\d{5})(-\d{4})?$/.exec(s); if (m) return m[1].slice(0, 3);
  m = /^([A-Z]\d[A-Z])\s?\d[A-Z]\d$/.exec(s); if (m) return m[1];
  return s.replace(/\s+/g, ' ');
}

/**
 * Does a place on a shipment match a lane end in a contract? Lane ends may be
 * "*" (anywhere), a 5-digit ZIP, a 3-digit ZIP prefix ("606"), a range
 * ("600-629"), a state or province code ("IL"), or "City, ST".
 */
export function placeMatches(pattern, place = {}) {
  const p = str(pattern).toUpperCase();
  if (!p || p === '*') return true;
  const zip = str(place.postal).toUpperCase(), z3 = zoneOf(zip), st = str(place.state).toUpperCase(), city = normalizeName(place.city || '');
  let m;
  if ((m = /^(\d{3})-(\d{3})$/.exec(p))) return /^\d{3}$/.test(z3) && z3 >= m[1] && z3 <= m[2];
  if (/^\d{5}$/.test(p)) return zip.slice(0, 5) === p;
  if (/^\d{3}$/.test(p)) return z3 === p;
  if (/^[A-Z]\d[A-Z]$/.test(p)) return z3 === p;
  if (/^[A-Z]{2}$/.test(p)) return st === p;
  if ((m = /^(.+),\s*([A-Z]{2})$/.exec(p))) return st === m[2] && city === normalizeName(m[1]);
  return normalizeName(p) === city;
}

/** Short lane label for reports: "IL 606 → TX 752". */
export function laneLabel(o = {}, d = {}) {
  const end = (x) => [str(x.state).toUpperCase(), zoneOf(x.postal) || normalizeName(x.city || '')].filter(Boolean).join(' ') || '?';
  return `${end(o)} → ${end(d)}`;
}

// ------------------------------------------------------------------- dates ----

const DAY = 86400000;
const toMs = (v) => { const s = str(v); if (!s) return NaN; const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`; return Date.parse(iso); };
export const isoDate = (v) => { const t = toMs(v); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
export function daysBetween(a, b) { const x = toMs(a), y = toMs(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / DAY) : null; }
export function hoursBetween(a, b) { const x = toMs(a), y = toMs(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round(((y - x) / 3600000) * 100) / 100 : null; }
export function addDays(d, n) { const t = toMs(d); return Number.isFinite(t) ? new Date(t + n * DAY).toISOString().slice(0, 10) : null; }
export const inWindow = (d, from, to) => { const x = isoDate(d); return !!x && (!from || x >= isoDate(from)) && (!to || x <= isoDate(to)); };

// ------------------------------------------------------------ accessorials ----

/**
 * Charge codes used across the Lodestar agents. `words` match free-text charge
 * descriptions on invoices (any language the carrier used is not covered: add
 * your own wording in the contract's `charge_aliases`).
 */
export const CHARGE_CODES = Object.freeze({
  linehaul: { label: 'Linehaul / base freight', words: ['linehaul', 'line haul', 'base rate', 'base charge', 'freight charge', 'transportation charge', 'transportation', 'net freight', 'freight', 'base'] },
  discount: { label: 'Discount', words: ['discount', 'disc', 'allowance', 'incentive'] },
  fuel: { label: 'Fuel surcharge', words: ['fuel', 'fsc', 'fuel surcharge', 'fuel adjustment'] },
  liftgate: { label: 'Liftgate', words: ['liftgate', 'lift gate', 'tailgate', 'lgd', 'lgp'] },
  residential: { label: 'Residential delivery or pickup', words: ['residential', 'resi', 'res delivery', 'residential surcharge', 'residential delivery'] },
  inside: { label: 'Inside delivery or pickup', words: ['inside delivery', 'inside pickup', 'inside'] },
  limited_access: { label: 'Limited access location', words: ['limited access', 'lmtd access', 'construction site', 'school', 'military', 'church', 'camp'] },
  appointment: { label: 'Appointment or notify', words: ['appointment', 'appt', 'notify', 'notification', 'call before', 'arrival notice'] },
  detention: { label: 'Detention / waiting time', words: ['detention', 'waiting time', 'wait time', 'delay'] },
  layover: { label: 'Layover', words: ['layover', 'lay over'] },
  lumper: { label: 'Lumper / unloading', words: ['lumper', 'unloading', 'loading fee', 'unload fee'] },
  redelivery: { label: 'Redelivery / reattempt', words: ['redelivery', 're-delivery', 'reattempt', 'attempted delivery'] },
  reweigh: { label: 'Reweigh or reclass', words: ['reweigh', 'reclass', 'weight correction', 'inspection', 'class correction', 'reclassification', 'weight & inspection'] },
  hazmat: { label: 'Hazardous materials', words: ['hazmat', 'haz mat', 'hazardous', 'dangerous goods', 'dg fee'] },
  stop_off: { label: 'Stop-off / extra stop', words: ['stop off', 'stop-off', 'extra stop', 'additional stop', 'stopoff'] },
  tonu: { label: 'Truck ordered not used', words: ['tonu', 'truck ordered not used', 'dry run', 'cancellation fee'] },
  storage: { label: 'Storage', words: ['storage', 'warehouse fee'] },
  overlength: { label: 'Overlength / excessive length', words: ['overlength', 'over length', 'excessive length', 'extreme length'] },
  sort_segregate: { label: 'Sort and segregate', words: ['sort and segregate', 'sort & segregate', 'sort/segregate', 'segregation'] },
  address_correction: { label: 'Address correction', words: ['address correction', 'addr correction', 'address change', 'corrected address'] },
  delivery_area: { label: 'Delivery area surcharge', words: ['delivery area', 'das', 'extended area', 'remote area', 'rural'] },
  additional_handling: { label: 'Additional handling', words: ['additional handling', 'ahs', 'handling surcharge', 'non-standard'] },
  large_package: { label: 'Large or oversize package', words: ['large package', 'oversize', 'over size', 'over maximum', 'unauthorized package'] },
  declared_value: { label: 'Declared value', words: ['declared value', 'insurance', 'excess value'] },
  signature: { label: 'Signature', words: ['signature', 'adult signature', 'direct signature', 'indirect signature'] },
  saturday: { label: 'Saturday delivery or pickup', words: ['saturday'] },
  peak: { label: 'Peak / demand surcharge', words: ['peak', 'demand surcharge', 'surge'] },
  customs: { label: 'Customs / brokerage', words: ['brokerage', 'customs', 'clearance', 'duty', 'entry fee', 'disbursement'] },
  demurrage: { label: 'Demurrage', words: ['demurrage'] },
  per_diem: { label: 'Container per diem / detention', words: ['per diem', 'perdiem', 'container detention'] },
  chassis: { label: 'Chassis', words: ['chassis'] },
  terminal: { label: 'Terminal handling', words: ['terminal handling', 'thc', 'dthc', 'othc'] },
  bunker: { label: 'Bunker / BAF', words: ['bunker', 'baf', 'low sulphur', 'lss', 'emission surcharge', 'ets'] },
  security: { label: 'Security surcharge', words: ['security', 'ssc', 'screening'] },
  tax: { label: 'Tax', words: ['tax', 'vat', 'gst', 'hst'] },
  other: { label: 'Other / unrecognised', words: [] },
});

const CHARGE_INDEX = Object.entries(CHARGE_CODES).flatMap(([code, { words }]) => words.map((w) => [normalizeName(w), code])).sort((a, b) => b[0].length - a[0].length);
const X12_CHARGE = { FUE: 'fuel', FSC: 'fuel', 405: 'fuel', DET: 'detention', LFT: 'liftgate', LFG: 'liftgate', RES: 'residential', RSD: 'residential', INS: 'inside', ID: 'inside', HAZ: 'hazmat', HZD: 'hazmat', LUM: 'lumper', LMP: 'lumper', LAY: 'layover', STP: 'stop_off', SOC: 'stop_off', NOT: 'appointment', APT: 'appointment', REW: 'reweigh', RCL: 'reweigh', TON: 'tonu', DSC: 'discount', 400: 'linehaul', LHS: 'linehaul' };

/** Map a charge description or code to a CHARGE_CODES key. `aliases` maps your own words to codes. */
export function chargeCode(text, aliases = {}) {
  const raw = str(text);
  if (!raw) return 'other';
  if (CHARGE_CODES[raw]) return raw;
  const up = raw.toUpperCase();
  if (X12_CHARGE[up]) return X12_CHARGE[up];
  const t = normalizeName(raw);
  for (const [k, v] of Object.entries(aliases || {})) if (normalizeName(k) === t || (normalizeName(k) && t.includes(normalizeName(k)))) return CHARGE_CODES[v] ? v : 'other';
  for (const [w, code] of CHARGE_INDEX) if (w && (t === w || new RegExp(`(^| )${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(t))) return code;
  return 'other';
}

// ----------------------------------------------------------------- weights ----

/** Dimensional weight, rounded up to the next whole unit. Divisor 139 (in/lb) is a common US parcel default; check your contract. */
export function dimWeight(l, w, h, divisor = 139) {
  const [a, b, c, d] = [num(l), num(w), num(h), num(divisor)];
  if (!(a > 0 && b > 0 && c > 0 && d > 0)) return null;
  return Math.ceil((Math.ceil(a) * Math.ceil(b) * Math.ceil(c)) / d);
}
export const billableWeight = (actual, dim) => Math.max(Math.ceil(num(actual) || 0), num(dim) || 0);

/** Density in pounds per cubic foot from inches and pounds. */
export function densityPcf(lbs, l, w, h) {
  const [p, a, b, c] = [num(lbs), num(l), num(w), num(h)];
  if (!(p > 0 && a > 0 && b > 0 && c > 0)) return null;
  return Math.round((p / ((a * b * c) / 1728)) * 100) / 100;
}

/**
 * Density-to-class scales. `nmfc_2025_13` is the 13-tier scale recalled from the
 * 2025 NMFC density changes; `classic_11` is the older 11-tier scale. Both were
 * written from memory and not checked against NMFTA publications: a buyer's
 * contract or tariff file overrides them (`density_scale` in the contract).
 */
export const DENSITY_SCALES = Object.freeze({
  nmfc_2025_13: [[50, 50], [35, 55], [30, 60], [22.5, 65], [15, 70], [12, 85], [10, 92.5], [8, 100], [6, 125], [4, 175], [2, 250], [1, 300], [0, 400]],
  classic_11: [[30, 60], [22.5, 65], [15, 70], [13.5, 77.5], [12, 85], [10.5, 92.5], [9, 100], [8, 110], [7, 125], [6, 150], [5, 175], [4, 200], [3, 250], [2, 300], [1, 400], [0, 500]],
});
export function classForDensity(pcf, scale = 'nmfc_2025_13') {
  const s = Array.isArray(scale) ? scale : DENSITY_SCALES[scale];
  if (!s || !(pcf >= 0)) return null;
  for (const [min, cls] of s) if (pcf >= min) return cls;
  return s[s.length - 1][1];
}

// ---------------------------------------------------------------- contracts ----

/**
 * JSON Schema for a freight contract file shared by the rating agents. Rates are
 * the buyer's own; nothing is looked up online.
 */
export const FREIGHT_CONTRACT_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['carriers'],
  properties: {
    note: { type: 'string' },
    currency: { type: 'string', pattern: '^[A-Z]{3}$' },
    tolerance: { type: 'number', minimum: 0, maximum: 1000, description: 'Amount difference ignored per invoice, in currency units (default 1.00)' },
    charge_aliases: { type: 'object', additionalProperties: { type: 'string', enum: Object.keys(CHARGE_CODES) } },
    density_scale: { type: 'string', enum: Object.keys(DENSITY_SCALES) },
    fuel_index: { type: 'array', description: 'Weekly diesel price you copied from your index source: [{"week_of":"2026-11-02","price":3.79}]', items: { type: 'object', additionalProperties: false, required: ['week_of', 'price'], properties: { week_of: { type: 'string', format: 'date' }, price: { type: 'number', minimum: 0 } } } },
    carriers: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false, required: ['carrier'],
        properties: {
          carrier: { type: 'string', minLength: 1 },
          scac: { type: 'string', pattern: '^[A-Z]{2,4}$' },
          aliases: { type: 'array', items: { type: 'string' } },
          effective: { type: 'string', format: 'date' },
          expires: { type: 'string', format: 'date' },
          payment_terms_days: { type: 'integer', minimum: 0, maximum: 365 },
          discount_pct: { type: 'number', minimum: 0, maximum: 100, description: 'LTL discount off the base rate, percent' },
          minimum_charge: { type: 'number', minimum: 0 },
          lanes: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['origin', 'destination', 'basis', 'rate'],
              properties: {
                origin: { type: 'string' }, destination: { type: 'string' },
                mode: { type: 'string', enum: ['ftl', 'ltl', 'parcel', 'intermodal', 'drayage', 'ocean', 'air', 'any'] },
                equipment: { type: 'string' },
                basis: { type: 'string', enum: ['flat', 'per_mile', 'per_cwt', 'per_lb', 'per_kg', 'per_pallet'] },
                rate: { type: 'number', minimum: 0 },
                minimum: { type: 'number', minimum: 0 },
                class: { type: 'number' },
              },
            },
          },
          fuel: {
            type: 'object', additionalProperties: false, required: ['basis', 'table'],
            properties: {
              basis: { type: 'string', enum: ['pct_of_linehaul', 'per_mile'] },
              table: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['min', 'value'], properties: { min: { type: 'number' }, max: { type: 'number' }, value: { type: 'number', minimum: 0 } } } },
            },
          },
          accessorials: {
            type: 'object',
            propertyNames: { enum: Object.keys(CHARGE_CODES) },
            additionalProperties: {
              type: 'object', additionalProperties: false,
              properties: {
                amount: { type: 'number', minimum: 0 }, per_hour: { type: 'number', minimum: 0 }, per_cwt: { type: 'number', minimum: 0 },
                pct: { type: 'number', minimum: 0, maximum: 100 },
                free_hours: { type: 'number', minimum: 0 }, max: { type: 'number', minimum: 0 },
                min: { type: 'number', minimum: 0 }, requires_proof: { type: 'boolean' }, not_allowed: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
});

/** Find the contract block for a carrier (by name, SCAC or alias) that is in force on `date`. */
export function contractFor(contract, carrier, date) {
  const list = (contract && contract.carriers) || [];
  const k = carrierKey(carrier);
  const hits = list.filter((c) => [c.carrier, c.scac, ...(c.aliases || [])].filter(Boolean).some((n) => carrierKey(n) === k));
  const d = isoDate(date);
  const live = hits.filter((c) => !d || ((!c.effective || d >= c.effective) && (!c.expires || d <= c.expires)));
  return { block: live[0] || null, expired: !live.length && hits.length ? hits[0] : null };
}

/** Best lane for a shipment: the most specific matching origin and destination. */
export function laneFor(block, shipment) {
  if (!block || !block.lanes) return null;
  const spec = (p) => { const s = str(p); return s === '*' || !s ? 0 : /^\d{5}$/.test(s) ? 5 : /,/.test(s) ? 4 : /^\d{3}$|^[A-Z]\d[A-Z]$/i.test(s) ? 3 : /^\d{3}-\d{3}$/.test(s) ? 2 : 1; };
  const mode = str(shipment.mode).toLowerCase();
  const cands = block.lanes.filter((l) => placeMatches(l.origin, shipment.origin) && placeMatches(l.destination, shipment.destination) && (!l.mode || l.mode === 'any' || !mode || l.mode === mode) && (l.class === undefined || num(shipment.class) === null || num(shipment.class) === l.class));
  cands.sort((a, b) => spec(b.origin) + spec(b.destination) - (spec(a.origin) + spec(a.destination)));
  return cands[0] || null;
}

/** Linehaul a lane allows for a shipment (before fuel and accessorials). */
export function laneLinehaul(lane, shipment, block = {}) {
  if (!lane) return null;
  const miles = num(shipment.miles), lbs = num(shipment.weight), pallets = num(shipment.pallets);
  let v = null;
  switch (lane.basis) {
    case 'flat': v = lane.rate; break;
    case 'per_mile': v = miles === null ? null : lane.rate * miles; break;
    case 'per_cwt': v = lbs === null ? null : lane.rate * Math.max(lbs, 0) / 100; break;
    case 'per_lb': v = lbs === null ? null : lane.rate * lbs; break;
    case 'per_kg': v = lbs === null ? null : lane.rate * lbs; break;
    case 'per_pallet': v = pallets === null ? null : lane.rate * pallets; break;
    default: v = null;
  }
  if (v === null) return null;
  if (block.discount_pct) v = v * (1 - block.discount_pct / 100);
  const min = Math.max(lane.minimum || 0, block.minimum_charge || 0);
  return round2(Math.max(v, min));
}

/** Fuel surcharge a contract allows for a given diesel price, linehaul and miles. */
export function contractFuel(block, dieselPrice, linehaul, miles) {
  if (!block || !block.fuel || dieselPrice === null || dieselPrice === undefined) return null;
  const row = block.fuel.table.find((r) => dieselPrice >= r.min && (r.max === undefined || dieselPrice < r.max));
  if (!row) return null;
  if (block.fuel.basis === 'pct_of_linehaul') return linehaul === null ? null : round2(linehaul * row.value / 100);
  return miles === null || miles === undefined ? null : round2(row.value * miles);
}

/** Diesel price for the week a shipment moved (the latest index entry on or before the date). */
export function dieselFor(index, date) {
  const d = isoDate(date);
  if (!d || !Array.isArray(index)) return null;
  const rows = index.filter((r) => r.week_of <= d).sort((a, b) => (a.week_of < b.week_of ? 1 : -1));
  return rows.length ? rows[0].price : null;
}

/** Allowed amount for one accessorial under a contract block. */
export function accessorialAllowed(block, code, { hours = null, weight = null, linehaul = null } = {}) {
  const rule = block && block.accessorials && block.accessorials[code];
  if (!rule) return { rule: null, allowed: null };
  if (rule.not_allowed) return { rule, allowed: 0 };
  let v = null;
  if (rule.amount !== undefined) v = rule.amount;
  if (rule.per_hour !== undefined) v = hours === null ? null : Math.max(0, hours - (rule.free_hours || 0)) * rule.per_hour;
  if (rule.per_cwt !== undefined) v = weight === null ? null : (weight / 100) * rule.per_cwt;
  if (rule.pct !== undefined) v = linehaul === null ? null : linehaul * rule.pct / 100;
  if (v !== null && rule.min !== undefined) v = Math.max(v, rule.min);
  if (v !== null && rule.max !== undefined) v = Math.min(v, rule.max);
  return { rule, allowed: v === null ? null : round2(v) };
}

/** Group rows by a key function into a Map, keeping order. */
export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}

/** The contract's own name for a carrier given any of its names, SCAC or aliases; the input when no block names it. */
export function canonicalCarrier(contract, name) {
  const k = carrierKey(name);
  const b = ((contract && contract.carriers) || []).find((c) => [c.carrier, c.scac, ...(c.aliases || [])].filter(Boolean).some((n) => carrierKey(n) === k));
  return b ? b.carrier : str(name);
}
