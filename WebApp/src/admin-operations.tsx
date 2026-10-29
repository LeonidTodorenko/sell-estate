import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { money } from './format';
import { Empty, Heading, Metric, Resource, useResource } from './ui';
import { adminLogsPath, adminLogPages, type AdminStats, type AdminLogPage } from './admin-contracts';
import './admin.css';

interface Withdrawal { id: string; userId: string; amount: number; status: string; createdAt: string }
const timestamp = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : '—';
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value) ? value : '—';
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? money(value) : '—';
const within = (value: string, from: string, to: string) => {
  if (!from && !to) return true;
  const time = Date.parse(value);
  return Number.isFinite(time) && (!from || time >= Date.parse(from + 'T00:00:00Z')) && (!to || time < Date.parse(to + 'T00:00:00Z') + 86400000);
};
function DateRange({ from, to, setFrom, setTo }: {from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void}) {
  return <><label>From date (UTC)<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>To date (UTC)<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label></>;
}

export function AdminOverview() {
  const resource = useResource<AdminStats>('/admin/stats');
  return <><Heading title="Admin overview" description="Operational totals from the admin API. All amounts in USD."><button onClick={resource.retry}>Refresh totals</button></Heading>
    <Resource resource={resource}>{data => <><div className="metrics admin-metrics">
      <Metric label="Investor accounts" value={count(data.investors)}/><Metric label="Recorded investments" value={amount(data.totalInvestments)}/><Metric label="Properties" value={count(data.totalProperties)}/><Metric label="Recorded rental income" value={amount(data.totalRentalIncome)}/><Metric label="Pending withdrawals" value={count(data.pendingWithdrawals)}/><Metric label="Pending KYC" value={count(data.pendingKyc)}/>
    </div><p className="muted">Cumulative records, with no period filter. These totals do not represent available cash or confirmed payouts. Missing or invalid values appear as —.</p></>}</Resource>
    <section className="panel operations-panel"><h2>Review queues</h2><nav className="operations-links" aria-label="Operational queues"><Link to="/admin/withdrawals?status=pending">Pending withdrawals →</Link><Link to="/admin/kyc">KYC review →</Link><Link to="/admin/logs">Action logs →</Link><Link to="/admin/investments">Investment records →</Link><Link to="/admin/properties">Properties →</Link><Link to="/admin/users">Users →</Link></nav><p className="muted">Withdrawal approval records are separate from payment settlement.</p></section></>;
}

export function AdminWithdrawals() {
  const resource = useResource<Withdrawal[]>('/withdrawals/all');
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') === 'pending' ? 'pending' : '');
  const [query, setQuery] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const invalid = Boolean(from && to && from > to);
  const clear = () => { setStatus(''); setQuery(''); setFrom(''); setTo(''); };
  return <><Heading title="Withdrawals" description="Review accounting requests. An approved status does not confirm a bank or card payout."><button onClick={resource.retry}>Refresh requests</button></Heading>
    <form className="filters panel admin-filter" onSubmit={e => e.preventDefault()}><label>Withdrawal status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><label>Request or user ID<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search IDs"/></label><DateRange from={from} to={to} setFrom={setFrom} setTo={setTo}/><button type="button" onClick={clear}>Clear filters</button></form>
    <p className="muted">Filters apply to all requests returned by the API. Dates include both selected days in UTC.</p>
    {invalid && <p role="alert">Start date must be on or before end date.</p>}
    <Resource resource={resource}>{items => {
      const rows = invalid ? [] : items.filter(item => (!status || item.status === status) && (!query.trim() || `${item.id} ${item.userId}`.toLowerCase().includes(query.trim().toLowerCase())) && within(item.createdAt, from, to));
      return <><p role="status">{rows.length} of {items.length} requests</p>{rows.length ? <section className="panel table-wrap"><table><thead><tr><th>Request / created (UTC)</th><th>User</th><th>Amount (USD)</th><th>Status</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td data-label="Request / created (UTC)"><span className="identifier">{item.id}</span><small>{timestamp(item.createdAt)}</small></td><td data-label="User"><Link className="identifier" to={`/admin/users/${encodeURIComponent(item.userId)}`}>{item.userId}</Link></td><td data-label="Amount (USD)">{amount(item.amount)}</td><td data-label="Status"><span className="tag">{item.status || 'Unknown'}</span></td></tr>)}</tbody></table></section> : <Empty title={items.length ? 'No matching withdrawals' : 'No withdrawal requests'}>Refresh the queue or change the filters.</Empty>}</>;
    }}</Resource>
    <section className="panel operations-panel"><h2>Financial decisions unavailable</h2><p>Approve records a financial transaction; reject returns funds to the account. These actions require a separately verified environment and are disabled in this iteration.</p><div className="actions"><button disabled>Approve</button><button disabled>Reject</button></div></section></>;
}

