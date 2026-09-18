import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { uploadKyc } from './api';
import { date, money } from './format';
import { Empty, Heading, Metric, Resource, useResource } from './ui';
import { inDateRange, investorPaths, kycPayload, kycStatus, type DocumentType, type FinanceStats, type HistoryPoint, type InboxMessage, type KycDocument, type MonthlyReport, type RentalEntry } from './investor-contracts';
import type { Session } from './types';

function DateFilters({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return <div className="filters"><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label>{(from || to) && <button onClick={() => { setFrom(''); setTo(''); }}>All dates</button>}</div>;
}
function History({ title, points }: { title: string; points?: HistoryPoint[] }) {
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const rows = (points || []).filter(p => inDateRange(p.date, from, to)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return <section className="panel"><h2>{title}</h2><DateFilters {...{ from, to, setFrom, setTo }}/>{from && to && from > to ? <p role="alert" className="error">The end date must be on or after the start date.</p> : !rows.length ? <Empty title="No history for this period"/> : <div className="history-list">{rows.map((point, index) => <div className="history-row" key={`${point.date}-${index}`}><span>{date(point.date)}</span><strong>{money(point.total)}</strong></div>)}</div>}</section>;
}
export function Finance({ session }: { session: Session }) {
  const resource = useResource<FinanceStats>(investorPaths(session).finance);
  return <><Heading title="My Finance" description="Your current balances and financial history."><button onClick={resource.retry}>Refresh</button></Heading><nav className="actions"><Link to="/club">Club status & fees</Link><Link to="/withdrawals">Withdrawal requests</Link><Link to="/top-up">Top up information</Link><Link to="/withdraw">Withdrawal information</Link></nav><Resource resource={resource}>{data => <><div className="metrics"><Metric label="Total assets" value={money(data.totalAssets)}/><Metric label="Wallet balance" value={money(data.walletBalance)}/><Metric label="Investment value" value={money(data.investmentValue)}/><Metric label="Rental income to date" value={money(data.rentalIncome)}/></div><p className="note">Historical values reflect account activity and may differ from the current value of your portfolio.</p><History title="Combined history" points={data.combinedHistory}/><History title="Equity history (excluding rent)" points={data.equityHistory}/><History title="Rental income history" points={data.rentIncomeHistory}/><Link to="/rental-income">View rental payouts →</Link></>}</Resource></>;
}
export function RentalIncome({ session }: { session: Session }) {
  const resource = useResource<RentalEntry[]>(investorPaths(session).rental);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  return <><Heading title="Rental Income" description="Payouts received from your rental properties."><button onClick={resource.retry}>Refresh</button></Heading><DateFilters {...{ from, to, setFrom, setTo }}/><Resource resource={resource}>{data => {
    const rows = data.filter(p => inDateRange(p.timestamp, from, to)).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    if (from && to && from > to) return <p role="alert" className="error">The end date must be on or after the start date.</p>;
    return <><div className="metrics"><Metric label="Income in selected period" value={money(rows.reduce((sum, p) => sum + p.amount, 0))}/><Metric label="Payouts" value={rows.length}/></div>{rows.length ? <section className="panel"><h2>Payout history</h2>{rows.map((p, i) => <article className="history-row" key={`${p.timestamp}-${i}`}><div><h3>{p.title}</h3><span className="muted">{date(p.timestamp)}</span></div><strong>{money(p.amount)}</strong></article>)}</section> : <Empty title="No rental income for this period">Rental payouts will appear here once received.</Empty>}</>;
  }}</Resource></>;
}
export function MonthlyReports({ session }: { session: Session }) {
  const path = investorPaths(session).reports;
  return <><Heading title="Monthly Reports" description="Month-by-month snapshots of your virtual capital."/>{path ? <DemoReports path={path}/> : <Empty title="Monthly reports are available in demo mode">Account reports are not yet available in the web client.</Empty>}</>;
}
function DemoReports({ path }: { path: string }) {
  const resource = useResource<MonthlyReport[]>(path);
  return <><button className="back-link" onClick={resource.retry}>Refresh</button><Resource resource={resource}>{data => data.length ? <div className="report-grid">{[...data].sort((a, b) => Date.parse(b.reportMonth) - Date.parse(a.reportMonth)).map(r => <article className="panel" key={r.id}><h2>{date(r.reportMonth)}</h2><p>Total capital <strong>{money(r.totalCapital)}</strong></p><dl><dt>Capital change</dt><dd>{r.capitalChange > 0 ? '+' : ''}{money(r.capitalChange)}</dd><dt>Wallet</dt><dd>{money(r.walletBalance)}</dd><dt>Investments</dt><dd>{money(r.investmentValue)}</dd><dt>Rental income to date</dt><dd>{money(r.rentalIncome)}</dd></dl></article>)}</div> : <Empty title="Your first demo report is on its way">Monthly snapshots appear after a full demo month has been completed.</Empty>}</Resource></>;
}
export function Inbox({ session }: { session: Session }) {
  const resource = useResource<InboxMessage[]>(investorPaths(session).inbox);
  return <><Heading title="Inbox" description="Account notifications. Opening a message does not change its read status."><button onClick={resource.retry}>Refresh</button></Heading><Link to="/chat">Support chat →</Link><Resource resource={resource}>{data => data.length ? <section className="panel message-list">{[...data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(m => <details key={m.id}><summary><span>{m.title}</span> {!m.isRead && <span className="tag">Unread</span>}<small>{date(m.createdAt)}</small></summary><p className="preserve-lines">{m.content}</p></details>)}</section> : <Empty title="You're all caught up">New notifications will appear here.</Empty>}</Resource></>;
}

const labels = { passport: 'Passport', driver_license: "Driver's License" };
function readPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Choose a JPEG, PNG or WebP image, up to 5 MB.'));
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read this image.')); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file); });
}
export function Kyc({ session }: { session: Session }) {
  const resource = useResource<KycDocument[]>(investorPaths(session).kyc);
  const [type, setType] = useState<DocumentType>('passport');
  const [files, setFiles] = useState<(File | null)[]>([null, null]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const status = resource.data ? kycStatus(resource.data, type) : 'unknown';
  const blocked = busy || uncertain || !resource.data || status === 'pending' || status === 'approved';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (blocked || lock.current || !files[0] || !files[1]) return;
    lock.current = true; setBusy(true); setMessage('');
    let accepted = 0, attempted = false;
    try {
      const photos = await Promise.all(files.map(file => readPhoto(file!)));
      for (const photo of photos) { attempted = true; await uploadKyc(session, kycPayload(session, type, photo)); accepted++; }
      setFiles([null, null]); setMessage('Both documents were submitted for review.'); resource.retry();
    } catch (error) {
      setUncertain(attempted);
      setMessage(`${accepted} of 2 uploads confirmed. ${error instanceof Error ? error.message : 'Upload failed.'}${attempted ? ' An unconfirmed upload may have reached the server. Refresh and review the document list before starting a new submission; uploads will not be retried automatically.' : ''}`);
    } finally { lock.current = false; setBusy(false); }
  }
  return <><Heading title="Identity Verification" description="Review your documents and verification status."><button disabled={busy} onClick={resource.retry}>Refresh</button></Heading>{session.isDemo && <p className="note">Demo verification is simulated. Use sample images only.</p>}<Resource resource={resource}>{docs => <><section className="panel"><h2>Verification status</h2><p>{labels[type]}: <strong>{status.replaceAll('_', ' ')}</strong></p><p className="muted">Status is based on the latest two documents of the selected type.</p></section><section className="panel"><h2>Uploaded documents</h2>{docs.length ? [...docs].sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)).map(d => <article className="history-row" key={d.id}><div><h3>{labels[d.type as DocumentType] || d.type}</h3><span>{date(d.uploadedAt)}</span></div><span className="tag">{d.status}</span></article>) : <Empty title="No documents submitted"/>}</section></>}</Resource><form className="panel kyc-form" onSubmit={submit}><h2>Submit identity documents</h2><label>Document type<select disabled={busy || uncertain} value={type} onChange={e => { setType(e.target.value as DocumentType); setFiles([null, null]); setMessage(''); }}><option value="passport">Passport</option><option value="driver_license">Driver's License</option></select></label><p>Choose the main document image and a selfie holding that document. JPEG, PNG or WebP, up to 5 MB each.</p>{['Document image', 'Selfie with document'].map((label, i) => <label key={`${type}-${i}`}>{label}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={blocked} onChange={e => setFiles(current => current.map((file, n) => n === i ? e.target.files?.[0] || null : file))}/></label>)}{status === 'pending' && <p>Documents are awaiting review.</p>}{status === 'approved' && <p>Your identity has been confirmed.</p>}{status === 'rejected' && <p className="error">Some documents were rejected. You can submit a new pair.</p>}{message && <p role="status" className="note">{message}</p>}<button className="button" disabled={blocked || !files[0] || !files[1]}>{busy ? 'Submitting…' : 'Submit for review'}</button>{uncertain && <p className="note">Submission is paused to avoid duplicates. After checking the refreshed list, reload this page if you need to start again.</p>}</form></>;
}

