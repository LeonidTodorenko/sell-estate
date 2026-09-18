import { RegisterPage, RecoveryPage, VerificationPage } from './onboarding-pages';
import { PaymentPlanPage } from './payment-plan-page';
import { Component, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getSession, signIn, signOut, subscribeSession } from './api';
import { Dashboard, Investments, Marketplace, Profile, Properties, PropertyDetails, Transactions } from './pages';
import { Kyc, Finance, RentalIncome, MonthlyReports, Inbox } from './investor-pages';
import type { Session } from './types';
import { Applications, TradeHistory, OfferBids, SellShares, EditProfile, ChangePassword, LegalPage } from './activity-pages';
import { MyProperties, Club, Referrals, Withdrawals, MoneyInfo, Chat, About } from './community-pages';
import { useResource } from './ui';
import { communityPaths } from './community-contracts';
import './style.css';

function Brand() { return <Link className="brand" to="/" aria-label="OwnersClub home"><span className="brand-symbol">O</span>OwnersClub<span className="brand-dot">.</span></Link>; }
function Landing() {
  const session = useSyncExternalStore(subscribeSession, getSession);
  return <div className="public-page"><header className="public-nav"><Brand/><Link className="button" to={session ? '/dashboard' : '/login'}>{session ? 'Open dashboard' : 'Log in'}</Link></header><main className="landing"><span className="eyebrow">OWNERSCLUB · INVESTOR PORTAL</span><h1>Your property portfolio.<br/><span>One clear view.</span></h1><p>Explore properties, follow your investments and keep track of your account activity with OwnersClub.</p><div className="actions"><Link className="button" to={session ? '/dashboard' : '/login'}>{session ? 'Open dashboard' : 'Access your account'} →</Link>{!session && <Link className="button secondary" to="/login?demo=1">Explore demo</Link>}{!session && <Link className="button secondary" to="/register">Create account</Link>}</div><div className="landing-features"><section><span>01</span><h2>Discover properties</h2><p>View the collection, available shares and property details.</p></section><section><span>02</span><h2>Follow your portfolio</h2><p>See your holdings, investment records and account balance.</p></section><section><span>03</span><h2>Stay informed</h2><p>Browse marketplace offers and review your transactions.</p></section></div></main><footer>OwnersClub · Property investing<nav className="legal-links"><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/support">Support</Link></nav></footer></div>;
}
function Login() {
  const location = useLocation(), navigate = useNavigate();
  const session = useSyncExternalStore(subscribeSession, getSession);
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const next = typeof location.state?.from === 'string' && /^\/(dashboard|properties|investments|marketplace|transactions|profile|kyc|finance|rental-income|monthly-reports|inbox|applications|trade-history|sell-shares|my-properties|club|referrals|withdrawals|top-up|withdraw|chat)(\/|$)/.test(location.state.from) ? location.state.from : '/dashboard';
  if (session) return <Navigate to={next} replace/>;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError(''); setBusy(true);
    try { await signIn(email, password); navigate(next, { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  return <div className="public-page"><header className="public-nav"><Brand/><Link to="/">Back to home</Link></header><main className="login-wrap"><section className="login-intro"><span className="eyebrow">YOUR OWNERSCLUB ACCOUNT</span><h1>{demo ? 'Explore with confidence.' : 'Welcome back.'}</h1><p>{demo ? 'Use the demo account credentials provided to you. Demo activity uses virtual funds.' : 'Sign in to view your properties, investments and account activity.'}</p></section><form className="panel login-form" onSubmit={submit}><h2>{demo ? 'Demo sign-in' : 'Log in'}</h2>{demo && <div className="demo-banner">Demo status is determined by your account.</div>}{location.state?.message && <p role="status">{location.state.message}</p>}{error && <p className="error" role="alert">{error}</p>}<label>Email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label><button className="button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><p className="muted">Use the same credentials as your mobile app.</p><Link to="/forgot-password">Forgot password?</Link><Link to="/register">Create a regular account</Link><Link to={demo ? '/login' : '/login?demo=1'}>{demo ? 'Use a regular account' : 'Have a demo account?'}</Link></form></main></div>;
}
const navigation = [['/dashboard', 'Overview'], ['/properties', 'Properties'], ['/investments', 'My investments'], ['/applications', 'Applications'], ['/marketplace', 'Marketplace'], ['/transactions', 'Transactions'], ['/finance', 'My Finance'], ['/rental-income', 'Rental Income'], ['/kyc', 'Identity Verification'], ['/monthly-reports', 'Monthly Reports'], ['/inbox', 'Inbox'], ['/profile', 'Profile']];
function UnreadIndicator({session}:{session:Session}) {
 const resource=useResource<{count:number}>(communityPaths(session.user.id).unread);
 const count=resource.data?.count;
 return <Link to="/inbox" title={resource.error?'Unread count unavailable':undefined}>Inbox{typeof count==='number' && Number.isFinite(count) && count>0 ? ` (${Math.floor(count)})` : ''}</Link>;
}
function Shell({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null), menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !sidebarRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    const desktop = window.matchMedia('(min-width: 761px)');
    const resize = () => { if (desktop.matches) setMenuOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      desktop.removeEventListener('change', resize);
    };
  }, [menuOpen]);
  async function logout() { setLoggingOut(true); const message = await signOut(); navigate('/login', { replace: true, state: { message } }); }
  return <div className="app-shell"><aside ref={sidebarRef} className={`sidebar${menuOpen ? ' menu-open' : ''}`}><div className="sidebar-heading"><Brand/><button ref={menuButtonRef} className="menu-toggle" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(open => !open)}><span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>Menu</button></div><div id="mobile-navigation" className="navigation-content"><div className="workspace-label">INVESTOR WORKSPACE</div><nav aria-label="Main navigation">{navigation.filter(([to]) => to !== '/monthly-reports' || session.isDemo).map(([to, label]) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}</nav><div className="sidebar-bottom"><span className="muted">{session.user.email || 'OwnersClub member'}</span><button onClick={logout} disabled={loggingOut}>Sign out</button></div></div></aside><div className="workspace"><header className="topbar"><span>Investor portal</span><UnreadIndicator key={`${session.user.id}-${session.isDemo}-${location.pathname}`} session={session}/><Link to="/profile">{session.user.fullName || session.user.email || 'Your account'}</Link></header>{session.isDemo && <div className="demo-banner" role="status"><strong>Demo mode</strong> · Virtual funds and simulated transactions{session.demoCode && ` · ${session.demoCode}`}</div>}<main id="main-content" className="main-content"><Outlet/></main><footer>OwnersClub · All amounts in USD<nav className="legal-links" aria-label="Legal and support"><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/support">Support</Link></nav></footer></div></div>;
}
function Gate() {
  const session = useSyncExternalStore(subscribeSession, getSession), location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname, message: 'Please sign in to continue.' }}/>;
  return <Shell session={session}/>;
}
function AccountPage({ page }: { page: 'dashboard' | 'investments' | 'marketplace' | 'transactions' | 'profile' | 'kyc' | 'finance' | 'rental-income' | 'monthly-reports' | 'inbox' | 'applications' | 'trade-history' | 'bids' | 'sell-shares' | 'edit-profile' | 'change-password' | 'my-properties' | 'club' | 'referrals' | 'withdrawals' | 'top-up' | 'withdraw' | 'chat' }) {
  const session = useSyncExternalStore(subscribeSession, getSession);
  if (!session) return null;
  const Component = { dashboard: Dashboard, investments: Investments, marketplace: Marketplace, transactions: Transactions, profile: Profile, kyc: Kyc, finance: Finance, 'rental-income': RentalIncome, 'monthly-reports': MonthlyReports, inbox: Inbox, applications: Applications, 'trade-history': TradeHistory, bids: OfferBids, 'sell-shares': SellShares, 'edit-profile': EditProfile, 'change-password': ChangePassword, 'my-properties': MyProperties, club: Club, referrals: Referrals, withdrawals: Withdrawals, 'top-up': MoneyInfo, withdraw: ({session}:{session:Session}) => <MoneyInfo session={session} withdraw/>, chat: Chat }[page];
  return <Component key={`${session.user.id}-${session.isDemo}`} session={session}/>;
}
function App() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); document.title = `${navigation.find(([path]) => location.pathname.startsWith(path))?.[1] || 'Investor portal'} · OwnersClub`; }, [location.pathname]);
  return <><a className="skip-link" href="#main-content">Skip to content</a><Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<RegisterPage/>}/><Route path="/forgot-password" element={<RecoveryPage/>}/><Route path="/reset-password" element={<RecoveryPage reset/>}/><Route path="/newpassword.html" element={<RecoveryPage reset/>}/><Route path="/verify-email" element={<VerificationPage/>}/><Route path="/users/confirm-email" element={<VerificationPage/>}/><Route element={<Gate/>}><Route path="/properties/:id/payment-plans" element={<PaymentPlanPage/>}/><Route path="/dashboard" element={<AccountPage page="dashboard"/>}/><Route path="/properties" element={<Properties/>}/><Route path="/properties/:id" element={<PropertyDetails/>}/><Route path="/investments" element={<AccountPage page="investments"/>}/><Route path="/marketplace" element={<AccountPage page="marketplace"/>}/><Route path="/transactions" element={<AccountPage page="transactions"/>}/><Route path="/profile" element={<AccountPage page="profile"/>}/><Route path="/kyc" element={<AccountPage page="kyc"/>}/><Route path="/finance" element={<AccountPage page="finance"/>}/><Route path="/rental-income" element={<AccountPage page="rental-income"/>}/><Route path="/monthly-reports" element={<AccountPage page="monthly-reports"/>}/><Route path="/inbox" element={<AccountPage page="inbox"/>}/><Route path="/applications" element={<AccountPage page="applications"/>}/><Route path="/trade-history" element={<AccountPage page="trade-history"/>}/><Route path="/marketplace/:offerId/bids" element={<AccountPage page="bids"/>}/><Route path="/sell-shares" element={<AccountPage page="sell-shares"/>}/><Route path="/profile/edit" element={<AccountPage page="edit-profile"/>}/><Route path="/profile/change-password" element={<AccountPage page="change-password"/>}/><Route path="/my-properties" element={<AccountPage page="my-properties"/>}/><Route path="/club" element={<AccountPage page="club"/>}/><Route path="/referrals" element={<AccountPage page="referrals"/>}/><Route path="/withdrawals" element={<AccountPage page="withdrawals"/>}/><Route path="/top-up" element={<AccountPage page="top-up"/>}/><Route path="/withdraw" element={<AccountPage page="withdraw"/>}/><Route path="/chat" element={<AccountPage page="chat"/>}/></Route><Route path="/about" element={<main id="main-content" className="main-content"><About/></main>}/><Route path="/privacy" element={<div className="public-page"><header className="public-nav"><Brand/><Link to="/profile">Your account</Link></header><main id="main-content" className="main-content"><LegalPage kind="privacy"/></main></div>}/><Route path="/terms" element={<div className="public-page"><header className="public-nav"><Brand/><Link to="/profile">Your account</Link></header><main id="main-content" className="main-content"><LegalPage kind="terms"/></main></div>}/><Route path="/support" element={<div className="public-page"><header className="public-nav"><Brand/><Link to="/profile">Your account</Link></header><main id="main-content" className="main-content"><LegalPage kind="support"/></main></div>}/><Route path="*" element={<main className="state"><h1>Page not found</h1><Link to="/">Return home</Link></main>}/></Routes></>;
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="state" role="alert"><h1>Unable to display this page</h1><p>The server may have returned an unexpected response. Please reload and try again.</p><button onClick={() => window.location.reload()}>Reload page</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><BrowserRouter><App/></BrowserRouter></ErrorBoundary>);

