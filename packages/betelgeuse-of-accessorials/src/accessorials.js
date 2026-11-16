// Betelgeuse: where accessorial charges come from, and how to stop the repeats. Pure functions.
import { contractFor, accessorialAllowed, canonicalCarrier, chargeCode, CHARGE_CODES, round2, str, groupBy } from 'lodestar-core';

const BASE = new Set(['linehaul', 'discount', 'fuel', 'tax', 'other']);
/** Accessorials a shipper can know about and order up front; the rest are caused by events at the dock. */
export const ORDERABLE = Object.freeze(['liftgate', 'residential', 'inside', 'limited_access', 'appointment', 'hazmat', 'sort_segregate', 'signature', 'saturday', 'declared_value', 'overlength', 'delivery_area']);
const FIX = { residential: 'Mark the address residential so quotes and tenders include it.', liftgate: 'Mark the address liftgate required (no dock) so it is ordered and quoted.', appointment: 'Mark the address appointment required.', limited_access: 'Mark the address limited access.', inside: 'Mark the address inside delivery.', delivery_area: 'Expect a delivery area surcharge; quote it in.', redelivery: 'Failed first attempts: confirm receiving hours and book an appointment.', detention: 'Repeated detention here: review dock times (Vega of Detention) and talk to the facility.', lumper: 'Lumper charges here: agree who pays and get receipts.', address_correction: 'Correct the address in your address book.', reweigh: 'Weights are being corrected here: check what your system sends.' };
const where = (x) => [str(x.dest_city || (x.destination && x.destination.city)), str(x.dest_state || (x.destination && x.destination.state)), str(x.dest_postal || (x.destination && x.destination.postal))].filter(Boolean).join(' ') || '(no destination)';

/** Analyse accessorial lines across invoices. */
export function analyse(invoices, shipments = [], contract = {}, { repeatAt = 2 } = {}) {
  const sIdx = new Map(); for (const s of shipments) for (const k of [s.shipment_id, s.pro, s.bol, s.po]) if (str(k)) sIdx.set(str(k).toLowerCase(), s);
  const lines = []; let freight = 0;
  for (const inv of invoices) {
    freight += inv.total || 0;
    const s = [inv.pro, inv.bol, inv.po, inv.invoice_number].map((k) => sIdx.get(str(k).toLowerCase())).find(Boolean) || null;
    const ordered = new Set(str(s && s.accessorials_ordered).split(/[;,|/]+/).map((x) => x.trim()).filter(Boolean).map((x) => chargeCode(x, contract.charge_aliases)));
    const { block } = contractFor(contract, inv.carrier, inv.ship_date);
    for (const l of inv.lines) {
      if (BASE.has(l.code) || !l.amount) continue;
      const { allowed, rule } = block ? accessorialAllowed(block, l.code, { weight: inv.weight }) : { allowed: null, rule: null };
      const over = allowed !== null && l.amount > allowed + (contract.tolerance ?? 1) ? round2(l.amount - allowed) : 0;
      lines.push({ invoice_number: inv.invoice_number, carrier: canonicalCarrier(contract, inv.carrier), ship_date: inv.ship_date, location: where(s || inv), shipment_id: s ? str(s.shipment_id) : null, code: l.code, label: (CHARGE_CODES[l.code] && CHARGE_CODES[l.code].label) || l.code, description: l.description, amount: l.amount, ordered: s ? ordered.has(l.code) : null, orderable: ORDERABLE.includes(l.code), contract_amount: allowed, not_allowed: !!(rule && rule.not_allowed), over });
    }
  }
  const total = round2(lines.reduce((a, l) => a + l.amount, 0));
  const by = (key) => [...groupBy(lines, key)].map(([k, ls]) => ({ key: k, count: ls.length, amount: round2(ls.reduce((a, l) => a + l.amount, 0)) })).sort((a, b) => b.amount - a.amount);
  const unordered = lines.filter((l) => l.orderable && l.ordered === false);
  const fixes = [];
  for (const [loc, ls] of groupBy(lines, (l) => l.location)) for (const [code, cs] of groupBy(ls, (l) => l.code)) {
    // A repeat ordered on every load is already in the address book; one missed even once is worth fixing.
    const n = new Set(cs.map((c) => c.invoice_number)).size;
    if (n >= repeatAt && cs.some((c) => !c.ordered) && FIX[code]) fixes.push({ location: loc, code, label: cs[0].label, times: n, amount: round2(cs.reduce((a, c) => a + c.amount, 0)), ordered_times: cs.filter((c) => c.ordered).length, carriers: [...new Set(cs.map((c) => c.carrier))].join(', '), fix: FIX[code] });
  }
  fixes.sort((a, b) => b.amount - a.amount);
  return {
    invoices: invoices.length, freight_total: round2(freight), accessorial_total: total, accessorial_share_pct: freight ? Math.round((total / freight) * 1000) / 10 : null,
    by_type: by((l) => l.label).map((x) => ({ type: x.key, count: x.count, amount: x.amount })),
    by_location: by((l) => l.location).map((x) => ({ location: x.key, count: x.count, amount: x.amount })),
    by_carrier: by((l) => l.carrier).map((x) => ({ carrier: x.key, count: x.count, amount: x.amount })),
    unordered: unordered.length, unordered_amount: round2(unordered.reduce((a, l) => a + l.amount, 0)),
    over_contract: lines.filter((l) => l.over > 0).length, over_amount: round2(lines.reduce((a, l) => a + l.over, 0)),
    not_matched: lines.filter((l) => l.ordered === null).length,
    fixes, lines,
  };
}

/** Address-book change list for the person who maintains the TMS. */
export function fixText(fixes, { from, system }) {
  const byLoc = groupBy(fixes, (f) => f.location);
  return [
    `# Address book changes${system ? ` for ${system}` : ''}`, '',
    `**To:** [TO CONFIRM who maintains the address book]`, `**From:** ${from || '[TO CONFIRM your name]'}`, '',
    `These locations keep producing the same accessorial charges without them being ordered. Updating the address book means quotes, tenders and BOLs include them, so they stop arriving as surprises. ${fixes.length} change(s) at ${byLoc.size} location(s).`, '',
    '| Location | Charge | Times billed | Times ordered | Billed | Change |', '| --- | --- | --- | --- | --- | --- |',
    ...fixes.map((f) => `| ${f.location} | ${f.label} | ${f.times} | ${f.ordered_times} | ${f.amount} | ${f.fix} |`), '',
    'Check each one with the customer or the receiving site before changing it; a one-off charge can be the carrier\'s mistake.',
  ].join('\n');
}
