import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HistoryChart } from './charts';
import { investorPaths, type FinanceStats } from './investor-contracts';
import { applicationsPath, type Application } from './activity-contracts';
import { PropertyPhoto } from './media';
import { money, date } from './format';
import { Empty, Heading, Metric, Resource, useResource } from './ui';
import type { Holding, Session, Totals, ShareOffer } from './types';

const quantity = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
const percent = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : '—';
export function InvestorDashboard({ session }: { session: Session }) {
  const totals = useResource<Totals>(`/users/${encodeURIComponent(session.user.id)}/total-assets`);
  return <><Heading title={`Welcome${session.user.fullName ? `, ${session.user.fullName}` : ' back'}`} description="Your assets, property holdings and investment requests."><button onClick={() => window.dispatchEvent(new Event('financial-data-changed'))}>Refresh overview</button></Heading>
    <Resource resource={totals}>{data => <><div className="metrics investor-metrics"><Metric label="Total assets" value={money(data.totalAssets)}/><Metric label="Wallet balance" value={money(data.walletBalance)}/><Metric label="Investment value" value={money(data.investmentValue)}/><Metric label="Monthly rent · estimated" value={money(data.rentalIncome)}/><Metric label="Pending applications · value" value={money(data.pendingApplicationsValue)}/><Metric label="On the marketplace · value" value={money(data.marketValue)}/></div><p className="note">Total assets uses the API valuation: wallet, investments, pending applications and listed shares. Monthly rent is theoretical income from current holdings, not received payouts.</p></>}</Resource>
    <nav className="actions" aria-label="Investor overview"><Link to="/investments">Open portfolio →</Link><Link to="/finance">Wallet & asset history</Link><Link to="/rental-income">Received rental payouts</Link><Link to="/transactions">Transactions</Link><Link to="/properties">Explore properties</Link><Link to="/marketplace">Browse marketplace</Link><Link to="/profile">Your profile</Link></nav>
    <AccountHistory session={session}/><Holdings session={session} compact/><PortfolioApplications session={session} pendingOnly/><DashboardListings/>
  </>;
}
export function PortfolioOverview({ session }: { session: Session }) {
 return <><ReceivedRent session={session}/><Holdings session={session}/><PortfolioApplications session={session}/></>;
}
function Holdings({ session, compact = false }: { session: Session; compact?: boolean }) {
 const resource = useResource<Holding[]>(`/investments/with-aggregated/${encodeURIComponent(session.user.id)}`);
 const [search, setSearch] = useState('');
 return <section className="panel"><div className="section-heading"><div><h2>Your property holdings</h2><p className="muted">Confirmed holdings and shares listed on the marketplace, as reported by the API.</p></div>{compact && <Link to="/investments">Full portfolio →</Link>}</div><Resource resource={resource}>{data => {
 const rows = data.filter(row => `${row.propertyTitle} ${row.propertyId}`.toLowerCase().includes(search.trim().toLowerCase()));
 return <>{!compact && <label className="portfolio-search">Find a property<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Property name or ID"/></label>}<p className="muted" aria-live="polite">{rows.length} of {data.length} properties with confirmed holdings</p>{rows.length ? <div className="portfolio-grid">{rows.map(row => <article className="portfolio-holding" key={row.propertyId}><div className="property-cell"><PropertyPhoto id={row.propertyId} title={row.propertyTitle} compact/><h3><Link to={`/properties/${encodeURIComponent(row.propertyId)}`}>{row.propertyTitle || row.propertyId}</Link></h3></div><dl><dt>Confirmed shares</dt><dd>{quantity(row.confirmedShares)}</dd><dt>Listed shares</dt><dd>{quantity(row.marketShares)}</dd><dt>Invested in holdings</dt><dd>{money(row.totalInvested)}</dd><dt>Monthly rent · estimated</dt><dd>{money(row.monthlyRentalIncome)}</dd>{!compact && <><dt>Combined share value*</dt><dd>{money(row.totalShareValue)}</dd><dt>Ownership · API estimate</dt><dd>{percent(row.ownershipPercent)}</dd><dt>Pending applications for holding</dt><dd>{quantity(row.confirmedApplications)}</dd></>}</dl>{!compact && <nav className="actions"><Link to={`/applications?propertyId=${encodeURIComponent(row.propertyId)}`}>Applications →</Link><Link to={`/properties/${encodeURIComponent(row.propertyId)}/payment-plans`}>Payment plan →</Link></nav>}</article>)}</div> : <Empty title={data.length ? 'No matching holdings' : 'No confirmed property holdings yet'}>{data.length ? 'Try another property name or ID.' : <>Pending-only properties appear in applications below. <Link to="/properties">Explore properties →</Link></>}</Empty>}{!compact && <p className="muted">*Combined share value includes pending shares for these properties. Ownership is the API ratio of invested amount to property price. Listed shares are reported separately; these figures should not be added together. Monthly rent is theoretical, not a payout.</p>}</>;
 }}</Resource></section>;
}
function PortfolioApplications({ session, pendingOnly = false }: { session: Session; pendingOnly?: boolean }) {
 const resource = useResource<Application[]>(applicationsPath(session.user.id));
 const [status, setStatus] = useState('');
 return <section className="panel"><div className="section-heading"><div><h2>{pendingOnly ? 'Pending investment requests' : 'Portfolio applications'}</h2><p className="muted">Includes properties without confirmed holdings. Statuses come from your application records.</p></div><Link to="/applications">All applications →</Link></div><Resource resource={resource}>{data => {
 const rows = data.filter(a => pendingOnly ? a.status?.toLowerCase() === 'pending' : !status || (a.status ?? '') === status).sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
 return <>{!pendingOnly && <label className="portfolio-search">Application status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{[...new Set(data.map(a => a.status).filter((s): s is string => !!s))].map(s => <option key={s}>{s}</option>)}</select></label>}<p className="muted" aria-live="polite">{rows.length} {pendingOnly ? 'pending requests' : 'applications'}</p>{rows.length ? rows.map(a => <article className="history-row portfolio-application" key={a.id}><div><h3><Link to={`/properties/${encodeURIComponent(a.propertyId)}`}>{a.propertyTitle || a.propertyId}</Link></h3><span className="muted">Requested: {quantity(a.requestedShares)} shares · {money(a.requestedAmount)}</span><small>{date(a.createdAt)}</small></div><span className="tag neutral">{a.status || 'Status unavailable'}</span></article>) : <Empty title={pendingOnly ? 'No pending investment requests' : 'No matching applications'}/>}</>;
 }}</Resource></section>;
}

function AccountHistory({ session }: { session: Session }) {
 const history = useResource<FinanceStats>(investorPaths(session).finance);
 return <Resource resource={history}>{data => <><section className="panel"><Metric label="Rental income received to date" value={money(data.rentalIncome)}/><Link to="/rental-income">View rental payouts</Link></section><HistoryChart title="Account activity history" points={data.combinedHistory} description="Recorded account activity from the API. This series includes deposits, purchases, sales, withdrawals and rental income; it is not a historical property valuation or investment return."/></>}</Resource>;
}
function ReceivedRent({ session }: { session: Session }) {
 const history = useResource<FinanceStats>(investorPaths(session).finance);
 return <Resource resource={history}>{data => <section className="panel"><Metric label="Rental income received to date · account" value={money(data.rentalIncome)}/><p className="muted">Account-wide recorded rental income. A received payout breakdown by property is not supplied by this summary.</p><Link to="/rental-income">Rental payout history</Link></section>}</Resource>;
}

function DashboardListings() {
  const offers = useResource<ShareOffer[]>('/share-offers/active');
  return <section className="panel"><div className="section-heading"><h2>Active listings</h2><Link to="/marketplace">Browse marketplace →</Link></div><Resource resource={offers}>{data => {
    const active = data.filter(o => o.isActive && Date.parse(o.expirationDate) > Date.now()).slice(0,4);
    return active.length ? <div className="listing-grid">{active.map(o => <article className="listing-preview" key={o.id}><div className="property-cell"><PropertyPhoto id={o.propertyId} title={o.propertyTitle || 'Property'} compact/><h3><Link to={`/properties/${encodeURIComponent(o.propertyId)}`}>{o.propertyTitle || 'View property'}</Link></h3></div><p>{o.sharesForSale} shares · {money(o.startPricePerShare)} / share</p><Link to={`/marketplace/${encodeURIComponent(o.id)}/bids`}>View listing →</Link></article>)}</div> : <p className="muted">No active listings available.</p>;
  }}</Resource></section>;
}
