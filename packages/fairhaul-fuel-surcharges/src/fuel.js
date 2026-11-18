// Fairhaul Fuel Surcharges: fuel surcharges against fuel tables and the diesel index. Pure functions.
import { contractFor, contractFuel, dieselFor, canonicalCarrier, carrierKey, isoDate, daysBetween, round2, groupBy, str } from 'fairhaul-core';

const linehaulOf = (inv) => { const lh = (inv.by_code.linehaul || 0) + (inv.by_code.discount || 0); return inv.by_code.linehaul === undefined ? null : round2(lh); };
const weeks = (index) => [...(index || [])].sort((a, b) => (a.week_of < b.week_of ? -1 : 1));

/** Which index week's price reproduces the billed fuel, nearest the ship date first. */
export function weekBilled(block, index, billed, linehaul, miles, shipDate, tolerance = 0.5) {
  const hits = weeks(index).filter((w) => { const f = contractFuel(block, w.price, linehaul, miles); return f !== null && Math.abs(f - billed) <= tolerance; });
  if (!hits.length) return null;
  hits.sort((a, b) => Math.abs(daysBetween(a.week_of, shipDate)) - Math.abs(daysBetween(b.week_of, shipDate)));
  return hits[0];
}

/** Check each invoice's fuel line. */
export function checkFuel(invoices, contract = {}, { tolerance, staleDays = 7 } = {}) {
  const tol = tolerance ?? contract.tolerance ?? 1;
  const index = contract.fuel_index || [];
  const items = invoices.map((inv) => {
    const carrier = canonicalCarrier(contract, inv.carrier);
    const date = isoDate(inv.ship_date) || isoDate(inv.invoice_date);
    const billed = inv.by_code.fuel !== undefined ? round2(inv.by_code.fuel) : null;
    const lh = linehaulOf(inv);
    const base = { invoice_number: inv.invoice_number, carrier, ship_date: date, linehaul: lh, miles: inv.miles, billed, expected: null, diesel: null, index_week: null, difference: null, pct_of_linehaul: billed !== null && lh ? Math.round((billed / lh) * 1000) / 10 : null };
    const { block, expired } = contractFor(contract, inv.carrier, date);
    const out = (status, detail, extra = {}) => ({ ...base, ...extra, status, detail });
    if (!block) return out(expired ? 'contract_expired' : 'no_contract', expired ? `The contract for ${carrier} had expired on ${date}.` : `No contract for ${carrier}.`);
    if (!block.fuel) return billed ? out('fuel_not_in_contract', `${carrier} billed ${billed} fuel, but the contract has no fuel table.`) : out('ok', 'No fuel billed and none in the contract.');
    if (!date) return out('no_date', 'No ship or invoice date, so the diesel week is unknown.');
    const wk = weeks(index).filter((w) => w.week_of <= date).at(-1);
    if (!wk) return out('no_index', `Your fuel index has no week on or before ${date}. Add it to the contract file.`);
    const stale = daysBetween(wk.week_of, date) > staleDays;
    const diesel = dieselFor(index, date); const expected = contractFuel(block, diesel, lh, inv.miles);
    const ext = { diesel, index_week: wk.week_of, expected };
    if (expected === null) return out('not_checked', block.fuel.basis === 'per_mile' ? 'Fuel is per mile and the invoice has no miles.' : !lh ? 'Fuel is a percent of linehaul and the invoice has no linehaul line.' : `Diesel ${diesel} is outside every row of the ${carrier} fuel table.`, ext);
    if (billed === null) return out(expected > 0 ? 'fuel_not_billed' : 'ok', expected > 0 ? `No fuel line; the table allows ${expected}. Nothing to dispute; it may be billed later.` : 'No fuel due.', ext);
    const diff = round2(billed - expected);
    const staleNote = stale ? ` Your index has nothing within ${staleDays} days before ${date} (latest ${wk.week_of}); add the missing weeks.` : '';
    if (diff > tol) {
      const w = weekBilled(block, index, billed, lh, inv.miles, date, Math.max(tol, 0.5));
      const why = w && w.week_of !== wk.week_of ? ` It matches the diesel price for the week of ${w.week_of} (${w.price}) instead of ${wk.week_of} (${diesel}).` : '';
      return out(w && w.week_of !== wk.week_of ? 'wrong_week' : 'fuel_over', `Billed ${billed}; the table at diesel ${diesel} (week of ${wk.week_of}) gives ${expected}, ${diff} over.${why}${staleNote}`, { ...ext, difference: diff, week_billed: w ? w.week_of : null });
    }
    if (diff < -tol) return out('fuel_under', `Billed ${billed}, ${-diff} under the table (${expected}). Nothing to dispute; note it in case the carrier rebills.${staleNote}`, { ...ext, difference: diff });
    return out(stale ? 'index_stale' : 'ok', `Matches the table at diesel ${diesel}.${staleNote}`, { ...ext, difference: diff });
  });
  const over = items.filter((i) => ['fuel_over', 'wrong_week'].includes(i.status));
  const carriers = [...groupBy(items, (i) => i.carrier)].map(([carrier, l]) => { const b = l.filter((i) => i.billed !== null); const lh = b.reduce((s, i) => s + (i.linehaul || 0), 0); return { carrier, invoices: l.length, fuel_billed: round2(b.reduce((s, i) => s + i.billed, 0)), fuel_expected: round2(l.reduce((s, i) => s + (i.expected || 0), 0)), over: round2(l.filter((i) => i.difference > tol).reduce((s, i) => s + i.difference, 0)), wrong_week: l.filter((i) => i.status === 'wrong_week').length, avg_pct_of_linehaul: lh ? Math.round((b.reduce((s, i) => s + i.billed, 0) / lh) * 1000) / 10 : null }; }).sort((a, b) => b.over - a.over);
  const latest = weeks(index).at(-1) || null;
  return { invoices: items.length, fuel_billed: round2(items.reduce((s, i) => s + (i.billed || 0), 0)), disputable: round2(over.reduce((s, i) => s + i.difference, 0)), over: over.length, wrong_week: items.filter((i) => i.status === 'wrong_week').length, not_checked: items.filter((i) => ['not_checked', 'no_contract', 'no_index', 'no_date', 'contract_expired'].includes(i.status)).length, latest_index_week: latest, carriers, items };
}

