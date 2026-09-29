import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, financialWrite } from './api';
import { money } from './format';
import { useResource, Resource } from './ui';
import type { Session, ShareOffer } from './types';

type Field = { name: string; label: string; type?: string; min?: number; max?: number; step?: string; optional?: boolean };
export function OperationForm({ session, title, description, fields = [], contract, summary }: {
  session: Session; title: string; description: string; fields?: Field[];
  contract: (values: Record<string, string>) => { path: string; body: Record<string, unknown> };
  summary: (values: Record<string, string>) => string;
}) {
  const [values, setValues] = useState<Record<string, string>>({}), [secret, setSecret] = useState('');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [error, setError] = useState(''), [paused, setPaused] = useState(false);
  const lock = useRef(false);
  function prepare(e: FormEvent) { e.preventDefault(); setError(''); try { contract(values); setReview(true); } catch (e) { setError(e instanceof Error ? e.message : 'Check the values.'); } }
  async function submit() {
    if (lock.current || paused || done || !review) return;
    lock.current = true; setBusy(true); setError('');
    try { const request = contract(values); await financialWrite(session, request.path, { ...request.body, pinOrPassword: secret }); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to submit.'); setPaused(!(e instanceof ApiError) || e.status === 0 || e.status === 200 || e.status >= 500 || e.status === 409); }
    finally { setSecret(''); setReview(false); setBusy(false); lock.current = false; }
  }
  return <details className="operation"><summary>{title}</summary><p>{description}</p><p className="note">{session.isDemo ? 'Demo: virtual funds and simulated activity.' : 'This changes your account records and may use your wallet balance. No bank or card payment is made.'}</p>{done ? <p role="status">Request accepted. <Link to="/transactions">Check transactions</Link> and <Link to="/applications">applications</Link>. <button onClick={() => window.dispatchEvent(new Event('financial-data-changed'))}>Refresh account data</button></p> : <form onSubmit={prepare}><fieldset disabled={busy || review || paused}>{fields.map(f => <label key={f.name}>{f.label}<input required={!f.optional} type={f.type || 'number'} min={f.min} max={f.max} step={f.step || '1'} value={values[f.name] || ''} onChange={e => setValues({ ...values, [f.name]: e.target.value })}/></label>)}<label>PIN or password<input required type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)}/></label><button className="button">Review {title.toLowerCase()}</button></fieldset></form>}{review && <div role="group" aria-label={`Confirm ${title}`}><p>{summary(values)}</p><button className="button" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : `Confirm ${title.toLowerCase()}`}</button><button disabled={busy} onClick={() => { setReview(false); setSecret(''); }}>Back</button></div>}{error && <p className="error" role="alert">{error}</p>}{paused && <p role="status">Submission paused: the outcome may be uncertain. Check account history, then reload before trying again. This request will not be retried automatically.</p>}</details>;
}
const sharesField: Field = { name: 'shares', label: 'Shares', min: 1 };
function positive(value: string, whole = false) { const n = Number(value); if (!Number.isFinite(n) || n <= 0 || (whole && !Number.isSafeInteger(n))) throw new Error('Enter a positive valid amount or whole number of shares.'); return n; }
function future(value: string) { const n = Date.parse(value); if (!Number.isFinite(n) || n <= Date.now()) throw new Error('Choose a future expiration date.'); return new Date(n).toISOString(); }
export function InvestmentForm({session,propertyId,available,price}:{session:Session;propertyId:string;available:number;price:number}) {
 if (available <= 0 || !Number.isFinite(price) || price <= 0) return <p>No shares available for an application.</p>;
 return <OperationForm session={session} title="Apply for shares" description="The server checks the payment plan, available shares and wallet balance. Submission may create an application or investment according to the current payment stage; allocation is not guaranteed." fields={[{...sharesField,max:available}]} contract={v=>({path:'/investments/apply',body:{propertyId,requestedShares:positive(v.shares,true)}})} summary={v=>`Apply for ${v.shares} shares. Indicative property value: ${money(Number(v.shares)*price)}. The server determines the required payment and allocation.`}/>;
}
export function CreateOfferForm({session,propertyId,shares}:{session:Session;propertyId:string;shares:number}) {
 return <OperationForm session={session} title="Create offer" description="Listing removes these shares from available holdings while the offer is active. Cancellation may charge a fee." fields={[{...sharesField,max:shares},{name:'start',label:'Starting price per share (USD)',min:0.01,step:'0.01'},{name:'buyout',label:'Buyout price per share (USD, optional)',min:0.01,step:'0.01',optional:true},{name:'expires',label:'Expires (local time)',type:'datetime-local'}]} contract={v=>({path:'/share-offers',body:{propertyId,sharesForSale:positive(v.shares,true),startPricePerShare:positive(v.start),buyoutPricePerShare:v.buyout?positive(v.buyout):null,expirationDate:future(v.expires)}})} summary={v=>`List ${v.shares} shares at ${money(Number(v.start))} starting price per share; ${v.buyout?money(Number(v.buyout)):'no'} buyout price. Expires ${v.expires.replace('T',' ')} local time.`}/>;
}
function CancelOffer({session,offer}:{session:Session;offer:ShareOffer}) {
 const fee=useResource<string>('/admin/stats/settings/cancel-fee');
 return <Resource resource={fee}>{value=>Number.isFinite(Number(value))&&Number(value)>=0?<OperationForm session={session} title="Cancel offer" description={`Current cancellation fee: ${money(Number(value))}. The server applies its current fee at submission.`} contract={()=>({path:`/share-offers/${encodeURIComponent(offer.id)}/cancel`,body:{}})} summary={()=>`Cancel this offer and return the remaining shares to your holdings. Current fee: ${money(Number(value))}.`}/>:<p>Cancellation fee unavailable. Please retry later.</p>}</Resource>;
}
export function OfferActions({session,offer:o}:{session:Session;offer:ShareOffer}) {
 const path=`/share-offers/${encodeURIComponent(o.id)}`;
 return o.sellerId===session.user.id ? <><CancelOffer session={session} offer={o}/><OperationForm session={session} title="Extend offer" description="Choose an expiration later than the current date shown above." fields={[{name:'expires',label:'New expiration (local time)',type:'datetime-local'}]} contract={v=>{const newDate=future(v.expires);if(Date.parse(newDate)<=Date.parse(o.expirationDate))throw new Error('New expiration must be later than the current expiration.');return {path:`${path}/extend-to`,body:{newDate}};}} summary={v=>`Extend this offer until ${v.expires.replace('T',' ')} local time.`}/></> : <>{o.buyoutPricePerShare!=null&&o.buyoutPricePerShare>0&&<OperationForm session={session} title="Buy shares" description="Purchase at the displayed buyout price using your wallet balance. Availability is checked on submission." fields={[{...sharesField,max:o.sharesForSale}]} contract={v=>({path:`${path}/buy`,body:{sharesToBuy:positive(v.shares,true)}})} summary={v=>`Buy ${v.shares} shares for ${money(Number(v.shares)*o.buyoutPricePerShare!)} at the displayed price.`}/>}<OperationForm session={session} title="Place bid" description="A bid records your proposed price. It does not purchase shares or guarantee acceptance. Bid acceptance is unavailable in this web release." fields={[{...sharesField,max:o.sharesForSale},{name:'price',label:'Bid price per share (USD)',min:o.startPricePerShare||0.01,step:'0.01'}]} contract={v=>({path:`${path}/bid`,body:{shares:positive(v.shares,true),bidPricePerShare:positive(v.price)}})} summary={v=>`Bid for ${v.shares} shares at ${money(Number(v.price))} each (${money(Number(v.shares)*Number(v.price))} total). This is not a completed purchase.`}/></>;
}
