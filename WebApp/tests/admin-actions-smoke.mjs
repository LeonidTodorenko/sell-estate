import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4183';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();
const page=await context.newPage(); page.setDefaultTimeout(7000);
let user, docs, fail=0, stale=false, posts=[], errors=[];
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const reset=()=>{user={id:'user-1',fullName:'Jane Operator',email:'jane@example.com',userRole:0,userRoleText:'Investor',permissions:0,permissionsText:[],isBlocked:false,isEmailConfirmed:true,createdAt:'2026-09-01'};docs=[{id:'doc-1',userId:'user-1',type:'passport',status:'pending',base64File:image,uploadedAt:'2026-09-02'}];fail=0;stale=false;}; reset();
const auth=(role='admin',demo=false,id='admin-1')=>({accessToken:`h.${Buffer.from(JSON.stringify({sub:id,role,isDemo:String(demo),exp:9999999999})).toString('base64url')}.t`,refreshToken:'fixture',isDemo:demo,user:{id,role,email:'admin@example.com'}});
page.on('pageerror',err=>errors.push(err.message));
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 if(url.origin===base) return route.continue();
 assert.equal(url.origin,'https://sell-estate.onrender.com');
 assert.ok(req.headers().authorization?.startsWith('Bearer '));
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(req.method()==='POST'){
  posts.push({path,body:req.postDataJSON()});
  if(fail) return send({message:'Fixture failure'},fail);
  if(path.endsWith('/set-role')){user.userRole=req.postDataJSON().role;user.userRoleText=user.userRole===1?'Moderator':'Investor';}
  else if(path==='/api/users/user-1/block') user.isBlocked=!user.isBlocked;
  else if(path==='/api/users/user-1/unblock') user.isBlocked=false;
  else if(path==='/api/kyc/doc-1/approve') docs[0].status='approved';
  else throw Error('Unexpected write '+path);
  return send({message:'Saved'});
 }
 if(path==='/api/admin/users/user-1') return send({...user,...(stale?{isBlocked:!user.isBlocked}:{})});
 if(path==='/api/admin/users/admin-1') return send({...user,id:'admin-1',userRole:2});
 if(path==='/api/admin/users') return send([user]);
 if(path.startsWith('/api/kyc/user/')) return send(docs);
 if(path==='/api/kyc/pending') return send(docs.filter(d=>d.status==='pending'));
 if(path.startsWith('/api/users/')) return send({id:'admin-1'});
 throw Error('Unexpected request '+path);
});
async function session(value){await page.goto(base);await page.evaluate(v=>localStorage.setItem('ownersclub.web.session.v1',JSON.stringify(v)),value);}
async function profile(){await page.goto(base+'/admin/users/user-1');await page.getByRole('heading',{name:'Account management'}).waitFor();}
let accept=false;
page.on('dialog',async d=>{if(accept) await d.accept();else await d.dismiss();});
try{
 await session(auth());await profile();
 await page.getByRole('button',{name:'Block user',exact:true}).click();assert.equal(posts.length,0,'cancel does not send');
 accept=true;
 await page.getByLabel('New role').selectOption('1');await page.getByRole('button',{name:'Change role',exact:true}).click();
 await page.waitForResponse(r=>r.url().endsWith('/set-role') && r.request().method()==='POST');await page.getByRole('button',{name:'Reload profile'}).waitFor();assert.deepEqual(posts.at(-1),{path:'/api/admin/users/user-1/set-role',body:{role:1}});
 await page.getByRole('button',{name:'Block user',exact:true}).click();await page.getByRole('button',{name:'Unblock user',exact:true}).waitFor();
 await page.getByRole('button',{name:'Unblock user',exact:true}).click();await page.getByRole('button',{name:'Block user',exact:true}).waitFor();
 const before=posts.length;stale=true;await page.getByRole('button',{name:'Block user',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(posts.length,before,'stale state must not toggle');stale=false;
 for(const status of [403,409,500]){
  await profile();fail=status;const count=posts.length;await page.getByRole('button',{name:'Block user',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(posts.length,count+1);assert.equal(await page.getByRole('button',{name:'Block user',exact:true}).isDisabled(),true);fail=0;
 }
 await page.goto(base+'/admin/users/admin-1');await page.getByText('Self-service changes and changes to administrator accounts are unavailable here.').waitFor();assert.equal(await page.getByRole('button',{name:'Block user',exact:true}).count(),0);
 for(const width of [320,390,760,1024,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/admin/kyc');await page.getByRole('button',{name:'View document',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Approve KYC',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'View document',exact:true}).click();await page.getByRole('img',{name:'passport document for review'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
 }
 const count=posts.length;accept=false;await page.getByRole('button',{name:'Approve KYC',exact:true}).click();assert.equal(posts.length,count);accept=true;
 assert.equal(await page.getByRole('button',{name:'Reject KYC unavailable'}).isDisabled(),true);
 fail=500;await page.getByRole('button',{name:'Approve KYC',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(posts.length,count+1);assert.equal(await page.getByRole('button',{name:'Approve KYC',exact:true}).isDisabled(),true);fail=0;
 await page.reload();await page.getByRole('button',{name:'View document',exact:true}).click();await page.getByRole('button',{name:'Approve KYC',exact:true}).click();await page.getByText('No pending KYC documents',{exact:true}).waitFor();assert.equal(posts.at(-1).path,'/api/kyc/doc-1/approve');
 reset();docs[0].base64File='data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';await page.reload();await page.getByRole('button',{name:'View document',exact:true}).click();await page.getByText('Preview unavailable.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Approve KYC',exact:true}).isDisabled(),true);
 for(const value of [auth('investor'),auth('admin',true)]){
  await session(value);const count=posts.length;await page.goto(base+'/admin/kyc');await page.getByRole('heading',{name:'Admin access unavailable'}).waitFor();assert.equal(posts.length,count);
 }
 assert.deepEqual(errors,[]);console.log('PASS admin mutations: confirmation/cancel, exact payloads, role/block/unblock, stale state, self/admin protection, 403/409/500, no replay, KYC review/approve, unsupported reason, unsafe preview, access guards, five widths; all remote requests intercepted.');
} finally {await browser.close();}
