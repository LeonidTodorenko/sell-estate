beforeEach(()=>jest.useRealTimers());
import assert from 'assert';
import {createPurchaseIntents,jwtOwner} from '../src/services/purchaseIntentCore';

const payload={propertyId:'property-1',requestedShares:2};
const id='11111111-1111-4111-8111-111111111111';
function fixture(){const data=new Map();let counter=0;const store={getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);},removeItem:async k=>{data.delete(k);}};const uuid=()=>id.slice(0,-1)+(++counter).toString(16);return {data,store,make:()=>createPurchaseIntents(store,uuid)};}
const rejected=status=>Object.assign(new Error('rejected'),{status});
test('duplicate taps send one POST while the first is pending',async()=>{
 const f=fixture(),c=f.make();let release;let calls=0;const first=c.submit('a',payload,'pin',async()=>{calls++;await new Promise(r=>{release=r;});return 'ok';});
 await new Promise(r=>setTimeout(r,5));
 await assert.rejects(c.submit('a',payload,'pin',async()=>{calls++;}));release();await first;assert.equal(calls,1);assert.equal(await c.read('a'),null);
});
test('response lost, network retry and reload reuse exactly the same UUID and payload',async()=>{
 const f=fixture(),c=f.make();let original;
 await assert.rejects(c.submit('a',payload,'pin',async i=>{original=i;throw new Error('response lost');}));
 const reboot=f.make();await reboot.submit('a',payload,'pin',async i=>{assert.equal(i.id,original.id);assert.deepEqual(i.payload,payload);return 'accepted';});assert.equal(await reboot.read('a'),null);
});
test('different shares, property or credential cannot reuse UUID or create a new intent',async()=>{
 const f=fixture(),c=f.make();await assert.rejects(c.submit('a',payload,'pin',async()=>{throw rejected(503);}));let calls=0;
 for(const [p,s] of [[{...payload,requestedShares:3},'pin'],[{...payload,propertyId:'other'},'pin'],[payload,'new pin']])await assert.rejects(c.submit('a',p,s,async()=>{calls++;}));assert.equal(calls,0);assert.ok(await c.read('a'));
});
test('invalid input creates no persisted intent and sends nothing',async()=>{
 const f=fixture(),c=f.make();let calls=0;
 for(const n of [0,-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])await assert.rejects(c.submit('a',{...payload,requestedShares:n},'pin',async()=>{calls++;}));
 await assert.rejects(c.submit('a',payload,' ',async()=>{calls++;}));assert.equal(calls,0);assert.equal(f.data.size,0);
});
test('initial definitive rejection clears intent; later 400 after uncertainty retains it',async()=>{
 const f=fixture(),c=f.make();await assert.rejects(c.submit('a',payload,'pin',async()=>{throw rejected(400);}));assert.equal(await c.read('a'),null);
 await assert.rejects(c.submit('a',payload,'pin',async()=>{throw rejected(0);}));const before=await c.read('a');
 await assert.rejects(c.submit('a',payload,'pin',async()=>{throw rejected(400);}));assert.equal((await c.read('a')).id,before.id);
});
test('409 is retained and blocks further sends, including after restart',async()=>{
 const f=fixture(),c=f.make();await assert.rejects(c.submit('a',payload,'pin',async()=>{throw rejected(409);}),/409/);
 assert.equal((await c.read('a')).conflict,true);let sent=false;
 await assert.rejects(f.make().submit('a',payload,'pin',async()=>{sent=true;}),/409/);assert.equal(sent,false);
});
test('JWT owner is authoritative; demo and missing identity fail closed; users have separate intents',async()=>{
 assert.equal(jwtOwner({sub:'USER-A'}),'user-a');assert.equal(jwtOwner({'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier':'USER-B',sub:'bad'}),'user-b');
 for(const claims of [null,{}, {sub:'a',isDemo:true},{sub:'a',isDemo:'true'}])assert.throws(()=>jwtOwner(claims));
 const f=fixture(),c=f.make();await assert.rejects(c.submit('a',payload,'pin',async()=>{throw rejected(0);}));assert.equal(await c.read('b'),null);
 await c.submit('b',payload,'pin',async()=> 'ok');assert.ok(await c.read('a'));
});
test('storage failure before dispatch sends nothing; malformed state is never discarded',async()=>{
 let sent=false;const bad=createPurchaseIntents({getItem:async()=>null,setItem:async()=>{throw new Error('full');},removeItem:async()=>{}},()=>id);
 await assert.rejects(bad.submit('a',payload,'pin',async()=>{sent=true;}));assert.equal(sent,false);
 const f=fixture();f.data.set('ownersclub.investment.apply.v1:a','broken');await assert.rejects(f.make().submit('a',payload,'pin',async()=>{sent=true;}));assert.equal(sent,false);assert.equal(f.data.size,1);
});
test('crash after durable pre-send marker resumes as uncertain; PIN is never persisted',async()=>{
 const f=fixture(),c=f.make();await assert.rejects(c.submit('a',payload,'secret-code',async()=>{throw new Error('crash');}));
 const raw=[...f.data.values()][0];assert.equal(raw.includes('secret-code'),false);assert.equal(JSON.parse(raw).uncertain,true);
 await assert.rejects(f.make().submit('a',payload,'secret-code',async()=>{throw rejected(401);}));assert.ok(await c.read('a'));
});
test('success clears durable state and next explicit purchase gets a new key',async()=>{
 const f=fixture(),c=f.make();let first;
 await c.submit('a',payload,'pin',async i=>{first=i.id;return 'ok';});
 await c.submit('a',payload,'pin',async i=>{assert.notEqual(i.id,first);return 'ok';});assert.equal(f.data.size,0);
});
