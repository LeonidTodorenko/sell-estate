import { useRef, useState } from 'react';
import { accountWrite, getSession } from './api';
import { Resource, useResource } from './ui';
import { date, money } from './format';

export interface Stage {id:string;stepNumber:number;milestone:string;eventDate:string|null;dueDate:string;percentage:number;total:number;paid:number;outstanding:number;available:boolean}
export interface Workflow {automaticProcessingEnabled?:boolean;canApply:boolean;currentStep:number|null;mode:string;terms:string;pricePerShare:number;availableShares:number;stages:Stage[]}
export function StageOverview({propertyId}:{propertyId:string}) {
 const resource=useResource<Workflow>(`/investment-workflow/properties/${encodeURIComponent(propertyId)}`);
 return <Resource resource={resource}>{w=><section className="panel"><h2>Investment stages</h2><p>{w.terms}</p><p>{w.automaticProcessingEnabled?'Automatic processing at the stage due date is enabled. Unproven reservations require administrator reconciliation.':'Automatic processing is OFF. Reservations require administrator review.'}</p><p>{money(w.pricePerShare)} per share · {w.availableShares} shares available · {w.canApply?`Current stage ${w.currentStep}: ${w.mode==='reservation'?'reserve pending review':'immediate investment'}`:'Applications unavailable'}</p>{w.stages.map(s=><article key={s.id}><h3>Stage {s.stepNumber}: {s.milestone||'Funding milestone'} · {s.percentage}%</h3><p>{date(s.eventDate)} → {date(s.dueDate)} · {s.available?'Available for a new purchase':'Unavailable for a new purchase'}</p><p>Target {money(s.total)} · Funded {money(s.paid)} · Outstanding {money(s.outstanding)}</p></article>)}</section>}</Resource>;
}
export function StatusExplanation({status}:{status:string|null}) {
 const text:Record<string,string>={pending:'Funds and shares reserved. Awaiting stage settlement or administrator review; ownership is not yet allocated.',accepted:'All requested shares allocated. No second wallet debit.',partial:'Some shares allocated. The unused reservation was returned to the wallet.',rejected:'No shares allocated. The reservation was returned to the wallet.',carried:'Reservation retained for the next stage. Awaiting settlement of the next stage; no second debit.'};
 return <p>{text[status||'pending']||'Status requires review. Contact support with the application ID.'}</p>;
}
export function SchedulerConflicts() {
 const resource=useResource<{id:string;timestamp:string;details:string}[]>('/investment-workflow/scheduler-conflicts');
 return <section className="panel"><h2>Recorded scheduler reconciliation conflicts</h2><button onClick={resource.retry}>Refresh conflicts</button><Resource resource={resource}>{rows=>rows.length?rows.map(x=>{let detail;try{detail=JSON.parse(x.details);}catch{return <p key={x.id}>Conflict details unavailable. Review the action log.</p>;}return <p key={x.id}>{date(x.timestamp)} · Application {detail.applicationId} · {detail.reason}</p>;}):<p>No recorded conflicts.</p>}</Resource></section>;
}
export function ApplicationHistory({id}:{id:string}) {
 const [show,setShow]=useState(false);
 return <><button onClick={()=>setShow(v=>!v)}>{show?'Hide decision history':'View decision history'}</button>{show&&<History id={id}/>}</>;
}
function History({id}:{id:string}) {
 const resource=useResource<{createdAt:string;history:{timestamp:string;details:string}[]}>(`/investment-workflow/applications/${id}/history`);
 return <Resource resource={resource}>{v=><div><p>Submitted {date(v.createdAt)}</p>{v.history.length?v.history.map((h,i)=>{let d;try{d=JSON.parse(h.details);}catch{return <p key={i}>History unavailable</p>;}return <p key={i}>{date(h.timestamp)} · {d.Action??'Reconciliation conflict'} · from stage {d.ExpectedStep??'—'} · {d.ApprovedShares??'—'} shares · {d.Reason??d.reason}</p>;}):<p>No decisions recorded.</p>}</div>}</Resource>;
}
type Reservation={id:string;stepNumber:number;status:string|null;requestedShares:number;requestedAmount:number};
export function ApplicationDecision({application:a,reload,round}:{application:Reservation;reload:()=>void;round:Reservation[]}) {
 const [action,setAction]=useState('accept'),[shares,setShares]=useState(String(a.requestedShares)),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 async function submit(){const session=getSession();if(!session||lock.current||locked)return;
  const n=action==='accept'?Number(shares):0;
  if(!Number.isSafeInteger(n)||n<0||n>a.requestedShares||(action==='accept'&&n===0)||reason.trim().length<3){setError('Enter valid shares and a reason of at least 3 characters.');return;}
  const stageRound=round.filter(x=>x.stepNumber===a.stepNumber&&['pending','carried'].includes(x.status||''));
  const roundAmount=stageRound.reduce((sum,x)=>sum+x.requestedAmount,0);
  const amount=action==='accept'?a.requestedAmount*n/a.requestedShares:0;
  if(!window.confirm(`${action.toUpperCase()} application ${a.id}, stage ${a.stepNumber}. ${action==='accept-stage'?`Accept ALL ${stageRound.length} reservations in stage ${a.stepNumber}, total ${money(roundAmount)}. Application IDs: ${stageRound.map(x=>x.id).join(', ')}. No second debit.`:action==='carry'?'Keep the entire reservation for the next stage.':`Allocate ${n} shares; approximate refund ${money(a.requestedAmount-amount)} (server calculates the exact amount).`} Reason: ${reason}`))return;
  lock.current=true;setBusy(true);setError('');
  try{await accountWrite(session,`/investment-workflow/applications/${a.id}/decision`,{operationId:crypto.randomUUID(),action,approvedShares:n,expectedStep:a.stepNumber,reason:reason.trim(),...(action==='accept-stage'?{expectedRound:stageRound.map(x=>x.id)}:{})});setLocked(true);reload();}
  catch(e){setLocked(true);setError(`${e instanceof Error?e.message:'Decision failed.'} Reload and inspect history before another decision.`);}
  finally{setBusy(false);lock.current=false;}
 }
 return <details><summary>Details and decision</summary><ApplicationHistory id={a.id}/><StatusExplanation status={a.status}/>{['pending','carried'].includes(a.status||'pending')&&<fieldset disabled={busy||locked}><label>Decision<select value={action} onChange={e=>setAction(e.target.value)}><option value="accept">Accept / partial acceptance</option><option value="accept-stage">Accept all funded stage reservations</option><option value="reject">Reject and refund</option><option value="carry">Carry reservation to next stage</option></select></label>{action==='accept'&&<label>Approved shares<input type="number" min="1" max={a.requestedShares} step="1" value={shares} onChange={e=>setShares(e.target.value)}/></label>}<label>Reason<textarea required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><p>Acceptance must cover the stage funding target with already funded amounts. Old reservations without matching debit records require reconciliation.</p><button onClick={()=>void submit()}>Review decision</button></fieldset>}{error&&<p role="alert">{error}</p>}</details>;
}

export function SchedulerRuns() {
 const resource=useResource<{id:string;timestamp:string;details:string}[]>('/investment-workflow/scheduler-runs');
 return <section className="panel"><h2>Scheduler run history</h2><p>Read-only history, newest events first. A start without a later completion may indicate an interrupted run. Refresh to check again. Events are recorded after the monitoring update is deployed; database outages can leave gaps.</p><button onClick={resource.retry}>Refresh runs</button><Resource resource={resource}>{rows=>rows.length?rows.map(x=>{let d;try{d=JSON.parse(x.details);}catch{return <p key={x.id}>Event unavailable. Review server logs.</p>;}return <p key={x.id}>{date(x.timestamp)} | {d.status} | Run {d.runId}{d.subjectId?` | Item ${d.subjectId}`:''}{d.errorType?` | ${d.errorType}`:''}</p>;}):<p>No recorded runs yet.</p>}</Resource></section>;
}