/** Each carrier's fuel table side by side at a set of diesel prices, for one reference load. */
export function compareTables(contract = {}, { prices, linehaul = 1000, miles = 500, date } = {}) {
  const latest = weeks(contract.fuel_index).at(-1);
  const ps = (prices && prices.length ? prices : latest ? [round2(latest.price - 0.5), latest.price, round2(latest.price + 0.5)] : [3.5, 4, 4.5]).map(Number);
  // One row per carrier: the terms in force on the date (default: the latest index week), else its latest terms.
  const on = date || (latest && latest.week_of) || null;
  const live = (c) => !on || ((!c.effective || on >= c.effective) && (!c.expires || on <= c.expires));
  const picked = [...groupBy((contract.carriers || []).filter((c) => c.fuel), (c) => carrierKey(c.carrier))].map(([, l]) => l.find(live) || (date ? null : [...l].sort((a, b) => (str(a.effective) < str(b.effective) ? 1 : -1))[0])).filter(Boolean);
  const rows = picked.map((c) => {
    const cells = ps.map((p) => { const f = contractFuel(c, p, linehaul, miles); return { diesel: p, fuel: f, pct_of_linehaul: f === null ? null : Math.round((f / linehaul) * 1000) / 10 }; });
    return { carrier: c.carrier, basis: c.fuel.basis, terms: [c.effective, c.expires].filter(Boolean).join(' to ') || null, cells };
  });
  const at = (i) => rows.filter((r) => r.cells[i].fuel !== null).sort((a, b) => b.cells[i].fuel - a.cells[i].fuel);
  const mid = Math.floor(ps.length / 2);
  return { reference: { linehaul, miles }, prices: ps, carriers: rows, highest_at_middle_price: at(mid)[0] ? at(mid)[0].carrier : null, lowest_at_middle_price: at(mid).at(-1) ? at(mid).at(-1).carrier : null };
}

/** What a diesel move would have cost on these invoices. */
export function sensitivity(invoices, contract = {}, { step = 0.1 } = {}) {
  let base = 0, moved = 0, n = 0;
  const per = new Map();
  for (const inv of invoices) {
    const date = isoDate(inv.ship_date) || isoDate(inv.invoice_date); const { block } = contractFor(contract, inv.carrier, date);
    const d = dieselFor(contract.fuel_index, date); if (!block || !block.fuel || d === null) continue;
    const lh = linehaulOf(inv); const a = contractFuel(block, d, lh, inv.miles), b = contractFuel(block, round2(d + step), lh, inv.miles);
    if (a === null || b === null) continue;
    base += a; moved += b; n++; const c = canonicalCarrier(contract, inv.carrier); per.set(c, round2((per.get(c) || 0) + b - a));
  }
  return { step, invoices: n, fuel_at_index: round2(base), fuel_if_moved: round2(moved), change: round2(moved - base), by_carrier: [...per].map(([carrier, change]) => ({ carrier, change })).sort((x, y) => y.change - x.change) };
}

export function disputeText(items, { from, contact }) {
  const list = items.filter((i) => ['fuel_over', 'wrong_week'].includes(i.status));
  const total = round2(list.reduce((s, i) => s + i.difference, 0));
  return { total, invoices: list.map((i) => i.invoice_number), text: [
    `# Fuel surcharge dispute: ${list[0].carrier}`, '',
    `**To:** ${contact || `[TO CONFIRM ${list[0].carrier} billing contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `The fuel surcharge on ${list.length} invoice(s) is above the fuel table in our agreement at the diesel price for the week each load shipped. We ask for a credit of ${total}.`, '',
    '| Invoice | Shipped | Index week | Diesel | Billed | Table | Over |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...list.map((i) => `| ${i.invoice_number} | ${i.ship_date} | ${i.index_week} | ${i.diesel} | ${i.billed} | ${i.expected} | ${i.difference} |`), '',
    ...list.filter((i) => i.status === 'wrong_week').map((i) => `- ${i.invoice_number}: the amount matches the week of ${i.week_billed}, not the week the load shipped.`),
    '', 'Diesel prices are from the index named in our agreement: [TO CONFIRM index name and source].',
  ].join('\n') };
}
