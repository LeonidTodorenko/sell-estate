import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'C:/App/work/iteration8/tooling/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const page=await context.newPage();
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:4178';let mode='lost';const posts=[],errors=[];
const auth={accessToken:'h.'+Buffer.from(JSON.stringify({sub:'owner',exp:9999999999})).toString('base64url')+'.s',refreshToken:'r',user:{id:'owner'},isDemo:false,demoCode:null};
page.on('pageerror',e=>errors.push(e.message));
await context.route('https://sell-estate.onrender.com/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(req.method()==='POST'){
  assert.equal(path,'/api/investments/apply');posts.push({body:req.postDataJSON(),key:req.headers()['idempotency-key'],auth:req.headers().authorization});
  await new Promise(r=>setTimeout(r,100));
  if(mode==='lost')return route.abort();if(mode==='409')return send({message:'Conflict'},409);
  return send({message:'Application submitted'});
 }
 if(path==='/api/properties')return send([{id:'p1',title:'Test property',price:100,totalShares:10,availableShares:5}]);
 if(path==='/api/users/owner')return send({id:'owner'});
 if(path.includes('unread-count'))return send({count:0});
 return send([]);
});
try{
 await page.goto(base);await page.evaluate(a=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a)),auth);
 const open=async()=>{await page.goto(base+'/properties/p1');await page.getByText('Apply for shares',{exact:true}).click();await page.getByRole('button',{name:'Review purchase',exact:true}).waitFor();};
 const confirm=async()=>{await page.getByLabel('PIN or password',{exact:true}).fill('1234');await page.getByRole('button',{name:/Review (saved )?purchase/,exact:false}).click();await page.getByRole('button',{name:'Confirm purchase',exact:true}).evaluate(b=>{b.click();b.click();});};
 await open();await page.getByLabel('Shares',{exact:true}).fill('2');await confirm();await page.getByRole('alert').waitFor();assert.equal(posts.length,1);
 const first=posts[0];assert.match(first.key,/^[0-9a-f-]{36}$/);assert.equal(first.auth,'Bearer '+auth.accessToken);assert.deepEqual(first.body,{propertyId:'p1',requestedShares:2,pinOrPassword:'1234'});
 await page.reload();await page.getByText('Apply for shares',{exact:true}).click();await page.getByText('Unresolved purchase:',{exact:false}).waitFor();assert.equal(await page.getByLabel('Shares',{exact:true}).isDisabled(),true);
 const other=await context.newPage();await other.goto(base);
 await other.evaluate(()=>{navigator.locks.request('ownersclub.investment.apply:owner',async()=>{window.lockHeld=true;await new Promise(r=>{window.releasePurchaseLock=r;});});});
 await other.waitForFunction(()=>window.lockHeld);await confirm();await page.getByRole('alert').waitFor();assert.equal(posts.length,1,'cross-tab lock blocks a second POST');
 await other.evaluate(()=>window.releasePurchaseLock());await other.close();
 mode='ok';await confirm();await page.getByText('Request accepted.',{exact:false}).waitFor();assert.equal(posts.length,2);assert.deepEqual(posts[1],first);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ownersclub.investment.apply.v1:')).length),0);
 await open();await page.getByLabel('Shares',{exact:true}).fill('3');mode='409';await confirm();await page.getByRole('alert').waitFor();assert.notEqual(posts[2].key,first.key);assert.equal(await page.getByRole('button',{name:'Review saved purchase',exact:true}).isDisabled(),true);
 await page.reload();await page.getByText('Apply for shares',{exact:true}).click();await page.getByText('Unresolved purchase:',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Review saved purchase',exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS browser: duplicate taps, lost response, reload, exact retry, JWT header, cleanup, next UUID, persistent 409, cross-tab exclusion');
}catch(e){console.log(JSON.stringify({posts,errors,text:await page.locator("body").innerText()}));throw e;}finally{await browser.close();}
