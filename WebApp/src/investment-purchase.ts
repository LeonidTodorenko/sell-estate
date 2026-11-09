import { createPurchaseIntents, jwtOwner } from './purchase-intent';
import { parseJwt } from './session';
import { getSession, investmentWrite } from './api';
import type { Session } from './types';
const intents = createPurchaseIntents({
  getItem: async k => localStorage.getItem(k),
  setItem: async (k,v) => { localStorage.setItem(k,v); },
  removeItem: async k => { localStorage.removeItem(k); },
}, () => crypto.randomUUID());
function owner(session: Session) {
  const claims = parseJwt(session.accessToken);
  const id = jwtOwner(claims, true);
  const demo = claims?.isDemo === true || claims?.isDemo === 'true';
  if (id !== session.user.id.toLowerCase() || demo !== !!session.isDemo) throw new Error('The account does not match its JWT. Sign in again.');
  return id;
}
export async function savedInvestment(session: Session) { return intents.read(owner(session)); }
export async function purchaseInvestment(session: Session, payload: {propertyId:string;requestedShares:number;paymentPlanId?:string;stepNumber?:number}, secret: string) {
  const id = owner(session);
  if (!navigator.locks) throw new Error('This browser cannot safely lock purchases. Use a supported secure browser.');
  return navigator.locks.request(`ownersclub.investment.apply:${id}`, {ifAvailable:true}, async lock => {
    if (!lock) throw new Error('An investment purchase is active in another tab.');
    return intents.submit(id, payload, secret, async intent => {
      const current = getSession();
      if (!current || owner(current) !== id) throw new Error('The active account changed. Sign in to the original account.');
      return investmentWrite(session, {...intent.payload, pinOrPassword:secret}, intent.id);
    });
  });
}
