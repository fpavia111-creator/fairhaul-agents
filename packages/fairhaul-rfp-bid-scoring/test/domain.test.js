// RFP awards: bids counted once, outliers held back, incumbents, backups and the award letter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { award, awardText } from '../src/index.js';

const lane = (id, extra = {}) => ({ lane_id: id, origin: 'Chicago, IL', destination: 'Dallas, TX', annual_loads: 100, incumbent: 'Ridgeline Freight', incumbent_rate: 1000, ...extra });
const bid = (id, carrier, rate, extra = {}) => ({ lane_id: id, carrier, rate, ...extra });

test('a carrier that bid twice on a lane is counted once, at its lowest bid, with a note', () => {
  const r = award([lane('L1')], [bid('L1', 'Prairie Express', 950), bid('L1', 'Prairie Express', 900, { capacity: 50 }), bid('L1', 'Summit Carriers', 940)]);
  const x = r.results[0];
  assert.equal(x.bids, 2); assert.deepEqual(x.awards.map((a) => [a.carrier, a.loads, a.rate]), [['Prairie Express', 50, 900], ['Summit Carriers', 50, 940]]);
  assert.match(x.notes[0], /Prairie Express bid more than once.*\(900\)/);
});

test('a bid far below the lane median is held back for checking; with two bids nothing is an outlier', () => {
  const r = award([lane('L1')], [bid('L1', 'Cheap Co', 500), bid('L1', 'Prairie Express', 950), bid('L1', 'Summit Carriers', 990)]);
  assert.equal(r.results[0].awards[0].carrier, 'Prairie Express'); assert.equal(r.outlier_bids, 1);
  assert.equal(award([lane('L1')], [bid('L1', 'Cheap Co', 500), bid('L1', 'Prairie Express', 950)]).results[0].awards[0].carrier, 'Cheap Co');
});

test('the incumbent is kept only within the preference band', () => {
  const bids = [bid('L1', 'Prairie Express', 900), bid('L1', 'Ridgeline Freight', 940)];
  const kept = award([lane('L1')], bids, { prefer_incumbent_pct: 5 });
  assert.equal(kept.results[0].awards[0].carrier, 'Ridgeline Freight'); assert.equal(kept.incumbents_kept, 1); assert.match(kept.results[0].notes.join(' '), /Incumbent Ridgeline Freight kept/);
  assert.equal(award([lane('L1')], bids, { prefer_incumbent_pct: 4 }).results[0].awards[0].carrier, 'Prairie Express');
});

test('a lane with no usable bids is reported; zero and blank rates are not bids', () => {
  const r = award([lane('L1'), lane('L2')], [bid('L1', 'A', 0), bid('L1', 'B', ''), bid('L2', 'C', 900)]);
  assert.equal(r.results[0].status, 'no_bids'); assert.equal(r.no_bids, 1); assert.equal(r.results[1].status, 'awarded');
});

test('the backup is the next carrier not already awarded, and can be switched off', () => {
  const bids = [bid('L1', 'A', 900), bid('L1', 'B', 950), bid('L1', 'C', 990)];
  assert.deepEqual(award([lane('L1')], bids).results[0].backup, { carrier: 'B', rate: 950 });
  assert.equal(award([lane('L1')], bids, { backup: false }).results[0].backup, null);
});

test('savings and the change against the incumbent are worked out per lane and in total', () => {
  const r = award([lane('L1'), lane('L2', { incumbent_rate: 800, annual_loads: 50 })], [bid('L1', 'A', 900), bid('L2', 'B', 840)]);
  assert.deepEqual(r.results.map((x) => [x.savings, x.change_pct]), [[10000, -10], [-2000, 5]]);
  assert.equal(r.savings, 8000); assert.equal(r.baseline_cost, 140000);
});

test('the award letter lists awarded lanes and backup lanes, and leaves the start date open when not given', () => {
  const r = award([lane('L1'), lane('L2')], [bid('L1', 'A', 900), bid('L1', 'B', 950), bid('L2', 'B', 880)]);
  const text = awardText('B', r.results, { rfp: '2027 dry van RFP' });
  assert.match(text, /# Award: 2027 dry van RFP, B/); assert.match(text, /\| L2 \| Chicago, IL → Dallas, TX \| 100 \| 880 \|/);
  assert.match(text, /backup carrier on:\n\n- L1 .* at 950/); assert.match(text, /\[TO CONFIRM start date\]/); assert.match(text, /Volumes are estimates, not commitments/);
});
