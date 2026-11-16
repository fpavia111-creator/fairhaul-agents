// Bellatrix: LTL weight and class corrections. Pure functions.
import { densityPcf, classForDensity, DENSITY_SCALES, canonicalCarrier, readYesNo, round2, str, num, groupBy } from 'lodestar-core';

const t = (aliases, extra = {}) => ({ aliases, translate: false, ...extra });
export const CORRECTION_FIELDS = Object.freeze({
  pro: t(['PRO', 'PRO Number', 'Pro #'], { required: true }),
  carrier: t(['Carrier', 'Carrier Name', 'SCAC'], { required: true }),
  shipment_id: t(['Shipment ID', 'BOL', 'Load ID', 'Order']),
  correction_date: t(['Correction Date', 'Inspection Date', 'Date', 'Invoice Date'], { type: 'date' }),
  product: t(['Product', 'SKU', 'Item', 'Commodity', 'Description']),
  handling_units: t(['Handling Units', 'Pallets', 'Pieces', 'HU'], { type: 'number' }),
  length: t(['Length', 'Length (in)', 'L'], { type: 'number' }),
  width: t(['Width', 'Width (in)', 'W'], { type: 'number' }),
  height: t(['Height', 'Height (in)', 'H'], { type: 'number' }),
  declared_weight: t(['Declared Weight', 'BOL Weight', 'Original Weight', 'Shipper Weight'], { type: 'number' }),
  corrected_weight: t(['Corrected Weight', 'Reweigh', 'Actual Weight', 'Inspected Weight'], { type: 'number' }),
  declared_class: t(['Declared Class', 'BOL Class', 'Original Class'], { type: 'number' }),
  corrected_class: t(['Corrected Class', 'Inspected Class', 'New Class'], { type: 'number' }),
  amount_added: t(['Amount Added', 'Correction Amount', 'Additional Charge', 'Rebill Amount', 'Difference'], { type: 'money' }),
  certificate: t(['Certificate', 'Inspection Certificate', 'W&I Certificate', 'Cert Provided', 'Photos'], { type: 'bool' }),
});
export const REWEIGH_TERMS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    note: { type: 'string' },
    weight_tolerance_pct: { type: 'number', minimum: 0, maximum: 20, description: 'Corrections within this percent of the declared weight are worth challenging (default 2)' },
    weight_tolerance_lbs: { type: 'number', minimum: 0, maximum: 500, description: 'Or within this many pounds, whichever is larger (default 25)' },
    density_scale: { type: 'string', enum: Object.keys(DENSITY_SCALES), description: 'Density scale for class checks (default nmfc_2025_13; recalled, check against your tariff)' },
    repeat_at: { type: 'integer', minimum: 2, maximum: 50, description: 'Same product corrected this many times means your own data needs fixing (default 2)' },
  },
});
const D = { weight_tolerance_pct: 2, weight_tolerance_lbs: 25, density_scale: 'nmfc_2025_13', repeat_at: 2 };

