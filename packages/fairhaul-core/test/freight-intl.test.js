// Freight files from other countries: translated column names, kilograms and
// kilometres, local amounts and dates, legacy encodings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adaptRecords, readTable, COLUMN_WORDS, COLUMN_LANGUAGES, FIELD_CONCEPTS, INVOICE_LINE_FIELDS, INVOICE_PROFILES, SHIPMENT_FIELDS,
  stripUnit, unitInHeader, conceptOf, translatedNames, SOURCES_CONFIG_SCHEMA, EXPORTS,
} from '../src/index.js';
import { validate } from '../src/schema.js';
import { encodeText } from '../../../scripts/lib/encode.mjs';
import { tmp } from './helpers.js';

const INV = { fields: INVOICE_LINE_FIELDS, profiles: INVOICE_PROFILES };
const SHP = { fields: SHIPMENT_FIELDS };
const m = (rows) => ({ format: 'csv', matrix: rows });

test('every freight concept has words in all eight languages, and every field alias points at a real concept', () => {
  for (const [concept, target] of Object.entries(FIELD_CONCEPTS)) assert.ok(COLUMN_WORDS[target], `${concept} -> ${target}`);
  for (const c of ['carrier', 'shipment_id', 'bol', 'weight', 'distance', 'pallets', 'freight_cost', 'container', 'last_free_day', 'hts', 'duty', 'entry_number']) {
    for (const l of COLUMN_LANGUAGES) assert.ok(COLUMN_WORDS[c][l] && COLUMN_WORDS[c][l].length, `${c} ${l}`);
  }
  assert.equal(conceptOf('load_id', {}), 'shipment_id');
  assert.equal(conceptOf('invoice_number', {}), 'invoice');
  assert.equal(conceptOf('origin', { translate: 'country_of_origin' }), 'country_of_origin');
  assert.equal(conceptOf('weight', { translate: false }), null);
  assert.ok(translatedNames('carrier').some((x) => x.word === '承运商' && x.lang === 'zh'));
});

test('a unit at the end of a header is recognised in every script, and only for its own kind of measure', () => {
  assert.equal(stripUnit('Gewicht (kg)'), 'Gewicht'); assert.equal(stripUnit('重量(kg)'), '重量'); assert.equal(stripUnit('Distance km'), 'Distance'); assert.equal(stripUnit('Weight_lbs'), 'Weight'); assert.equal(stripUnit('Carrier'), 'Carrier');
  assert.equal(unitInHeader('Gewicht (kg)', 'weight'), 'kg'); assert.equal(unitInHeader('Weight (lb)', 'weight'), 'lb'); assert.equal(unitInHeader('重量（ｋｇ）', 'weight'), 'kg'); assert.equal(unitInHeader('중량(킬로)', 'weight'), 'kg');
  assert.equal(unitInHeader('Entfernung (km)', 'distance'), 'km'); assert.equal(unitInHeader('Loaded Miles', 'distance'), 'mi'); assert.equal(unitInHeader('距离(公里)', 'distance'), 'km');
  assert.equal(unitInHeader('Länge (cm)', 'length'), 'cm'); assert.equal(unitInHeader('Length (in)', 'length'), 'in');
  assert.equal(unitInHeader('Weight', 'weight'), null); assert.equal(unitInHeader('Distance (km)', 'weight'), null);
});

test('a German carrier invoice in Windows-1252 with semicolons, comma decimals, dotted dates and kilograms reads like the English one', () => {
  const dir = tmp();
  const de = 'Rechnungsnummer;Spediteur;Rechnungsdatum;Versanddatum;Betrag;Leistungsbeschreibung;Positionsbetrag;Gewicht (kg);Entfernung (km);Bemerkung\r\n' +
    'RE-4711;Müller Transporte GmbH;03.11.2026;28.10.2026;1.234,56;Fracht;1.100,00;544,31;804,67;Zustellung Hof\r\n' +
    'RE-4711;Müller Transporte GmbH;03.11.2026;28.10.2026;1.234,56;Dieselzuschlag;134,56;544,31;804,67;\r\n';
  writeFileSync(join(dir, 'de.csv'), encodeText(de, 'windows-1252'));
  const t = readTable(join(dir, 'de.csv'));
  const r = adaptRecords(t, INV, { kind: 'invoices', file: 'de.csv' });
  assert.equal(r.rows.length, 2);
  const row = r.rows[0];
  assert.equal(row.invoice_number, 'RE-4711'); assert.equal(row.carrier, 'Müller Transporte GmbH');
  assert.equal(row.invoice_date, '2026-11-03'); assert.equal(row.ship_date, '2026-10-28');
  assert.equal(row.amount, '1234.56');
  assert.equal(Number(row.charge_amount), 1100);
  assert.equal(row.charge_description, 'Fracht');
  assert.equal(Number(row.weight), 1200); // 544.31 kg
  assert.equal(Number(row.miles), 500); // 804.67 km
  assert.equal(r.report.encoding, 'windows-1252');
  assert.deepEqual(r.report.units_converted, { weight: 'kg -> lb', miles: 'km -> mi' });
  assert.equal(r.report.decimal_mark, ',');
  assert.equal(r.report.translated_columns.carrier.language, 'de');
  assert.ok(!r.report.warnings.some((w) => /read as metric/.test(w)), 'the unit was in the header, so nothing was assumed');
});

