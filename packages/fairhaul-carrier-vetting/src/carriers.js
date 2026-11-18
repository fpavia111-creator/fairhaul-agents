// Fairhaul Carrier Vetting: warning signs in the carrier master and booked loads. Pure functions.
// Signals, not verdicts: every one has an innocent explanation a person checks.
import { str, groupBy, isoDate, daysBetween, carrierGrouper, sameCarrier } from 'fairhaul-core';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
export const CARRIER_FIELDS = Object.freeze({
  carrier_id: t(['Carrier ID', 'Vendor ID', 'Code', 'SCAC'], { required: true }),
  name: t(['Carrier', 'Carrier Name', 'Legal Name', 'Name'], { required: true }),
  mc: t(['MC', 'MC Number', 'Docket']),
  dot: t(['DOT', 'USDOT', 'DOT Number']),
  phone: t(['Phone', 'Dispatch Phone', 'Contact Phone']),
  email: t(['Email', 'Dispatch Email', 'Contact Email']),
  address: t(['Address', 'Street', 'Physical Address']),
  remit_to: t(['Remit To', 'Remit Name', 'Payee']),
  bank_last4: t(['Bank Last 4', 'Account Last 4', 'Bank Account']),
  bank_changed: t(['Bank Changed', 'Remit Changed', 'Payment Info Changed'], { type: 'date' }),
  authority_date: t(['Authority Date', 'Authority Granted', 'MC Granted'], { type: 'date' }),
  insurance_expiry: t(['Insurance Expiry', 'COI Expiry', 'Insurance Expires', 'Cargo Insurance Expiry'], { type: 'date' }),
  safety_rating: t(['Safety Rating', 'Rating']),
  status: t(['Status', 'Carrier Status']),
});
export const LOAD_FIELDS = Object.freeze({
  load_id: t(['Load ID', 'Shipment ID', 'Load'], { required: true }),
  carrier_id: t(['Carrier ID', 'Vendor ID', 'Code', 'SCAC'], { required: true }),
  pickup_date: t(['Pickup Date', 'Ship Date', 'Pickup'], { type: 'date' }),
  booked_at: t(['Booked', 'Booked At', 'Tender Date'], { type: 'date' }),
  value: t(['Cargo Value', 'Value'], { type: 'money' }),
  dispatch_phone: t(['Dispatch Phone', 'Driver Phone', 'Phone']),
  dispatch_email: t(['Dispatch Email', 'Email']),
});
const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|aol|icloud|proton(mail)?|gmx|mail|yandex)\./i;
const digits = (v) => str(v).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const norm = (v) => str(v).toLowerCase().replace(/[^a-z0-9]/g, '');
export const WEIGHTS = { on_watch_list: 5, shared_bank: 5, shared_phone: 3, shared_email: 3, duplicate_mc: 4, contact_differs_on_load: 4, unsatisfactory_rating: 5, insurance_expired: 4, bank_changed_recently: 3, new_authority: 2, insurance_expiring: 1, remit_to_other_name: 1, free_email: 1, shared_address: 1, conditional_rating: 1, missing_mc_dot: 2 };
const LEVEL = (s) => (s >= 5 ? 'high' : s >= 2 ? 'medium' : s > 0 ? 'low' : 'none');

