// Optional browser QA. Install Playwright in a separate tooling folder and set
// PLAYWRIGHT_MODULE to its absolute module path; it is not a production dependency.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const token = (demo = false, expired = false) => `header.${Buffer.from(JSON.stringify({ sub: demo ? 'demo-1' : 'user-1', isDemo: String(demo), exp: expired ? 1 : Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
const auth = (demo = false, expired = false) => ({ accessToken: token(demo, expired), refreshToken: demo ? null : 'refresh-test', isDemo: demo, user: { id: demo ? 'demo-1' : 'user-1', fullName: 'Test Investor', email: 'test@example.com', role: 'user', isDemo: demo, demoCode: demo ? 'DEMO-1' : null } });
const properties = [{ id: 'property-1', title: 'Marina Residence', location: 'Dubai Marina', price: 500000, totalShares: 500, availableShares: 75, listingType: 'rental', status: 'available', about: 'A property description.', expectedYieldText: 'As provided by the property team' }, { id: 'property-2', title: 'City Apartment', location: 'Downtown', price: 200000, totalShares: 200, availableShares: 0, listingType: 'sale', status: 'sold' }];
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = []; page.on('pageerror', err => errors.push(err.message));
let mode = 'normal', refreshCount = 0, loginDemo = false;
await context.route('https://sell-estate.onrender.com/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname.replace('/api', '');
  const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*' } });
  if (path === '/auth/login') return mode === 'bad-login' ? send({ message: 'Invalid email or password' }, 401) : send(auth(loginDemo));
  if (path.startsWith('/messages/unread-count/')) return send({count:2});
  if (path === '/auth/refresh') { refreshCount++; await new Promise(resolve => setTimeout(resolve, 100)); return send({ accessToken: token(), refreshToken: 'rotated' }); }
  if (path === '/auth/logout') return send({});
  if (mode === 'unauthorized') return send({ message: 'Session expired' }, 401);
  assert.ok(request.headers().authorization?.startsWith('Bearer '), `Bearer header missing: ${path}`);
  if (path === '/properties') return mode === 'error' ? send({ message: 'Test server unavailable' }, 503) : send(mode === 'empty' ? [] : properties);
  if (path.endsWith('/images')) return send([]);
  if (path.endsWith('/total-assets')) return send({ totalAssets: 15000, walletBalance: 5000, investmentValue: 10000, rentalIncome: 120, pendingApplicationsValue: 0, marketValue: 0 });
  if (path.startsWith('/investments/with-aggregated/')) return send([{ propertyId: 'property-1', propertyTitle: 'Marina Residence', totalShares: 10, totalInvested: 10000, totalShareValue: 10000, ownershipPercent: 2 }]);
  if (path.startsWith('/investments/user/')) return send([{ id: 'investment-1', propertyId: 'property-1', shares: 10, investedAmount: 10000, createdAt: '2026-08-01T12:00:00Z' }]);
  if (path === '/share-offers/active') return send([{ id: 'offer-1', sellerId: 'other-user', propertyId: 'property-1', propertyTitle: 'Marina Residence', sharesForSale: 2, startPricePerShare: 1000, buyoutPricePerShare: 1100, isActive: true, expirationDate: '2099-01-01T00:00:00Z' }]);
  if (path.startsWith('/users/transactions/user/')) return send([{ id: 'tx-1', type: 'Investment', amount: 10000, shares: 10, propertyId: 'property-1', propertyTitle: 'Marina Residence', timestamp: '2026-08-01T12:00:00Z' }]);
  throw new Error(`Unexpected endpoint: ${path}`);
});
const visible = async text => page.getByText(text, { exact: true }).filter({ visible: true }).first().waitFor();
const check = label => console.log(`PASS ${label}`);
try {
  await page.goto(base); await page.getByRole('heading', { name: /Your property portfolio/ }).waitFor(); check('landing');
  await page.goto(`${base}/transactions`); await page.waitForURL('**/login'); check('protected deep-link gate');
  mode = 'bad-login'; await page.getByLabel('Email', { exact: true }).fill('test@example.com'); await page.getByLabel('Password', { exact: true }).fill('test-password'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await visible('Invalid email or password'); check('login error');
  mode = 'normal'; await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/transactions'); await visible('Investment'); check('login returns to requested route');
  await page.goto(`${base}/dashboard`); await visible('$15,000.00'); await visible('Marina Residence'); await page.reload(); await visible('$15,000.00'); check('dashboard and persisted session');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ownersclub.web.session.v1'))); assert.equal(saved.user.id, 'user-1'); assert.equal(saved.isDemo, false);
  await page.goto(`${base}/properties`); await visible('Marina Residence'); await page.getByRole('searchbox').fill('does-not-exist'); await visible('No matching properties'); await page.getByRole('searchbox').fill(''); await page.getByLabel('Available shares only').check(); await visible('1 properties'); check('properties filters');
  await page.getByRole('link', { name: 'Marina Residence', exact: true }).click(); await visible('Property overview'); await visible('$1,000.00'); await page.reload(); await visible('A property description.'); check('details and deep-link reload');
  await page.goto(`${base}/properties/missing`); await visible('Property not found'); check('missing property');
  await page.goto(`${base}/investments`); await visible('Marina Residence'); await page.getByLabel('Minimum shares').fill('100'); await visible('No matching investments'); check('investments filters');
  await page.goto(`${base}/marketplace`); await visible('Marina Residence'); await page.getByLabel('My offers only').check(); await visible('No matching active offers'); check('marketplace filters');
  await page.goto(`${base}/transactions`); await visible('Investment'); await page.getByLabel('From', { exact: true }).fill('2026-09-08'); await visible('No matching transactions'); await page.getByLabel('To', { exact: true }).fill('2026-08-01'); await visible('The end date must be on or after the start date.'); check('transaction date validation');
  await page.goto(`${base}/profile`); await visible('Investor account'); await visible('user-1'); check('profile');
  mode = 'error'; await page.goto(`${base}/properties`); await visible('Test server unavailable'); mode = 'normal'; await page.getByRole('button', { name: 'Try again' }).click(); await visible('Marina Residence'); check('API error and retry');
  mode = 'empty'; await page.reload(); await visible('No properties available'); mode = 'normal'; check('empty state');
  await page.evaluate(value => localStorage.setItem('ownersclub.web.session.v1', JSON.stringify(value)), auth(false, true));
  await page.goto(`${base}/dashboard`); await visible('$15,000.00'); assert.equal(refreshCount, 1); assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('ownersclub.web.session.v1')))).refreshToken, 'rotated'); check('single concurrent refresh and token rotation');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.waitForURL('**/login'); assert.equal(await page.evaluate(() => localStorage.getItem('ownersclub.web.session.v1')), null); check('logout clears persistence');
  loginDemo = true; await page.goto(`${base}/login?demo=1`); await page.getByLabel('Email', { exact: true }).fill('test@example.com'); await page.getByLabel('Password', { exact: true }).fill('demo-password'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await visible('Demo mode'); await page.reload(); await visible('Demo mode'); check('demo login and indicator persistence');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/dashboard', '/properties', '/properties/property-1', '/investments', '/marketplace', '/transactions', '/profile']) {
    await page.goto(`${base}${path}`); await page.locator('main h1').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow on ${path}`);
  }
  check('seven mobile routes without page overflow');
  if (process.env.SMOKE_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.SMOKE_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOT_DIR}/profile-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`${base}/dashboard`); await visible('$15,000.00');
    await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOT_DIR}/dashboard-desktop.png`, fullPage: true });
  }
  await page.evaluate(value => localStorage.setItem('ownersclub.web.session.v1', JSON.stringify(value)), auth(true, true));
  await page.goto(`${base}/dashboard`); await page.waitForURL('**/login'); assert.equal(refreshCount, 1); check('expired demo signs out without refresh');
  await page.evaluate(() => localStorage.setItem('ownersclub.web.session.v1', 'broken-json')); await page.goto(`${base}/profile`); await page.waitForURL('**/login'); check('corrupt session recovery');
  await page.evaluate(value => localStorage.setItem('ownersclub.web.session.v1', JSON.stringify(value)), auth());
  mode = 'unauthorized'; await page.goto(`${base}/dashboard`); await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => localStorage.getItem('ownersclub.web.session.v1')), null); check('401 after refresh clears session without a retry loop');
  mode = 'normal';
  await page.evaluate(value => localStorage.setItem('ownersclub.web.session.v1', JSON.stringify(value)), auth());
  await page.goto(`${base}/dashboard`); await visible('$15,000.00');
  const otherTab = await context.newPage(); await otherTab.goto(base); await otherTab.evaluate(() => localStorage.removeItem('ownersclub.web.session.v1'));
  await page.waitForURL('**/login'); await otherTab.close(); check('cross-tab sign-out');
  assert.deepEqual(errors, []); check('no uncaught browser exceptions');
} catch (error) { console.error('Page at failure:', page.url(), await page.locator('body').innerText()); throw error; }
finally { await browser.close(); }
