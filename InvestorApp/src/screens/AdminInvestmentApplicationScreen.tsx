import AdminProtectedScreen from '../components/AdminProtectedScreen';
import React, {useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,FlatList,Pressable,Alert,StyleSheet} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import api from '../api';
import theme from '../constants/theme';
import {DecisionHistory} from './InvestmentApplicationScreen';
type Application={id:string;userId:string;propertyId:string;requestedAmount:number;requestedShares:number;approvedAmount:number|null;approvedShares:number|null;stepNumber:number;status:string;createdAt:string};
const uuid=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3)|8).toString(16);});
function Decision({a,items,reload}:{a:Application;items:Application[];reload:()=>void}){
 const [shares,setShares]=useState(String(a.requestedShares)),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false);
 const lock=useRef(false);
 const decide=(action:string)=>{
  if(lock.current||locked)return;
  const approvedShares=action==='accept'?Number(shares):0;
  if(reason.trim().length<3||!Number.isSafeInteger(approvedShares)||approvedShares<0||approvedShares>a.requestedShares||(action==='accept'&&approvedShares===0)){Alert.alert('Check decision','Enter valid approved shares and a reason of at least 3 characters.');return;}
  const round=items.filter(x=>x.stepNumber===a.stepNumber&&['pending','carried'].includes(x.status));
  const explanation=action==='carry'?'Keep the entire reservation for the next stage.':action==='accept-stage'?`Accept ALL ${round.length} stage reservations, total $${round.reduce((sum,x)=>sum+x.requestedAmount,0).toFixed(2)}. IDs: ${round.map(x=>x.id).join(', ')}. No second debit.`:`Allocate ${approvedShares} shares. Estimated refund $${(a.requestedAmount-a.requestedAmount*approvedShares/a.requestedShares).toFixed(2)}. Server calculates the exact amount.`;
  Alert.alert('Confirm investment decision',`${action.toUpperCase()} · ${a.id} · Stage ${a.stepNumber}\n${explanation}\nReason: ${reason.trim()}`,[{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:async()=>{
   if(lock.current||locked)return;lock.current=true;setBusy(true);
   try{await api.post(`/investment-workflow/applications/${a.id}/decision`,{operationId:uuid(),action,approvedShares,expectedStep:a.stepNumber,reason:reason.trim(),...(action==='accept-stage'?{expectedRound:round.map(x=>x.id)}:{})},{silentError:true} as any);setLocked(true);reload();}
   catch(e:any){setLocked(true);Alert.alert('Decision requires verification',`${e?.response?.data?.message||'Decision outcome may be uncertain.'} Reload applications and history before another decision.`);}
   finally{lock.current=false;setBusy(false);}
  }}]);
 };
 return <View><DecisionHistory id={a.id}/>{['pending','carried'].includes(a.status)&&<><Text>Approved shares (partial acceptance returns the unused reservation)</Text><TextInput accessibilityLabel="Approved shares" keyboardType="number-pad" value={shares} editable={!busy&&!locked} onChangeText={setShares} style={styles.input}/><TextInput accessibilityLabel="Decision reason" placeholder="Reason (required)" value={reason} editable={!busy&&!locked} maxLength={1000} onChangeText={setReason} style={styles.input}/><Text>Acceptance must cover the stage threshold. Use the complete funded round when several reservations cover it together.</Text>{[['accept','Accept / partial'],['accept-stage','Accept funded stage round'],['reject','Reject and refund'],['carry','Carry to next stage']].map(([action,label])=><Pressable accessibilityRole="button" accessibilityLabel={label} key={action} disabled={busy||locked} onPress={()=>decide(action)} style={styles.button}><Text>{label}</Text></Pressable>)}</>}</View>;
}
export default function AdminInvestmentApplicationScreen(){return <AdminProtectedScreen><ApplicationsQueue/></AdminProtectedScreen>; }
function ApplicationsQueue(){
 const [properties,setProperties]=useState<{id:string;title:string}[]>([]),[property,setProperty]=useState(''),[items,setItems]=useState<Application[]>([]),[status,setStatus]=useState(''),[stage,setStage]=useState(''),[user,setUser]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const request=useRef(0);
 useEffect(()=>{api.get('/properties').then(r=>setProperties(r.data)).catch(()=>setError('Unable to load properties.'));},[]);
 const load=useCallback(async()=>{const version=++request.current;setItems([]);setError('');if(!property)return;setLoading(true);try{const r=await api.get(`/applications/property/${property}`);if(version===request.current)setItems(r.data);}catch{if(version===request.current)setError('Unable to load applications.');}finally{if(version===request.current)setLoading(false);}},[property]);
 useEffect(()=>{void load();return()=>{request.current++;};},[load]);
 const rows=items.filter(a=>(!status||a.status===status)&&(!stage||a.stepNumber===Number(stage))&&(!user||a.userId.toLowerCase().includes(user.toLowerCase())));
 return <View style={styles.container}><Text style={styles.title}>Investment applications</Text><Text>Full share price is reserved once. The scheduler settles due stages when enabled. Carry remains an administrator decision. Reconciliation conflicts are recorded in Action Logs.</Text><Picker selectedValue={property} onValueChange={setProperty}><Picker.Item label="Choose property" value=""/>{properties.map(p=><Picker.Item key={p.id} label={p.title} value={p.id}/>)}</Picker><Picker selectedValue={status} onValueChange={setStatus}><Picker.Item label="All statuses" value=""/>{['pending','accepted','partial','rejected','carried'].map(s=><Picker.Item key={s} label={s} value={s}/>)}</Picker><TextInput accessibilityLabel="Stage filter" placeholder="Stage" keyboardType="number-pad" value={stage} onChangeText={setStage} style={styles.input}/><TextInput accessibilityLabel="Investor filter" placeholder="Investor ID" value={user} onChangeText={setUser} style={styles.input}/><Pressable onPress={()=>void load()} style={styles.button}><Text>Reload applications</Text></Pressable>{!!error&&<Text accessibilityRole="alert">{error}</Text>}{loading&&<Text>Loading applications…</Text>}<FlatList data={rows} keyExtractor={a=>`${a.id}-${a.status}-${a.stepNumber}`} ListEmptyComponent={<Text>No applications for this selection.</Text>} renderItem={({item:a})=><View style={styles.card}><Text>Application: {a.id}</Text><Text>Investor: {a.userId}</Text><Text>Stage {a.stepNumber} · {a.status}</Text><Text>Requested ${a.requestedAmount.toFixed(2)} · {a.requestedShares} shares</Text><Text>Approved {a.approvedAmount==null?'—':`$${a.approvedAmount.toFixed(2)}`} · {a.approvedShares??'—'} shares</Text><Text>Created: {new Date(a.createdAt).toLocaleString()}</Text><Decision a={a} items={items} reload={()=>void load()}/></View>}/></View>;
}
const styles=StyleSheet.create({container:{flex:1,padding:16,backgroundColor:theme.colors.background},title:{fontSize:22,fontWeight:'bold'},input:{borderWidth:1,borderColor:'#aaa',padding:8,marginVertical:5,borderRadius:6},button:{backgroundColor:'#e2f4ec',padding:12,marginVertical:4,borderRadius:6},card:{backgroundColor:'white',padding:14,marginVertical:8,borderRadius:8}});
