import { AdminInvestmentIntents } from './admin-intents';
import {useEffect,useRef,useState} from 'react';
import {api,financialWrite} from './api';
import type {Session} from './types';
import {paymentMethods,paymentStatus,safeCheckout,terminal,type PaymentAttempt,type PaymentConfig,type PaymentMethod,type WalletPayment} from './payment-contracts';
export function AddFunds({session}:{session:Session}){
 const key=`ownersclub.payment.${session.user.id}`;
 const [config,setConfig]=useState<PaymentConfig|null>(null),[amount,setAmount]=useState('100'),[method,setMethod]=useState<PaymentMethod>('yookassa');
 const [attempt,setAttempt]=useState<PaymentAttempt|null>(()=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}});
 const [payment,setPayment]=useState<WalletPayment|null>(null),[history,setHistory]=useState<WalletPayment[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false);
 const loadHistory=()=>api<WalletPayment[]>('/payments').then(setHistory);
 useEffect(()=>{let active=true;Promise.all([api<PaymentConfig>('/payments/config'),api<WalletPayment[]>('/payments')]).then(([c,h])=>{if(active){setConfig(c);setHistory(h);}}).catch(()=>{if(active)setError('Payments are temporarily unavailable.');});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!attempt?.id||payment&&terminal(payment))return;let active=true;const id=attempt.id;
  const refresh=async()=>{if(!active||document.visibilityState!=='visible'||lock.current)return;lock.current=true;
   try{const p=await api<WalletPayment>(`/payments/${id}`);if(active){setPayment(p);setError('');if(terminal(p)){if(p.credited)window.dispatchEvent(new Event("financial-data-changed"));await loadHistory();}}}
   catch{if(active)setError('Status verification is unavailable. Your payment is saved; retry later.');}finally{lock.current=false;}};
  void refresh();const timer=window.setInterval(()=>void refresh(),5000);window.addEventListener('focus',refresh);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[attempt?.id,payment?.status,payment?.credited]);
 function save(a:PaymentAttempt){localStorage.setItem(key,JSON.stringify(a));setAttempt(a);}
 async function create(){if(lock.current||!config?.enabled)return;lock.current=true;setBusy(true);setError('');
  try{const a=attempt||{requestKey:crypto.randomUUID(),amount:Number(amount),method};save(a);
   const p=await financialWrite(session,'/payments',a) as WalletPayment;save({...a,id:p.id});setPayment(p);await loadHistory();
  }catch(e){setError(`${e instanceof Error?e.message:'Payment unavailable.'} Recover the same attempt after an uncertain result.`);}
  finally{lock.current=false;setBusy(false);}}
 const chosen=attempt?.method??method;const value=attempt?.amount??Number(amount);
 const fee=config?Math.round(value*config.feePercent)/100:0;const credit=config?Math.floor((value-fee)/config.exchangeRate*100)/100:0;
 const valid=config&&/^\d+(\.\d{1,2})?$/.test(amount)&&value>=config.minAmount&&value<=config.maxAmount&&credit>0;
 return <section className="panel account-form"><h2>Add Funds</h2>
 {config?.testMode&&<p className="demo-banner">Test mode · No real money is charged. The configured currency conversion is for testing.</p>}
 <label>Amount {config?.chargeCurrency}<input type="number" min={config?.minAmount} max={config?.maxAmount} step="0.01" value={attempt?.amount??amount} disabled={busy||!!attempt} onChange={e=>setAmount(e.target.value)}/></label>
 <label>Payment method<select value={chosen} disabled={busy||!!attempt} onChange={e=>setMethod(e.target.value as PaymentMethod)}>{Object.entries(paymentMethods).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 {config&&<p>Charge: {value.toFixed(2)} {config.chargeCurrency} · Fee: {(payment?.feeAmount??fee).toFixed(2)} {config.chargeCurrency}<br/>Wallet credit: {(payment?.walletAmount??credit).toFixed(2)} {config.walletCurrency} · Rate: {payment?.exchangeRate??config.exchangeRate} {config.chargeCurrency} per {config.walletCurrency}</p>}
 {chosen==='bank_transfer'&&config&&<p>{config?.testMode?'TEST/manual: do not send money. Admin approval credits the test wallet immediately.':config?.bankInstructions||'Request bank details from the administrator before transferring funds.'}</p>}
 {chosen!=='yookassa'&&config&&!(chosen==='bank_transfer'&&config?.testMode)&&<p>Your request will appear in the payment queue. Funds are credited only after the administrator independently verifies receipt.</p>}
 {!attempt?.id&&<button className="button" disabled={busy||!config?.enabled||(!attempt&&!valid)} onClick={()=>void create()}>{busy?'Processing…':attempt?'Recover payment':chosen==='yookassa'?'Continue to payment':'Send request'}</button>}
 {payment&&<><p role="status">{paymentStatus[payment.status]??'Processing'}. {payment.credited?'Wallet credit confirmed.':'Wallet credit not confirmed.'}</p>
 {payment.confirmationUrl&&safeCheckout(payment.confirmationUrl)&&!terminal(payment)&&<a className="button" href={payment.confirmationUrl} target="_blank" rel="noopener noreferrer">Open secure payment page</a>}
 {(terminal(payment)||payment.method!=='yookassa')&&<button onClick={()=>{localStorage.removeItem(key);setAttempt(null);setPayment(null);}}>New payment or request</button>}</>}
 {error&&<p role="alert">{error}</p>}<h3>Payment history</h3><button onClick={()=>void loadHistory().catch(()=>setError('History unavailable.'))}>Refresh history</button>
 {history.length?history.map(p=><article key={p.id}><p>{new Date(p.createdAt).toLocaleString()} · {paymentMethods[p.method]} · {p.amount.toFixed(2)} {p.chargeCurrency} → {p.walletAmount.toFixed(2)} {p.walletCurrency}<br/>{paymentStatus[p.status]??p.status}{p.testMode?' · TEST':''}{p.rejectionReason?' · Declined: '+p.rejectionReason:''}</p>
 <button disabled={!!attempt&&attempt.id!==p.id} onClick={()=>{save({requestKey:p.requestKey,amount:p.amount,method:p.method,id:p.id});setPayment(p);}}>View payment</button></article>):<p>No payments yet.</p>}
 </section>;
}
type PaymentQueueRow = { payment: WalletPayment; userId: string; reviewedBy?: string; settlementReference?: string };
type Review = {
 action: 'processing' | 'reject' | 'confirm';
 reference?: string;
 fundsIndependentlyVerified?: boolean;
 receivedAmount?: number;
 receivedCurrency?: string;
 paymentLink?: string | null;
 reason?: string;
};

