import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'C:/App/work/iteration8/tooling/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage(),errors=[],posts=[];
page.on('pageerror',e=>errors.push(e.message));
const app={id:'a1',userId:'owner',propertyId:'p1',propertyTitle:'OwnersClub QA property',requestedShares:4,requestedAmount:40,approvedShares:null,approvedAmount:null,status:'pending',stepNumber:1,createdAt:'2026-11-01T10:00:00Z'};
const history=[];
await context.route('**/api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const send=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 if(req.method()==='POST'){
  assert.equal(path,'/api/investment-workflow/applications/a1/decision');const body=req.postDataJSON();posts.push(body);
  assert.equal(body.action,'accept');assert.equal(body.approvedShares,2);assert.equal(body.expectedStep,1);assert.match(body.operationId,/^[0-9a-f-]{36}$/);assert.equal(body.reason,'Partial allocation reviewed');
  app.status='partial';app.approvedShares=2;app.approvedAmount=20;
  history.push({timestamp:'2026-11-10T08:00:00Z',details:JSON.stringify({applicationId:'a1',Action:'accept',ExpectedStep:1,ApprovedShares:2,Reason:body.reason})});
  return send({message:'Decision committed'});
 }
 if(path==='/api/properties')return send([{id:'p1',title:app.propertyTitle,price:100,totalShares:10,availableShares:5}]);
 if(path==='/api/applications/property/p1'||path==='/api/applications/user/owner')return send([app]);
 if(path==='/api/investment-workflow/applications/a1/history')return send({createdAt:app.createdAt,history});
 if(path==='/api/investment-workflow/properties/p1')return send({canApply:true,currentStep:1,automaticProcessingEnabled:true,mode:'reservation',pricePerShare:10,availableShares:5,terms:'Full share price is debited once. Percentages describe the property schedule.',stages:[{id:'s1',stepNumber:1,percentage:25,milestone:'Initial funding',eventDate:'2026-11-01T00:00:00Z',dueDate:'2026-12-01T00:00:00Z',total:10,paid:0,outstanding:10,available:true}]});
 if(path==='/api/properties/p1/payment-plans')return send([{id:'s1',milestone:'Initial funding',installmentCode:'QA-1',eventDate:'2026-11-01T00:00:00Z',dueDate:'2026-12-01T00:00:00Z',percentage:25,amountDue:10,vat:0,total:10,paid:0,outstanding:10}]);
 if(path.includes('unread-count'))return send({count:0});
 return send([]);
});
const auth={accessToken:'h.'+Buffer.from(JSON.stringify({sub:'owner',role:'admin',exp:9999999999})).toString('base64url')+'.s',refreshToken:'r',user:{id:'owner',role:'admin'},isDemo:false};
try{
 await page.goto('http://127.0.0.1:4178');await page.evaluate(a=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(a)),auth);
 await page.goto('http://127.0.0.1:4178/admin/applications?property=p1');
 await page.getByText('Details and decision',{exact:true}).click();
 await page.getByLabel('Approved shares',{exact:true}).fill('2');await page.getByLabel('Reason',{exact:true}).fill('Partial allocation reviewed');
 await page.getByLabel('Stage',{exact:true}).fill('2');await page.getByText('No matching applications',{exact:true}).waitFor();
 await page.getByLabel('Stage',{exact:true}).fill('1');await page.getByText('Details and decision',{exact:true}).click();
 // Re-enter after filtering remounts the decision form.
 await page.getByLabel('Approved shares',{exact:true}).fill('2');await page.getByLabel('Reason',{exact:true}).fill('Partial allocation reviewed');
 await page.screenshot({path:'C:/App/work/release3041/admin-review.png',fullPage:true});
 page.once('dialog',async d=>{assert.match(d.message(),/refund.*20/i);await d.accept();});
 await page.getByRole('button',{name:'Review decision',exact:true}).click();
 await page.locator('td[data-label="Status"]').filter({hasText:'partial'}).waitFor();assert.equal(posts.length,1);
 await page.goto('http://127.0.0.1:4178/applications');await page.getByRole('button',{name:'View decision history'}).click();await page.getByText(/Partial allocation reviewed/).waitFor();
 await page.screenshot({path:'C:/App/work/release3041/investor-history.png',fullPage:true});
 await page.goto('http://127.0.0.1:4178/properties/p1/payment-plans');await page.getByText('Stage 1: Initial funding · 25%',{exact:true}).waitFor();await page.getByText(/Automatic processing at the stage due date is enabled/).waitFor();await page.getByRole('cell',{name:'QA-1',exact:true}).waitFor();assert.equal(await page.getByRole('alert').count(),0);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'C:/App/work/release3041/stages-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS 304 UI: stage filter, partial-decision review/refund, one POST, investor status/history, stage terms/percentages/dates and mobile layout (mock API; financial effects verified separately against PostgreSQL).');
}finally{await browser.close();}
