// ASC X12 reader for the transport transaction sets the Lodestar agents use:
// 204 (load tender), 210 (freight invoice), 214 (shipment status), 990
// (response to a load tender) and 997/999 (functional acknowledgements).
//
// It reads the envelope (ISA/GS/ST and their trailers), checks the control
// numbers and counts, and turns each transaction into a flat record. Element
// positions follow the public X12 structure as recalled for version 004010;
// they were not checked against the licensed X12 implementation guides, and
// trading partners often differ. Every record keeps its raw segments so a person
// can check what was read.

const clean = (s) => String(s ?? '').trim();
/** N2 numbers (two implied decimals): "123456" is 1234.56. Plain decimals pass through. */
export const n2 = (v) => { const s = clean(v); if (!s) return null; if (/^-?\d+$/.test(s)) return Number(s) / 100; const n = Number(s); return Number.isFinite(n) ? n : null; };
const plain = (v) => { const s = clean(v); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const x12Date = (d) => { const s = clean(d); if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; if (/^\d{6}$/.test(s)) return `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`; return null; };
const x12Time = (t) => { const s = clean(t); return /^\d{4}/.test(s) ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : null; };
export const x12DateTime = (d, t) => { const day = x12Date(d); if (!day) return null; const tm = x12Time(t); return tm ? `${day}T${tm}:00` : day; };

/** Detect the delimiters from the ISA segment. */
export function x12Delimiters(text) {
  const s = String(text).replace(/^﻿/, '');
  const at = s.indexOf('ISA');
  if (at < 0) throw new Error('not an X12 file: no ISA segment');
  const isa = s.slice(at);
  const element = isa[3];
  if (!element || /[A-Za-z0-9\s]/.test(element)) throw new Error('not an X12 file: ISA has no element separator');
  // ISA has 16 elements; the 16th (component separator) is one character, then the segment terminator.
  let pos = 0, count = 0;
  while (count < 16 && pos < isa.length) { if (isa[pos] === element) count++; pos++; }
  if (count < 16) throw new Error('ISA segment is cut short');
  const component = isa[pos];
  let segment = isa[pos + 1];
  if (segment === '\r' && isa[pos + 2] === '\n') segment = '\r\n';
  if (!segment) throw new Error('ISA segment has no terminator');
  return { element, component, segment, start: at };
}

/** Split an X12 file into segments (arrays of elements). Line breaks after terminators are ignored. */
export function x12Segments(text) {
  const d = x12Delimiters(text);
  const body = String(text).replace(/^﻿/, '').slice(d.start);
  const term = d.segment.trim() === '' ? /\r?\n/ : new RegExp(`${d.segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`);
  const segs = body.split(term).map((s) => s.replace(/^[\r\n]+/, '')).filter((s) => s.trim() !== '');
  return { delimiters: d, segments: segs.map((s, i) => ({ n: i + 1, id: s.split(d.element)[0].trim(), el: s.split(d.element), raw: s })) };
}

/**
 * Parse an X12 interchange into envelopes and transactions and check its
 * structure. Returns { interchanges, transactions, problems }.
 */
export function parseX12(text, { maxTransactions = 50000 } = {}) {
  const { delimiters, segments } = x12Segments(text);
  const problems = [];
  const interchanges = []; const transactions = [];
  let isa = null, gs = null, st = null;
  const p = (seg, code, message) => problems.push({ segment: seg ? seg.n : null, code, message });
  for (const seg of segments) {
    const e = seg.el;
    switch (seg.id) {
      case 'ISA':
        if (isa) p(seg, 'isa_not_closed', `ISA ${clean(isa.el[13])} has no IEA before the next ISA`);
        isa = { ...seg, control: clean(e[13]), sender: clean(e[6]), receiver: clean(e[8]), date: x12Date(e[9]), groups: 0 };
        interchanges.push({ control: isa.control, sender: isa.sender, receiver: isa.receiver, date: isa.date, version: clean(e[12]), usage: clean(e[15]) === 'T' ? 'test' : clean(e[15]) === 'P' ? 'production' : clean(e[15]) });
        break;
      case 'GS':
        if (!isa) p(seg, 'gs_outside_isa', 'GS before any ISA');
        if (gs) p(seg, 'gs_not_closed', `GS ${clean(gs.el[6])} has no GE`);
        gs = { ...seg, control: clean(e[6]), functional: clean(e[1]), version: clean(e[8]), sets: 0 };
        if (isa) isa.groups++;
        break;
      case 'ST':
        if (!gs) p(seg, 'st_outside_gs', 'ST before any GS');
        if (st) p(seg, 'st_not_closed', `ST ${clean(st.control)} has no SE`);
        st = { set: clean(e[1]), control: clean(e[2]), start: seg.n, segments: [seg] };
        if (gs) gs.sets++;
        break;
      case 'SE': {
        if (!st) { p(seg, 'se_outside_st', 'SE without ST'); break; }
        st.segments.push(seg);
        const declared = Number(clean(e[1])), actual = st.segments.length;
        if (declared !== actual) p(seg, 'se_count', `transaction ${st.set} ${st.control}: SE says ${declared} segment(s), found ${actual}`);
        if (clean(e[2]) !== st.control) p(seg, 'se_control', `transaction ${st.set}: SE control ${clean(e[2])} does not match ST control ${st.control}`);
        if (transactions.length < maxTransactions) transactions.push({ set: st.set, control: st.control, group: gs ? gs.control : null, interchange: isa ? isa.control : null, segments: st.segments });
        st = null; break;
      }
      case 'GE':
        if (!gs) { p(seg, 'ge_outside_gs', 'GE without GS'); break; }
        if (Number(clean(e[1])) !== gs.sets) p(seg, 'ge_count', `group ${gs.control}: GE says ${clean(e[1])} transaction(s), found ${gs.sets}`);
        if (clean(e[2]) !== gs.control) p(seg, 'ge_control', `GE control ${clean(e[2])} does not match GS control ${gs.control}`);
        gs = null; break;
      case 'IEA':
        if (!isa) { p(seg, 'iea_outside_isa', 'IEA without ISA'); break; }
        if (Number(clean(e[1])) !== isa.groups) p(seg, 'iea_count', `interchange ${isa.control}: IEA says ${clean(e[1])} group(s), found ${isa.groups}`);
        if (clean(e[2]) !== isa.control) p(seg, 'iea_control', `IEA control ${clean(e[2])} does not match ISA control ${isa.control}`);
        isa = null; break;
      default:
        if (st) st.segments.push(seg); else p(seg, 'segment_outside_st', `${seg.id} outside a transaction`);
    }
  }
  if (st) p(null, 'st_not_closed', `transaction ${st.set} ${st.control} has no SE`);
  if (gs) p(null, 'gs_not_closed', `group ${gs.control} has no GE`);
  if (isa) p(null, 'isa_not_closed', `interchange ${isa.control} has no IEA`);
  return { delimiters: { element: delimiters.element, component: delimiters.component, segment: delimiters.segment === '\r\n' ? '\\r\\n' : delimiters.segment }, interchanges, transactions, problems };
}

// --------------------------------------------------------------- extractors ----

const party = (segs, i) => {
  // N1 loop: N1, optional N2, N3 (street), N4 (city, state, postal, country)
  const n1 = segs[i].el; const out = { role: clean(n1[1]), name: clean(n1[2]), id: clean(n1[4]) };
  for (let j = i + 1; j < segs.length && ['N2', 'N3', 'N4'].includes(segs[j].id); j++) {
    const e = segs[j].el;
    if (segs[j].id === 'N3') out.street = clean(e[1]);
    if (segs[j].id === 'N4') Object.assign(out, { city: clean(e[1]), state: clean(e[2]), postal: clean(e[3]), country: clean(e[4]) || undefined });
  }
  return out;
};
const refs = (segs) => Object.fromEntries(segs.filter((s) => s.id === 'L11' || s.id === 'N9').map((s) => [clean(s.id === 'L11' ? s.el[2] : s.el[1]), clean(s.id === 'L11' ? s.el[1] : s.el[2])]).filter(([k, v]) => k && v));
const pick = (parties, ...roles) => parties.find((x) => roles.includes(x.role)) || null;

/** 210 Motor Carrier Freight Details and Invoice → one invoice record with charge lines. */
export function read210(tx) {
  const s = tx.segments; const b3 = (s.find((x) => x.id === 'B3') || { el: [] }).el;
  const parties = s.map((x, i) => (x.id === 'N1' ? party(s, i) : null)).filter(Boolean);
  const lines = []; let weight = null, l3 = null;
  for (const x of s) {
    if (x.id === 'L1') lines.push({ line: clean(x.el[1]), rate: plain(x.el[2]), rate_qualifier: clean(x.el[3]), amount: n2(x.el[4]), code: clean(x.el[8]), description: clean(x.el[12]) || clean(x.el[8]) });
    if (x.id === 'L0' && weight === null) weight = plain(x.el[4]);
    if (x.id === 'L3') l3 = { weight: plain(x.el[1]), charge: n2(x.el[5]) };
  }
  const shipper = pick(parties, 'SH'), consignee = pick(parties, 'CN', 'ST'), billTo = pick(parties, 'BT');
  return {
    set: '210', control: tx.control,
    invoice_number: clean(b3[2]), shipment_id: clean(b3[3]), payment_method: clean(b3[4]),
    invoice_date: x12Date(b3[6]), amount: n2(b3[7]), delivery_date: x12Date(b3[9]), scac: clean(b3[11]),
    weight: (l3 && l3.weight) ?? weight, total_from_l3: l3 ? l3.charge : null,
    origin: shipper ? { city: shipper.city, state: shipper.state, postal: shipper.postal } : null,
    destination: consignee ? { city: consignee.city, state: consignee.state, postal: consignee.postal } : null,
    shipper: shipper && shipper.name, consignee: consignee && consignee.name, bill_to: billTo && billTo.name,
    references: refs(s), charges: lines, segments: s.length,
  };
}

/** Status codes seen in 214 AT7 segments (subset, recalled). */
export const STATUS_214 = Object.freeze({ X3: 'arrived_pickup', AF: 'departed_pickup', CP: 'completed_loading', X1: 'arrived_delivery', D1: 'completed_unloading', CD: 'departed_delivery', AG: 'estimated_delivery', X6: 'en_route', AB: 'appointment_pickup', AA: 'appointment_delivery', A9: 'shipment_damaged', SD: 'shipment_delayed', AP: 'delivery_not_completed', X2: 'estimated_arrival' });

/** 214 Shipment Status → one record per AT7 status event. */
export function read214(tx) {
  const s = tx.segments; const b10 = (s.find((x) => x.id === 'B10') || { el: [] }).el;
  const events = [];
  let stop = null, place = null;
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    if (x.id === 'LX') stop = clean(x.el[1]);
    if (x.id === 'MS1') place = { city: clean(x.el[1]), state: clean(x.el[2]), country: clean(x.el[3]) || undefined };
    if (x.id === 'AT7') {
      const code = clean(x.el[1]) || clean(x.el[3]);
      events.push({ stop, status_code: code, status: STATUS_214[code] || 'other', reason_code: clean(x.el[2]) || clean(x.el[4]) || null, at: x12DateTime(x.el[5], x.el[6]), time_zone: clean(x.el[7]) || null, place });
    }
  }
  return { set: '214', control: tx.control, pro: clean(b10[1]), shipment_id: clean(b10[2]), scac: clean(b10[3]), references: refs(s), events, segments: s.length };
}