export function AdminPayments({session}:{session:Session}) {
 const [rows,setRows]=useState<PaymentQueueRow[]>([]);
 const [error,setError]=useState(''), [busy,setBusy]=useState(false);
 const [method,setMethod]=useState(''), [status,setStatus]=useState('');
 const lock=useRef(false), generation=useRef(0);
 const load=async () => {
  const version=++generation.current;
  const query=new URLSearchParams({method,status});
  const data=await api<PaymentQueueRow[]>('/payments/admin/queue?'+query);
  if(version===generation.current) setRows(data);
 };
 useEffect(()=>{
  setRows([]);
  setError('');
  void load().catch(()=>setError('Payment queue unavailable.'));
  return ()=>{generation.current++;};
 },[method,status]);
 async function review(id:string,input:Review) {
  if(lock.current) return;
  lock.current=true;
  setBusy(true);
  setError('');
  try {
   await financialWrite(session,'/payments/admin/'+id+'/review',input);
  } catch(e) {
   setError(e instanceof Error?e.message:'Review failed.');
  } finally {
   try { await load(); }
   catch { setRows([]); setError('Payment queue unavailable. Refresh before reviewing again.'); }
   lock.current=false;
   setBusy(false);
  }
 }
 return <>
  <h1>Payments & requests</h1>
  <AdminInvestmentIntents session={session}/>
  <p>TEST/manual bank approvals credit the test wallet immediately. For other manual payments, use independent settlement records. Keep card details out of this queue.</p>
  <div className="filters">
   <label>Method<select disabled={busy} value={method} onChange={e=>setMethod(e.target.value)}>
    <option value="">All methods</option>{Object.entries(paymentMethods).map(([value,label])=><option key={value} value={value}>{label}</option>)}
   </select></label>
   <label>Status<select disabled={busy} value={status} onChange={e=>setStatus(e.target.value)}>
    <option value="">All statuses</option>{Object.entries(paymentStatus).map(([value,label])=><option key={value} value={value}>{label}</option>)}
   </select></label>
   <button disabled={busy} onClick={()=>void load().catch(()=>setError('Payment queue unavailable.'))}>Refresh</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  {rows.map(row=><ReviewRow key={row.payment.id} row={row} busy={busy} review={review}/>)}
 </>;
}

