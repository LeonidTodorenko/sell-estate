import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { date, money } from './format';
import { Empty, Heading, Metric, Resource, useResource } from './ui';
import {
  adminLogPages, adminLogsPath, adminUserPath, adminUsersPath,
  type AdminDemoAccount, type AdminInvestment, type AdminLogPage,
  type AdminStats, type AdminUserDetails, type AdminUserSummary,
} from './admin-contracts';
import './admin.css';

const role = (user: AdminUserSummary) => user.userRoleText || `Role ${user.userRole}`;
const status = (value: boolean, yes: string, no: string) => <span className={`tag ${value ? '' : 'neutral'}`}>{value ? yes : no}</span>;

export function AdminOverview() {
  const resource = useResource<AdminStats>('/admin/stats');
  return <><Heading title="Admin overview" description="Read-only operational totals from the protected admin API."/><Resource resource={resource}>{data => <div className="metrics admin-metrics"><Metric label="Investors" value={data.investors}/><Metric label="Invested amount" value={money(data.totalInvestments)}/><Metric label="Properties" value={data.totalProperties}/><Metric label="Rental income" value={money(data.totalRentalIncome)}/><Metric label="Pending withdrawals" value={data.pendingWithdrawals}/><Metric label="Pending KYC" value={data.pendingKyc}/></div>}</Resource></>;
}

export function AdminUsers() {
  const [draft, setDraft] = useState(''), [query, setQuery] = useState('');
  const resource = useResource<AdminUserSummary[]>(adminUsersPath(query));
  function submit(event: FormEvent) { event.preventDefault(); setQuery(draft.trim()); }
  return <><Heading title="Users" description="Search safe account fields. Account changes are unavailable in this web view."/><form className="filters panel admin-filter" onSubmit={submit}><label className="search">Name or email<input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Search users"/></label><button className="button">Search</button>{query && <button type="button" onClick={() => { setDraft(''); setQuery(''); }}>Clear</button>}</form><Resource resource={resource}>{users => users.length ? <section className="panel table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Email status</th><th>Account</th><th>Created</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><Link to={`/admin/users/${encodeURIComponent(user.id)}`}>{user.fullName || 'Unnamed user'}</Link><small>{user.email}</small></td><td>{role(user)}</td><td>{status(user.isEmailConfirmed, 'Confirmed', 'Unconfirmed')}</td><td>{status(!user.isBlocked, 'Active', 'Blocked')}</td><td>{date(user.createdAt)}</td></tr>)}</tbody></table></section> : <Empty title={query ? 'No matching users' : 'No users available'}>Try a different name or email.</Empty>}</Resource></>;
}

export function AdminUser() {
  const { id = '' } = useParams();
  const resource = useResource<AdminUserDetails>(adminUserPath(id));
  return <><Link className="back-link" to="/admin/users">← Back to users</Link><Heading title="User details" description="Safe account metadata returned by the current admin API."/><Resource resource={resource}>{user => <section className="panel admin-details"><h2>{user.fullName || 'Unnamed user'}</h2><p className="muted">{user.email}</p><dl><dt>User ID</dt><dd className="identifier">{user.id}</dd><dt>Role</dt><dd>{role(user)}</dd><dt>Account</dt><dd>{user.isBlocked ? 'Blocked' : 'Active'}</dd><dt>Email</dt><dd>{user.isEmailConfirmed ? 'Confirmed' : 'Unconfirmed'}</dd><dt>Created</dt><dd>{date(user.createdAt)}</dd><dt>Permissions</dt><dd>{user.permissionsText.length ? user.permissionsText.join(', ') : `None (${user.permissions})`}</dd></dl></section>}</Resource></>;
}

export function AdminInvestments() {
  const resource = useResource<AdminInvestment[]>('/admin/investments');
  return <><Heading title="Investments" description="Read-only investment records. Approval and rejection actions are not exposed."/><Resource resource={resource}>{items => items.length ? <section className="panel table-wrap"><table><thead><tr><th>Investment</th><th>User</th><th>Property</th><th>Shares</th><th>Amount</th><th>Created</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td className="identifier">{item.id}</td><td className="identifier">{item.userId}</td><td className="identifier">{item.propertyId}</td><td>{item.shares}</td><td>{money(item.investedAmount)}</td><td>{date(item.createdAt)}</td></tr>)}</tbody></table></section> : <Empty title="No investments available"/>}</Resource></>;
}

export function AdminDemoAccounts() {
  const resource = useResource<AdminDemoAccount[]>('/admin/demo-accounts');
  return <><Heading title="Demo accounts" description="Read-only sandbox account status. Create, reset and activation controls are unavailable."/><Resource resource={resource}>{items => items.length ? <section className="panel table-wrap"><table><thead><tr><th>Account</th><th>Code</th><th>Balance</th><th>Status</th><th>Last active</th><th>Expires</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.fullName || 'Unnamed demo'}<small>{item.email}</small></td><td>{item.demoCode || '—'}{item.isTemplate && <small>Template</small>}</td><td>{money(item.walletBalance)}</td><td>{status(item.isActive, 'Active', 'Inactive')}</td><td>{date(item.lastActiveAt)}</td><td>{date(item.expiresAt)}</td></tr>)}</tbody></table></section> : <Empty title="No demo accounts available"/>}</Resource></>;
}

export function AdminLogs() {
  const [draftAction, setDraftAction] = useState(''), [draftUser, setDraftUser] = useState('');
  const [filters, setFilters] = useState({ action: '', userName: '' }), [page, setPage] = useState(1);
  const resource = useResource<AdminLogPage>(adminLogsPath(filters.action, filters.userName, page));
  function submit(event: FormEvent) { event.preventDefault(); setFilters({ action: draftAction.trim(), userName: draftUser.trim() }); setPage(1); }
  return <><Heading title="Action logs" description="Server-filtered audit records with read-only pagination."/><form className="filters panel admin-filter" onSubmit={submit}><label>Action<input value={draftAction} onChange={event => setDraftAction(event.target.value)} placeholder="Action contains"/></label><label>User name<input value={draftUser} onChange={event => setDraftUser(event.target.value)} placeholder="User contains"/></label><button className="button">Apply filters</button>{(filters.action || filters.userName) && <button type="button" onClick={() => { setDraftAction(''); setDraftUser(''); setFilters({ action: '', userName: '' }); setPage(1); }}>Clear</button>}</form><Resource resource={resource}>{result => result.items.length ? <><section className="panel table-wrap"><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>{result.items.map(item => <tr key={item.id}><td>{date(item.timestamp)}</td><td>{item.userName || 'Unknown user'}<small className="identifier">{item.userId}</small></td><td>{item.action}</td><td className="admin-log-details">{item.details || '—'}</td></tr>)}</tbody></table></section><nav className="admin-pagination" aria-label="Log pages"><button disabled={result.page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {result.page} of {adminLogPages(result)} · {result.total} records</span><button disabled={result.page >= adminLogPages(result)} onClick={() => setPage(value => value + 1)}>Next</button></nav></> : <Empty title="No matching log records">Change the filters or try again later.</Empty>}</Resource></>;
}
