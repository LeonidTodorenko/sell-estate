import {useEffect,useState} from 'react';
import {api,accountWrite,paymentDocument} from './api';
import type {Session} from './types';
type Entry={id:string;authorId:string;kind:string;comment:string;contentType?:string;size:number;createdAt:string};
export function PaymentEvidence({session,id,admin=false,open}:{session:Session;id:string;admin?:boolean;open:boolean}) {
 const [entries,setEntries]=useState<Entry[]>([]),[comment,setComment]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const path=`/payments/${id}/evidence`;
 const load=()=>api<Entry[]>(path).then(setEntries);
 useEffect(()=>{setEntries([]);void load().catch(()=>setError('Document history unavailable.'));},[id]);
 async function send(){if(busy)return;setBusy(true);setError('');try{
  if(admin)await accountWrite(session,path+'/clarification',{comment});
  else {if(file&&file.size>5*1024*1024)throw new Error('Maximum file size: 5 MiB.');
   const form=new FormData();form.append('comment',comment);if(file)form.append('file',file);
   await paymentDocument(session,id,undefined,form);}
  setComment('');setFile(null);await load();
 }catch(e){setError(e instanceof Error?e.message:'Unable to submit.');}finally{setBusy(false);}}
 async function download(e:Entry){setBusy(true);setError('');try{
  const blob=await paymentDocument(session,id,e.id) as Blob;
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
  a.download=`evidence-${e.id}.${e.contentType==='application/pdf'?'pdf':e.contentType==='image/png'?'png':'jpg'}`;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(e){setError(e instanceof Error?e.message:'Unable to open.');}finally{setBusy(false);}}
 return <section><h3>Documents and clarification</h3>
  <p>TEST only. A receipt upload does not confirm receipt of funds. PDF/JPEG/PNG · 5 MiB each · maximum 5 files.</p>
  <button disabled={busy} onClick={()=>void load().catch(()=>setError('History unavailable.'))}>Refresh documents</button>
  {entries.at(-1)?.kind==='clarification'&&<p>Awaiting owner clarification — request remains open.</p>}
  {entries.map(e=><article key={e.id}><p>{e.kind==='clarification'?'Administrator requests clarification':'Owner submission'} · {new Date(e.createdAt).toLocaleString()}<br/>{e.comment}</p>
   {e.contentType&&<button disabled={busy} onClick={()=>void download(e)}>Download / view {e.contentType} ({Math.ceil(e.size/1024)} KiB)</button>}</article>)}
  {open&&<><label>{admin?'Clarification request':'Accompanying comment'}<textarea maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)}/></label>
   {!admin&&<label>PDF or photo<input key={file?.name??'empty'} type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>}
   <button disabled={busy||(!comment.trim()&&(admin||!file))} onClick={()=>void send()}>{admin?'Request clarification without declining':'Send document / comment'}</button></>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
