// Algol's domain memory: vendor records a named person has confirmed are the same
// carrier (an old and a new vendor id, a factoring company's record, a name used
// before a merger). One kind, and it only widens the search: invoices under those
// records are compared with each other as if they were one vendor. Nothing learned
// can mark a payment as fine or hide a group.
import { memoryTools } from 'lodestar-core';

export const MEMORY_KINDS = Object.freeze({
  same_vendor: {
    description: 'Two or more vendor names or vendor ids that are one carrier, e.g. {"vendors": ["Ridgeline Freight", "V-2207", "Ridgeline Frt LLC"], "reason": "second vendor record created 2024"}.',
    effect: 'compares invoices under those vendor records with each other as one vendor in every duplicate search (more matches, never fewer)',
    schema: { type: 'object', additionalProperties: false, required: ['vendors'], properties: { vendors: { type: 'array', minItems: 2, maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 120 } }, reason: { type: 'string', maxLength: 300 } } },
  },
});
export const MEMORY = memoryTools('algol', MEMORY_KINDS);

/** Accepted same-vendor groups for findDuplicates. */
export const vendorGroups = (ctx) => (ctx && typeof ctx.memoryFacts === 'function' ? ctx.memoryFacts('same_vendor') : []).map((f) => ({ id: f.id, vendors: f.value.vendors }));
