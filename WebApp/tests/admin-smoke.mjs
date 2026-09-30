import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4175';
const apiOrigin = 'https://sell-estate.onrender.com';
const key = 'ownersclub.web.session.v1';
const auth = (role = 'admin', demo = false, id = 'admin-1') => ({
  accessToken: `header.${Buffer.from(JSON.stringify({ sub:id, role, isDemo:String(demo), exp:9999999999 })).toString('base64url')}.test`,
  refreshToken: demo ? null : 'refresh', isDemo:demo, demoCode:demo?'DEMO-1':null,
  user:{ id, role, email:`${role}@example.com`, fullName:role === 'admin' ? 'Admin User' : 'Investor User', isDemo:demo },
});
const browser = await chromium.launch({ channel:'msedge', headless:true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(10000);
const calls = [], errors = [];
let mode = 'normal';
page.on('pageerror', error => errors.push(error.message));
await context.route(`${apiOrigin}/api/**`, async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname.slice(4);
  calls.push({ path:path + url.search, method:request.method() });
  assert.equal(request.method(), 'GET', `Admin Web must not mutate: ${path}`);
  assert.ok(request.headers().authorization?.startsWith('Bearer '));
  const send = (data, status=200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) });
  if (mode === 'forbidden') return send({}, 403);
  if (mode === 'error') return send({ message:'Admin fixture unavailable' }, 503);
  if (mode === 'empty') {
    if (path === '/admin/stats') return send({investors:0,totalInvestments:0,totalProperties:0,totalRentalIncome:0,pendingWithdrawals:0,pendingKyc:0});
    if (path === '/admin/stats/logs') return send({total:0,page:1,pageSize:20,items:[]});
    return send([]);
  }
  if (path === '/admin/stats') return send({investors:12,totalInvestments:125000,totalProperties:4,totalRentalIncome:8200,pendingWithdrawals:2,pendingKyc:3});
  if (path === '/admin/users' && url.searchParams.get('query')) {
    assert.equal(url.searchParams.get('query'),'Jane + Ops');
    return send([{id:'user-1',fullName:'Jane Operator',email:'jane@example.com',userRole:0,userRoleText:'Investor',permissions:0,permissionsText:[],isBlocked:false,isEmailConfirmed:true,createdAt:'2026-09-01'}]);
  }
  if (path === '/admin/users') return send([{id:'user-1',fullName:'Jane Operator',email:'jane@example.com',userRole:0,userRoleText:'Investor',permissions:0,permissionsText:[],isBlocked:false,isEmailConfirmed:true,createdAt:'2026-09-01'}]);
  if (path === '/admin/users/user-1') return send({id:'user-1',fullName:'Jane Operator',email:'jane@example.com',userRole:0,userRoleText:'Investor',permissions:0,permissionsText:[],isBlocked:false,isEmailConfirmed:true,createdAt:'2026-09-01'});
  if (path === '/admin/investments') return send([{id:'investment-1',userId:'user-1',propertyId:'property-1',shares:10,investedAmount:2500,createdAt:'2026-09-02'}]);
  if (path === '/admin/demo-accounts') return send([{id:'demo-1',demoCode:'SANDBOX-1',fullName:'Demo Client',email:'demo@example.com',walletBalance:10000,isTemplate:false,isActive:true,createdAt:'2026-09-01',lastActiveAt:'2026-09-10',expiresAt:'2026-12-01'}]);
  if (path === '/admin/stats/logs') {
    const pageNumber = Number(url.searchParams.get('page'));
    if (url.searchParams.has('action')) assert.equal(url.searchParams.get('action'),'Balance +');
    return send({total:21,page:pageNumber,pageSize:20,items:[{id:`log-${pageNumber}`,userId:'admin-1',userName:'Admin User',action:'Balance Updated',details:'Read-only fixture details',timestamp:'2026-09-03'}]});
  }
  throw new Error(`Unexpected admin endpoint ${path}`);
});
async function setSession(value) {
  await page.goto(base);
  await page.evaluate(([storageKey, session]) => { if (session) localStorage.setItem(storageKey,JSON.stringify(session)); else localStorage.removeItem(storageKey); }, [key,value]);
}
const waitLoaded = async () => { await page.locator('main h1').waitFor(); await page.waitForFunction(() => !document.querySelector('.loading-dot')); };
try {
  await setSession(null); await page.goto(base+'/admin/logs?action=x#top'); await page.waitForURL('**/login');
  await page.evaluate(([storageKey,value]) => { localStorage.setItem(storageKey,JSON.stringify(value)); window.dispatchEvent(new StorageEvent('storage',{key:storageKey,newValue:JSON.stringify(value)})); }, [key,auth()]);
  await page.waitForURL('**/admin/logs?action=x#top');
  await waitLoaded();
  assert.equal(calls.filter(call => call.path.startsWith('/admin/stats/logs?')).length,1);

  for (const blocked of [auth('investor'), auth('admin',true,'demo-1')]) {
    const before = calls.length; await setSession(blocked); await page.goto(base+'/admin');
    await page.getByText(blocked.isDemo ? 'Demo accounts cannot access administration.' : 'This account is not marked as an administrator. Server authorization remains authoritative.',{exact:true}).waitFor();
    assert.equal(calls.length,before,'frontend guard avoids irrelevant admin request');
  }

  await setSession(auth());
  const routes = ['/admin','/admin/users','/admin/users/user-1','/admin/investments','/admin/demo-accounts','/admin/logs'];
  for (const width of [320,390,760,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for (const route of routes) {
      await page.goto(base+route); await waitLoaded();
      assert.equal(await page.getByRole('alert').count(),0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} overflow at ${width}`);
    }
  }
  await page.goto(base+'/admin/users'); await waitLoaded();
  await page.getByLabel('Name or email').fill(' Jane + Ops '); await page.getByRole('button',{name:'Search'}).click(); await page.getByText('Jane Operator',{exact:true}).waitFor();
  await page.goto(base+'/admin/logs'); await waitLoaded();
  await page.getByLabel('Action').fill(' Balance + '); await page.getByRole('button',{name:'Apply filters'}).click(); await page.getByText('Balance Updated',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Next'}).click(); await page.getByText('Page 2 of 2',{exact:false}).waitFor();

  mode='error'; await page.goto(base+'/admin/investments'); await page.getByText('Admin fixture unavailable',{exact:true}).waitFor();
  mode='normal'; await page.getByRole('button',{name:'Try again'}).click(); await page.getByText('investment-1',{exact:true}).waitFor();
  mode='empty'; for (const route of ['/admin/users','/admin/investments','/admin/demo-accounts','/admin/logs']) { await page.goto(base+route); await waitLoaded(); assert.ok(await page.locator('main .state h3').count()>0); }
  mode='forbidden'; await page.goto(base+'/admin'); await page.getByText('Access is unavailable for this account. Check your account status or sign in again.',{exact:true}).waitFor();
  assert.ok(calls.every(call => call.method === 'GET'));
  assert.deepEqual(errors,[]);
  console.log('PASS admin role/demo UX guard, authoritative 403, six read-only views, filters, pagination, errors/empty states, five widths, no writes or real API calls');
} finally { await browser.close(); }
