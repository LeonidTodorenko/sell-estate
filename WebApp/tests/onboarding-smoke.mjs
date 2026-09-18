import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:4175';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const page=await context.newPage();
const errors=[],requests=[];let mode='normal',captchaCount=0;
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();
 assert.equal(u.origin,'https://sell-estate.onrender.com');const path=u.pathname.slice(4);requests.push({path,method:r.method(),body:r.postData(),auth:r.headers().authorization});
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(path==='/captcha/generate'){captchaCount++;return send({id:'11111111-1111-1111-1111-111111111111',expression:'3 + 5'});}
 if(path.startsWith('/users/')&&['/users/register','/users/forgot-password','/users/reset-password','/users/confirm-email'].includes(path)){assert.equal(r.headers().authorization,undefined);return send({message:mode==='error'?'Fixture rejected':'Success'},mode==='error'?400:200);}
 assert.equal(r.method(),'GET');
 if(path.endsWith('/payment-plans')){if(mode==='loading')await new Promise(r=>setTimeout(r,500));if(mode==='error')return send({message:'Fixture rejected'},500);return send(mode==='empty'?[]:[{id:'plan',milestone:'Booking',eventDate:null,dueDate:'2027-01-01',installmentCode:'A1',percentage:10,amountDue:100,vat:5,total:105,paid:50,outstanding:55}]);}
 if(path.includes('unread'))return send({count:0});
 return send([]);
});
const settled=()=>page.waitForLoadState('networkidle');
const fit=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal page overflow');
try{
 for(const width of [360,390,760,1024,1440]){await page.setViewportSize({width,height:900});for(const path of ['/','/login','/login?demo=1','/register','/forgot-password','/reset-password','/reset-password?token=test','/newpassword.html?token=test','/verify-email','/users/confirm-email?token=test']){await page.goto(base+path);await settled();await fit();assert.equal(await page.getByText('Page not found',{exact:true}).count(),0);}}
 await page.goto(base+'/register');await settled();for(const [name,value] of Object.entries({firstName:'Ada',lastName:'Lovelace',email:'ada@example.com',password:'password123',repeatPassword:'password123',secretWord:'secret',pinCode:'0123',referralCode:'ref',captchaAnswer:'8'}))await page.locator(`[name="${name}"]`).fill(value);await page.getByRole('checkbox').check();
 mode='error';const previous=captchaCount;await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByText('Fixture rejected').waitFor();await settled();assert.ok(captchaCount>previous);assert.equal(await page.locator('[name="captchaAnswer"]').inputValue(),'');
 mode='normal';await page.locator('[name="captchaAnswer"]').fill('8');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL('**/verify-email');assert.equal(JSON.parse(requests.find(r=>r.path==='/users/register').body).pinCode,'0123');
 await page.goto(base+'/forgot-password');await page.getByLabel('Email',{exact:true}).fill('ada@example.com');await page.getByRole('button',{name:'Send reset link'}).click();await page.getByText('Check your email',{exact:true}).waitFor();assert.equal(requests.find(r=>r.path==='/users/forgot-password').body,'"ada@example.com"');
 await page.goto(base+'/newpassword.html?token=opaque%2Btoken');await page.getByLabel('New password',{exact:true}).fill('password123');await page.getByLabel('Confirm new password',{exact:true}).fill('password123');mode='error';await page.getByRole('button',{name:'Reset password',exact:true}).click();await page.getByText('Fixture rejected').waitFor();mode='normal';await page.getByRole('button',{name:'Reset password',exact:true}).click();await page.getByText('Password updated',{exact:true}).waitFor();assert.equal(new URL(page.url()).search,'');assert.deepEqual(JSON.parse(requests.find(r=>r.path==='/users/reset-password').body),{token:'opaque+token',newPassword:'password123'});
 await page.goto(base+'/users/confirm-email?token=opaque');const before=requests.filter(r=>r.path==='/users/confirm-email').length;await settled();assert.equal(requests.filter(r=>r.path==='/users/confirm-email').length,before);await page.getByRole('button',{name:'Confirm email',exact:true}).click();await page.getByText('Email confirmed. You can now log in.').waitFor();
 for(const demo of [false,true]){const session={accessToken:`header.${Buffer.from(JSON.stringify({sub:'owner',isDemo:String(demo),exp:9999999999})).toString('base64url')}.test`,refreshToken:demo?null:'refresh',user:{id:'owner'},isDemo:demo};await page.evaluate(s=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(s)),session);
 for(const width of [360,390,760,1024,1440]){await page.setViewportSize({width,height:900});await page.goto(base+'/properties/property/payment-plans');await page.getByText('Booking',{exact:true}).waitFor();await fit();assert.equal(await page.locator('tbody td').count(),10);if(width<761){await page.getByRole('button',{name:'Menu'}).click();assert.equal(await page.getByRole('button',{name:'Menu'}).getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Menu'}).getAttribute('aria-expanded'),'false');}}
 for(const state of ['loading','error','empty']){mode=state;await page.reload();if(state==='loading')await page.locator('.loading-dot').first().waitFor();await settled();if(state==='error'){await page.getByText('Fixture rejected').waitFor();mode='normal';await page.getByRole('button',{name:'Try again'}).click();await page.getByText('Booking',{exact:true}).waitFor();}if(state==='empty')await page.getByText('No payment plan available').waitFor();}mode='normal';}
 await page.evaluate(()=>localStorage.clear());await page.goto(base+'/properties/property/payment-plans');await page.waitForURL('**/login');assert.deepEqual(errors,[]);console.log('PASS onboarding: public routes and normal/demo Payment Plan at five widths; registration/recovery/verification payloads, errors, CAPTCHA refresh, missing token, payment loading/error/retry/empty, burger menu and auth gate; all API requests mocked.');
}finally{await browser.close();}
