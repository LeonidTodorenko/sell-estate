import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { loadSession } from './sessionStorage';
import { parseJwt } from './auth';
import { createPurchaseIntents, jwtOwner } from './purchaseIntentCore';
// UUID is an operation identifier, never an authentication secret.
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n=Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16); }); }
const intents = createPurchaseIntents(AsyncStorage, uuid);
async function owner() {
  const session = await loadSession();
  const id = jwtOwner(parseJwt(session?.accessToken));
  if (!session || session.isDemo || String(session.user?.id??session.user?.userId).toLowerCase() !== id) throw new Error('The account does not match its JWT. Sign in again.');
  return id;
}
export async function savedInvestment() { return intents.read(await owner()); }
export async function purchaseInvestment(payload: {propertyId:string;requestedShares:number}, secret:string) {
  const id=await owner();
  return intents.submit(id,payload,secret,async intent=>{
    if(await owner()!==id)throw new Error('The active account changed.');
    const response=await api.post('/investments/apply',{...intent.payload,pinOrPassword:secret},{
      headers:{'Idempotency-Key':intent.id}, investmentOwner:id, silentLoading:true, silentError:true,
    } as any);
    if(response.data?.message!=='Application submitted')throw new Error('Unexpected purchase response. Retry the saved purchase.');
    return response;
  });
}
