// What an AI model sees when it calls an agent's tools, worked out from the agent's own source
// fields and the core masker (fairhaul-core/src/pii.js) in its default mode, "mask".
// Used by readme-sections.mjs (README section) and model-view.mjs (docs/model-view.md).
import { piiKindOf } from '../../packages/fairhaul-core/src/index.js';

const FREE = /description|reason|notes?$|memo|comment|^item$|^work$|exceptions|remarks|condition|^event$/;
const KIND_LABEL = { name: 'person\'s name', staff: 'staff name', phone: 'phone', email: 'e-mail', address: 'street address', ssn: 'SSN', dob: 'date of birth', license: 'licence number', account: 'account number' };

export function modelView(manifest) {
  const seen = new Set(); const v = { masked: [], strict: [], zip: [], dates: [], amounts: [], free_text: [], clear: [] };
  for (const s of Object.values(manifest.sources || {})) for (const [f, fd] of Object.entries(s.fields || {})) {
    if (seen.has(f)) continue; seen.add(f);
    const kind = (fd && fd.pii) || piiKindOf(f, 'mask');
    if (kind) v.masked.push({ field: f, kind, label: KIND_LABEL[kind] || kind });
    else if (piiKindOf(f, 'strict') === 'company') v.strict.push(f);
    else if (piiKindOf(f, 'strict') === 'zip') v.zip.push(f);
    else if (fd && (fd.type === 'date' || fd.type === 'datetime')) v.dates.push(f);
    else if (fd && ['money', 'number', 'integer', 'percent'].includes(fd.type)) v.amounts.push(f);
    else if (FREE.test(f)) v.free_text.push(f);
    else v.clear.push(f);
  }
  return v;
}

const code = (l) => l.map((x) => `\`${x}\``).join(', ');

/** README section body (markdown lines) for one agent. */
export function modelViewLines(manifest) {
  const v = modelView(manifest); const L = [];
  L.push(v.masked.length
    ? `- **Masked** (stable pseudonyms such as \`CU-3f2a9c1d\`, or \`[PHONE]\`-style placeholders): ${v.masked.map((m) => `${m.label} (\`${m.field}\`)`).join(', ')}. Where these values appear inside other text they are replaced too.`
    : '- **Masked:** this agent reads no column with a person\'s name or contact details. Anything that looks like a phone number, e-mail or SSN is still replaced in every result.');
  const clear = [v.clear.length && `ids, codes, places and names of carriers and other businesses (${code(v.clear)})`, v.strict.length && `customer, consignee and shipper names (${code(v.strict)}; pseudonymised with \`--pii strict\`)`, v.zip.length && `postal codes (${code(v.zip)}; cut to three digits with \`--pii strict\`)`, v.dates.length && `dates (${code(v.dates)})`, v.amounts.length && `amounts, weights and counts (${code(v.amounts)})`].filter(Boolean);
  if (clear.length) L.push(`- **Sent as they are:** ${clear.join('; ')}.`);
  if (v.free_text.length) L.push(`- **Free text sent as written** (known names, phone numbers, e-mails and SSN-like numbers inside it are replaced; anything else typed there is not): ${code(v.free_text)}.`);
  L.push('- Results go to whatever model your AI assistant uses. For data you may not share with that provider, use a local model or one covered by your agreements with it. The CSV and HTML files written on your machine keep the real values.');
  return L;
}
