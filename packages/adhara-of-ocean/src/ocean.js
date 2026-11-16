// Adhara: ocean freight invoices against the service contract. Pure functions.
import { isoDate, round2, str, num, carrierKey, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const OCEAN_LINE_FIELDS = Object.freeze({
  invoice_number: t(['Invoice Number', 'Invoice', 'Invoice #'], { required: true }),
  carrier: t(['Carrier', 'Line', 'Forwarder', 'Vendor'], { required: true }),
  bl: t(['BL', 'B/L', 'Bill of Lading', 'MBL', 'HBL'], { required: true }),
  pol: t(['POL', 'Port of Loading', 'Origin Port'], { required: true }),
  pod: t(['POD', 'Port of Discharge', 'Destination Port'], { required: true }),
  sailing_date: t(['Sailing Date', 'ETD', 'On Board Date', 'Departure'], { type: 'date' }),
  equipment: t(['Equipment', 'Container Type', 'Size Type', 'Size']),
  containers: t(['Containers', 'Container Count', 'Qty Containers', 'Units'], { type: 'number' }),
  charge_code: t(['Charge Code', 'Charge', 'Code', 'Description'], { required: true }),
  quantity: t(['Quantity', 'Qty'], { type: 'number' }),
  unit_rate: t(['Unit Rate', 'Rate'], { type: 'money' }),
  amount: t(['Amount', 'Charge Amount', 'Total'], { type: 'money', required: true }),
  currency: t(['Currency', 'Curr', 'CCY']),
});
const rateMap = { type: 'object', description: 'Amount per container by equipment type, e.g. {"20GP": 1800, "40HC": 2400}', additionalProperties: { type: 'number', minimum: 0 } };
export const OCEAN_CONTRACT_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['contracts'],
  properties: {
    note: { type: 'string' }, tolerance: { type: 'number', minimum: 0 },
    code_aliases: { type: 'object', description: 'Your invoice wording to a charge code, e.g. {"bunker adjustment": "BAF"}', additionalProperties: { type: 'string' } },
    contracts: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['carrier', 'lanes'], properties: {
      carrier: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' } }, reference: { type: 'string' }, currency: { type: 'string' },
      effective: { type: 'string', format: 'date' }, expires: { type: 'string', format: 'date' },
      lanes: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['pol', 'pod', 'rates'], properties: { pol: { type: 'string' }, pod: { type: 'string' }, rates: rateMap } } },
      surcharges: { type: 'object', description: 'Allowed surcharges by code', additionalProperties: { type: 'object', additionalProperties: false, properties: { per_container: rateMap, flat: { type: 'number', minimum: 0, description: 'Per bill of lading' }, valid_from: { type: 'string', format: 'date' }, valid_to: { type: 'string', format: 'date' }, included: { type: 'boolean', description: 'Included in the base rate; must not be billed' } } } },
    } } },
  },
});
const CODES = [['OFR', /ocean freight|base freight|basic freight|^ofr$|^frt$/], ['BAF', /bunker|^baf$|fuel/], ['LSS', /low sulphur|low sulfur|^lss$/], ['CAF', /currency adj|^caf$/], ['PSS', /peak season|^pss$|^gri$|general rate/], ['THC_O', /origin terminal|^othc$|thc.*origin|origin thc/], ['THC_D', /destination terminal|^dthc$|thc.*dest|dest.*thc/], ['DOC', /document|^doc$|b\/l fee|bl fee/], ['ISPS', /isps|security/], ['EBS', /emergency bunker|^ebs$/], ['CSC', /congestion|^csc$/], ['SEAL', /seal/]];
export function oceanCode(text, aliases = {}) { const s = str(text).toLowerCase().trim(); for (const [k, v] of Object.entries(aliases)) if (k.toLowerCase() === s) return v.toUpperCase(); for (const [c, re] of CODES) if (re.test(s)) return c; return s.toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'OTHER'; }
const port = (v) => str(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
const eq = (v) => str(v).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^(20|40|45)(DV|DRY|ST|STD)$/, '$1GP').replace(/^40HQ$/, '40HC');

