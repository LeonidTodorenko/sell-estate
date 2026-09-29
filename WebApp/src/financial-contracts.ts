import type { Session } from './types.ts';
export const financialPolicy = {
 purchase: 'Applications use the current payment plan and account wallet.',
 application: 'Application changes are unavailable: existing actions require an administrator.',
 buy: 'Buy shares at the displayed buyout price.',
 bid: 'Bids are proposals, not completed purchases.',
 cancel: 'Cancellation may charge the current server fee.',
 extend: 'Choose a later expiration date.',
 sell: 'Listing reserves shares from available holdings.',
 accept: 'Accept Bid is unavailable: no active backend contract exists.',
 price: 'Change Price is unavailable: no active backend contract exists.',
 buyback: 'Platform buyback is unavailable: this web release does not offer platform buyback.',
 withdraw: 'Bank and card withdrawals are unavailable in this beta. No money is sent to a bank or card.',
 topup: 'Real top-ups are unavailable: no payment gateway is connected.',
} as const;
export function demoTopUpContract(expected: Session, current: Session | null, amount: number) {
 if (!expected.isDemo || !current?.isDemo || current.user.id !== expected.user.id || current.demoCode !== expected.demoCode) throw new Error('The active demo account changed. Reload before continuing.');
 if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount.');
 return { path: '/demo/wallet/topup', body: { amount } };
}

// Audited write availability. Unsupported actions remain unavailable.
export const auditedWrites = {
 purchase: {endpoint:'/investments/apply',pin:'pinOrPassword',enabled:true},
 application: {endpoint:'/applications/submit',pin:null,enabled:false},
 buy: {endpoint:'/share-offers/{id}/buy',pin:'pinOrPassword',enabled:true},
 bid: {endpoint:'/share-offers/{id}/bid',pin:'pinOrPassword',enabled:true},
 cancel: {endpoint:'/share-offers/{id}/cancel',pin:'pinOrPassword',enabled:true},
 extend: {endpoint:'/share-offers/{id}/extend-to',pin:'pinOrPassword',enabled:true},
 sell: {endpoint:'/share-offers',pin:'pinOrPassword',enabled:true},
 accept: {endpoint:null,pin:null,enabled:false},
 price: {endpoint:null,pin:null,enabled:false},
 buyback: {endpoint:'/share-offers/sell-to-platform',pin:'pinOrPassword',enabled:false},
 withdraw: {endpoint:'/withdrawals/request',pin:null,enabled:false},
 topup: {endpoint:'/users/wallet/topup',pin:'pinOrPassword',enabled:false},
 demoTopup: {endpoint:'/demo/wallet/topup',pin:null,enabled:true},
} as const;
