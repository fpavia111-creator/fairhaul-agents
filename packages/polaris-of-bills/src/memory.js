// Polaris's domain memory: facts about one shipper's carriers that a named person
// has accepted, so the next audit does not have to be told again.
//
// Two kinds can change an audit, and the contract file always wins over both:
// - charge_alias: a carrier's own wording for a charge ("WAIT TIME", "DET-DRV") read
//   as one of Polaris's charge codes, so it is checked against the contract's terms
//   for that code instead of being flagged as an unknown charge.
// - carrier_alias: another name or SCAC a carrier bills under, so its invoices are
//   audited against that carrier's contract block instead of "no contract".
// Tolerances, rates, fuel prices and allowances are never learned: a remembered
// number could hide an overcharge. Accepting a fact is a one-click category.
import { memoryTools, CHARGE_CODES, carrierKey, str } from 'lodestar-core';

export const MEMORY_KINDS = Object.freeze({
  charge_alias: {
    description: `A carrier's wording for a charge, read as one of Polaris's charge codes, e.g. {"description": "WAIT TIME", "code": "detention"}. Codes: ${Object.keys(CHARGE_CODES).join(', ')}.`,
    effect: 'reads that charge wording as that code in every audit, so it is checked against the contract terms for the code (the contract\'s own charge_aliases win)',
    schema: { type: 'object', additionalProperties: false, required: ['description', 'code'], properties: { description: { type: 'string', minLength: 2, maxLength: 120 }, code: { type: 'string', enum: Object.keys(CHARGE_CODES) }, carrier: { type: 'string', maxLength: 120, description: 'Only for this carrier (optional; recorded for people, the alias applies to every carrier)' } } },
  },
  carrier_alias: {
    description: 'Another name or SCAC a carrier bills under, e.g. {"name": "RDGL", "carrier": "Ridgeline Freight"}. The carrier must be named in the contract.',
    effect: 'audits invoices billed under that name against the named carrier\'s contract block (a name the contract already gives to a carrier keeps that carrier)',
    schema: { type: 'object', additionalProperties: false, required: ['name', 'carrier'], properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, carrier: { type: 'string', minLength: 2, maxLength: 120 } } },
  },
});

export const MEMORY = memoryTools('polaris', MEMORY_KINDS);

const norm = (s) => str(s).toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The contract with accepted facts added where the contract says nothing.
 * Returns { contract, used: [{ id, kind, value }], skipped: [{ id, kind, value, why }] }.
 */
export function withLearned(contract, ctx) {
  const facts = (k) => (ctx && typeof ctx.memoryFacts === 'function' ? ctx.memoryFacts(k) : []);
  const out = { ...contract, charge_aliases: { ...(contract.charge_aliases || {}) }, carriers: (contract.carriers || []).map((c) => ({ ...c, aliases: [...(c.aliases || [])] })) };
  const used = []; const skipped = [];
  const own = new Set(Object.keys(contract.charge_aliases || {}).map(norm));
  for (const f of facts('charge_alias')) {
    const k = norm(f.value.description);
    if (own.has(k)) { skipped.push({ id: f.id, kind: f.kind, value: f.value, why: 'the contract already maps this wording' }); continue; }
    out.charge_aliases[f.value.description] = f.value.code; used.push({ id: f.id, kind: f.kind, value: f.value });
  }
  const names = (c) => [c.carrier, c.scac, ...(c.aliases || [])].filter(Boolean).map(carrierKey);
  for (const f of facts('carrier_alias')) {
    const target = out.carriers.find((c) => names(c).includes(carrierKey(f.value.carrier)));
    if (!target) { skipped.push({ id: f.id, kind: f.kind, value: f.value, why: `the contract names no carrier "${f.value.carrier}"` }); continue; }
    const taken = out.carriers.find((c) => names(c).includes(carrierKey(f.value.name)));
    if (taken) { if (taken !== target) skipped.push({ id: f.id, kind: f.kind, value: f.value, why: `the contract already gives "${f.value.name}" to ${taken.carrier}` }); continue; }
    target.aliases.push(f.value.name); used.push({ id: f.id, kind: f.kind, value: f.value });
  }
  return { contract: out, used, skipped };
}
