// Polaris audit logic: pure functions over grouped invoices, the contract and
// optional shipment and paid-history files. No I/O.
import { canonicalCarrier, chargeCode, contractFor, laneFor, laneLinehaul, contractFuel, dieselFor, accessorialAllowed, CHARGE_CODES, laneLabel, round2, str, num, carrierKey, hoursBetween } from 'lodestar-core';

const LINEHAUL = new Set(['linehaul']);
const SKIP = new Set(['linehaul', 'discount', 'fuel', 'tax']);

/** Index shipments by every id an invoice might carry. */
export function shipmentIndex(shipments = []) {
  const m = new Map();
  for (const s of shipments) for (const k of [s.shipment_id, s.pro, s.bol]) { const v = str(k).toLowerCase(); if (v && !m.has(v)) m.set(v, s); }
  return m;
}
const findShipment = (idx, inv) => [inv.pro, inv.bol, inv.po].map((k) => idx.get(str(k).toLowerCase())).find(Boolean) || null;
const orderedCodes = (s, aliases) => new Set(str(s && s.accessorials_ordered).split(/[;,|/]+/).map((x) => x.trim()).filter(Boolean).map((x) => chargeCode(x, aliases)));

/**
 * Audit every invoice. Returns per-invoice findings with the amount Polaris
 * thinks is disputable, and totals.
 *
 * Finding codes:
 *   duplicate_invoice, duplicate_pro, already_paid, lines_do_not_add_up,
 *   no_contract, contract_expired, no_lane, rate_needs_data,
 *   linehaul_over, fuel_over, fuel_not_checked, accessorial_not_allowed, accessorial_over,
 *   accessorial_unpriced, accessorial_not_ordered, weight_over_bol, quote_exceeded
 */
