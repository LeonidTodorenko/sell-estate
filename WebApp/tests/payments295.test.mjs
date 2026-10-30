import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCheckout,terminal} from '../src/payment-contracts.ts';
test('checkout accepts PSP HTTPS hosts and rejects lookalikes, credentials and custom schemes',()=>{
 for(const url of ['https://yookassa.ru/pay','https://checkout.yoomoney.ru/pay'])assert.equal(safeCheckout(url),true);
 for(const url of ['http://yookassa.ru/pay','javascript:alert(1)','https://yookassa.ru.attacker.invalid/','https://yookassa.ru@attacker.invalid/','https://attacker.invalid/yookassa.ru'])assert.equal(safeCheckout(url),false);
});
test('pending return navigation is not a successful payment',()=>{
 assert.equal(terminal({status:'pending',credited:false}),false);
 assert.equal(terminal({status:'requested',credited:false}),false);
 assert.equal(terminal({status:'succeeded',credited:true}),true);
 assert.equal(terminal({status:'canceled',credited:false}),true);
});
