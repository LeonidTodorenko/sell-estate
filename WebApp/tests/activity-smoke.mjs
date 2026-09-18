import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:4175';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const page=await context.newPage();
let demo=false,mode='normal',posts=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
const id=()=>demo?'demo-owner':'real-owner';
const auth=()=>({accessToken:`header.${Buffer.from(JSON.stringify({sub:id(),isDemo:String(demo),exp:9999999999})).toString('base64url')}.test`,refreshToken:demo?null:'refresh',user:{id:id()},isDemo:demo});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.continue();
 assert.equal(url.origin,'https://sell-estate.onrender.com');assert.ok(url.pathname.startsWith('/api/'));const path=url.pathname.slice(4);
 assert.equal(request.headers().authorization,`Bearer ${auth().accessToken}`);
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(path.startsWith('/messages/unread-count/'))return send({count:2});
 if(request.method()==='POST'){assert.equal(path,`/users/${id()}/update-profile`);posts++;assert.deepEqual(request.postDataJSON(),{fullName:'Updated Name',email:demo?'demo@example.com':'updated@example.com',phoneNumber:'123',address:'Test address'});if(mode==='write-error')return send({message:'Profile rejected'},400);if(mode==='write401')return send({message:'Unauthorized write'},401);return send({message:'Profile updated'});}
 assert.equal(request.method(),'GET');if(mode==='error')return send({message:'Fixture unavailable'},503);
 if(mode==='loading')await new Promise(r=>setTimeout(r,250));
 if(path===`/users/${id()}`)return send({id:id(),fullName:'Initial Name',email:demo?'demo@example.com':'real@example.com',phoneNumber:'',address:''});
 if(mode==='empty')return send([]);
 if(path===`/applications/user/${id()}`)return send([{id:'app1',propertyId:'p1',propertyTitle:'Marina Residence',requestedAmount:100,requestedShares:2,approvedAmount:0,approvedShares:0,status:null,isPriority:true,stepNumber:1,createdAt:'2026-09-01'}]);
 if(path==='/share-offers/transactions')return send([{propertyId:'p1',propertyTitle:'Purchase property',shares:2,pricePerShare:50,buyerId:id(),sellerId:'other',timestamp:'2026-09-01'},{propertyId:'p2',propertyTitle:'Sale property',shares:3,pricePerShare:60,buyerId:'other',sellerId:id(),timestamp:'2026-09-02'}]);
 if(path==='/share-offers/offer1/bids')return send([{id:'bid1',offerId:'offer1',bidderId:id(),shares:2,bidPricePerShare:55,createdAt:'2026-09-01'}]);
 if(path===`/share-offers/user/${id()}/grouped`)return send([{propertyId:'p1',propertyTitle:'Marina Residence',shares:2,totalInvested:100,averagePrice:50,buybackPricePerShare:45}]);
 throw Error(`Unexpected endpoint ${path}`);
});
const routes=['/applications','/trade-history','/marketplace/offer1/bids','/sell-shares','/profile/edit','/profile/change-password','/privacy','/terms','/support'];
const settled=()=>page.waitForFunction(()=>!document.querySelector('.loading-dot'));
try{
 for(demo of [false,true]){
  await page.goto(base);await page.evaluate(a=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a)),auth());
  for(const width of [320,390,760,1024,1440]){await page.setViewportSize({width,height:900});for(const path of routes){await page.goto(base+path);await page.locator('main h1').waitFor();await settled();assert.equal(await page.getByRole('alert').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} overflow ${width}`);}}
  if(process.env.SMOKE_SCREENSHOT_DIR){await page.goto(base+'/applications');await settled();await page.screenshot({path:process.env.SMOKE_SCREENSHOT_DIR+'/'+(demo?'demo':'normal')+'-applications.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.goto(base+'/profile/edit');await settled();await page.screenshot({path:process.env.SMOKE_SCREENSHOT_DIR+'/'+(demo?'demo':'normal')+'-profile-mobile.png',fullPage:true});}
  console.log(`PASS ${demo?'demo':'normal'} nine routes at five widths`);
  await page.goto(base+'/applications');await page.getByText('Pending',{exact:true}).last().waitFor();await page.getByText('Application details').click();assert.equal(await page.getByText('$0.00',{exact:true}).count(),1);
  await page.goto(base+'/applications?propertyId=missing');await page.getByText('No matching applications').waitFor();
  await page.goto(base+'/trade-history');await page.getByText('Purchase property').waitFor();assert.equal(await page.getByText('Sale property').count(),0);await page.getByRole('combobox').selectOption('sell');await page.getByText('Sale property').waitFor();
  await page.goto(base+'/profile/edit');await page.getByLabel('Full name',{exact:true}).fill('Updated Name');assert.equal(await page.getByLabel('Email',{exact:true}).isDisabled(),demo);if(!demo)await page.getByLabel('Email',{exact:true}).fill('updated@example.com');await page.getByLabel('Phone number').fill('123');await page.getByLabel('Address').fill('Test address');
  await page.getByRole('button',{name:'Save profile'}).click();await page.getByText('Profile updated.',{exact:true}).waitFor();
  mode='write-error';await page.getByRole('button',{name:'Save profile'}).click();await page.getByText('Profile rejected').waitFor();
  mode='write401';const before=posts;await page.getByRole('button',{name:'Save profile'}).click();await page.getByText('Unauthorized write').waitFor();assert.equal(posts,before+1);mode='normal';
  console.log(`PASS ${demo?'demo':'normal'} mappings, filters, profile payload, errors and no replay`);
 }
 for(const path of routes.slice(0,5)){mode='loading';await page.goto(base+path);await page.locator('.loading-dot').waitFor();await settled();mode='error';await page.reload();await page.getByText('Fixture unavailable').waitFor();mode='normal';await page.getByRole('button',{name:'Try again'}).click();await settled();if(path!='/profile/edit'){mode='empty';await page.reload();await settled();assert.ok(await page.locator('.state h3').count());}}
 mode='normal';for(const kind of ['privacy','terms','support']){await page.goto(base+'/'+kind);assert.equal(await page.locator('main a').getAttribute('href'),`https://sell-estate.onrender.com/${kind}`);}
 assert.deepEqual(errors,[]);console.log('PASS loading/error/retry/empty states, legal targets and no browser errors');
}finally{await browser.close();}


