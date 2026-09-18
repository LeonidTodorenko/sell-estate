import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4175';
const key = 'ownersclub.web.session.v1';
const auth = (demo = false, expired = false) => ({ accessToken: `header.${Buffer.from(JSON.stringify({ sub: demo ? 'demo-owner' : 'real-owner', isDemo: String(demo), exp: expired ? 1 : 9999999999 })).toString('base64url')}.test`, refreshToken: demo ? null : 'refresh', user: { id: demo ? 'demo-owner' : 'real-owner' }, isDemo: demo });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message));
let mode = 'normal', demo = false, uploads = 0, refreshes = 0, docs = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB9kAAAAASUVORK5CYII=', 'base64');
await context.route('https://sell-estate.onrender.com/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname.slice(4);
  calls.push({ path, method: request.method() });
  const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (path.startsWith('/messages/unread-count/')) return send({count:2});
  if (path === '/auth/refresh') { refreshes++; return send(auth(false)); }
  const id = demo ? 'demo-owner' : 'real-owner';
  assert.equal(request.headers().authorization, `Bearer ${auth(demo).accessToken}`);
  if (path === '/kyc/upload') {
    uploads++;
    const body = request.postDataJSON();
    assert.deepEqual(body, { userId: id, type: 'passport', base64File: png.toString('base64'), status: 'pending' });
    if (mode === 'partial' && uploads === 2) return send({ message: 'Second upload failed' }, 503);
    if (mode === 'upload401') return send({ message: 'Unauthorized upload' }, 401);
    docs.push({ id: String(uploads), ...body, uploadedAt: `2026-09-0${uploads}T12:00:00Z` });
    return send({ message: 'Document uploaded', ...(demo ? { simulated: true } : {}) });
  }
  assert.equal(request.method(), 'GET', `Unexpected write: ${path}`);
  if (mode === 'error') return send({ message: 'Fixture unavailable' }, 503);
  if (mode === 'loading') await new Promise(r => setTimeout(r, 350));
  const empty = mode === 'empty';
  if (path === `/kyc/user/${id}`) return send(docs);
  if (path === `/users/${id}/assets-summary`) {
    const history = empty ? [] : [{ date: '2026-08-01', total: -20 }, { date: '2026-09-01', total: 120 }];
    return send({ walletBalance: 100, investmentValue: 200, totalAssets: 300, rentalIncome: 120, combinedHistory: history, equityHistory: history, rentIncomeHistory: history });
  }
  if (path === '/users/me/rent-income-history') return send(empty ? [] : [{ title: 'Marina residence with a long property name '.repeat(3), timestamp: '2026-09-01T12:00:00Z', amount: 120 }]);
  if (path === '/demo/monthly-reports') { assert.ok(demo); return send(empty ? [] : [{ id:'r1', reportMonth:'2026-09-01', totalCapital: 300, capitalChange: -20, walletBalance:100, investmentValue:200, rentalIncome:120 }]); }
  if (path === `/messages/inbox/${id}`) return send(empty ? [] : [{ id:'m1', title:'Portfolio update', content:'Text-only message <script>throw new Error()</script>', isRead:false, createdAt:'2026-09-01' }]);
  throw new Error(`Unexpected endpoint ${path}`);
});
const visible = text => page.getByText(text, { exact:true }).first().waitFor();
async function setSession(value) { await page.goto(base); await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [key, value]); }
const routes = ['/kyc', '/finance', '/rental-income', '/monthly-reports', '/inbox'];
const check = name => console.log(`PASS ${name}`);
try {
  for (demo of [false,true]) {
    docs = []; await setSession(auth(demo));
    for (const width of [320,390,760,1024,1440]) {
      await page.setViewportSize({ width, height:900 });
      for (const route of routes) {
        await page.goto(base + route); await page.locator('main h1').waitFor();
        await page.waitForFunction(() => !document.querySelector('.loading-dot'));
        assert.equal(await page.getByRole('alert').count(),0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} overflow at ${width}`);
      }
    }
    check(`${demo ? 'demo' : 'production'}: five routes at five widths`);
    await page.goto(base + '/monthly-reports');
    assert.equal(await page.getByRole('navigation', { name:'Main navigation' }).getByRole('link',{name:'Monthly Reports'}).count(), demo ? 1 : 0);
    await page.goto(base + '/kyc'); await visible('No documents submitted');
    await page.getByLabel('Document image', { exact:true }).setInputFiles({ name:'document.png', mimeType:'image/png', buffer:png });
    await page.getByLabel('Selfie with document',{exact:true}).setInputFiles({name:'selfie.png',mimeType:'image/png',buffer:png});
    uploads = 0; await page.getByRole('button',{name:'Submit for review',exact:true}).click();
    await visible('Both documents were submitted for review.'); await visible('Documents are awaiting review.');
    assert.equal(uploads,2); assert.ok(await page.getByRole('button',{name:'Submit for review',exact:true}).isDisabled());
    check(`${demo ? 'demo' : 'production'}: exact KYC payload and pending state`);
  }
  docs=[]; await page.goto(base+'/kyc'); await visible('No documents submitted');
  uploads=0; mode='partial';
  for (const label of ['Document image','Selfie with document']) await page.getByLabel(label,{exact:true}).setInputFiles({name:'sample.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Submit for review',exact:true}).click();
  await page.getByText('1 of 2 uploads confirmed.',{exact:false}).waitFor();
  assert.equal(uploads,2); assert.ok(await page.getByRole('button',{name:'Submit for review',exact:true}).isDisabled());
  mode='normal'; await page.getByRole('button',{name:'Refresh',exact:true}).click(); await visible('incomplete');
  check('partial upload stays paused and refresh shows accepted document');
  docs=[]; mode='upload401'; uploads=0; await page.reload(); await visible('No documents submitted');
  for (const label of ['Document image','Selfie with document']) await page.getByLabel(label,{exact:true}).setInputFiles({name:'sample.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Submit for review',exact:true}).click(); await page.getByText('0 of 2 uploads confirmed.',{exact:false}).waitFor(); assert.equal(uploads,1); assert.equal(refreshes,0);
  check('demo upload 401 never refreshes or replays');
  mode='normal'; await page.reload(); await visible('No documents submitted');
  for (const label of ['Document image','Selfie with document']) await page.getByLabel(label,{exact:true}).setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('bad')});
  const before=uploads; await page.getByRole('button',{name:'Submit for review',exact:true}).click(); await page.getByText('Choose a JPEG, PNG or WebP image, up to 5 MB.',{exact:false}).waitFor(); assert.equal(uploads,before);
  check('invalid images rejected before network writes');
  for (const route of routes) {
    mode='loading'; await page.goto(base+route); await page.locator('.loading-dot').first().waitFor(); await page.waitForFunction(() => !document.querySelector('.loading-dot'));
    mode='error'; await page.reload(); await visible('Fixture unavailable'); mode='normal'; await page.getByRole('button',{name:'Try again'}).click(); await page.waitForFunction(() => !document.querySelector('.loading-dot')); assert.equal(await page.getByRole('alert').count(),0);
    mode='empty'; await page.reload(); await page.waitForFunction(() => !document.querySelector('.loading-dot')); assert.ok(await page.locator('main .state h3').count() > 0);
  }
  check('five routes: loading, error, retry and empty states');
  mode='normal'; await page.goto(base+'/rental-income'); await visible('$120.00');
  await page.getByLabel('From',{exact:true}).fill('2026-09-02'); await visible('No rental income for this period');
  await page.getByLabel('To',{exact:true}).fill('2026-09-01'); await visible('The end date must be on or after the start date.');
  await page.goto(base+'/inbox'); await visible('Portfolio update'); await page.locator('summary').click(); await visible('Text-only message <script>throw new Error()</script>');
  assert.equal(calls.filter(c => c.path.includes('mark-read')).length,0); check('date filters and read-only text inbox');
  await page.setViewportSize({width:320,height:700});
  const menu=page.getByRole('button',{name:'Menu'});
  await menu.click(); await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Identity Verification'}).click(); await page.waitForURL('**/kyc'); assert.equal(await menu.getAttribute('aria-expanded'),'false');
  await menu.click(); await page.keyboard.press('Escape'); assert.equal(await menu.getAttribute('aria-expanded'),'false');
  await menu.click(); await menu.click(); assert.equal(await menu.getAttribute('aria-expanded'),'false');
  await menu.click(); await page.locator('main h1').click(); assert.equal(await menu.getAttribute('aria-expanded'),'false');
  check('mobile menu: new link, Escape, repeat click, outside click');
  if(process.env.SMOKE_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.SMOKE_SCREENSHOT_DIR,{recursive:true});
    for (const width of [390,1440]) { await page.setViewportSize({width,height:1000}); for(const route of routes) { await page.goto(base+route); await page.waitForFunction(() => !document.querySelector('.loading-dot')); await page.screenshot({path:`${process.env.SMOKE_SCREENSHOT_DIR}/${route.slice(1)}-${width}.png`,fullPage:true}); } }
  }
  await setSession(auth(true,true)); await page.goto(base+'/finance'); await page.waitForURL('**/login'); assert.equal(refreshes,0); check('expired demo new route signs out without production refresh');
  assert.deepEqual(errors,[]); check('no browser exceptions');
} finally { await browser.close(); }
