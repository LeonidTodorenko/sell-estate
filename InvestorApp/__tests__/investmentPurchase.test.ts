import AsyncStorage from '@react-native-async-storage/async-storage';
import api,{setAccessToken} from '../src/api';
import {loadSession} from '../src/services/sessionStorage';
import {purchaseInvestment,savedInvestment} from '../src/services/investmentPurchase';
jest.mock('../src/services/sessionStorage',()=>({loadSession:jest.fn(),saveSession:jest.fn(),clearSession:jest.fn()}));
jest.mock('../src/contexts/LoadingContext',()=>({showGlobalLoading:jest.fn(),hideGlobalLoading:jest.fn()}));
jest.mock('../src/navigation/navigationRef',()=>({resetToLogin:jest.fn()}));
jest.mock('../src/utils/apiError',()=>({handleApiError:jest.fn()}));
const token=(id:string)=>'h.'+require('buffer').Buffer.from(JSON.stringify({sub:id})).toString('base64url')+'.s';
const payload={propertyId:'p1',requestedShares:2};
let sent:any[]=[];
beforeEach(async()=>{jest.useRealTimers();await AsyncStorage.clear();sent=[];setAccessToken(token('a'));(loadSession as jest.Mock).mockResolvedValue({accessToken:token('a'),user:{id:'a'}});api.defaults.adapter=async config=>{sent.push(config);return {data:{message:'Application submitted'},status:200,statusText:'OK',headers:{},config};};});
test('real axios dispatch attaches JWT and saved key; lost response retries identical payload',async()=>{
 api.defaults.adapter=async config=>{sent.push(config);throw new Error('response lost');};
 await expect(purchaseInvestment(payload,'1234')).rejects.toThrow('response lost');const first=await savedInvestment();
 expect(first).not.toBeNull();
 api.defaults.adapter=async config=>{sent.push(config);return {data:{message:'Application submitted'},status:200,statusText:'OK',headers:{},config};};
 await purchaseInvestment(payload,'1234');
 expect(sent).toHaveLength(2);expect(sent[0].data).toBe(sent[1].data);expect(sent[1].headers.get('Idempotency-Key')).toBe(first!.id);expect(sent[1].headers.get('Authorization')).toBe('Bearer '+token('a'));expect(await savedInvestment()).toBeNull();
});
test('legacy/cached identity differing from JWT cannot submit',async()=>{
 (loadSession as jest.Mock).mockResolvedValue({accessToken:token('b'),user:{id:'a'}});
 await expect(purchaseInvestment(payload,'1234')).rejects.toThrow('JWT');expect(sent).toHaveLength(0);
});
test('request interceptor rejects a switched in-memory JWT before network dispatch',async()=>{
 setAccessToken(token('b'));
 await expect(purchaseInvestment(payload,'1234')).rejects.toThrow('JWT account changed');expect(sent).toHaveLength(0);expect(await savedInvestment()).not.toBeNull();
});
test('different payload cannot send when a durable investment is unresolved',async()=>{
 api.defaults.adapter=async config=>{sent.push(config);throw new Error('offline');};
 await expect(purchaseInvestment(payload,'1234')).rejects.toThrow();
 await expect(purchaseInvestment({...payload,requestedShares:3},'1234')).rejects.toThrow('unresolved');expect(sent).toHaveLength(1);
});
