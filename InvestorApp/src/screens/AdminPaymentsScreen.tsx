import React, {useCallback, useRef, useState} from 'react';
import {ScrollView, Text, TextInput, View, Alert} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import api from '../api';
import {WalletPayment, paymentMethods, paymentStatus, terminal} from '../payments';
import BlueButton from '../components/BlueButton';
import AdminProtectedScreen from '../components/AdminProtectedScreen';
import PaymentEvidence from '../components/PaymentEvidence';

type Row={payment:WalletPayment;userId:string;userName?:string};
export default function AdminPaymentsScreen(){
 const navigation=useNavigation<any>();
 const [rows,setRows]=useState<Row[]>([]),[pending,setPending]=useState(0),[method,setMethod]=useState(''),[status,setStatus]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState<string|null>(null),[reason,setReason]=useState('');
 const lock=useRef(false),generation=useRef(0);
 const load=useCallback(async()=>{const version=++generation.current;
  const [queue,summary]=await Promise.all([api.get(`/payments/admin/queue?method=${method}&status=${status}`),api.get('/payments/admin/summary')]);
  if(version===generation.current){setRows(queue.data);setPending(summary.data.pending);}
 },[method,status]);
 useFocusEffect(useCallback(()=>{setRows([]);void load().catch(()=>setError('Unable to load payment queue.'));return()=>{generation.current++;};},[load]));
 async function review(id:string,action:'confirm'|'reject'){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await api.post(`/payments/admin/${id}/review`,{action,reason:reason.trim()});await load();setReason('');}
  catch(e:any){setError(e.response?.data?.message??'Review failed. Refresh before retrying.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <AdminProtectedScreen><ScrollView contentContainerStyle={{padding:20,gap:14}}>
  <Text style={{fontSize:24}}>Платежи и заявки · {pending} pending</Text>
  <Text>Финансы · TEST operations only. Uploading evidence does not confirm receipt of funds.</Text>
  <BlueButton title="Финансы → Withdrawals" onPress={()=>navigation.navigate('AdminWithdrawals')}/>
  <Picker accessibilityLabel="Filter payment method" enabled={!busy} selectedValue={method} onValueChange={setMethod}><Picker.Item label="All methods" value=""/>{Object.entries(paymentMethods).map(([v,l])=><Picker.Item key={v} label={l} value={v}/>)}</Picker>
  <Picker accessibilityLabel="Filter payment status" enabled={!busy} selectedValue={status} onValueChange={setStatus}><Picker.Item label="All statuses" value=""/>{Object.entries(paymentStatus).map(([v,l])=><Picker.Item key={v} label={l} value={v}/>)}</Picker>
  <BlueButton title="Refresh queue" disabled={busy} onPress={()=>void load().catch(()=>setError('Queue unavailable.'))}/>
  {!!error&&<Text accessibilityRole="alert">{error}</Text>}
  {!rows.length&&<Text>No requests in this filter (newest 100 shown).</Text>}
  {rows.map(({payment:p,userId,userName})=><View key={p.id} style={{borderWidth:1,borderColor:'#ccc',padding:12,gap:10}}>
   <Text>{userName||userId}{'\n'}{paymentMethods[p.method]} · {paymentStatus[p.status]??p.status}{p.testMode?' · TEST':''}{'\n'}{p.amount.toFixed(2)} {p.chargeCurrency} → {p.walletAmount.toFixed(2)} {p.walletCurrency}{'\n'}{new Date(p.createdAt).toLocaleString()}</Text>
   <BlueButton title={selected===p.id?'Hide details':'Details'} disabled={busy} onPress={()=>{setSelected(selected===p.id?null:p.id);setReason('');}}/>
   {selected===p.id&&<><Text>Request {p.id}{'\n'}Owner {userId}{'\n'}Fee {p.feeAmount} · Rate {p.exchangeRate}{'\n'}{p.rejectionReason}</Text>
    {p.method!=='yookassa'&&<PaymentEvidence id={p.id} admin open={p.testMode&&!terminal(p)}/>}
    {p.testMode&&p.method!=='yookassa'&&!terminal(p)&&<>
     <TextInput accessibilityLabel="Rejection reason" placeholder="Rejection reason (required)" maxLength={240} value={reason} onChangeText={setReason}/>
     <BlueButton title="Reject with reason" disabled={busy||!reason.trim()} onPress={()=>void review(p.id,'reject')}/>
     {p.method==='bank_transfer'&&<BlueButton title="Approve and credit TEST wallet" disabled={busy} onPress={()=>Alert.alert('TEST bank request',`Credit ${p.walletAmount} ${p.walletCurrency} once?`,[{text:'Cancel'},{text:'Approve TEST',onPress:()=>void review(p.id,'confirm')}])}/>}
    </>}
   </>}
  </View>)}
 </ScrollView></AdminProtectedScreen>;
}
