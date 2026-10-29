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
import { InvestmentRecords } from './admin-properties';
import { UserActions, UserKyc } from './admin-actions';

const role = (user: AdminUserSummary) => user.userRoleText || `Role ${user.userRole}`;
const status = (value: boolean, yes: string, no: string) => <span className={`tag ${value ? '' : no === 'Blocked' ? 'status-danger' : no === 'Unconfirmed' ? 'status-warning' : 'neutral'}`}>{value ? yes : no}</span>;

export function AdminOverview() {
  const resource = useResource<AdminStats>('/admin/stats');
  return <><Heading title="Admin overview" description="Read-only operational totals from the protected admin API."/><Resource resource={resource}>{data => <div className="metrics admin-metrics"><Metric label="Investors" value={data.investors}/><Metric label="Invested amount" value={money(data.totalInvestments)}/><Metric label="Properties" value={data.totalProperties}/><Metric label="Rental income" value={money(data.totalRentalIncome)}/><Metric label="Pending withdrawals" value={data.pendingWithdrawals}/><Metric label="Pending KYC" value={data.pendingKyc}/></div>}</Resource></>;
}

export function AdminUsers() {
  const [draft, setDraft] = useState(''), [query, setQuery] = useState('');
  const resource = useResource<AdminUserSummary[]>(adminUsersPath(query));
  function submit(event: FormEvent) { event.preventDefault(); setQuery(draft.trim()); }
  return <><Heading title="Users" description="Search accounts and open a profile to manage roles, access and KYC."/><form className="filters panel admin-filter" onSubmit={submit}><label className="search">Name or email<input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Search users"/></label><button className="button">Search</button>{query && <button type="button" onClick={() => { setDraft(''); setQuery(''); }}>Clear</button>}</form><Resource resource={resource}>{users => users.length ? <section className="panel table-wrap"><table role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader">User</th><th role="columnheader">Role</th><th role="columnheader">Email status</th><th role="columnheader">Account</th><th role="columnheader">Created</th></tr></thead><tbody role="rowgroup">{users.map(user => <tr role="row" key={user.id}><td role="cell" data-label="User"><Link to={`/admin/users/${encodeURIComponent(user.id)}`}>{user.fullName || 'Unnamed user'}</Link><small>{user.email}</small></td><td role="cell" data-label="Role">{role(user)}</td><td role="cell" data-label="Email status">{status(user.isEmailConfirmed, 'Confirmed', 'Unconfirmed')}</td><td role="cell" data-label="Account">{status(!user.isBlocked, 'Active', 'Blocked')}</td><td role="cell" data-label="Created">{date(user.createdAt)}</td></tr>)}</tbody></table></section> : <Empty title={query ? 'No matching users' : 'No users available'}>Try a different name or email.</Empty>}</Resource></>;
}

export function AdminUser() {
  const { id = '' } = useParams();
  const resource = useResource<AdminUserDetails>(adminUserPath(id));
  return <><Link className="back-link" to="/admin/users">← Back to users</Link><Heading title="User details" description="Safe account metadata returned by the current admin API."/><Resource resource={resource}>{user => <><section className="panel admin-details"><h2>{user.fullName || 'Unnamed user'}</h2><p className="muted">{user.email}</p><dl><dt>User ID</dt><dd className="identifier">{user.id}</dd><dt>Role</dt><dd>{role(user)}</dd><dt>Account</dt><dd>{user.isBlocked ? 'Blocked' : 'Active'}</dd><dt>Email</dt><dd>{user.isEmailConfirmed ? 'Confirmed' : 'Unconfirmed'}</dd><dt>Created</dt><dd>{date(user.createdAt)}</dd><dt>Permissions</dt><dd>{user.permissionsText.length ? user.permissionsText.join(', ') : `None (${user.permissions})`}</dd></dl></section><UserActions key={`${user.id}-${user.userRole}-${user.isBlocked}`} user={user} reload={resource.retry}/><UserKyc key={user.id} id={user.id}/></>}</Resource></>;
}

export function AdminInvestments() {
  const resource = useResource<AdminInvestment[]>('/admin/investments');
  return <><Heading title="Investments" description="Recorded investments and share purchases."/><Link to="/admin/applications">Review investment applications →</Link><Resource resource={resource}>{items => <InvestmentRecords items={items}/>}</Resource></>;
}

export function AdminDemoAccounts() {
  const resource = useResource<AdminDemoAccount[]>('/admin/demo-accounts');
  return <><Heading title="Demo accounts" description="Read-only sandbox account status. Create, reset and activation controls are unavailable."/><Resource resource={resource}>{items => items.length ? <section className="panel table-wrap"><table role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader">Account</th><th role="columnheader">Code</th><th role="columnheader">Balance</th><th role="columnheader">Status</th><th role="columnheader">Last active</th><th role="columnheader">Expires</th></tr></thead><tbody role="rowgroup">{items.map(item => <tr role="row" key={item.id}><td role="cell" data-label="Account">{item.fullName || 'Unnamed demo'}<small>{item.email}</small></td><td role="cell" data-label="Code">{item.demoCode || '—'}{item.isTemplate && <small>Template</small>}</td><td role="cell" data-label="Balance">{money(item.walletBalance)}</td><td role="cell" data-label="Status">{status(item.isActive, 'Active', 'Inactive')}</td><td role="cell" data-label="Last active">{date(item.lastActiveAt)}</td><td role="cell" data-label="Expires">{date(item.expiresAt)}</td></tr>)}</tbody></table></section> : <Empty title="No demo accounts available"/>}</Resource></>;
}

export function AdminLogs() {
  const [draftAction, setDraftAction] = useState(''), [draftUser, setDraftUser] = useState('');
  const [filters, setFilters] = useState({ action: '', userName: '' }), [page, setPage] = useState(1);
  const resource = useResource<AdminLogPage>(adminLogsPath(filters.action, filters.userName, page));
  function submit(event: FormEvent) { event.preventDefault(); setFilters({ action: draftAction.trim(), userName: draftUser.trim() }); setPage(1); }
  return <><Heading title="Action logs" description="Server-filtered audit records with read-only pagination."/><form className="filters panel admin-filter" onSubmit={submit}><label>Action<input value={draftAction} onChange={event => setDraftAction(event.target.value)} placeholder="Action contains"/></label><label>User name<input value={draftUser} onChange={event => setDraftUser(event.target.value)} placeholder="User contains"/></label><button className="button">Apply filters</button>{(filters.action || filters.userName) && <button type="button" onClick={() => { setDraftAction(''); setDraftUser(''); setFilters({ action: '', userName: '' }); setPage(1); }}>Clear</button>}</form><Resource resource={resource}>{result => result.items.length ? <><section className="panel table-wrap"><table role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader">Time</th><th role="columnheader">User</th><th role="columnheader">Action</th><th role="columnheader">Details</th></tr></thead><tbody role="rowgroup">{result.items.map(item => <tr role="row" key={item.id}><td role="cell" data-label="Time">{date(item.timestamp)}</td><td role="cell" data-label="User">{item.userName || 'Unknown user'}<small className="identifier">{item.userId}</small></td><td role="cell" data-label="Action">{item.action}</td><td role="cell" data-label="Details" className="admin-log-details">{item.details || '—'}</td></tr>)}</tbody></table></section><nav className="admin-pagination" aria-label="Log pages"><button disabled={result.page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {result.page} of {adminLogPages(result)} · {result.total} records</span><button disabled={result.page >= adminLogPages(result)} onClick={() => setPage(value => value + 1)}>Next</button></nav></> : <Empty title="No matching log records">Change the filters or try again later.</Empty>}</Resource></>;
}
