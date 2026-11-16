// Aldebaran's domain memory: contact details a named person has put on this
// broker's watch list (a phone, email domain, MC number or bank account ending
// seen in a fraud attempt). One kind, and it only adds warning signs: nothing
// learned can clear a signal, lower a score or vouch for a carrier.
import { memoryTools } from 'lodestar-core';

export const WATCH_TYPES = Object.freeze(['phone', 'email', 'email_domain', 'mc', 'dot', 'bank_last4', 'address']);
export const MEMORY_KINDS = Object.freeze({
  watch_contact: {
    description: `A contact detail seen in fraud or double brokering, e.g. {"type": "phone", "value": "312-555-0199", "reason": "used to redirect payment, March"}. Types: ${WATCH_TYPES.join(', ')}.`,
    effect: 'adds the on_watch_list warning sign (high) to every carrier in the master, and a hold reason to every booked load, that uses this detail (more warning signs, never fewer)',
    schema: { type: 'object', additionalProperties: false, required: ['type', 'value', 'reason'], properties: { type: { type: 'string', enum: [...WATCH_TYPES] }, value: { type: 'string', minLength: 2, maxLength: 200 }, reason: { type: 'string', minLength: 3, maxLength: 300 } } },
    check: (v) => (v.type === 'bank_last4' && !/^\d{4}$/.test(v.value.trim()) ? 'bank_last4 must be exactly four digits (never a full account number)' : v.type === 'email_domain' && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v.value.trim().replace(/^@/, '')) ? 'email_domain must look like example.com' : null),
  },
});
export const MEMORY = memoryTools('aldebaran', MEMORY_KINDS);

/** Accepted watch-list entries as vetCarriers options. */
export const watchList = (ctx) => (ctx && typeof ctx.memoryFacts === 'function' ? ctx.memoryFacts('watch_contact') : []).map((f) => ({ id: f.id, ...f.value }));
