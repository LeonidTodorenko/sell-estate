import test from 'node:test';
import assert from 'node:assert/strict';
import { adminLogPages, adminLogsPath, adminUserPath, adminUsersPath, isAdminSession } from '../src/admin-contracts.ts';

const session = (role = 'admin', isDemo = false) => ({
  accessToken: 'token', refreshToken: isDemo ? null : 'refresh', isDemo, demoCode: null,
  user: { id: 'user-1', role, isDemo, demoCode: null },
});

test('admin UX gate requires a production admin session', () => {
  assert.equal(isAdminSession(session()), true);
  assert.equal(isAdminSession(session('ADMIN')), true);
  assert.equal(isAdminSession(session('investor')), false);
  assert.equal(isAdminSession(session('admin', true)), false);
  assert.equal(isAdminSession(null), false);
});

test('admin paths encode user-controlled values and keep reads under current routes', () => {
  assert.equal(adminUsersPath('  Jane + Ops  '), '/admin/users?query=Jane+%2B+Ops');
  assert.equal(adminUsersPath(' '), '/admin/users');
  assert.equal(adminUserPath('id/with?parts'), '/admin/users/id%2Fwith%3Fparts');
  assert.equal(adminLogsPath(' Balance + ', ' Jane/Smith ', 0), '/admin/stats/logs?page=1&pageSize=20&action=Balance+%2B&userName=Jane%2FSmith');
});

test('log pagination handles empty and partial pages without division errors', () => {
  assert.equal(adminLogPages({ total: 0, page: 1, pageSize: 20, items: [] }), 1);
  assert.equal(adminLogPages({ total: 41, page: 1, pageSize: 20, items: [] }), 3);
  assert.equal(adminLogPages({ total: 2, page: 1, pageSize: 0, items: [] }), 2);
});
