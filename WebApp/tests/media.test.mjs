import test from 'node:test';
import assert from 'node:assert/strict';
import { imageUrl } from '../src/format.ts';
import { normalizeSession } from '../src/session.ts';
test('media formats match mobile data URIs and raw raster base64',()=>{
 assert.equal(imageUrl('data:image/webp;base64,UklGRabc'),'data:image/webp;base64,UklGRabc');
 assert.equal(imageUrl(' iVBORw0KGgo= '),'data:image/png;base64,iVBORw0KGgo=');
 assert.equal(imageUrl('/9j/abc='),'data:image/jpeg;base64,/9j/abc=');
 for(const raw of [null,'','javascript:alert(1)','data:image/svg+xml;base64,abc','<script>']) assert.equal(imageUrl(raw),undefined);
});
test('avatar DTO survives login and token refresh for investor and demo',()=>{
 for(const isDemo of [true,false]) {
 const raw={accessToken:'a.b.c',isDemo,user:{id:'owner',avatarBase64:'data:image/png;base64,abc'}};
 const session=normalizeSession(raw);
 assert.equal(session.user.avatarBase64,raw.user.avatarBase64);
 assert.equal(normalizeSession({accessToken:'d.e.f'},session).user.avatarBase64,raw.user.avatarBase64);
 }
});
