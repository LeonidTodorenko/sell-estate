export type PaymentMethod='yookassa'|'invoice'|'bank_transfer'|'assistance';
export type PaymentConfig={enabled:boolean;chargeCurrency:string;walletCurrency:string;exchangeRate:number;feePercent:number;minAmount:number;maxAmount:number;testMode:boolean;bankInstructions:string};
export type WalletPayment={id:string;requestKey:string;amount:number;chargeCurrency:string;walletAmount:number;walletCurrency:string;feeAmount:number;exchangeRate:number;method:PaymentMethod;status:string;credited:boolean;confirmationUrl?:string;testMode:boolean;createdAt:string};
export type PaymentAttempt={requestKey:string;amount:number;method:PaymentMethod;id?:string};
export const paymentMethods:Record<PaymentMethod,string>={yookassa:'Online payment · YooKassa',invoice:'Request invoice / payment link',bank_transfer:'Bank transfer',assistance:'Payment assistance'};
export const paymentStatus:Record<string,string>={creating:'Creating payment',pending:'Awaiting payment',waiting_for_capture:'Processing',succeeded:'Successful',canceled:'Canceled',requested:'Request received',processing:'Administrator is reviewing',rejected:'Request declined'};
export const terminal=(p:WalletPayment)=>p.credited||p.status==='canceled'||p.status==='rejected';
export const safeCheckout=(url:string)=>/^https:\/\/(?:[a-z0-9-]+\.)*(?:yookassa\.ru|yoomoney\.ru)(?:\/|$)/i.test(url);
