import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:4175';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const page=await context.newPage();
let demo=false,mode='normal',posts=0,chatReads=0,canInvite=true;const errors=[];page.on('pageerror',e=>errors.push(e.message));
const id=()=>demo?'demo-owner':'real-owner';
const auth=()=>({accessToken:`header.${Buffer.from(JSON.stringify({sub:id(),isDemo:String(demo),exp:9999999999})).toString('base64url')}.test`,refreshToken:demo?null:'refresh',user:{id:id()},isDemo:demo});
await context.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();
 assert.equal(u.origin,'https://sell-estate.onrender.com');assert.ok(u.pathname.startsWith('/api/'));
 const path=u.pathname.slice(4),send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 assert.equal(r.headers().authorization,`Bearer ${auth().accessToken}`);
 if(r.method()==='POST'){
  assert.equal(demo,false);assert.ok(['/chat/send','/referrals/invite'].includes(path));posts++;
  assert.deepEqual(r.postDataJSON(),path==='/chat/send'?{recipientId:'admin',content:'Test message'}:{email:'friend@example.com'});
  if(mode==='write401')return send({message:'Unauthorized write'},401);
  if(mode==='write-error')return send({message:'Request rejected'},400);
  return send(path==='/referrals/invite'?{code:'INVITE-TEST',link:'https://example.test/invite/INVITE-TEST'}:{});
 }
 assert.equal(r.method(),'GET');
 if(path.startsWith('/messages/unread-count/'))return send({count:3});
 if(mode==='error')return send({message:'Fixture unavailable'},503);
 if(mode==='loading')await new Promise(r=>setTimeout(r,300));
 if(path==='/users/admin-id'){assert.equal(demo,false);chatReads++;return send({adminId:'admin'});}
 if(path.startsWith('/chat/conversation/')){assert.equal(demo,false);chatReads++;return send(mode==='empty'?[]:[{id:'m1',senderId:'admin',recipientId:id(),content:'Welcome <script>safe text</script>',sentAt:'2026-09-01'}]);}
 if(path===`/properties/my-properties/${id()}`)return send(mode==='empty'?[]:[{propertyId:'p1',propertyTitle:'Marina Residence',totalShares:3,totalInvested:150}]);
 if(path===`/share-offers/${id()}/club-info`)return send({status:'Expert',totalAssets:150,baseFee:.2,withReferralFee:.1,canInvite,referrerRewardPercent:.03,referrerRewardYears:2});
 if(path===`/users/${id()}/total-assets`)return send({clubStatus:'Expert',clubFeePercent:0,hasReferrer:false});
 if(path==='/referrals/my-invites')return send(mode==='empty'?[]:[{id:'i1',inviteeEmail:'previous@example.com',createdAt:'2026-09-01',expiresAt:'2026-10-01',status:'Pending'}]);
 if(path===`/withdrawals/user/${id()}`)return send(mode==='empty'?[]:[{id:'w1',amount:15,status:'Pending',createdAt:'2026-09-01'}]);
 if(path==='/properties')return send([{id:'p1',title:'Marina Residence',location:'Dubai',latitude:0,longitude:0,price:100,totalShares:10,availableShares:2}]);
 if(path==='/properties/p1/images')return send([]);
 throw Error(`Unexpected API ${path}`);
});
const routes=['/my-properties','/club','/referrals','/withdrawals','/top-up','/withdraw','/chat','/about','/properties/p1'];
const settled=()=>page.waitForFunction(()=>!document.querySelector('.loading-dot'));
try{
 for(demo of [false,true]){
  await page.goto(base);await page.evaluate(a=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a)),auth());
  const beforeReads=chatReads,beforePosts=posts;
  for(const width of [320,390,760,1024,1440]){await page.setViewportSize({width,height:900});for(const path of routes){await page.goto(base+path);await page.locator('main h1').waitFor();await settled();assert.equal(await page.getByRole('alert').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} overflow ${width}`);}}
  assert.equal(posts,beforePosts);
  await page.goto(base+'/properties/p1');await settled();assert.equal(await page.getByRole('link',{name:'Open in OpenStreetMap'}).getAttribute('href'),'https://www.openstreetmap.org/?mlat=0&mlon=0#map=15/0/0');
  await page.goto(base+'/club');await settled();await page.getByText('0%',{exact:true}).waitFor();await page.getByRole('link',{name:'Inbox (3)',exact:true}).waitFor();
  if(demo){assert.equal(chatReads,beforeReads);await page.goto(base+'/chat');assert.equal(await page.getByRole('button',{name:'Send message'}).count(),0);await page.goto(base+'/referrals');await settled();assert.equal(await page.getByRole('button',{name:'Send invitation'}).count(),0);}
  else {
   for(const [path,label,button,value] of [['/chat','Message','Send message','Test message'],['/referrals','Friend’s email','Send invitation','friend@example.com']]){
    await page.goto(base+path);await settled();await page.getByLabel(label,{exact:true}).fill(value);await page.getByRole('button',{name:button,exact:true}).click();await page.getByText(path==='/chat'?'Message sent.':'Invitation sent.',{exact:true}).waitFor();await settled();if(path==='/referrals')await page.getByText('Code: INVITE-TEST',{exact:true}).waitFor();
    await page.getByLabel(label,{exact:true}).fill(value);mode='write401';let before=posts;await page.getByRole('button',{name:button,exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(posts,before+1);mode='normal';
   }
   canInvite=false;await page.goto(base+'/referrals');await settled();assert.equal(await page.getByRole('button',{name:'Send invitation'}).isDisabled(),true);canInvite=true;
  }
  if(process.env.SMOKE_SCREENSHOT_DIR){await page.goto(base+'/club');await settled();await page.screenshot({path:process.env.SMOKE_SCREENSHOT_DIR+`/${demo?'demo':'normal'}-club.png`,fullPage:true});await page.setViewportSize({width:390,height:844});await page.goto(base+'/referrals');await settled();await page.screenshot({path:process.env.SMOKE_SCREENSHOT_DIR+`/${demo?'demo':'normal'}-referrals-mobile.png`,fullPage:true});}
  console.log(`PASS ${demo?'demo':'normal'}: nine routes at five widths, map, backend fees, unread count and write restrictions`);
 }
 for(const path of ['/my-properties','/club','/referrals','/withdrawals']){mode='loading';await page.goto(base+path);await page.locator('.loading-dot').first().waitFor();await settled();mode='error';await page.reload();await page.getByText('Fixture unavailable').first().waitFor();mode='normal';for(let remaining=await page.getByRole('button',{name:'Try again'}).count();remaining>0;remaining--)await page.getByRole('button',{name:'Try again'}).first().click();await settled();if(path!='/club'){mode='empty';await page.reload();await settled();assert.ok(await page.locator('.state h3').count());}mode='normal';}
 assert.deepEqual(errors,[]);console.log('PASS loading/error/retry/empty states, no unexpected writes or browser errors');
} finally {await browser.close();}

