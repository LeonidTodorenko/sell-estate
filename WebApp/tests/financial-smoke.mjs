import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:4175';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const page=await context.newPage();
let demo=true,mode='ok',posts=0,reads=0;const unexpected=[],errors=[];
const auth=(isDemo=demo,id='owner',exp=9999999999)=>({accessToken:`header.${Buffer.from(JSON.stringify({sub:id,isDemo:String(isDemo),exp})).toString('base64url')}.test`,refreshToken:isDemo?null:'refresh',user:{id},isDemo,demoCode:null});
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(u.origin!=='https://sell-estate.onrender.com'){unexpected.push(r.url());return route.abort();}
 const path=u.pathname.slice(4);
 if(r.method()==='POST'){
  if(path!=='/demo/wallet/topup'||!demo){unexpected.push(`${r.method()} ${path}`);return route.abort();}
  posts++;assert.deepEqual(r.postDataJSON(),{amount:12.34});assert.equal(r.headers().authorization,`Bearer ${auth().accessToken}`);
  await new Promise(r=>setTimeout(r,250));
  if(mode==='401')return send({message:'Expired'},401);
  if(mode==='error')return send({message:'Server rejected amount'},400);
  if(mode==='network')return route.abort();
  return send({message:'Virtual funds added',amount:12.34,walletBalance:112.34,isDemo:true});
 }
 if(r.method()!=='GET'){unexpected.push(r.method());return route.abort();}
 if(path.startsWith('/messages/unread-count/')){reads++;return send({count:0});}
 if(path==='/properties')return send([{id:'p1',title:'Property',price:100,totalShares:10,availableShares:5}]);
 if(path==='/properties/p1/images')return send([]);
 if(path==='/share-offers/active')return send([]);
 if(path.includes('/grouped')||path.includes('/bids')||path.startsWith('/applications/user/'))return send([]);
 unexpected.push(`GET ${path}`);return route.abort();
});
const install=async a=>{await page.goto(base);await page.evaluate(a=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a)),a);};
const review=async()=>{await page.getByLabel('Amount (USD)').fill('12.34');await page.getByRole('button',{name:'Review demo top-up'}).click();await page.getByRole('dialog').waitFor();};
try{
 for(demo of [false,true]){
  await install(auth());
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   for(const path of ['/top-up','/withdraw','/properties/p1','/marketplace','/marketplace/o1/bids','/sell-shares','/applications']){
    await page.goto(base+path);await page.locator('main h1').waitFor();await page.waitForFunction(()=>!document.querySelector('.loading-dot'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   await page.goto(base+'/top-up');
   if(!demo){assert.equal(await page.getByRole('button',{name:'Review demo top-up'}).count(),0);continue;}
   const before=posts;await review();assert.equal(posts,before);await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(posts,before);
   await review();const oldReads=reads;
   await page.getByRole('button',{name:'Confirm virtual top-up'}).evaluate(b=>{b.click();b.click();});
   await page.getByText('Virtual funds added. Wallet balance:',{exact:false}).waitFor();assert.equal(posts,before+1);
   await page.waitForFunction(()=>!document.querySelector('.loading-dot'));assert.ok(reads>oldReads,'mounted data refetched');
   assert.equal(await page.locator('input[type=password]').count(),0);
  }
 }
 demo=true;
 for(mode of ['error','401','network']){
  await install(auth());await page.goto(base+'/top-up');await review();const before=posts;await page.getByRole('button',{name:'Confirm virtual top-up'}).click();await page.getByRole('alert').waitFor();assert.equal(posts,before+1);assert.equal(await page.getByRole('button',{name:'Review demo top-up'}).isDisabled(),true);
 }
 mode='ok';
 for(const changed of [auth(false),auth(true,'another')]){
  await install(auth());await page.goto(base+'/top-up');await review();const before=posts;
  await page.evaluate(a=>{localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a));window.dispatchEvent(new StorageEvent('storage',{key:'ownersclub.web.session.v1',newValue:JSON.stringify(a)}));},changed);
  const button=page.getByRole('button',{name:'Confirm virtual top-up'});if(await button.count())await button.click();assert.equal(posts,before);
 }
 await install(auth(true,'owner',1));const before=posts;await page.goto(base+'/top-up');await page.waitForURL('**/login');assert.equal(posts,before);
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 console.log('PASS financial/security: normal/demo, 390/1440 widths, confirmation/cancel, exact body, double-click, success/refetch, error/network/401 no replay, identity/mode change, expired demo, unexpected POST denial');
}finally{await browser.close();}
