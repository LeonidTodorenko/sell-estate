import assert from 'node:assert/strict';
import test from 'node:test';
import { forecastRequest, initialInputs, isForecast, plotPath } from '../src/forecast-data.ts';
import { forecastFixture, propertyId } from './forecast-fixture.mjs';

test('forecast inputs preserve negative base growth and separate zero expenses from unknown fees', () => {
  const result = forecastRequest({ ...initialInputs, shares: '2', base: '-4', monthlyPropertyExpenses: '0' }, 100);
  assert.deepEqual(result.body, {
    shares: 2, horizons: [1, 3, 5, 10], growth: { negative: -10, base: -4, optimistic: 0 },
    rent: { startDate: null, feePercent: null, monthlyPropertyExpenses: 0 },
  });
});

test('all growth scenarios can show losses', () => {
  const result = forecastRequest({ ...initialInputs, negative: '-20', base: '-8', optimistic: '-3' }, 100);
  assert.deepEqual(result.body.growth, { negative: -20, base: -8, optimistic: -3 });
});

test('invalid inputs cannot produce a request', () => {
  for (const input of [{ shares: '1.5' }, { shares: '101' }, { shares: '' }, { base: '-11' },
    { optimistic: '-1' }, { negative: '0' }, { feePercent: '101' }, { monthlyPropertyExpenses: '-1' },
    { startDate: '2027-02-29' }]) {
    assert.ok(forecastRequest({ ...initialInputs, ...input }, 100).error);
  }
});

test('schema v1 accepts nulls and rejects wrong identity, version, missing amounts and invalid dates', () => {
  const payload = forecastFixture(forecastRequest(initialInputs, 100).body);
  assert.ok(isForecast(payload, propertyId, 1));
  assert.ok(!isForecast(payload, 'other', 1));
  assert.ok(!isForecast(payload, propertyId, 2));
  assert.ok(!isForecast({ ...payload, schemaVersion: 2 }, propertyId, 1));
  assert.ok(!isForecast({ ...payload, cashFlow: [{ ...payload.cashFlow[0], date: '2026-02-30' }, ...payload.cashFlow.slice(1)] }, propertyId, 1));
  assert.ok(!isForecast({ ...payload, cashFlow: [{ ...payload.cashFlow[0], netRent: undefined }, ...payload.cashFlow.slice(1)] }, propertyId, 1));
});

test('chart paths preserve zero and break at unknown values', () => {
  assert.equal(plotPath([0, -2, null, 3], i => i, n => n), 'M0,0 L1,-2 M3,3');
  assert.equal(plotPath([null], i => i, n => n), '');
});
