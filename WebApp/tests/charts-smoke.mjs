import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [], calls = [];
page.on('pageerror', e => errors.push(e.message));
let mode = 'normal';
await context.route('https://sell-estate.onrender.com/api/**', async route => {
  const path = new URL(route.request().url()).pathname.slice(4);
  assert.equal(route.request().method(), 'GET');
  calls.push(path);
  const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (path.startsWith('/messages/unread-count/')) return send({ count: 0 });
  if (mode === 'loading') await new Promise(r => setTimeout(r, 450));
  if (mode === 'error') return send({ message: 'Chart fixture unavailable' }, 503);
  const empty = mode === 'empty';
  if (path.endsWith('/assets-summary')) {
    const points = empty ? [] : mode === 'single' ? [{date:'2026-10-01',total:0}] : [{date:'bad',total:1}, {date:'2026-10-01',total:250}, {date:'2025-09-01',total:0}, {date:'2026-04-01',total:-20}, {date:'2026-08-01',total:100}];
    return send({walletBalance:100,investmentValue:200,totalAssets:300,rentalIncome:120,combinedHistory:points,equityHistory:points,rentIncomeHistory:points});
  }
  if (path.endsWith('/total-assets')) return send(empty ? {} : {walletBalance:100,investmentValue:200,pendingApplicationsValue:50,marketValue:50,totalAssets:400,rentalIncome:120});
  if (path.startsWith('/investments/with-aggregated/')) return send(empty ? [] : [{propertyId:'p1',propertyTitle:'Marina residence '.repeat(12),totalShareValue:200,totalShares:2,totalInvested:150,ownershipPercent:1}]);
  if (path.startsWith('/investments/user/')) return send(empty ? [] : [{id:'i1',propertyId:'p1',shares:2,investedAmount:150,createdAt:'2026-10-01'}]);
  if (path === '/properties') return send(empty ? [] : [
    ...['pending','available','sold','rented','declined','Custom status'].map((status,i) => ({id:`p${i}`,title:`Property ${i}`,location:'Long location '.repeat(15),status,listingType:'rental',price:1000,totalShares:100,availableShares:i,expectedYieldText:i===1?'API yield text':null})),
    {id:'missing',title:'Missing fields',status:'',listingType:'sale'},
    {id:'zero',title:'Zero price',status:'available',price:0,totalShares:10,availableShares:0},
    {id:'invalid',title:'Invalid fields',status:'pending',price:-1,totalShares:0,availableShares:-1}
  ]);
  if (path === '/users/me/rent-income-history') return send(empty ? [] : [{title:'Marina',timestamp:'2026-09-01',amount:120},{title:'Marina',timestamp:'2026-09-02',amount:30},{title:'Marina',timestamp:'2026-10-01',amount:-10}]);
  throw new Error(`Unexpected path: ${path}`);
});
const ready = () => page.waitForFunction(() => !document.querySelector('.loading-dot'));
try {
  for (const demo of [false, true]) {
    await page.goto(base);
    const id = demo ? 'demo-owner' : 'real-owner';
    const session = {accessToken:`header.${Buffer.from(JSON.stringify({sub:id,isDemo:String(demo),exp:9999999999})).toString('base64url')}.test`,refreshToken:demo?null:'refresh',user:{id},isDemo:demo};
    await page.evaluate(value => localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(value)),session);
    for (const width of [320,390,760,1024,1440]) {
      await page.setViewportSize({width,height:1000});
      for (const route of ['/dashboard','/finance','/rental-income','/investments','/properties']) {
        mode='normal'; await page.goto(base+route); await page.locator('main h1').waitFor(); await ready();
        assert.equal(await page.getByRole('alert').count(),0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), `${route} overflow at ${width}`);
        if (route !== '/properties') assert.ok(await page.locator('.analytics-card').count()>0);
      }
    }
    await page.goto(base+'/properties'); await ready();
    for (const label of ['Pending','Available','Sold','Rented','Declined','Custom status','Status not provided']) assert.ok(await page.locator('.property-card .tag').getByText(label,{exact:true}).count());
    const missing=page.locator('.property-card').filter({has:page.getByRole('heading',{name:'Missing fields'})});
    assert.equal(await missing.locator('dt').count(),0);
    assert.ok((await missing.innerText()).includes('Share availability not provided'));
    assert.equal(await page.locator('.property-card').filter({has:page.getByRole('heading',{name:'Invalid fields'})}).locator('dt').count(),0);
    assert.equal(await page.locator('.property-card').filter({has:page.getByRole('heading',{name:'Zero price'})}).getByText('$0.00',{exact:true}).count(),2);
    assert.equal(await page.locator('.property-card').getByText('API yield text',{exact:true}).count(),1);
    await page.goto(base+'/investments'); await ready(); await page.getByLabel('Minimum shares',{exact:true}).fill('999');
    await page.getByRole('button',{name:'Clear filters',exact:true}).click(); assert.equal(await page.getByLabel('Minimum shares',{exact:true}).inputValue(),'');
    await page.goto(base+'/rental-income'); await ready(); await page.getByLabel('From',{exact:true}).fill('2099-01-01');
    await page.getByRole('button',{name:'Clear dates',exact:true}).click(); assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'');
    await page.goto(base+'/dashboard'); await ready();
    for (const [label,path] of [['My Investments','/investments'],['Rental Income','/rental-income'],['Explore Properties','/properties']]) {
      const link=page.getByRole('navigation',{name:'Quick actions',exact:true}).getByRole('link',{name:label});
      assert.equal(await link.count(),1); await link.click(); assert.equal(new URL(page.url()).pathname,path); await ready(); await page.goto(base+'/dashboard'); await ready();
    }
    const card=page.locator('.analytics-card').first();
    for (const [range,count] of [['3M',2],['6M',3],['1Y',3],['All',4]]) {
      await card.getByRole('button',{name:range,exact:true}).click();
      await card.locator('summary').click();
      assert.equal(await card.locator('tbody tr').count(),count);
      await card.locator('summary').click();
    }
    await page.goto(base+'/finance'); await ready();
    const structure=page.locator('.analytics-card').filter({has:page.getByRole('heading',{name:'Asset structure',exact:true})});
    assert.equal(await structure.locator('li').count(),4);
    assert.ok(!(await structure.locator('li').allTextContents()).some(s=>s.includes('Rental')));
    await page.goto(base+'/rental-income'); await ready();
    await page.locator('.chart-data summary').click();
    assert.deepEqual(await page.locator('.chart-data tbody tr').allTextContents(),['2026-09-01$150.00','2026-10-01-$10.00']);
    await page.getByLabel('From',{exact:true}).fill('2026-09-02');
    assert.deepEqual(await page.locator('.chart-data tbody tr').allTextContents(),['2026-09-01$30.00','2026-10-01-$10.00']);
    for (const route of ['/dashboard','/finance','/rental-income','/investments']) {
      mode='loading'; await page.goto(base+route); await page.locator('.loading-dot').first().waitFor(); await ready();
      mode='error'; await page.reload(); await page.getByRole('alert').first().waitFor(); await ready();
      mode='normal'; await page.getByRole('button',{name:'Try again',exact:true}).evaluateAll(buttons => buttons.forEach(button => button.click()));
      await ready(); assert.equal(await page.getByRole('alert').count(),0);
      mode='empty'; await page.reload(); await ready(); assert.equal(await page.locator('svg.analytics-chart').count(),0);
      if(route==='/dashboard'||route==='/finance') assert.ok(await page.getByText('No historical data yet',{exact:true}).count());
      if(route==='/rental-income') assert.equal(await page.getByRole('link',{name:'View your properties →',exact:true}).count(),1);
      if(route==='/investments') assert.equal(await page.getByRole('link',{name:'Explore properties →',exact:true}).count(),1);
    }
    mode='single'; await page.goto(base+'/dashboard'); await ready(); assert.equal(await page.locator('.analytics-chart circle').count(),1);
    console.log(`PASS ${demo?'demo':'investor'}: four pages, five widths, range values, monthly aggregation, loading/error/retry/empty/single`);
  }
  mode='normal'; await page.setViewportSize({width:1440,height:1000}); await page.goto(base+'/dashboard'); await ready();
  const output=process.env.CHART_SCREENSHOTS || 'outputs/charts'; await fs.mkdir(output,{recursive:true});
  await page.screenshot({path:`${output}/dashboard-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844}); await page.goto(base+'/finance'); await ready(); await page.screenshot({path:`${output}/finance-mobile.png`,fullPage:true});
  await page.setViewportSize({width:320,height:900}); await page.goto(base+'/properties'); await ready(); await page.screenshot({path:`${output}/properties-mobile.png`,fullPage:true});
  assert.deepEqual(errors,[]); console.log(`PASS no browser errors; ${calls.length} mocked GET requests; screenshots: ${output}`);
} finally { await browser.close(); }
