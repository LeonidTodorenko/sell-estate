import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHistory, rangeHistory, monthlyRent, validAllocation } from '../src/chart-data.ts';

test('history is sorted without mutation; malformed observations are excluded', () => {
  const input = [{ date: '2026-10-01', total: -5 }, { date: 'bad', total: 4 }, { date: '2026-01-01', total: 0 }, { date: '2026-09-01', total: NaN }];
  assert.deepEqual(cleanHistory(input).map(p => p.total), [0, -5]);
  assert.equal(input[0].date, '2026-10-01');
  assert.deepEqual(cleanHistory(), []);
});
test('periods use latest observation, include boundary, and clamp month end', () => {
  const input = ['2025-05-31', '2025-11-30', '2026-02-27', '2026-02-28', '2026-05-31'].map(date => ({ date, total: 100 }));
  assert.deepEqual(rangeHistory(input, '3m').map(p => p.date), ['2026-02-28', '2026-05-31']);
  assert.equal(rangeHistory(input, '6m').length, 4);
  assert.equal(rangeHistory(input, '1y').length, 5);
  assert.equal(rangeHistory(input, 'all').length, 5);
  assert.deepEqual(rangeHistory([], '3m'), []);
});
test('monthly payouts sum actual amounts, preserve corrections and UTC dates; no synthetic months', () => {
  assert.deepEqual(monthlyRent([{timestamp:'2026-09-30T23:30:00-02:00',amount:10}, {timestamp:'2026-10-12',amount:20}, {timestamp:'2026-10-20',amount:-5}, {timestamp:'2026-08-01',amount:0}, {timestamp:'bad',amount:4}, {timestamp:'2026-10-01',amount:Infinity}]), [{date:'2026-08-01',total:0},{date:'2026-10-01',total:25}]);
});
test('allocation excludes missing, nonfinite and nonpositive values', () => {
  assert.deepEqual(validAllocation([{label:'A',value:20},{label:'B',value:0},{label:'C',value:NaN},{label:'D',value:-5}]), [{label:'A',value:20}]);
});