export function auditInvoices(invoices, { contract = {}, shipments = [], paid = [], tolerance } = {}) {
  const tol = num(tolerance) ?? num(contract.tolerance) ?? 1;
  const aliases = contract.charge_aliases || {};
  const sIdx = shipmentIndex(shipments);
  const seenInv = new Map(), seenPro = new Map();
  const paidKeys = new Set(paid.map((p) => `${carrierKey(p.carrier)}|${str(p.invoice_number).toLowerCase()}`));
  const paidPro = new Set(paid.map((p) => `${carrierKey(p.carrier)}|${str(p.pro).toLowerCase()}`).filter((k) => !k.endsWith('|')));
  const out = [];
  for (const inv of invoices) {
    const f = []; const add = (code, amount, detail) => f.push({ code, amount: amount === null || amount === undefined ? null : round2(amount), detail });
    const ck = carrierKey(inv.carrier);
    // Duplicates first: a duplicate is disputable in full and the other checks are moot.
    const invKey = `${ck}|${inv.invoice_number.toLowerCase()}`;
    const proKey = inv.pro ? `${ck}|${inv.pro.toLowerCase()}` : null;
    let dup = false;
    if (seenInv.has(invKey)) { add('duplicate_invoice', inv.total, `Invoice ${inv.invoice_number} appears more than once in this file (first seen on row group ${seenInv.get(invKey)}).`); dup = true; }
    else if (proKey && seenPro.has(proKey)) { add('duplicate_pro', inv.total, `PRO ${inv.pro} was already billed on invoice ${seenPro.get(proKey)}.`); dup = true; }
    if (!dup && paidKeys.has(invKey)) { add('already_paid', inv.total, `Invoice ${inv.invoice_number} is already in the paid history.`); dup = true; }
    else if (!dup && proKey && paidPro.has(proKey)) { add('already_paid', inv.total, `PRO ${inv.pro} is already in the paid history under another invoice.`); dup = true; }
    seenInv.set(invKey, seenInv.get(invKey) || inv.invoice_number); if (proKey && !seenPro.has(proKey)) seenPro.set(proKey, inv.invoice_number);

    if (inv.stated_total !== null && inv.lines_total !== null && Math.abs(inv.stated_total - inv.lines_total) > 0.005) add('lines_do_not_add_up', Math.max(0, inv.stated_total - inv.lines_total), `Charge lines add up to ${inv.lines_total}, the invoice says ${inv.stated_total}.`);

    const ship = findShipment(sIdx, inv);
    const date = inv.ship_date || (ship && ship.ship_date) || inv.invoice_date;
    const { block, expired } = contractFor(contract, inv.carrier, date);
    let allowedLinehaul = null, lane = null;
    const shipment = { origin: inv.origin, destination: inv.destination, weight: inv.weight ?? (ship && num(ship.weight)), miles: inv.miles, pallets: inv.pallets ?? (ship && num(ship.pallets)), class: inv.class, mode: inv.mode };
    if (!dup) {
      if (!block) add(expired ? 'contract_expired' : 'no_contract', null, expired ? `The contract for ${inv.carrier} ran ${expired.effective || '?'} to ${expired.expires || '?'}; this shipment is dated ${date || 'unknown'}.` : `No contract block names carrier "${inv.carrier}" (by name, SCAC or alias).`);
      else {
        lane = laneFor(block, shipment);
        if (!lane) add('no_lane', null, `No contract lane covers ${laneLabel(inv.origin, inv.destination)}.`);
        else {
          allowedLinehaul = laneLinehaul(lane, shipment, block);
          const billedLinehaul = round2(Object.entries(inv.by_code).filter(([c]) => LINEHAUL.has(c) || c === 'discount').reduce((s, [, v]) => s + v, 0));
          if (allowedLinehaul === null) add('rate_needs_data', null, `The lane is priced ${lane.basis.replace('_', ' ')} but the invoice has no ${lane.basis === 'per_mile' ? 'miles' : lane.basis === 'per_pallet' ? 'pallet count' : 'weight'}.`);
          else if (inv.lines.length && billedLinehaul - allowedLinehaul > tol) add('linehaul_over', billedLinehaul - allowedLinehaul, `Linehaul billed ${billedLinehaul}, contract allows ${allowedLinehaul} (${lane.basis.replace('_', ' ')} ${lane.rate}${lane.minimum ? `, minimum ${lane.minimum}` : ''}${block.discount_pct ? `, ${block.discount_pct}% discount` : ''}).`);
          else if (!inv.lines.length && inv.total - allowedLinehaul > tol && !block.fuel) add('linehaul_over', inv.total - allowedLinehaul, `Invoice total ${inv.total} with no charge breakdown; contract linehaul is ${allowedLinehaul}.`);
        }
        // Fuel
        const billedFuel = inv.by_code.fuel || 0;
        if (billedFuel) {
          const diesel = dieselFor(contract.fuel_index, date);
          const allowedFuel = contractFuel(block, diesel, allowedLinehaul, shipment.miles);
          if (allowedFuel === null) add('fuel_not_checked', null, !block.fuel ? 'The contract has no fuel table.' : diesel === null ? `No fuel_index price on or before ${date || 'the ship date'}.` : 'The fuel table has no row for that diesel price, or miles are missing.');
          else if (billedFuel - allowedFuel > tol) add('fuel_over', billedFuel - allowedFuel, `Fuel billed ${billedFuel}, contract allows ${allowedFuel} at diesel ${diesel}.`);
        }
        // Accessorials
        const ordered = ship ? orderedCodes(ship, aliases) : null;
        for (const [code, billed] of Object.entries(inv.by_code)) {
          if (SKIP.has(code) || billed <= 0) continue;
          const label = (CHARGE_CODES[code] || CHARGE_CODES.other).label;
          const hours = code === 'detention' && ship && ship.arrived_at && ship.departed_at ? hoursBetween(ship.arrived_at, ship.departed_at) : null;
          const { rule, allowed } = accessorialAllowed(block, code, { hours, weight: shipment.weight, linehaul: allowedLinehaul });
          if (!rule) { add('accessorial_unpriced', null, `${label} billed ${billed}; the contract does not price it. Ask the carrier for the basis or dispute it.`); continue; }
          if (rule.not_allowed) { add('accessorial_not_allowed', billed, `${label} billed ${billed}; the contract says this charge is not allowed.`); continue; }
          if (ordered && rule.requires_proof !== false && !ordered.has(code) && ['liftgate', 'residential', 'inside', 'appointment', 'limited_access', 'hazmat', 'sort_segregate'].includes(code)) { add('accessorial_not_ordered', billed, `${label} billed ${billed}, but the shipment record does not list it as ordered.`); continue; }
          if (allowed !== null && billed - allowed > tol) add('accessorial_over', billed - allowed, `${label} billed ${billed}, contract allows ${allowed}.`);
        }
      }
      if (ship) {
        const bolW = num(ship.weight);
        if (bolW && inv.weight && inv.weight > bolW * 1.05 && !inv.by_code.reweigh) add('weight_over_bol', null, `Billed weight ${inv.weight} is more than 5% over the BOL weight ${bolW} and no reweigh certificate charge is on the bill. Ask for the inspection certificate.`);
        const q = num(ship.quoted_amount);
        if (q !== null && inv.total - q > tol) add('quote_exceeded', null, `Invoice total ${inv.total} is ${round2(inv.total - q)} over the quoted ${q}. Check what changed.`);
      }
    }
    const disputable = round2(f.reduce((s, x) => s + (x.amount && x.amount > 0 ? x.amount : 0), 0));
    const capped = round2(Math.min(disputable, inv.total));
    const review = f.some((x) => x.amount === null);
    out.push({
      invoice_number: inv.invoice_number, carrier: canonicalCarrier(contract, inv.carrier), billed_as: inv.carrier, pro: inv.pro || null, bol: inv.bol || null, ship_date: date || null, lane: laneLabel(inv.origin, inv.destination),
      total: inv.total, contract_linehaul: allowedLinehaul, disputable: capped, approved_to_pay: round2(inv.total - capped),
      status: dup ? 'duplicate' : capped > 0 ? 'dispute' : review ? 'review' : 'ok',
      matched_shipment: ship ? ship.shipment_id : null, findings: f, lines: inv.lines,
    });
  }
  const sumOf = (k) => round2(out.reduce((s, x) => s + x[k], 0));
  const count = (st) => out.filter((x) => x.status === st).length;
  const byCode = {};
  for (const i of out) for (const x of i.findings) { byCode[x.code] = byCode[x.code] || { count: 0, amount: 0 }; byCode[x.code].count++; byCode[x.code].amount = round2(byCode[x.code].amount + (x.amount || 0)); }
  const carriers = {};
  for (const i of out) { const c = carriers[i.carrier] = carriers[i.carrier] || { invoices: 0, billed: 0, disputable: 0 }; c.invoices++; c.billed = round2(c.billed + i.total); c.disputable = round2(c.disputable + i.disputable); }
  return {
    invoices: out.length, billed: sumOf('total'), disputable: sumOf('disputable'), approved_to_pay: sumOf('approved_to_pay'),
    ok: count('ok'), dispute: count('dispute'), review: count('review'), duplicate: count('duplicate'),
    disputable_pct: sumOf('total') ? round2((sumOf('disputable') / sumOf('total')) * 100) : 0,
    by_finding: byCode, by_carrier: carriers, tolerance: tol, items: out,
  };
}