test('a Japanese file in Shift_JIS with no unit in the weight column is read as kilograms, and the report says so', () => {
  const dir = tmp();
  const ja = '出荷番号,運送会社,出荷日,配達日,重量,パレット数,運賃\r\nSHP-1,テスト運輸株式会社,2026/11/02,2026/11/04,500,2,"120,000円"\r\n';
  writeFileSync(join(dir, 'ja.csv'), encodeText(ja, 'shift_jis'));
  const r = adaptRecords(readTable(join(dir, 'ja.csv')), { fields: { ...SHIPMENT_FIELDS, freight_cost: { aliases: ['Freight Cost'], type: 'money' } } }, { kind: 'shipments', file: 'ja.csv' });
  const row = r.rows[0];
  assert.equal(row.shipment_id, 'SHP-1'); assert.equal(row.carrier, 'テスト運輸株式会社'); assert.equal(row.ship_date, '2026-11-02'); assert.equal(row.delivery_date, '2026-11-04');
  assert.equal(Number(row.weight), 1102.31); assert.equal(Number(row.pallets), 2); assert.equal(row.freight_cost, '120000');
  assert.equal(r.report.encoding, 'shift_jis');
  assert.ok(r.report.warnings.some((w) => /read as metric/.test(w) && /重量/.test(w)));
});

test('Chinese GBK and Korean EUC-KR shipment lists read their carrier, dates and pallets', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'zh.csv'), encodeText('装运单号,承运商,发货日期,托盘数\r\nZ-9,示例物流有限公司,2026-11-05,4\r\n', 'gbk'));
  writeFileSync(join(dir, 'ko.csv'), encodeText('운송번호,운송사,출하일,팔레트 수\r\nK-7,예시물류,2026.11.06,3\r\n', 'euc-kr'));
  const zh = adaptRecords(readTable(join(dir, 'zh.csv')), SHP, {}).rows[0];
  assert.deepEqual([zh.shipment_id, zh.carrier, zh.ship_date, zh.pallets], ['Z-9', '示例物流有限公司', '2026-11-05', '4']);
  const ko = adaptRecords(readTable(join(dir, 'ko.csv')), SHP, {}).rows[0];
  assert.deepEqual([ko.shipment_id, ko.carrier, ko.ship_date, ko.pallets], ['K-7', '예시물류', '2026-11-06', '3']);
});

test('English headers with a unit convert too, a pounds column is left alone, and "units" in fairhaul-sources.json wins', () => {
  let r = adaptRecords(m([['Invoice Number', 'Weight (kg)', 'Distance (km)'], ['A', '100', '100']]), INV, {});
  assert.equal(Number(r.rows[0].weight), 220.46); assert.equal(Number(r.rows[0].miles), 62.14);
  r = adaptRecords(m([['Invoice Number', 'Weight (lb)', 'Miles'], ['A', '100', '100']]), INV, {});
  assert.equal(r.rows[0].weight, '100'); assert.equal(r.rows[0].miles, '100'); assert.equal(r.report.units_converted, undefined);
  r = adaptRecords(m([['invoice_number', 'weight'], ['A', '100']]), INV, { override: { units: { weight: 'kg' } } });
  assert.equal(Number(r.rows[0].weight), 220.46);
  assert.equal(validate(SOURCES_CONFIG_SCHEMA, { sources: { invoices: { units: { weight: 'kg' } } } }).ok, true);
  assert.equal(validate(SOURCES_CONFIG_SCHEMA, { sources: { invoices: { units: { weight: 'stone' } } } }).ok, false);
});

test('a German SAP TM settlement list is recognised by its labels and its gross weight read as kilograms', () => {
  const r = adaptRecords(m([['Frachtabrechnungsbeleg', 'Frachtauftrag', 'Frachtführer', 'Belegdatum', 'Nettobetrag', 'Währung', 'Kostenart', 'Betrag', 'Bruttogewicht'], ['6100000123', '4100000456', 'Beispiel Spedition', '02.11.2026', '2.345,00', 'EUR', 'Fracht', '2.100,00', '1.000']]), INV, {});
  assert.equal(r.report.profile, 'sap_tm_freight_settlement_de'); assert.equal(r.report.system, 'SAP Transportation Management');
  const row = r.rows[0];
  assert.equal(row.invoice_number, '6100000123'); assert.equal(row.pro, '4100000456'); assert.equal(row.invoice_date, '2026-11-02'); 
  assert.equal(Number(row.amount), 2345); assert.equal(Number(row.charge_amount), 2100); assert.equal(Number(row.weight), 2204.62);
  assert.ok(EXPORTS.sap_tm_freight_settlement_de.basis === 'recalled');
});

test('translated names never take a column an English name already took, and files in the agent\'s own layout come back untouched', () => {
  const r = adaptRecords(m([['carrier', 'Spediteur', 'invoice_number'], ['A', 'B', 'X']]), INV, {});
  assert.equal(r.rows[0].carrier, 'A');
  const same = adaptRecords(m([['invoice_number', 'carrier', 'weight'], ['X', 'A', '10']]), INV, {});
  assert.equal(same.report.adapted, false); assert.equal(same.rows[0].weight, '10');
});
