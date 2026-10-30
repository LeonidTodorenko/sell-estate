import React, {useEffect, useRef, useState} from 'react';
import {Picker} from '@react-native-picker/picker';
import {AppState, Linking, ScrollView, Text, TextInput} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useQueryClient} from '@tanstack/react-query';
import api from '../api';
import BlueButton from '../components/BlueButton';
import {loadSession} from '../services/sessionStorage';

import {paymentMethods,paymentStatus,safeCheckout,terminal,type PaymentAttempt as Attempt,type WalletPayment as Payment,type PaymentConfig,type PaymentMethod} from '../payments';
const path='/payments';
// An identifier only: never used as a credential or authorization token.
const requestId=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16);});

export default function AddFunds(){
 const [storageKey,setStorageKey]=useState(''),[attempt,setAttempt]=useState<Attempt|null>(null);
 const [payment,setPayment]=useState<Payment|null>(null),[amount,setAmount]=useState('100');
 const [config,setConfig]=useState<PaymentConfig|null>(null),[history,setHistory]=useState<Payment[]>([]),[method,setMethod]=useState<PaymentMethod>('yookassa'),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);const query=useQueryClient();
 useEffect(()=>{let active=true;(async()=>{
  const session=await loadSession();const id=session?.user?.id??session?.user?.userId;
  if(!id||session?.isDemo)throw new Error('An authenticated account is required.');
  const key=`ownersclub.payment.${id}`;
  const saved=await AsyncStorage.getItem(key);const config=(await api.get(`${path}/config`)).data;
  if(active){setStorageKey(key);setAttempt(saved?JSON.parse(saved):null);setConfig(config);setHistory((await api.get(path)).data);setEnabled(config.enabled);}
 })().catch(()=>{if(active)setError('Payments are unavailable.');});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!attempt?.id||payment&&terminal(payment))return;
  let active=true;const id=attempt.id;
  const refresh=async()=>{if(!active||AppState.currentState!=='active'||lock.current)return;lock.current=true;
   try{const p=(await api.get(`${path}/${id}`,{silentLoading:true,silentError:true} as any)).data;
    if(active){setPayment(p);setError('');if(terminal(p)){await query.invalidateQueries({queryKey:['home']});setHistory((await api.get(path)).data);}}
   }catch{if(active)setError('Verification unavailable. Your payment is saved.');}finally{lock.current=false;}};
  void refresh();const timer=setInterval(()=>void refresh(),5000);
  const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  return()=>{active=false;clearInterval(timer);sub.remove();};
 },[attempt?.id,payment?.credited,payment?.status,query]);
 async function create(){
  if(lock.current||!enabled||!storageKey)return;lock.current=true;setBusy(true);setError('');
  try{
   const a=attempt??{requestKey:requestId(),amount:Number(amount),method};
   await AsyncStorage.setItem(storageKey,JSON.stringify(a));setAttempt(a);
   const p:Payment=(await api.post(path,{requestKey:a.requestKey,amount:a.amount,method:a.method,client:'android'})).data;
   const saved={...a,id:p.id};await AsyncStorage.setItem(storageKey,JSON.stringify(saved));setAttempt(saved);setPayment(p);setHistory((await api.get(path)).data);
  }catch{setError('Result uncertain. Recover the same attempt; do not create another payment.');}
  finally{lock.current=false;setBusy(false);}
 }
 const valid=!!config&&/^\d+(\.\d{1,2})?$/.test(amount)&&Number(amount)>=config.minAmount&&Number(amount)<=config.maxAmount;
 const chosen=attempt?.method??method;const value=attempt?.amount??Number(amount);
 const fee=config?Math.round(value*config.feePercent)/100:0;
 const credit=config?Math.floor((value-fee)/config.exchangeRate*100)/100:0;
 return <ScrollView contentContainerStyle={{padding:20,gap:16}}>
  <Text style={{fontSize:22}}>Add Funds</Text>
  {config?.testMode&&<Text>Test mode · No real money is charged. Currency conversion uses a test configuration.</Text>}
  <Text>Amount ({config?.chargeCurrency})</Text>
  <TextInput accessibilityLabel="Payment amount" keyboardType="decimal-pad" value={String(attempt?.amount??amount)} editable={!attempt&&!busy} onChangeText={setAmount}/>
  <Text>Payment method</Text><Picker enabled={!attempt&&!busy} selectedValue={chosen} onValueChange={v=>setMethod(v as PaymentMethod)}>{Object.entries(paymentMethods).map(([v,l])=><Picker.Item key={v} value={v} label={l}/>)}</Picker>
  {config&&<Text>Charge {value.toFixed(2)} {config.chargeCurrency} · Fee {(payment?.feeAmount??fee).toFixed(2)} {config.chargeCurrency}{'\n'}Wallet credit {(payment?.walletAmount??credit).toFixed(2)} {config.walletCurrency} · Rate {payment?.exchangeRate??config.exchangeRate} {config.chargeCurrency} per {config.walletCurrency}</Text>}
  {chosen==='bank_transfer'&&<Text>{config?.bankInstructions||'Request bank details from the administrator before transferring funds.'}</Text>}
  {chosen!=='yookassa'&&<Text>Funds are credited only after independent verification of receipt by the administrator.</Text>}
  {!attempt?.id&&<BlueButton title={attempt?'Recover payment':chosen==='yookassa'?'Continue to payment':'Send request'} disabled={!enabled||busy||(!attempt&&(!valid||credit<=0))} onPress={()=>void create()}/>}
  {payment&&<Text accessibilityLiveRegion="polite">{paymentStatus[payment.status]??'Processing'}. {payment.credited?'Wallet credit confirmed.':'Wallet credit not confirmed.'}</Text>}
  {payment?.confirmationUrl&&!terminal(payment)&&safeCheckout(payment.confirmationUrl)&&<BlueButton title="Open secure payment page" onPress={()=>{void Linking.openURL(payment.confirmationUrl!).catch(()=>setError('Unable to open the system browser.'));}}/>}
  {attempt?.id&&!payment&&<Text>Recovering payment status…</Text>}
  {payment&&(terminal(payment)||payment.method!=='yookassa')&&<BlueButton title="New payment or request" onPress={()=>{void AsyncStorage.removeItem(storageKey).then(()=>{setAttempt(null);setPayment(null);}).catch(()=>setError('Unable to save. Retry later.'));}}/>}
  {!!error&&<Text accessibilityRole="alert">{error}</Text>}
  <Text style={{fontSize:20}}>Payment history</Text><BlueButton title="Refresh history" onPress={()=>{void api.get(path).then(r=>setHistory(r.data)).catch(()=>setError('History unavailable.'));}}/>
  {history.map(p=><React.Fragment key={p.id}><Text>{new Date(p.createdAt).toLocaleString()} · {paymentMethods[p.method]}{'\n'}{p.amount.toFixed(2)} {p.chargeCurrency} → {p.walletAmount.toFixed(2)} {p.walletCurrency} · {paymentStatus[p.status]??p.status}{p.testMode?' · Test':''}</Text><BlueButton title="View payment" disabled={!!attempt&&attempt.id!==p.id} onPress={()=>{const a={requestKey:p.requestKey,amount:p.amount,method:p.method,id:p.id};void AsyncStorage.setItem(storageKey,JSON.stringify(a)).then(()=>{setAttempt(a);setPayment(p);}).catch(()=>setError('Unable to save.'));}}/></React.Fragment>)}
 </ScrollView>;
}
