import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();page.setDefaultTimeout(10000);
let demo=false,mode='ok',read=false;
const writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const auth=(id='owner')=>({accessToken:`header.${Buffer.from(JSON.stringify({sub:id,isDemo:String(demo),exp:9999999999})).toString('base64url')}.test`,refreshToken:demo?null:'refresh',user:{id},isDemo:demo});
const property={id:'p1',title:'Marina',location:'Dubai',price:1000,totalShares:100,availableShares:20,listingType:'Rental',status:'Available'};
await context.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();
 assert.equal(u.origin,'https://sell-estate.onrender.com');const path=u.pathname.slice(4);
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(r.method()==='POST'){
  assert.ok(r.headers().authorization?.startsWith('Bearer '));writes.push({path,body:r.postDataJSON()});
  await new Promise(resolve=>setTimeout(resolve,100));
  if(mode==='401')return send({message:'Expired'},401);
  if(mode==='403')return send({},403);
  if(mode==='400')return send({message:'Insufficient funds'},400);
  if(mode==='network')return route.abort();
  if(path==='/messages/m1/mark-read')read=true;
  if(path.endsWith('/buy')||path.endsWith('/cancel'))return route.fulfill({status:200,contentType:'text/plain',body:'Operation completed.'});
  if(path.endsWith('/extend-to'))return route.fulfill({status:200,body:''});
  return send({message:'Accepted'});
 }
 if(path.includes('/unread-count/'))return send({count:read?0:1});
 if(path==='/properties')return send([property]);
 if(path.endsWith('/images'))return send([]);
 if(path==='/share-offers/active')return send([{id:'other',sellerId:'someone',propertyId:'p1',propertyTitle:'Marina buy',sharesForSale:5,startPricePerShare:10,buyoutPricePerShare:12,isActive:true,expirationDate:'2098-01-01T00:00:00Z'},{id:'mine',sellerId:'owner',propertyId:'p1',propertyTitle:'Marina own',sharesForSale:5,startPricePerShare:10,buyoutPricePerShare:12,isActive:true,expirationDate:'2098-01-01T00:00:00Z'}]);
 if(path.endsWith('/grouped'))return send([{propertyId:'p1',propertyTitle:'Marina',shares:10,totalInvested:100,averagePrice:10,buybackPricePerShare:9}]);
 if(path==='/admin/stats/settings/cancel-fee')return send('2.50');
 if(path==='/users/owner')return send({id:'owner',fullName:'Current safe profile',email:'current@example.com',phoneNumber:'123',address:'Dubai',hasPin:true,kycStatus:'approved',avatarBase64:null});
 if(path.endsWith('/total-assets'))return send({walletBalance:100,totalAssets:100});
 if(path==='/messages/inbox/owner')return send([{id:'m1',title:'Update',content:'Safe message',isRead:read,createdAt:'2026-09-01'}]);
 if(path==='/share-offers/transactions')return send([{propertyId:'p1',propertyTitle:'Anonymous trade',timestamp:'2026-09-01',shares:2,pricePerShare:12,...(demo?{buyerId:'owner',sellerId:'other'}:{})}]);
 if(path.includes('/applications/user/'))return send([]);
 throw new Error(`Unexpected GET ${path}`);
});
async function install(){await page.goto(base);await page.evaluate(a=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a)),auth());}
async function operation(url,title,fields,expected){
 await page.goto(base+url);const section=page.locator('details.operation').filter({has:page.locator('summary',{hasText:new RegExp(`^${title}$`)})});await section.locator('summary').click();
 for(const [label,value] of Object.entries(fields))await section.getByLabel(label,{exact:true}).fill(value);
 await section.getByLabel('PIN or password',{exact:true}).fill('test-secret');const before=writes.length;
 await section.getByRole('button',{name:`Review ${title.toLowerCase()}`,exact:true}).click();assert.equal(writes.length,before);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'expanded form overflow');
 assert.ok(!(await page.locator('body').innerText()).includes('test-secret'));
 await section.getByRole('button',{name:`Confirm ${title.toLowerCase()}`,exact:true}).evaluate(b=>{b.click();b.click();});
 if(mode==='ok')await section.getByText('Request accepted.',{exact:false}).waitFor();
 else if(mode==='401')await page.waitForURL('**/login');
 else await section.getByRole('alert').waitFor();
 assert.equal(writes.length,before+1,'write is not replayed');assert.deepEqual(writes.at(-1),expected);
 if(mode==='network')assert.equal(await section.getByRole('button',{name:`Review ${title.toLowerCase()}`,exact:true}).isDisabled(),true);
}
try{
 for(demo of [false,true]){
  await install();
  for(const width of [320,1440]){
   await page.setViewportSize({width,height:900});
   await operation('/properties/p1','Apply for shares',{'Shares':'2'},{path:'/investments/apply',body:{propertyId:'p1',requestedShares:2,pinOrPassword:'test-secret'}});
   await operation('/sell-shares','Create offer',{'Shares':'2','Starting price per share (USD)':'10','Buyout price per share (USD, optional)':'12','Expires (local time)':'2099-01-01T12:00'},{path:'/share-offers',body:{propertyId:'p1',sharesForSale:2,startPricePerShare:10,buyoutPricePerShare:12,expirationDate:new Date('2099-01-01T12:00').toISOString(),pinOrPassword:'test-secret'}});
   await operation('/marketplace','Buy shares',{'Shares':'2'},{path:'/share-offers/other/buy',body:{sharesToBuy:2,pinOrPassword:'test-secret'}});
   await operation('/marketplace','Place bid',{'Shares':'2','Bid price per share (USD)':'11'},{path:'/share-offers/other/bid',body:{shares:2,bidPricePerShare:11,pinOrPassword:'test-secret'}});
   await operation('/marketplace','Cancel offer',{}, {path:'/share-offers/mine/cancel',body:{pinOrPassword:'test-secret'}});
   await operation('/marketplace','Extend offer',{'New expiration (local time)':'2099-01-01T12:00'},{path:'/share-offers/mine/extend-to',body:{newDate:new Date('2099-01-01T12:00').toISOString(),pinOrPassword:'test-secret'}});
  }
  await page.goto(base+'/profile');await page.getByText('Current safe profile',{exact:true}).waitFor();await page.getByText('current@example.com',{exact:true}).waitFor();
  await page.goto(base+'/profile/change-password');await page.getByLabel('Current password',{exact:true}).fill('old');await page.getByLabel('New password',{exact:true}).fill('new');await page.getByLabel('Confirm new password',{exact:true}).fill('wrong');const before=writes.length;await page.getByRole('button',{name:'Change password',exact:true}).click();await page.getByText('New passwords do not match.').waitFor();assert.equal(writes.length,before);await page.getByLabel('Confirm new password',{exact:true}).fill('new');await page.getByRole('button',{name:'Change password',exact:true}).click();await page.getByText('Password changed.',{exact:false}).waitFor();assert.deepEqual(writes.at(-1),{path:'/users/owner/change-password',body:{currentPassword:'old',newPassword:'new'}});assert.equal(await page.getByLabel('Current password',{exact:true}).inputValue(),'');
  await page.goto(base+'/profile/edit');await page.getByLabel('Image (up to 2 MB)').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('image-fixture')});await page.getByRole('button',{name:'Save avatar'}).click();await page.getByText('Avatar updated.',{exact:false}).waitFor();assert.deepEqual(writes.at(-1),{path:'/users/owner/upload-avatar',body:{base64Image:'data:image/png;base64,'+Buffer.from('image-fixture').toString('base64')}});
  read=false;await page.goto(base+'/inbox');await page.locator('details summary').click();await page.getByRole('button',{name:'Mark as read'}).click();await page.getByRole('link',{name:'Inbox',exact:true}).first().waitFor();await page.waitForFunction(()=>!document.body.innerText.includes('Unread'));assert.deepEqual(writes.at(-1),{path:'/messages/m1/mark-read',body:{}});
  await page.goto(base+'/trade-history');await page.getByText('Anonymous trade',{exact:true}).waitFor();assert.equal(await page.locator('option[value=buy]').count(),demo?1:0);
  console.log(`PASS ${demo?'demo':'production'} six exact operation payloads, review/double-click/no secrets/320 and 1440 layouts, SafeUserResponse, password/avatar/inbox and anonymous trades`);
 }
 for(mode of ['400','403','network','401']){await install();await operation('/properties/p1','Apply for shares',{'Shares':'2'},{path:'/investments/apply',body:{propertyId:'p1',requestedShares:2,pinOrPassword:'test-secret'}});}
 mode='ok';await install();await page.goto(base+'/properties/p1');await page.getByText('Apply for shares',{exact:true}).click();await page.getByLabel('Shares',{exact:true}).fill('2');await page.getByLabel('PIN or password').fill('test-secret');await page.getByRole('button',{name:'Review apply for shares'}).click();const before=writes.length;
 await page.evaluate(a=>{localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a));window.dispatchEvent(new StorageEvent('storage',{key:'ownersclub.web.session.v1',newValue:JSON.stringify(a)}));},auth('changed'));
 assert.equal(await page.getByRole('button',{name:'Confirm apply for shares'}).count(),0);assert.equal(writes.length,before);
 await page.evaluate(()=>localStorage.clear());await page.goto(base+'/applications?propertyId=p1#details');await page.waitForURL('**/login');
 // Test the stored return target without exchanging real credentials.
 await page.evaluate(a=>{localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a));window.dispatchEvent(new StorageEvent('storage',{key:'ownersclub.web.session.v1',newValue:JSON.stringify(a)}));},auth());await page.waitForURL('**/applications?propertyId=p1#details');
 assert.deepEqual(errors,[]);console.log('PASS 400/403/network/401 no replay, account switch removes pending confirmation, deep-link query/hash preserved; no browser exceptions or real API calls');
}finally{await browser.close();}
