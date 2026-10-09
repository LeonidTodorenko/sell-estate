// Isolated browser fixtures only; real public media snapshots stay in external work/.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4176';
const fixture=JSON.parse(await fs.readFile(process.env.MEDIA_FIXTURE,'utf8'));
const out=process.env.MEDIA_SCREENSHOTS;
await fs.mkdir(out,{recursive:true});
const [p1,p2]=fixture.properties;
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext(),page=await context.newPage();
const errors=[],calls=[];let mode='normal',avatar=png;
page.on('pageerror',e=>errors.push(e.message));
await context.route('https://sell-estate.onrender.com/api/**',async route=>{
 const path=new URL(route.request().url()).pathname.slice(4);calls.push(path);
 assert.equal(route.request().method(),'GET');
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(path==='/properties')return send(fixture.properties);
 if(path.endsWith('/images')){
  if(mode==='error')return send({message:'Unavailable'},503);
  if(mode==='loading')await new Promise(r=>setTimeout(r,500));
  return send(mode==='empty'?[]:mode==='broken'?[{id:'broken',base64Data:'data:image/jpeg;base64,AAAA'}]:fixture.images[path.split('/')[2]] || []);
 }
 if(path.startsWith('/messages/unread-count/'))return send({count:2});
 if(path.endsWith('/total-assets'))return send({walletBalance:100,totalAssets:300,investmentValue:200});
 if(path.endsWith('/assets-summary'))return send({combinedHistory:[{date:'2026-10-01',total:300}]});
 if(path.startsWith('/investments/with-aggregated/'))return send([{propertyId:p1.id,propertyTitle:p1.title,totalShares:2,totalShareValue:200,totalInvested:180,ownershipPercent:1}]);
 if(path.startsWith('/investments/user/'))return send([{id:'i1',propertyId:p1.id,shares:2,investedAmount:180,createdAt:'2026-10-01'}]);
 if(path==='/share-offers/active')return send([{id:'o1',propertyId:p2.id,propertyTitle:p2.title,isActive:true,expirationDate:'2099-01-01',sharesForSale:2,startPricePerShare:100}]);
 if(/^\/users\/(owner|demo)$/.test(path))return send({id:path.split('/').pop(),fullName:'Test Owner',email:'owner@example.test',avatarBase64:avatar});
 throw new Error('Unexpected endpoint '+path);
});
const ready=()=>page.waitForFunction(()=>!document.querySelector('.loading-dot'));
try{
 for(const demo of [false,true]){
  const id=demo?'demo':'owner';await page.goto(base);
  await page.evaluate(s=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(s)),{accessToken:`a.${Buffer.from(JSON.stringify({sub:id,isDemo:String(demo),exp:9999999999})).toString('base64url')}.c`,refreshToken:demo?null:'r',isDemo:demo,user:{id,fullName:'Test Owner',avatarBase64:png}});
  for(const width of [320,390,760,1024,1440]){
   await page.setViewportSize({width,height:1000});
   for(const path of ['/properties',`/properties/${p2.id}`,'/dashboard','/investments','/profile']){
    await page.goto(base+path);await ready();
    if(await page.locator('.photo-wrap').count()) await page.locator('.photo-wrap').first().scrollIntoViewIfNeeded();
    await page.locator('.property-photo img, .panel .avatar').first().waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.property-photo img,.avatar')].filter(e=>e.tagName==='IMG').every(e=>e.complete&&e.naturalWidth>0));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' overflow '+width);
    assert.equal(await page.locator('.topbar img.avatar').count(),1);
    if(path.includes(p2.id)){
      await page.getByRole('button',{name:'Show photo 2',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Show photo 2',exact:true}).getAttribute('aria-pressed'),'true');
      await page.getByText('Photo 2 of 3',{exact:true}).waitFor();
    }
    for(const media of await page.locator('.photo-wrap').all()) { await media.scrollIntoViewIfNeeded(); }
    await page.waitForTimeout(250);
    await page.evaluate(()=>window.scrollTo(0,0));
    if(width===320||width===1440)await page.screenshot({path:`${out}/${demo?'demo':'investor'}-${width}-${path.split('/')[1]}${path.includes(p2.id)?'-detail':''}.png`,fullPage:true});
   }
   if(width<=760){await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('navigation',{name:'Main navigation'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Menu',exact:true}).getAttribute('aria-expanded'),'false');}
  }
 }
 for(const state of ['empty','broken','error','loading']){
  mode=state;await page.goto(base+`/properties/${p2.id}`);await ready();
  if(state==='error'){await page.getByRole('button',{name:'Retry photos'}).waitFor();mode='normal';await page.getByRole('button',{name:'Retry photos'}).click();await page.getByRole('button',{name:'Show photo 2',exact:true}).waitFor();}
  else if(state==='loading'){await page.getByRole('button',{name:'Show photo 2',exact:true}).waitFor();}
  else await page.getByRole('img',{name:/No photo available/}).first().waitFor();
 }
 mode='normal';avatar=png;
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('ownersclub.web.session.v1'));delete s.user.avatarBase64;localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(s));});
 await page.goto(base+'/dashboard');await page.locator('.topbar img.avatar').waitFor();
 avatar='data:image/png;base64,AAAA';await page.goto(base+'/profile');await ready();await page.locator('.panel').getByRole('img',{name:'Your avatar initials'}).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('avatar-changed',{detail:'data:image/png;base64,AAAA'})));
 await page.locator('.topbar').getByRole('img',{name:'Your avatar initials'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS Iteration 12: real public photos, gallery selection, listings, avatars, fallback/retry/loading, menu, investor/demo, five widths; GET-only mocked API');
}finally{await browser.close();}
