import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSession, isExpired } from '../src/session.ts';
const token = claims => `header.${Buffer.from(JSON.stringify({ exp: 9999999999, ...claims })).toString('base64url')}.signature`;
test('current response keeps production identity and explicit false', () => {
  const s = normalizeSession({ accessToken: token({ isDemo: 'false' }), refreshToken: 'refresh', isDemo: false, user: { id: 'user-1', fullName: 'Леонид', isDemo: false } });
  assert.equal(s.user.id, 'user-1'); assert.equal(s.isDemo, false); assert.equal(s.user.fullName, 'Леонид'); assert.equal(s.refreshToken, 'refresh');
});
test('demo JWT claim preserves demo semantics and prevents production refresh', () => {
  const s = normalizeSession({ token: token({ isDemo: 'true', sub: 'demo-1', demoCode: 'DEMO-7' }), refreshToken: 'must-not-use' });
  assert.equal(s.isDemo, true); assert.equal(s.user.id, 'demo-1'); assert.equal(s.demoCode, 'DEMO-7'); assert.equal(s.refreshToken, null);
});
test('flat legacy response and Microsoft nameidentifier are supported', () => {
  assert.equal(normalizeSession({ jwt: token({}), userId: 'legacy-1', isDemo: false }).user.id, 'legacy-1');
  assert.equal(normalizeSession({ accessToken: token({ 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': 'claim-1' }) }).user.id, 'claim-1');
});
test('refresh preserves profile and rotates both tokens', () => {
  const old = normalizeSession({ accessToken: token({ sub: 'user-1' }), refreshToken: 'old', user: { id: 'user-1', email: 'test@example.com' } });
  const fresh = normalizeSession({ accessToken: token({ sub: 'user-1', exp: 9999999998 }), refreshToken: 'new' }, old);
  assert.equal(fresh.user.email, 'test@example.com'); assert.equal(fresh.refreshToken, 'new');
  assert.throws(() => normalizeSession({ accessToken: token({ sub: 'other' }), refreshToken: 'new' }, old));
});
test('missing identity/token rejected and expiration is enforced', () => {
  assert.throws(() => normalizeSession({ userId: 'id' })); assert.throws(() => normalizeSession({ accessToken: token({}) }));
  assert.equal(isExpired(normalizeSession({ accessToken: token({ exp: 1, sub: 'user' }) })), true);
  assert.equal(isExpired(normalizeSession({ accessToken: token({ sub: 'user' }) })), false);
});

test('refresh cannot silently switch demo scope with unchanged user ID', () => {
 const old=normalizeSession({accessToken:token({sub:'same',isDemo:'false'}),refreshToken:'old'});
 assert.throws(()=>normalizeSession({accessToken:token({sub:'same',isDemo:'true'})},old));
});