/** Markdown body of a dispute letter to one carrier, listing each disputed invoice and why. */
export function disputeText(items, { carrier, from, contact, reference }) {
  const rows = items.filter((i) => i.disputable > 0);
  const total = round2(rows.reduce((s, i) => s + i.disputable, 0));
  const lines = [
    `# Freight bill dispute: ${carrier}`,
    '',
    `**To:** ${contact || '[TO CONFIRM carrier billing contact]'}`,
    `**From:** ${from || '[TO CONFIRM your name and company]'}`,
    `**Reference:** ${reference || '[TO CONFIRM your account number with the carrier]'}`,
    '',
    `We reviewed ${rows.length} invoice(s) against our agreement with ${carrier} and dispute ${total} in total. The details are below. Please send corrected invoices or credit memos for these amounts.`,
    '',
    '| Invoice | PRO | Ship date | Billed | Disputed | Reason |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((i) => `| ${i.invoice_number} | ${i.pro || ''} | ${i.ship_date || ''} | ${i.total} | ${i.disputable} | ${i.findings.filter((x) => x.amount > 0).map((x) => x.detail).join(' ')} |`),
    '',
    `**Total disputed:** ${total}`,
    '',
    'Attached: [ATTACH contract pages or rate confirmation that apply]',
    '',
    'We will pay the undisputed balance of each invoice on our normal terms.',
  ];
  return { text: lines.join('\n'), total, invoices: rows.map((i) => i.invoice_number) };
}
