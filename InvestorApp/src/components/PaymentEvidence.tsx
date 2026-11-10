import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, NativeModules} from 'react-native';
import {pick, isErrorWithCode, errorCodes} from '@react-native-documents/picker';
import {Buffer} from 'buffer';
import api from '../api';
import BlueButton from './BlueButton';

type Entry={id:string;authorId:string;kind:string;comment:string;contentType?:string;size:number;createdAt:string};
export default function PaymentEvidence({id,admin=false,open}:{id:string;admin?:boolean;open:boolean}) {
 const [entries,setEntries]=useState<Entry[]>([]),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const path=`/payments/${id}/evidence`;
 const load=async()=>setEntries((await api.get(path,{silentLoading:true} as any)).data);
 useEffect(()=>{setEntries([]);void load().catch(()=>setError('History unavailable.'));},[id]);
 async function send(withFile=false){
  if(busy)return;setBusy(true);setError('');
  try{
   if(admin){await api.post(path+'/clarification',{comment});}
   else {
    const form=new FormData();form.append('comment',comment);
    if(withFile){const [f]=await pick({type:['application/pdf','image/jpeg','image/png']});
     if(f.size==null||f.size>5*1024*1024)throw new Error('Maximum 5 MiB per file.');
     form.append('file',{uri:f.uri,name:f.name??'document',type:f.type} as any);}
    await api.post(path,form,{timeout:60000});
   }
   setComment('');await load();
  }catch(e:any){if(!(isErrorWithCode(e)&&e.code===errorCodes.OPERATION_CANCELED))setError(e.response?.data?.message??e.message??'Unable to save.');}
  finally{setBusy(false);}
 }
 async function view(e:Entry){setBusy(true);setError('');try{
  const r=await api.get(path+`/${e.id}/file`,{responseType:'arraybuffer',timeout:60000});
  await NativeModules.PaymentDocument.open(Buffer.from(r.data).toString('base64'),e.contentType);
 }catch(e:any){setError(e.message??'Unable to open document.');}finally{setBusy(false);}}
 return <View style={{gap:10,paddingVertical:12}}>
  <Text style={{fontWeight:'bold'}}>Documents and clarification</Text>
  <Text>TEST only. A receipt upload does not confirm receipt of funds. PDF/JPEG/PNG · 5 MiB each · 5 files per request.</Text>
  <BlueButton title="Refresh documents" disabled={busy} onPress={()=>void load().catch(()=>setError('History unavailable.'))}/>
  {entries.at(-1)?.kind==='clarification'&&<Text>Awaiting owner clarification — request remains open.</Text>}
  {entries.map(e=><View key={e.id}><Text>{e.kind==='clarification'?'Administrator requests clarification':'Owner submission'} · {new Date(e.createdAt).toLocaleString()}{'\n'}{e.comment}</Text>
   {!!e.contentType&&<BlueButton title={`Open ${e.contentType} (${Math.ceil(e.size/1024)} KiB)`} disabled={busy} onPress={()=>void view(e)}/>}</View>)}
  {open&&<><TextInput accessibilityLabel={admin?'Clarification request':'Accompanying comment'} placeholder={admin?'What needs clarification?':'Accompanying comment'} value={comment} onChangeText={setComment} multiline maxLength={2000}/>
   <BlueButton title={admin?'Request clarification without declining':'Send comment'} disabled={busy||!comment.trim()} onPress={()=>void send()}/>
   {!admin&&<BlueButton title="Attach PDF / photo and comment" disabled={busy} onPress={()=>void send(true)}/>}</>}
  {!!error&&<Text accessibilityRole="alert">{error}</Text>}
 </View>;
}
