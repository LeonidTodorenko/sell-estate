import test from 'node:test';
import assert from 'node:assert/strict';
import {demoTopUpContract,auditedWrites} from '../src/financial-contracts.ts';
const demo={user:{id:'demo-1'},isDemo:true,demoCode:'D1'};
test('only audited demo top-up is enabled; PIN is inline for disabled purchase and market contracts',()=>{
 assert.deepEqual(Object.entries(auditedWrites).filter(([,v])=>v.enabled).map(([k])=>k),['demoTopup']);
 for(const key of ['purchase','buy','bid','cancel','extend','sell','buyback'])assert.equal(auditedWrites[key].pin,'pinOrPassword');
 assert.equal(auditedWrites.accept.endpoint,null);assert.equal(auditedWrites.price.endpoint,null);
});
test('demo top-up exact body excludes identity, PIN, cards and fees',()=>{
 assert.deepEqual(demoTopUpContract(demo,demo,12.34),{path:'/demo/wallet/topup',body:{amount:12.34}});
 for(const n of [0,-1,NaN,Infinity])assert.throws(()=>demoTopUpContract(demo,demo,n));
 assert.equal(demoTopUpContract(demo,demo,100001).body.amount,100001);
});
test('normal, missing, changed identity, mode and demo code fail closed',()=>{
 for(const current of [null,{...demo,isDemo:false},{...demo,user:{id:'other'}},{...demo,demoCode:'D2'}])assert.throws(()=>demoTopUpContract(demo,current,1));
 assert.throws(()=>demoTopUpContract({...demo,isDemo:false},demo,1));
});
