import test from 'node:test';
import assert from 'node:assert/strict';
import { investorPaths, kycPayload, kycStatus, inDateRange } from '../src/investor-contracts.ts';
import { normalizeSession } from '../src/session.ts';
const session = (demo) => normalizeSession({ accessToken: `header.${Buffer.from(JSON.stringify({ sub: demo ? 'demo-owner' : 'real-owner', isDemo: String(demo), exp: 9999999999 })).toString('base64url')}.test` });
test('production paths match mobile; no guessed reports endpoint', () => {
  assert.deepEqual(investorPaths(session(false)), { kyc: '/kyc/user/real-owner', finance: '/users/real-owner/assets-summary', rental: '/users/me/rent-income-history', inbox: '/messages/inbox/real-owner', reports: null });
});
test('demo paths preserve JWT owner and use JWT-scoped report and rental endpoints', () => {
  assert.deepEqual(investorPaths(session(true)), { kyc: '/kyc/user/demo-owner', finance: '/users/demo-owner/assets-summary', rental: '/users/me/rent-income-history', inbox: '/messages/inbox/demo-owner', reports: '/demo/monthly-reports' });
  assert.equal(session(true).refreshToken, null);
});
test('KYC payload uses current session ID and raw base64, including demo', () => {
  for (const demo of [false, true]) assert.deepEqual(kycPayload(session(demo), 'driver_license', 'aGVsbG8='), { userId: demo ? 'demo-owner' : 'real-owner', type: 'driver_license', base64File: 'aGVsbG8=', status: 'pending' });
  assert.throws(() => kycPayload(session(true), 'passport', ''));
});
test('KYC status matches latest pair of selected type and leaves source order intact', () => {
  const doc = (status, uploadedAt, type = 'passport') => ({ id: uploadedAt, type, status, uploadedAt });
  assert.equal(kycStatus([], 'passport'), 'not_submitted');
  assert.equal(kycStatus([doc('approved','2026-01-01')], 'passport'), 'incomplete');
  const docs = [doc('rejected','2025-01-01'), doc('approved','2026-01-02'), doc('approved','2026-01-01'), doc('pending','2026-01-03','driver_license')];
  const copy = structuredClone(docs);
  assert.equal(kycStatus(docs,'passport'),'approved'); assert.deepEqual(docs,copy);
  assert.equal(kycStatus([...docs,doc('pending','2026-02-01')],'passport'),'pending');
  assert.equal(kycStatus([...docs,doc('rejected','2026-02-01')],'passport'),'rejected');
});
test('date filters include whole end day and reject invalid timestamps', () => {
  assert.ok(inDateRange('2026-09-09T23:59:59', '2026-09-09','2026-09-09'));
  assert.equal(inDateRange('2026-09-10T00:00:00','2026-09-09','2026-09-09'),false);
  assert.equal(inDateRange('invalid','',''),false);
});