/** Score each carrier on warning signs; flag booked loads on carriers that score high or medium. */
export function vetCarriers(carriers, loads = [], { asOf, newAuthorityDays = 180, expiringDays = 30, bankChangeDays = 30, watch = [] } = {}) {
  const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  const signals = new Map(carriers.map((c) => [str(c.carrier_id), []]));
  const add = (c, code, detail) => signals.get(str(c.carrier_id)).push({ code, weight: WEIGHTS[code], detail });
  const active = carriers.filter((c) => !/inactive|blocked|do not use/i.test(str(c.status)));
  const isActive = new Set(active);
  const groupName = carrierGrouper(carriers.map((c) => c.name));
  // Name at most five other carriers in a detail, so a value shared by hundreds stays readable (and fast).
  const others = (list, c) => { const o = list.filter((x) => x !== c); const named = o.slice(0, 5).map((x) => `${x.name} (${x.carrier_id}${isActive.has(x) ? '' : `, ${str(x.status).toLowerCase()}`})`).join(', '); return o.length > 5 ? `${named} and ${o.length - 5} more` : named; };
  const shared = (field, f, code, label) => {
    // Inactive and blocked carriers are compared too: a blocked carrier's bank account or
    // phone turning up under a new name is the sign that matters most. Only active
    // carriers get the signal.
    for (const [k, list] of groupBy(carriers.filter((c) => f(c[field])), (c) => f(c[field]))) {
      const names = new Set(list.map((c) => groupName(c.name))); if (names.size < 2) continue;
      for (const c of list.filter((x) => isActive.has(x))) add(c, code, `${label} ${field === 'bank_last4' ? `ending ${k}` : str(c[field])} is also on ${others(list, c)}.`);
    }
  };
  shared('bank_last4', (v) => digits(v).slice(-4), 'shared_bank', 'Bank account');
  shared('phone', (v) => digits(v), 'shared_phone', 'Phone');
  shared('email', (v) => str(v).toLowerCase(), 'shared_email', 'Email');
  shared('address', norm, 'shared_address', 'Address');
  shared('mc', (v) => digits(v), 'duplicate_mc', 'MC');
  // Watch list (accepted domain memory): a detail seen before in a fraud attempt.
  const watched = (type, v) => { const s = str(v); if (!s) return null; return watch.find((w) => w.type === type && (type === 'phone' || type === 'mc' || type === 'dot' ? digits(w.value) && digits(w.value) === digits(s) : type === 'bank_last4' ? digits(s).slice(-4) === digits(w.value) : type === 'email' ? w.value.trim().toLowerCase() === s.toLowerCase() : type === 'email_domain' ? s.toLowerCase().endsWith('@' + w.value.trim().toLowerCase().replace(/^@/, '')) : norm(w.value) === norm(s))) || null; };
  const watchHit = (c) => [['phone', c.phone], ['email', c.email], ['email_domain', c.email], ['mc', c.mc], ['dot', c.dot], ['bank_last4', c.bank_last4], ['address', c.address]].map(([t, v]) => { const w = watched(t, v); return w && { w, t }; }).filter(Boolean);
  for (const c of carriers) for (const { w, t } of watchHit(c)) if (signals.has(str(c.carrier_id))) add(c, 'on_watch_list', `${t.replace('_', ' ')} on your watch list (${w.id || 'learned'}): ${w.reason}`);
  for (const c of active) {
    if (!digits(c.mc) && !digits(c.dot)) add(c, 'missing_mc_dot', 'No MC or DOT number on file.');
    const auth = isoDate(c.authority_date); if (auth && daysBetween(auth, today) < newAuthorityDays) add(c, 'new_authority', `Authority granted ${auth}, ${daysBetween(auth, today)} days ago.`);
    const ins = isoDate(c.insurance_expiry);
    if (ins && ins < today) add(c, 'insurance_expired', `Insurance on file expired ${ins}.`);
    else if (ins && daysBetween(today, ins) <= expiringDays) add(c, 'insurance_expiring', `Insurance on file expires ${ins}.`);
    const bc = isoDate(c.bank_changed); if (bc && daysBetween(bc, today) <= bankChangeDays) add(c, 'bank_changed_recently', `Payment details changed ${bc}. Confirm by calling a number you already had, not one in the change request.`);
    if (str(c.remit_to) && !sameCarrier(c.remit_to, c.name)) add(c, 'remit_to_other_name', `Pays to ${c.remit_to}. Often a factoring company; ask for the notice of assignment.`);
    if (FREE_MAIL.test(str(c.email))) add(c, 'free_email', `Contact email ${c.email} is a free mailbox.`);
    if (/unsat/i.test(str(c.safety_rating))) add(c, 'unsatisfactory_rating', `Safety rating on file: ${c.safety_rating}.`);
    else if (/condit/i.test(str(c.safety_rating))) add(c, 'conditional_rating', `Safety rating on file: ${c.safety_rating}.`);
  }
  const byId = new Map(carriers.map((c) => [str(c.carrier_id).toUpperCase(), c]));
  const loadRows = [];
  for (const l of loads) {
    const c = byId.get(str(l.carrier_id).toUpperCase());
    if (!c) { loadRows.push({ load_id: str(l.load_id), carrier_id: str(l.carrier_id), carrier: '', pickup_date: isoDate(l.pickup_date), level: 'unknown', action: 'carrier not in the master; vet before pickup', reasons: 'not in carrier master' }); continue; }
    const reasons = [];
    if (str(l.dispatch_phone) && digits(c.phone) && digits(l.dispatch_phone) !== digits(c.phone)) reasons.push(`dispatch phone ${l.dispatch_phone} differs from the master ${c.phone}`);
    if (str(l.dispatch_email) && str(c.email) && str(l.dispatch_email).toLowerCase() !== str(c.email).toLowerCase()) reasons.push(`dispatch email ${l.dispatch_email} differs from the master ${c.email}`);
    for (const [t, v] of [['phone', l.dispatch_phone], ['email', l.dispatch_email], ['email_domain', l.dispatch_email]]) { const w = watched(t, v); if (w) reasons.push(`dispatch ${t.replace('_', ' ')} ${str(v)} is on your watch list: ${w.reason}`); }
    if (reasons.length && signals.has(str(c.carrier_id))) { const s = signals.get(str(c.carrier_id)); const n = s.filter((x) => x.code === 'contact_differs_on_load').length; if (n < 5) add(c, 'contact_differs_on_load', `Load ${l.load_id}: ${reasons.join('; ')}.`); else if (n === 5) add(c, 'contact_differs_on_load', 'More loads with different contact details; see the load list.'); }
    const ins = isoDate(c.insurance_expiry); const pu = isoDate(l.pickup_date);
    if (ins && pu && ins < pu) reasons.push(`insurance expires ${ins}, before pickup ${pu}`);
    loadRows.push({ load_id: str(l.load_id), carrier_id: str(c.carrier_id), carrier: str(c.name), pickup_date: pu, value: l.value ?? null, _c: c, reasons: reasons.join('; ') });
  }
  const rows = carriers.map((c) => {
    // Each kind of signal counts once in the score, however many loads or carriers raised it.
    const s = signals.get(str(c.carrier_id)) || []; const score = [...new Set(s.map((x) => x.code))].reduce((a, code) => a + WEIGHTS[code], 0);
    return { carrier_id: str(c.carrier_id), name: str(c.name), mc: str(c.mc), status: str(c.status) || 'active', score, level: /inactive|blocked|do not use/i.test(str(c.status)) ? 'inactive' : LEVEL(score), signals: [...new Set(s.map((x) => x.code))].join(' '), details: s.map((x) => x.detail), signal_list: s };
  }).sort((a, b) => b.score - a.score);
  const lvl = new Map(rows.map((r) => [r.carrier_id, r]));
  for (const l of loadRows) if (l._c) { const r = lvl.get(str(l._c.carrier_id)); l.level = r.level; l.action = r.level === 'high' || r.level === 'inactive' ? 'hold: verify by phone on a number you already had before releasing' : r.level === 'medium' || l.reasons ? 'verify before pickup' : 'none'; l.reasons = [l.reasons, r.signals].filter(Boolean).join('; '); delete l._c; }
  const order = { high: 0, inactive: 0, unknown: 1, medium: 2, low: 3, none: 4 };
  loadRows.sort((a, b) => order[a.level] - order[b.level]);
  const n = (v) => rows.filter((r) => r.level === v).length;
  return { as_of: today, carriers: rows.length, high: n('high'), medium: n('medium'), low: n('low'), clean: n('none'), loads: loadRows.length, loads_to_hold: loadRows.filter((l) => l.action.startsWith('hold') || l.level === 'unknown').length, loads_to_verify: loadRows.filter((l) => l.action === 'verify before pickup').length, rows, load_rows: loadRows };
}

