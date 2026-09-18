import type { Session } from './types.ts';
export const financialPolicy = {
 purchase: 'Purchase is unavailable: account security checks need a backend update.',
 application: 'Application changes are unavailable: existing actions require an administrator.',
 buy: 'Buyout is unavailable: account security checks need a backend update.',
 bid: 'Bidding is unavailable: account security checks need a backend update.',
 cancel: 'Cancellation is unavailable: account security checks need a backend update.',
 extend: 'Extension is unavailable: account security checks need a backend update.',
 sell: 'Listing shares is unavailable: account security checks need a backend update.',
 accept: 'Accept Bid is unavailable: no active backend contract exists.',
 price: 'Change Price is unavailable: no active backend contract exists.',
 buyback: 'Platform buyback is unavailable: ownership checks need a backend update; demo has no isolated platform wallet.',
 withdraw: 'Withdrawals are unavailable: account security checks need a backend update.',
 topup: 'Real top-ups are unavailable: no payment gateway is connected.',
} as const;
export function demoTopUpContract(expected: Session, current: Session | null, amount: number) {
 if (!expected.isDemo || !current?.isDemo || current.user.id !== expected.user.id || current.demoCode !== expected.demoCode) throw new Error('The active demo account changed. Reload before continuing.');
 if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount.');
 return { path: '/demo/wallet/topup', body: { amount } };
}

// Audit metadata only; disabled mappings are never passed to the transport.
export const auditedWrites = {
 purchase: {endpoint:'/investments/apply',pin:'pinOrPassword',enabled:false},
 application: {endpoint:'/applications/submit',pin:null,enabled:false},
 buy: {endpoint:'/share-offers/{id}/buy',pin:'pinOrPassword',enabled:false},
 bid: {endpoint:'/share-offers/{id}/bid',pin:'pinOrPassword',enabled:false},
 cancel: {endpoint:'/share-offers/{id}/cancel',pin:'pinOrPassword',enabled:false},
 extend: {endpoint:'/share-offers/{id}/extend-to',pin:'pinOrPassword',enabled:false},
 sell: {endpoint:'/share-offers',pin:'pinOrPassword',enabled:false},
 accept: {endpoint:null,pin:null,enabled:false},
 price: {endpoint:null,pin:null,enabled:false},
 buyback: {endpoint:'/share-offers/sell-to-platform',pin:'pinOrPassword',enabled:false},
 withdraw: {endpoint:'/withdrawals/request',pin:null,enabled:false},
 topup: {endpoint:'/users/wallet/topup',pin:'pinOrPassword',enabled:false},
 demoTopup: {endpoint:'/demo/wallet/topup',pin:null,enabled:true},
} as const;