function ReviewRow({row,busy,review}:{row:PaymentQueueRow;busy:boolean;review:(id:string,input:Review)=>Promise<void>}) {
 const [reference,setReference]=useState(''), [verified,setVerified]=useState(false);
 const [received,setReceived]=useState(''), [currency,setCurrency]=useState(''), [link,setLink]=useState('');
 const [reason,setReason]=useState('');
 const p=row.payment;
 const testBank=p.method==='bank_transfer'&&p.testMode;
 return <section className="panel">
  <h2>{paymentMethods[p.method]}{testBank?' · TEST/manual':''}</h2>
  <p>Account {row.userId}<br/>Payment {p.id}<br/>{new Date(p.createdAt).toLocaleString()}<br/>
   {p.amount.toFixed(2)} {p.chargeCurrency} · Fee {p.feeAmount.toFixed(2)} · Credit {p.walletAmount.toFixed(2)} {p.walletCurrency}<br/>
   {paymentStatus[p.status]??p.status}{p.testMode?' · TEST':''}</p>
  {row.reviewedBy&&<p>Reviewed by {row.reviewedBy}</p>}
  {row.settlementReference&&<p>Settlement reference {row.settlementReference}</p>}
  {p.rejectionReason&&<p>Declined: {p.rejectionReason}</p>}
  {p.method!=='yookassa'&&!terminal(p)&&<>
   {!testBank&&<>
    <label>PSP-hosted payment link (optional)<input type="url" value={link} onChange={e=>setLink(e.target.value)}/></label>
    <label>Received amount<input type="number" step="0.01" value={received} onChange={e=>setReceived(e.target.value)}/></label>
    <label>Received currency<input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></label>
    <label>Statement reference<input value={reference} maxLength={80} onChange={e=>setReference(e.target.value)}/></label>
    <label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>I independently verified receipt of the exact amount and currency shown above.</label>
   </>}
   <label>Decline reason<input value={reason} maxLength={240} onChange={e=>setReason(e.target.value)}/></label>
   <div className="actions">
    {!testBank&&<button disabled={busy} onClick={()=>void review(p.id,{action:'processing',paymentLink:link||null})}>Start review</button>}
    <button disabled={busy||!reason.trim()} onClick={()=>void review(p.id,{action:'reject',reason:reason.trim()})}>Decline</button>
    {testBank
     ? <button disabled={busy} onClick={()=>void review(p.id,{action:'confirm'})}>Approve & credit TEST wallet</button>
     : <button disabled={busy||!verified||Number(received)!==p.amount||currency!==p.chargeCurrency||!/^[A-Za-z][A-Za-z0-9_-]{7,79}$/.test(reference)}
       onClick={()=>void review(p.id,{action:'confirm',reference,fundsIndependentlyVerified:verified,receivedAmount:Number(received),receivedCurrency:currency,paymentLink:link||null})}>
       Confirm receipt & credit wallet
      </button>}
   </div>
  </>}
 </section>;
}