/** 204 Motor Carrier Load Tender → one tender with stops. */
export function read204(tx) {
  const s = tx.segments; const b2 = (s.find((x) => x.id === 'B2') || { el: [] }).el; const b2a = (s.find((x) => x.id === 'B2A') || { el: [] }).el;
  const stops = []; let cur = null;
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    if (x.id === 'S5') { cur = { seq: clean(x.el[1]), reason: clean(x.el[2]), weight: plain(x.el[3]), dates: [] }; stops.push(cur); }
    if (x.id === 'G62' && cur) cur.dates.push({ qualifier: clean(x.el[1]), at: x12DateTime(x.el[2], x.el[4]) });
    if (x.id === 'N1' && cur) Object.assign(cur, { party: party(s, i) });
  }
  const l3 = s.find((x) => x.id === 'L3');
  return { set: '204', control: tx.control, scac: clean(b2[2]), shipment_id: clean(b2[4]), payment_method: clean(b2[6]), purpose: clean(b2a[1]) || null, references: refs(s), stops, weight: l3 ? plain(l3.el[1]) : null, amount: l3 ? n2(l3.el[5]) : null, segments: s.length };
}

/** 990 Response to a Load Tender. */
export function read990(tx) {
  const b1 = (tx.segments.find((x) => x.id === 'B1') || { el: [] }).el;
  const code = clean(b1[4]);
  return { set: '990', control: tx.control, scac: clean(b1[1]), shipment_id: clean(b1[2]), date: x12Date(b1[3]), action_code: code, action: code === 'A' ? 'accepted' : code === 'D' ? 'declined' : code === 'R' ? 'delete' : code ? 'other' : null, references: refs(tx.segments), segments: tx.segments.length };
}