/** Audit ocean invoices against contracts. */
export function auditOcean(rows, cfg) {
  const tol = cfg.tolerance ?? 1; const aliases = cfg.code_aliases || {};
  const bls = [...groupBy(rows, (r) => `${carrierKey(r.carrier)}|${str(r.invoice_number)}|${str(r.bl)}`)].map(([, ls]) => ls);
  const items = bls.map((ls) => {
    const r0 = ls[0]; const date = isoDate(r0.sailing_date); const findings = [];
    const add = (code, detail, amount = 0) => findings.push({ code, detail, amount: round2(amount) });
    const cands = cfg.contracts.filter((c) => [c.carrier, ...(c.aliases || [])].some((n) => carrierKey(n) === carrierKey(r0.carrier)));
    const live = cands.filter((c) => !date || ((!c.effective || date >= c.effective) && (!c.expires || date <= c.expires)));
    const contract = live[0] || null;
    const equipment = eq(r0.equipment); const boxes = num(r0.containers);
    const lines = ls.map((r) => ({ code: oceanCode(r.charge_code, aliases), description: str(r.charge_code), qty: num(r.quantity), amount: num(r.amount) || 0, currency: str(r.currency).toUpperCase() || null }));
    const billed = round2(lines.reduce((s, l) => s + l.amount, 0));
    const base = { invoice_number: str(r0.invoice_number), carrier: str(r0.carrier), bl: str(r0.bl), pol: port(r0.pol), pod: port(r0.pod), sailing_date: date, equipment, containers: boxes, billed, contract: contract ? contract.reference || contract.carrier : null };
    if (!contract) { add(cands.length ? 'contract_expired' : 'no_contract', cands.length ? `Sailing ${date} is outside every contract term for ${r0.carrier}.` : `No contract for ${r0.carrier}.`); return { ...base, findings, disputable: 0 }; }
    const ccy = contract.currency && lines.find((l) => l.currency && l.currency !== contract.currency.toUpperCase());
    if (ccy) add('currency_mismatch', `Billed in ${ccy.currency}; the contract is in ${contract.currency}. Amounts not compared until converted.`);
    const lane = contract.lanes.find((l) => port(l.pol) === base.pol && port(l.pod) === base.pod);
    for (const [code, ls2] of groupBy(lines, (l) => l.code)) if (ls2.length > 1 && ls2.every((l) => l.amount === ls2[0].amount)) add('duplicate_charge', `${code} billed ${ls2.length} times for ${ls2[0].amount} each.`, ls2[0].amount * (ls2.length - 1));
    for (const l of lines) {
      if (l.qty !== null && boxes !== null && /OFR|BAF|LSS|PSS|THC|EBS|CSC|ISPS|CAF/.test(l.code) && l.qty !== boxes) add('container_count', `${l.code} billed for ${l.qty} container(s); the B/L has ${boxes}.`, l.qty > boxes && l.qty ? (l.amount / l.qty) * (l.qty - boxes) : 0);
      if (ccy) continue;
      const n = (boxes !== null && l.qty !== null && l.qty > boxes ? boxes : l.qty) ?? boxes ?? 1;
      if (n !== l.qty && l.qty !== null) l.amount = round2((l.amount / l.qty) * n); // the container_count finding already carries the extra containers
      if (l.code === 'OFR') {
        if (!lane) { add('no_lane', `No contract rate for ${base.pol} to ${base.pod}.`); continue; }
        const rate = lane.rates[equipment]; if (rate === undefined) { add('no_rate_for_equipment', `The contract lane has no ${equipment} rate.`); continue; }
        const exp = round2(rate * n); if (l.amount - exp > tol) add('rate_over', `Ocean freight ${l.amount} for ${n} x ${equipment}; contract ${rate} each = ${exp}.`, l.amount - exp);
        continue;
      }
      const s = (contract.surcharges || {})[l.code];
      if (!s) { add('surcharge_not_in_contract', `${l.description} (${l.code}) ${l.amount} is not in the contract.`, l.amount); continue; }
      if (s.included) { add('surcharge_included', `${l.code} is included in the contract rate and should not be billed.`, l.amount); continue; }
      if ((s.valid_from && date && date < s.valid_from) || (s.valid_to && date && date > s.valid_to)) { add('surcharge_out_of_window', `${l.code} applies ${s.valid_from || '...'} to ${s.valid_to || '...'}; sailing ${date}.`, l.amount); continue; }
      const exp = s.per_container ? (s.per_container[equipment] !== undefined ? round2(s.per_container[equipment] * n) : null) : s.flat !== undefined ? s.flat : null;
      if (exp === null) add('surcharge_unpriced', `${l.code} is allowed but the contract has no amount for ${equipment}.`);
      else if (l.amount - exp > tol) add('surcharge_over', `${l.code} ${l.amount}; contract ${exp}.`, l.amount - exp);
    }
    return { ...base, findings, disputable: round2(findings.reduce((s, f) => s + f.amount, 0)) };
  });
  const by = {}; for (const i of items) for (const f of i.findings) by[f.code] = (by[f.code] || 0) + 1;
  return { bills: items.length, billed: round2(items.reduce((s, i) => s + i.billed, 0)), disputable: round2(items.reduce((s, i) => s + i.disputable, 0)), with_findings: items.filter((i) => i.findings.length).length, by_finding: by, items };
}

export function disputeText(items, { from, contact }) {
  const total = round2(items.reduce((s, i) => s + i.disputable, 0));
  return { total, text: [
    `# Ocean freight invoice dispute: ${items[0].carrier}`, '',
    `**To:** ${contact || `[TO CONFIRM ${items[0].carrier} billing contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `These charges differ from our service contract${items[0].contract ? ` (${items[0].contract})` : ''}. We ask for credit notes totalling ${total}.`, '',
    ...items.flatMap((i) => [`## Invoice ${i.invoice_number}, B/L ${i.bl} (${i.pol} to ${i.pod}, ${i.containers ?? '?'} x ${i.equipment}, sailed ${i.sailing_date || '?'})`, '', '| Issue | Amount |', '| --- | --- |', ...i.findings.filter((f) => f.amount > 0).map((f) => `| ${f.detail} | ${f.amount} |`), '']),
    '[ATTACH the contract rate sheet pages for these lanes]',
  ].join('\n') };
}