/** Markdown for a verification request to one carrier. */
export function verificationText(r, id, a = {}) {
  const c = r.rows.find((x) => x.carrier_id === id);
  const asks = new Set();
  for (const s of c.signal_list) {
    if (/insurance/.test(s.code)) asks.add('A current certificate of insurance sent directly by your insurance agent, naming us as certificate holder.');
    if (s.code === 'remit_to_other_name') asks.add('The notice of assignment from your factoring company.');
    if (/bank/.test(s.code)) asks.add('Confirmation of your payment details. We will call you on the number we already hold before paying to any new account.');
    if (/shared|duplicate_mc|contact_differs/.test(s.code)) asks.add('Confirmation of your dispatch phone and email, and whether any other company books loads for you.');
    if (/new_authority|missing_mc_dot/.test(s.code)) asks.add('Your MC and USDOT numbers and the date your operating authority was granted.');
    if (/rating/.test(s.code)) asks.add('Any update on your safety rating or corrective action plan.');
  }
  const L = [`# Carrier verification: ${c.name}`, '', `**To:** ${a.to || '[TO CONFIRM: contact you already had for this carrier]'}`, `**From:** ${a.from || '[YOUR NAME]'}`, '', `Hello,`, '', `As part of our regular carrier review we would like to confirm a few details for ${c.name}${c.mc ? ` (MC ${c.mc})` : ''} before the next load.`, ''];
  for (const x of asks) L.push(`- ${x}`);
  L.push('', 'Thank you,', a.from || '[YOUR NAME]', '', '---', '', '[CHECK: internal note below, for your team only; delete it before this goes to the carrier]', '');
  for (const d of c.details) L.push(`- ${d}`);
  return L.join('\n');
}