export function AdminLogs() {
  const [draftAction, setDraftAction] = useState(''), [draftUser, setDraftUser] = useState('');
  const [filters, setFilters] = useState({action: '', userName: ''}), [page, setPage] = useState(1);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const invalid = Boolean(from && to && from > to);
  const resource = useResource<AdminLogPage>(adminLogsPath(filters.action, filters.userName, page));
  function submit(e: FormEvent) { e.preventDefault(); setFilters({action: draftAction.trim(), userName: draftUser.trim()}); setPage(1); }
  function clear() { setDraftAction(''); setDraftUser(''); setFilters({action:'',userName:''}); setFrom(''); setTo(''); setPage(1); }
  return <><Heading title="Action logs" description="Audit records with server search and read-only details."><button onClick={resource.retry}>Refresh logs</button></Heading>
    <form className="filters panel admin-filter" onSubmit={submit}><label>Action<input value={draftAction} onChange={e => setDraftAction(e.target.value)} placeholder="Action type contains"/></label><label>User name<input value={draftUser} onChange={e => setDraftUser(e.target.value)} placeholder="User name contains"/></label><button className="button">Apply filters</button><button type="button" onClick={clear}>Clear filters</button></form>
    <section className="panel operations-panel"><h2>Dates on current page</h2><div className="filters admin-filter"><DateRange from={from} to={to} setFrom={setFrom} setTo={setTo}/></div><p className="muted">The API supports action and user name search only. Date filters apply to the current page, not the entire audit history. Both selected days are included in UTC.</p></section>
    {invalid && <p role="alert">Start date must be on or before end date.</p>}
    <Resource resource={resource}>{result => {
      const rows = invalid ? [] : result.items.filter(item => within(item.timestamp, from, to));
      return <><p role="status">{rows.length} of {result.items.length} records on this page · {result.total} server matches</p>{rows.length ? <section className="panel table-wrap"><table><thead><tr><th>Time (UTC)</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td data-label="Time (UTC)">{timestamp(item.timestamp)}</td><td data-label="User">{item.userName || 'Unknown user'}{item.userId && <small><Link className="identifier" to={`/admin/users/${encodeURIComponent(item.userId)}`}>{item.userId}</Link></small>}</td><td data-label="Action">{item.action}</td><td data-label="Details" className="admin-log-details"><details><summary>Show details</summary><dl><dt>Record ID</dt><dd className="identifier">{item.id}</dd><dt>Details</dt><dd className="log-text">{item.details || 'No details returned'}</dd></dl></details></td></tr>)}</tbody></table></section> : <Empty title="No matching log records">Dates may hide records on this page. Clear dates or browse other pages.</Empty>}
      <nav className="admin-pagination" aria-label="Log pages"><button disabled={result.page <= 1} onClick={() => setPage(n => Math.max(1,n-1))}>Previous</button><span>Page {result.page} of {adminLogPages(result)} · {result.total} server matches</span><button disabled={result.page >= adminLogPages(result)} onClick={() => setPage(n => n+1)}>Next</button></nav></>;
    }}</Resource></>;
}