/** 997 / 999 Functional acknowledgement. */
export function read997(tx) {
  const s = tx.segments; const ak1 = (s.find((x) => x.id === 'AK1') || { el: [] }).el; const ak9 = (s.find((x) => x.id === 'AK9') || { el: [] }).el;
  const sets = s.filter((x) => x.id === 'AK2').map((x) => ({ set: clean(x.el[1]), control: clean(x.el[2]) }));
  const statuses = s.filter((x) => x.id === 'AK5' || x.id === 'IK5').map((x) => clean(x.el[1]));
  sets.forEach((x, i) => { x.status = statuses[i] || null; });
  const code = clean(ak9[1]);
  return { set: tx.set, control: tx.control, acknowledges_group: clean(ak1[2]), functional: clean(ak1[1]), group_status: code === 'A' ? 'accepted' : code === 'E' ? 'accepted_with_errors' : code === 'R' ? 'rejected' : code === 'P' ? 'partially_accepted' : code || null, sets, segments: s.length };
}

export const X12_READERS = Object.freeze({ 204: read204, 210: read210, 214: read214, 990: read990, 997: read997, 999: read997 });

/** Parse and read every supported transaction in an X12 file. */
export function readX12(text, opts) {
  const p = parseX12(text, opts);
  const records = []; const skipped = {};
  for (const tx of p.transactions) {
    const fn = X12_READERS[tx.set];
    if (!fn) { skipped[tx.set] = (skipped[tx.set] || 0) + 1; continue; }
    try { records.push({ interchange: tx.interchange, group: tx.group, ...fn(tx) }); } catch (e) { p.problems.push({ segment: tx.segments[0] && tx.segments[0].n, code: 'read_failed', message: `${tx.set} ${tx.control}: ${String(e.message || e).slice(0, 200)}` }); }
  }
  return { ...p, transactions: undefined, transaction_count: p.transactions.length, records, skipped_sets: skipped };
}

/** Flatten 210 records into one row per invoice (for agents that take invoice tables). */
export function invoicesFrom210(records) {
  return records.filter((r) => r.set === '210').map((r) => ({
    invoice_number: r.invoice_number, pro: r.shipment_id, carrier: r.scac, invoice_date: r.invoice_date, delivery_date: r.delivery_date, amount: r.amount, weight: r.weight,
    origin_city: r.origin && r.origin.city, origin_state: r.origin && r.origin.state, origin_postal: r.origin && r.origin.postal,
    dest_city: r.destination && r.destination.city, dest_state: r.destination && r.destination.state, dest_postal: r.destination && r.destination.postal,
    bol: r.references.BM || r.references.BOL || '', po: r.references.PO || '', charges: r.charges,
  }));
}
