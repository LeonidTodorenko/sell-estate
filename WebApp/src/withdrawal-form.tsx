import { useRef, useState, type FormEvent } from 'react';
import { ApiError, financialWrite } from './api';
import type { Session } from './types';

type Attempt = { requestKey: string; amount: number; testDestination: string };
const testDestination = 'TEST-BANK-001';

export function WithdrawalForm({session}:{session:Session}) {
  const storageKey = 'ownersclub.withdrawal.' + session.user.id;
  const [attempt,setAttempt] = useState<Attempt|null>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  });
  const [amount,setAmount] = useState(''), [busy,setBusy] = useState(false);
  const [message,setMessage] = useState(''), [error,setError] = useState('');
  const lock = useRef(false);

  async function submit(event:FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const value = Number(amount);
    if (!attempt && (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(value) || value <= 0)) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const pending = attempt ?? {requestKey:crypto.randomUUID(),amount:value,testDestination};
      localStorage.setItem(storageKey,JSON.stringify(pending));
      setAttempt(pending);
      await financialWrite(session,'/withdrawals/request',pending);
      localStorage.removeItem(storageKey);
      setAttempt(null);
      setAmount('');
      setMessage(session.isDemo ? 'Demo withdrawal simulated.' : 'TEST request saved. See withdrawal history for its current status.');
      window.dispatchEvent(new Event('financial-data-changed'));
    } catch(e) {
      if (e instanceof ApiError && e.status === 400) {
        localStorage.removeItem(storageKey);
        setAttempt(null);
      }
      setError(e instanceof Error ? e.message : 'Withdrawal unavailable.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <p>{session.isDemo ? 'Demo withdrawals are simulated instantly.' : 'TEST/manual withdrawal. The amount is reserved until review. Approval simulates a payout.'}</p>
    <label>Amount (USD)<input required type="number" step="0.01" min="0.01" value={attempt?.amount??amount}
      disabled={busy||!!attempt} onChange={e=>setAmount(e.target.value)}/></label>
    {!session.isDemo&&<p>Test bank destination {testDestination}</p>}
    {attempt&&<p>Retry the saved request to recover its result.</p>}
    <button className="button" disabled={busy}>{busy?'Submitting…':attempt?'Recover request':'Submit TEST withdrawal'}</button>
    {message&&<p role="status">{message}</p>}
    {error&&<p role="alert">{error}</p>}
  </form>;
}
