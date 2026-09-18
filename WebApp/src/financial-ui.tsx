import { useRef, useState } from 'react';
import { demoTopUp } from './api';
import { money } from './format';
import type { Session } from './types';
export function DemoTopUp({session}:{session:Session}) {
 const [amount,setAmount]=useState(''),[confirmed,setConfirmed]=useState<number|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[paused,setPaused]=useState(false);
 const lock=useRef(false);
 async function submit(){
  if(lock.current||confirmed===null||paused)return;
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{const result=await demoTopUp(session,confirmed);setNotice(`${result.message}. Wallet balance: ${money(result.walletBalance)}`);setAmount('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to add virtual funds.');setPaused(true);}
  finally{setConfirmed(null);setBusy(false);lock.current=false;}
 }
 return <section className="panel account-form"><h2>Add virtual funds</h2><p>This simulates a demo top-up. No bank, card or real payment is involved. Limits are checked by the server.</p><form onSubmit={e=>{e.preventDefault();if(!busy&&!paused&&Number.isFinite(Number(amount))&&Number(amount)>0){setConfirmed(Number(amount));setNotice('');setError('');}}}><label>Amount (USD)<input type="number" step="any" required value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy||paused||confirmed!==null}/></label><button className="button" disabled={busy||paused||confirmed!==null||!Number.isFinite(Number(amount))||Number(amount)<=0}>Review demo top-up</button></form>{confirmed!==null&&<div role="dialog" aria-modal="false" aria-label="Confirm demo top-up"><p>Add {confirmed} USD in virtual funds to this demo account?</p><button className="button" disabled={busy} onClick={submit}>{busy?'Adding…':'Confirm virtual top-up'}</button><button disabled={busy} onClick={()=>setConfirmed(null)}>Cancel</button></div>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error} Submission is paused. Check wallet and transactions, then reload before trying again.</p>}</section>;
}