/** Review each correction. */
export function reviewCorrections(rows, terms = {}) {
  const tm = { ...D, ...terms };
  const items = rows.map((r) => {
    const dw = num(r.declared_weight), cw = num(r.corrected_weight), dc = num(r.declared_class), cc = num(r.corrected_class), hu = num(r.handling_units) || 1;
    const l = num(r.length), w = num(r.width), h = num(r.height);
    const reasons = [], notes = [];
    const cert = readYesNo(r.certificate);
    if (cert === false || cert === null) reasons.push({ code: 'no_certificate', detail: 'No inspection certificate or photos on file. Ask the carrier for the weight and inspection certificate before paying.' });
    const weightChange = dw !== null && cw !== null ? round2(cw - dw) : null;
    if (weightChange !== null && weightChange > 0) {
      const tol = Math.max((dw * tm.weight_tolerance_pct) / 100, tm.weight_tolerance_lbs);
      if (weightChange <= tol) reasons.push({ code: 'within_tolerance', detail: `Reweighed ${weightChange} lb heavier, within ${round2(tol)} lb (${tm.weight_tolerance_pct}% or ${tm.weight_tolerance_lbs} lb). That is within normal scale variation.` });
    }
    let density = null, densityClass = null;
    if (l && w && h) {
      density = densityPcf(cw ?? dw, l * hu, w, h); densityClass = classForDensity(density, tm.density_scale);
      if (cc !== null && dc !== null && cc > dc && densityClass !== null && densityClass <= dc) reasons.push({ code: 'class_not_supported', detail: `Reclassed ${dc} to ${cc}, but ${cw ?? dw} lb on ${hu} unit(s) of ${l}x${w}x${h} in is ${density} lb/ft³, class ${densityClass} on the ${tm.density_scale} scale. If the item is density-rated, the declared class stands.` });
      if (cc !== null && dc !== null && cc > dc && densityClass !== null && densityClass > dc) notes.push(`At ${density} lb/ft³ the density scale gives class ${densityClass}, so the reclass looks right if the dimensions are right.`);
    } else if (cc !== null && dc !== null && cc > dc) notes.push('No dimensions on file, so the reclass cannot be checked against density.');
    return { pro: str(r.pro), shipment_id: str(r.shipment_id) || null, carrier: canonicalCarrier({}, r.carrier), date: r.correction_date || null, product: str(r.product) || '(none)', declared_weight: dw, corrected_weight: cw, weight_change: weightChange, declared_class: dc, corrected_class: cc, density, density_class: densityClass, amount_added: num(r.amount_added) || 0, certificate: cert, reasons, notes };
  });
  const byProduct = groupBy(items.filter((i) => i.product !== '(none)'), (i) => i.product.toLowerCase());
  const fixes = [];
  for (const [, list] of byProduct) {
    const supported = list.filter((i) => !i.reasons.some((x) => x.code !== 'no_certificate'));
    if (supported.length >= tm.repeat_at) {
      const per = supported.filter((i) => i.corrected_weight && i.declared_weight).map((i) => i.corrected_weight / i.declared_weight);
      const classes = [...new Set(supported.map((i) => i.corrected_class).filter((c) => c !== null && c !== undefined))];
      fixes.push({ product: list[0].product, corrections: supported.length, amount_added: round2(supported.reduce((s, i) => s + i.amount_added, 0)), weight_factor: per.length ? Math.round((per.reduce((a, b) => a + b, 0) / per.length) * 1000) / 1000 : null, corrected_classes: classes.join(', '), fix: `Corrected ${supported.length} times with the carrier's figures standing up. Update the item master${per.length ? ` weight (corrected weights average ${Math.round((per.reduce((a, b) => a + b, 0) / per.length - 1) * 1000) / 10}% above declared)` : ''}${classes.length ? `${per.length ? ' and' : ''} class (carrier class ${classes.join(', ')})` : ''}.` });
      for (const i of supported) i.notes.push('Repeated for this product; your own data is the likely cause.');
    }
  }
  for (const i of items) i.status = i.reasons.some((x) => x.code !== 'no_certificate') ? 'challenge' : i.reasons.length ? 'ask_for_certificate' : fixes.some((f) => f.product.toLowerCase() === i.product.toLowerCase()) ? 'fix_our_data' : 'accept';
  const sum = (st) => round2(items.filter((i) => st.includes(i.status)).reduce((s, i) => s + i.amount_added, 0));
  const carriers = [...groupBy(items, (i) => i.carrier)].map(([carrier, l]) => ({ carrier, corrections: l.length, amount_added: round2(l.reduce((s, i) => s + i.amount_added, 0)), challenge: l.filter((i) => i.status === 'challenge').length, without_certificate: l.filter((i) => !i.certificate).length })).sort((a, b) => b.amount_added - a.amount_added);
  return { corrections: items.length, amount_added: sum(['challenge', 'ask_for_certificate', 'fix_our_data', 'accept']), challenge: items.filter((i) => i.status === 'challenge').length, challenge_amount: sum(['challenge']), ask_for_certificate: items.filter((i) => i.status === 'ask_for_certificate').length, certificate_amount: sum(['ask_for_certificate']), fix_our_data: items.filter((i) => i.status === 'fix_our_data').length, accepted: items.filter((i) => i.status === 'accept').length, density_scale: tm.density_scale, carriers, fixes, items };
}

export function disputeText(items, { from, contact }) {
  const list = items.filter((i) => ['challenge', 'ask_for_certificate'].includes(i.status));
  const total = round2(list.reduce((s, i) => s + i.amount_added, 0));
  return { total, pros: list.map((i) => i.pro), text: [
    `# Weight and class corrections: ${list[0].carrier}`, '',
    `**To:** ${contact || `[TO CONFIRM ${list[0].carrier} billing or inspection contact]`}`, `**From:** ${from || '[TO CONFIRM your name and company]'}`, '',
    `We dispute the corrections on ${list.length} shipment(s), ${total} in added charges. Please send the weight and inspection certificate for each, or cancel the correction.`, '',
    '| PRO | Declared | Corrected | Added | Why we dispute |', '| --- | --- | --- | --- | --- |',
    ...list.map((i) => `| ${i.pro} | ${i.declared_weight ?? ''} lb, class ${i.declared_class ?? ''} | ${i.corrected_weight ?? ''} lb, class ${i.corrected_class ?? ''} | ${i.amount_added} | ${i.reasons.map((x) => x.detail).join(' ')} |`), '',
    '[ATTACH our BOLs and any photos of the freight as tendered]',
  ].join('\n') };
}
