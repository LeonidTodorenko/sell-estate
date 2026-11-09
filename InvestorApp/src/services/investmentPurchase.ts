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
  const id = jwtOwner(parseJwt(session?.accessToken), true);
  if (!session || String(session.user?.id??session.user?.userId).toLowerCase() !== id) throw new Error('The account does not match its JWT. Sign in again.');
  const claims = parseJwt(session.accessToken);
  if ((claims?.isDemo === true || claims?.isDemo === 'true') !== !!session.isDemo) throw new Error('The account does not match its JWT. Sign in again.');
  return { id, demo: claims?.isDemo === true || claims?.isDemo === 'true' };
}
export async function savedInvestment() { return intents.read((await owner()).id); }
export async function purchaseInvestment(payload: {propertyId:string;requestedShares:number;paymentPlanId?:string;stepNumber?:number}, secret:string) {
  const {id,demo}=await owner();
  return intents.submit(id,payload,secret,async intent=>{
    const current=await owner();
    if(current.id!==id || current.demo!==demo)throw new Error('The active account changed.');
    const response=await api.post('/investments/apply',{...intent.payload,pinOrPassword:secret},{
      headers:{'Idempotency-Key':intent.id}, investmentOwner:id, investmentDemo:demo, silentLoading:true, silentError:true,
    } as any);
    if(response.data?.message!=='Application submitted')throw new Error('Unexpected purchase response. Retry the saved purchase.');
    return response;
  });
}
