// Production preview only. All API traffic uses isolated, GET-only fixtures.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const qaRequire=createRequire(import.meta.url);
const {PNG}=qaRequire(qaRequire.resolve('pngjs',{paths:[process.env.PLAYWRIGHT_MODULE || process.cwd()]}));
const base=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4182';
const out=process.env.THEME_SCREENSHOTS;
const fixture=JSON.parse(await fs.readFile(process.env.MEDIA_FIXTURE,'utf8'));
await fs.mkdir(out,{recursive:true});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const snapshots=new Map(); const errors=[];
const comparisons=[];
function samePixels(a,b,key,preference,forced){
 const expected=PNG.sync.read(a),actual=PNG.sync.read(b);
 assert.equal(actual.width,expected.width);assert.equal(actual.height,expected.height);
 let different=0;
 for(let i=0;i<actual.data.length;i+=4){if([0,1,2,3].some(c=>Math.abs(actual.data[i+c]-expected.data[i+c])>2))different++;}
 const fraction=different/(actual.width*actual.height);
 comparisons.push({key,preference,forced,differentPixels:different,fraction});
 assert.ok(fraction<=.00001,`Rendered colors changed under ${preference}, forced=${forced}: ${key}, fraction=${fraction}`);
}
for(const forced of [false,true]){
 const browser=await chromium.launch({channel:'msedge',headless:true,args:forced?['--enable-features=WebContentsForceDark']:[]});
 try{
 // Auto Dark Theme operates with a dark preference. The hard browser override
 // with a light preference can bypass the author's opt-out; record it separately.
 for(const preference of forced?['dark']:['light','dark']){
 const context=await browser.newContext({colorScheme:preference});
 await context.route('**/api/**',async r=>{
  assert.equal(r.request().method(),'GET'); const p=new URL(r.request().url()).pathname.slice(4);
  const history=[{date:'2026-04-01',total:100},{date:'2026-10-01',total:300}];
  let data=[];
  if(p==='/properties')data=fixture.properties;
  else if(p.endsWith('/images'))data=fixture.images[p.split('/')[2]] || [];
  else if(p==='/users/qa')data={id:'qa',fullName:'Light Theme QA',email:'qa@example.test',avatarBase64:png};
  else if(p.endsWith('/total-assets'))data={walletBalance:100,totalAssets:300,investmentValue:200,rentalIncome:20};
  else if(p.endsWith('/assets-summary'))data={combinedHistory:history,equityHistory:history,rentIncomeHistory:history};
  else if(p.includes('unread-count'))data={count:0};
  else if(p==='/admin/stats')data={investors:12,totalInvestments:100,totalProperties:4,totalRentalIncome:20,pendingWithdrawals:0,pendingKyc:0};
  else if(p==='/admin/stats/logs')data={total:0,page:1,pageSize:20,items:[]};
  await r.fulfill({json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.evaluate(s=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(s)),{accessToken:`a.${Buffer.from(JSON.stringify({sub:'qa',role:'admin',isDemo:'false',exp:9999999999})).toString('base64url')}.c`,refreshToken:'fixture',isDemo:false,user:{id:'qa',role:'admin',fullName:'Light Theme QA',avatarBase64:png}});
 for(const width of [320,390,760,1024,1440]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['/dashboard','/properties',`/properties/${fixture.properties[1].id}`,'/investments','/profile','/profile/edit','/admin','/admin/users','/admin/investments','/admin/demo-accounts','/admin/logs']){
   await page.goto(base+route);await page.locator('main h1').waitFor();
   await page.waitForFunction(()=>!document.querySelector('.loading-dot'));
   for(const media of await page.locator('.photo-wrap').all())await media.scrollIntoViewIfNeeded();
   await page.waitForLoadState('networkidle');
   await page.waitForFunction(()=>[...document.querySelectorAll('.property-photo img,.avatar')].filter(e=>e.tagName==='IMG').every(e=>e.complete&&e.naturalWidth>0));
   await page.evaluate(()=>scrollTo(0,0));
   const colors=await page.evaluate(()=>({scheme:getComputedStyle(document.documentElement).colorScheme,meta:document.querySelector('meta[name="color-scheme"]').content,canvas:getComputedStyle(document.body).backgroundColor,surfaces:[...document.querySelectorAll('.sidebar,.topbar,.panel:not(.quick-actions),.property-card,.filters,input:not([type=checkbox]),select,textarea')].map(e=>getComputedStyle(e).backgroundColor),metric:document.querySelector('.metric')?getComputedStyle(document.querySelector('.metric')).backgroundColor:null}));
   assert.deepEqual(colors.scheme.split(' ').sort(),['light','only']);assert.equal(colors.meta,'only light');assert.equal(colors.canvas,'rgb(244, 247, 245)');
   assert.ok(colors.surfaces.every(c=>c==='rgb(255, 255, 255)'),route+JSON.stringify(colors));
   if(colors.metric)assert.ok(['rgb(229, 245, 235)','rgb(255, 255, 255)'].includes(colors.metric));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow '+width);
   if([320,1440].includes(width)){
    const key=width+'-'+route.slice(1).replaceAll('/','-');
    const bytes=await page.screenshot({fullPage:true,animations:'disabled'});
    if(!forced&&preference==='light'){snapshots.set(key,bytes);await fs.writeFile(`${out}/${key}.png`,bytes);}
    else {await fs.writeFile(`${out}/${key}-${preference}-forced-${forced}.png`,bytes);samePixels(snapshots.get(key),bytes,key,preference,forced);}
   }
  }
 }
 await context.close();
 }
 }finally{await browser.close();}
}
assert.deepEqual(errors,[]);
await fs.writeFile(`${out}/pixel-comparisons.json`,JSON.stringify(comparisons,null,2));
console.log('PASS light-only theme: 165 route/viewport/mode cases; desktop/mobile rendered colors match (0.001% raster tolerance) across light/dark preference and Chromium Auto Dark Theme with dark preference; investor/admin/media/chart/inputs; GET-only fixtures.');
