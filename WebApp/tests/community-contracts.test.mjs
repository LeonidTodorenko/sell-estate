import test from 'node:test';
import assert from 'node:assert/strict';
import { communityPaths, mapLink, fee, messagePayload, invitePayload } from '../src/community-contracts.ts';
test('coordinates are finite numeric values in range, including zero',()=>{
 assert.match(mapLink(0,0),/mlat=0&mlon=0/);
 for(const [a,b] of [[null,1],['1',2],[91,2],[1,-181],[NaN,0],[0,Infinity]])assert.equal(mapLink(a,b),null);
});
test('backend fee fractions retain zero and do not invent missing values',()=>{
 assert.equal(fee(0),'0%');assert.equal(fee(.125),'12.5%');assert.equal(fee(undefined),'Unavailable');assert.equal(fee(NaN),'Unavailable');
});
test('identity path segments are encoded',()=>assert.equal(communityPaths('a/b').properties,'/properties/my-properties/a%2Fb'));
test('community payloads trim input and block demo writes',()=>{
 assert.deepEqual(messagePayload(false,'admin',' hello '),{recipientId:'admin',content:'hello'});
 assert.throws(()=>messagePayload(true,'admin','hello'));assert.throws(()=>messagePayload(false,'','hello'));assert.throws(()=>messagePayload(false,'admin',' '));
 assert.deepEqual(invitePayload(false,true,' friend@example.com '),{email:'friend@example.com'});
 assert.throws(()=>invitePayload(true,true,'friend@example.com'));assert.throws(()=>invitePayload(false,false,'friend@example.com'));assert.throws(()=>invitePayload(false,true,'bad'));
});
