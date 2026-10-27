import React, { useEffect, useState } from 'react';

import { createRoot } from 'react-dom/client';
import {
  Activity, Moon, Sun, ArrowRight, ArrowUpRight, BadgePercent, Bell, CheckCircle2,
  ChevronRight, CircleAlert, CircleHelp, Clock3, CreditCard, Eye,
  Gift, Headphones, Home, LayoutDashboard, Link2, LockKeyhole, LogOut,
  Menu, MessageCircle, PlayCircle, Plus, Settings2, ShieldCheck, Sparkles,
  Wallet, X, Zap, UserRound, ChartNoAxesCombined, Mail, Globe2, Smartphone
} from 'lucide-react';
import './styles.css';
import './update.css';
import './dark-mode.css';
import { apiRequest, clearAccessToken, formatDateTime, formatINRFromPaise, getAccessToken, readApiConfig } from './adsplus-api.js';
import { getAdditionalUserInfo, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';

const NAV = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'earnings', label: 'Earnings', icon: ChartNoAxesCombined },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'coupons', label: 'Refer & Earn', icon: BadgePercent },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

function App() {
  const [page, setPage] = useState('home');
  const [darkMode, setDarkMode] = useState(() => { try { return window.localStorage.getItem('adsplus.theme') === 'dark'; } catch { return false; } });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [backendState, setBackendState] = useState({ status: 'checking', message: 'Checking Ads+ account services.' });
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3600);
  };
  const navigate = (target) => {
    setPage(target);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const refreshData = () => setRefreshKey((v) => v + 1);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    }, (error) => {
      console.error('Firebase auth state error:', error);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.dataset.adsplusTheme = theme;
    try { window.localStorage.setItem('adsplus.theme', theme); } catch { /* local storage may be disabled */ }
  }, [darkMode]);

  useEffect(() => {
    let active = true;
    (async () => {
      setBackendState({ status: 'checking', message: 'Checking the configured Ads+ service.' });
      const config = await readApiConfig(true);
      if (!active) return;
      if (!config.apiBaseUrl) {
        setDashboard(null);
        setBackendState({ status: 'not_configured', message: 'No backend URL is configured. Real account data cannot load until Ads+ server services are deployed and connected.' });
        return;
      }
      if (!getAccessToken()) {
        setDashboard(null);
        setBackendState({ status: 'signed_out', message: 'Backend URL is set. Connect your email account to request live, server-verified data.' });
        return;
      }
      try {
        const payload = await apiRequest('/api/v1/me/dashboard');
        if (!active) return;
        setDashboard(payload?.dashboard || payload);
        setBackendState({ status: 'connected', message: 'Account connected. Values below are loaded from the configured Ads+ backend.' });
      } catch (error) {
        if (!active) return;
        setDashboard(null);
        const unauthorised = !getAccessToken();
        setBackendState({
          status: unauthorised ? 'signed_out' : 'error',
          message: error?.message || 'Could not load the live Ads+ dashboard.',
        });
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const connectAccount = async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const additionalInfo = getAdditionalUserInfo(credential);
      console.info('Ads+ Google sign-in completed.', {
        isNewUser: additionalInfo?.isNewUser === true
      });
      notify('Google sign-in successful. Backend data still requires server authentication.');
    } catch (error) {
      console.error('Google sign-in failed:', error);
      notify(error?.code === 'auth/unauthorized-domain'
        ? 'This website domain is not authorized in Firebase Authentication.'
        : error?.code === 'auth/popup-blocked'
          ? 'The sign-in popup was blocked. Allow popups and try again.'
          : error?.message || 'Google sign-in failed. Please try again.');
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      clearAccessToken();
      setDashboard(null);
      setBackendState({ status: 'signed_out', message: 'Google account signed out. Backend account data is not connected.' });
      notify('Google account signed out.');
    } catch (error) {
      notify(error?.message || 'Could not sign out.');
    }
  };

  const redeemCreatorCode = async (code) => {
    const result = await apiRequest('/api/v1/coupons/redeem', { method: 'POST', body: { code } });
    notify(result?.message || 'The server has processed the creator-code request.');
    refreshData();
    return result;
  };

  const requestWithdrawal = async ({ amount, upiId }) => {
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) throw new Error('Enter a valid withdrawal amount greater than zero.');
    if (!upiId || !upiId.trim()) throw new Error('Enter the payout destination requested by Ads+.');
    const result = await apiRequest('/api/v1/withdrawals', {
      method: 'POST',
      body: { amount_paise: Math.round(rupees * 100), method: 'upi', destination: upiId.trim() },
    });
    refreshData();
    return result;
  };

  const profile = dashboard?.user || dashboard?.profile || {};
  const statusLabel = ({ checking: 'CHECKING', not_configured: 'BACKEND NEEDED', signed_out: 'SIGN IN REQUIRED', connected: 'LIVE ACCOUNT', error: 'CONNECTION ERROR' })[backendState.status] || 'ACCOUNT STATUS';
  return <div className={`app-shell ${darkMode ? 'theme-dark' : 'theme-light'}`}>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('home')} aria-label="Ads+ home">
        <span className="brand-mark adsplus-brand-mark"><img className="adsplus-logo-image adsplus-logo-light" src="/logo-black.png" alt="Ads+ logo" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('logo-missing'); }} /><img className="adsplus-logo-image adsplus-logo-dark" src="/logo-white.png" alt="" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('logo-missing'); }} /><span className="brand-logo-fallback">A<span>+</span></span></span>
        <span className="brand-copy"><strong>Ads<span>+</span></strong><small>REWARDS, REIMAGINED</small></span>
      </button>
      <div className="sidebar-caption">YOUR WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{NAV.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} className={`nav-item ${page === item.id ? 'selected' : ''}`} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span>{page === item.id && <span className="nav-dot" />}</button>;
      })}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-help"><div className="help-orb"><Headphones size={19} /></div><strong>Need a hand?</strong><p>Find answers about your account and rewards.</p><button className="text-link" onClick={() => navigate('help')}>Visit help centre <ArrowRight size={14} /></button></div>
      <div className="side-user"><div className="avatar">{String(authUser?.displayName || profile.display_name || profile.name || 'A').slice(0,1).toUpperCase()}</div><div className="side-user-copy"><strong>{authUser?.displayName || profile.display_name || profile.name || 'Ads+ account'}</strong><small>{profile.email || (backendState.status === 'connected' ? 'Connected' : 'Not connected')}</small></div><button className="icon-quiet" onClick={() => navigate('profile')} aria-label="Open profile"><ChevronRight size={16} /></button></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-quiet" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{pageLabel(page)}</strong></div></div><div className="topbar-actions"><button type="button" className={`theme-toggle ${darkMode ? 'is-dark' : 'is-light'}`} role="switch" aria-checked={darkMode} aria-label={darkMode ? 'Turn dark mode off' : 'Turn dark mode on'} title={darkMode ? 'Dark mode: on' : 'Dark mode: off'} onClick={() => setDarkMode((value) => !value)}><span className="theme-toggle-icon">{darkMode ? <Sun size={17} /> : <Moon size={17} />}</span><span className="theme-toggle-label">Dark mode</span><span className="theme-switch-track"><span className="theme-switch-thumb" /></span></button><button className="notification-btn icon-quiet" aria-label="Refresh live account data" onClick={refreshData}><Activity size={18} /></button><button className="top-avatar" onClick={() => navigate('profile')} aria-label="Your profile">{String(profile.display_name || profile.name || 'A').slice(0,1).toUpperCase()}</button></div></header>
      <main className="page-content">
        {page === 'home' && <HomePage navigate={navigate} dashboard={dashboard} backendState={backendState} />}
        {page === 'earnings' && <EarningsPage navigate={navigate} dashboard={dashboard} backendState={backendState} />}
        {page === 'wallet' && <WalletPage notify={notify} dashboard={dashboard} backendState={backendState} onWithdraw={requestWithdrawal} />}
        {page === 'coupons' && <CouponsPage notify={notify} dashboard={dashboard} backendState={backendState} onRedeem={redeemCreatorCode} />}
        {page === 'profile' && <ProfilePage navigate={navigate} notify={notify} dashboard={dashboard} backendState={backendState} authUser={authUser} authLoading={authLoading} onConnect={connectAccount} onSignOut={signOut} />}
        {page === 'help' && <HelpPage notify={notify} />}
      </main>
      <footer className="page-footer"><span>© 2026 Ads+</span><span className="footer-dot">·</span><button onClick={() => navigate('help')}>Help centre</button><span className="footer-spacer" /><span className="footer-lock"><LockKeyhole size={12} /> {backendState.status === 'connected' ? 'Live account connected' : 'Live account not connected'}</span></footer>
    </div>
    <nav className="mobile-tabbar" aria-label="Mobile navigation">{NAV.map((item) => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'current' : ''} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.id === 'coupons' ? 'Codes' : item.label}</span></button>; })}</nav>
    {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}

function pageLabel(page) { return ({ home: 'Overview', earnings: 'Earnings', wallet: 'Wallet', coupons: 'Refer & Earn', profile: 'Profile', help: 'Help centre' })[page] || 'Overview'; }
function PageHeading({ eyebrow, title, subtitle, action }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>; }
function SetupNotice({ title = 'Connect your Ads+ account', children, action }) { return <section className="notice-strip"><span className="notice-icon"><ShieldCheck size={19} /></span><div><strong>{title}</strong><p>{children}</p>{action && <div className="setup-action">{action}</div>}</div></section>; }

function ActivityList({ items, emptyTitle, emptyText }) {
  if (!Array.isArray(items) || items.length === 0) return <div className="empty-state"><Activity size={22} /><strong>{emptyTitle}</strong><span>{emptyText}</span></div>;
  return <div className="activity-list">{items.map((item, index) => <div className="activity-row" key={item.id || `${item.created_at || 'event'}-${index}`}><span className="activity-icon"><Activity size={16} /></span><div className="activity-copy"><strong>{item.label || item.description || item.type || 'Verified Ads+ activity'}</strong><small>{formatDateTime(item.created_at || item.createdAt)}</small></div><strong className="activity-amount">{formatINRFromPaise(item.amount_paise)}</strong></div>)}</div>;
}
function countLabel(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat('en-IN').format(Number(value)); }

function HomePage({ navigate, dashboard, backendState }) {
  const connected = backendState.status === 'connected' && Boolean(dashboard);
  const wallet = dashboard?.wallet || {};
  const metrics = dashboard?.metrics || {};
  const activity = Array.isArray(dashboard?.recent_activity) ? dashboard.recent_activity : [];
  const modes = dashboard?.services?.reward_modes || {};
  return <>
    <PageHeading eyebrow="YOUR ADS+ WORKSPACE" title="Welcome to Ads+." subtitle={connected ? 'Your latest account data is loaded from the Ads+ server.' : 'Connect the real Ads+ backend and account to load verified rewards.'} action={<span className="profile-status"><span className={`status-point ${connected ? 'status-point-on' : ''}`} /> {connected ? 'Account connected' : backendState.status === 'error' ? 'Connection error' : 'Setup required'}</span>} />
    <div className="hero-grid">
      <section className="wallet-hero"><div className="wallet-hero-top"><span className="hero-kicker"><Wallet size={15} /> AVAILABLE BALANCE</span><Eye size={17} /></div><div className="hero-amount">{formatINRFromPaise(connected ? wallet.available_paise : undefined)}</div><div className="hero-under">{connected ? 'Server-reported available balance' : 'No live balance until account connection'}</div><div className="hero-rule" /><div className="hero-bottom"><div><small>Total earned</small><strong>{formatINRFromPaise(connected ? wallet.total_earned_paise : undefined)}</strong></div><div><small>Pending rewards</small><strong>{formatINRFromPaise(connected ? wallet.pending_paise : undefined)}</strong></div><button className="hero-button" onClick={() => navigate('wallet')}>Wallet <ArrowUpRight size={16} /></button></div><div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" /></section>
      <section className="daily-card card-surface"><div className="section-kicker"><span className="kicker-icon lavender-icon"><Sparkles size={16} /></span><span>YOUR ACTIVITY</span></div><div className="daily-stat"><strong>{countLabel(connected ? metrics.verified_events_today : undefined)}</strong></div><p className="muted-copy">Verified events today</p><div className="empty-state"><Activity size={22} /><strong>{connected ? 'Activity comes from server records' : 'No live activity loaded'}</strong><span>{connected ? 'Only events reported by the backend are shown.' : 'Connect the extension, sign in and verify ad events on the backend.'}</span></div><button className="subtle-link" onClick={() => navigate('earnings')}>View earnings <ArrowRight size={15} /></button></section>
    </div>
    <div className="section-title-row"><div><h2>Reward modes</h2><p>Mode status is read from the connected Ads+ service.</p></div><span className="mode-count">{connected ? 'Server status' : 'Not connected'}</span></div>
    <div className="mode-grid"><ModeCard icon={Link2} title="Sponsored link" label="BASE REWARD" detail="A sponsored link shown with an AI response." active={Boolean(modes.sponsored_link)} /><ModeCard icon={PlayCircle} title="Video card" label="EXTRA REWARD" detail="A compact video ad card during the session." active={Boolean(modes.video_card)} /><ModeCard icon={Zap} title="Response follow-up" label="EXTRA REWARD" detail="A sponsored link after the AI response." active={Boolean(modes.response_follow_up)} /></div>
    <div className="two-column-section"><section className="section-card"><div className="section-header"><div><h2>Recent activity</h2><p>Records returned by the Ads+ backend.</p></div><button className="text-link" onClick={() => navigate('earnings')}>See all <ArrowRight size={14} /></button></div><ActivityList items={connected ? activity.slice(0, 4) : []} emptyTitle="No live reward records" emptyText={connected ? 'The server has not returned recent activity.' : 'No local sample entries are used.'} /></section><section className="section-card share-card"><div className="section-header"><div><h2>Reward distribution</h2><p>Current planned formula</p></div><span className="small-icon"><ShieldCheck size={18} /></span></div><div className="formula-line"><span>Sponsored link</span><strong>50% base</strong></div><div className="formula-line"><span>Video card add-on</span><strong>+10% of base</strong></div><div className="formula-line"><span>Response follow-up add-on</span><strong>+15% of base</strong></div><p className="disclaimer">Only the server can calculate eligible rewards after validating ad events and platform terms. This UI does not create earnings.</p></section></div>
    <SetupNotice title={connected ? 'Live account connected' : 'Real rewards need a server connection'}>{backendState.message}</SetupNotice>
  </>;
}

function ModeCard({ icon: Icon, title, label, detail, active }) { return <section className="mode-card"><div className="mode-card-top"><span className="mode-icon brown"><Icon size={19} /></span><span className={`connection-status ${active ? 'connection-active' : ''}`}><span /> {active ? 'Active' : 'Not active'}</span></div><div className="mode-label">{label}</div><h3>{title}</h3><p>{detail}</p><div className="mode-status"><span className={active ? 'status-on' : 'status-off'} /> {active ? 'Enabled by Ads+ service' : 'Not enabled by Ads+ service'}</div></section>;}

function EarningsPage({ navigate, dashboard, backendState }) {
  const connected = backendState.status === 'connected' && Boolean(dashboard);
  const wallet = dashboard?.wallet || {};
  const records = Array.isArray(dashboard?.reward_ledger) ? dashboard.reward_ledger : (Array.isArray(dashboard?.recent_activity) ? dashboard.recent_activity : []);
  return <><PageHeading eyebrow="YOUR REWARD HISTORY" title="Earnings" subtitle={connected ? 'Amounts and entries are supplied by the Ads+ backend.' : 'No invented amounts or local sample records are shown.'} /><div className="earnings-summary-grid"><SummaryCard label="Total earnings" value={formatINRFromPaise(connected ? wallet.total_earned_paise : undefined)} note="Server-reported total" icon={ChartNoAxesCombined} tone="brown" /><SummaryCard label="Available" value={formatINRFromPaise(connected ? wallet.available_paise : undefined)} note="Server-reported withdrawable balance" icon={Wallet} tone="lavender" /><SummaryCard label="Pending" value={formatINRFromPaise(connected ? wallet.pending_paise : undefined)} note="Server-reported pending rewards" icon={Clock3} tone="platinum" /></div><section className="section-card earnings-chart-card"><div className="section-header"><div><h2>Reward activity</h2><p>Only verified records from the server are displayed.</p></div></div><ActivityList items={connected ? records.slice(0, 8) : []} emptyTitle="No earnings data from server" emptyText={connected ? 'The server has no reward-ledger entries for this account yet.' : 'Configure the backend and sign in to load real earnings.'} /></section><section className="section-card"><div className="section-header"><div><h2>Reward ledger</h2><p>Server-confirmed records only.</p></div><span className="record-count">{connected ? `${records.length} records` : 'No live records'}</span></div>{connected && records.length > 0 ? <><div className="ledger-header"><span>ACTIVITY</span><span>DATE</span><span>STATUS</span><span>AMOUNT</span></div>{records.map((item, index) => <div className="ledger-row" key={item.id || `${item.created_at || 'record'}-${index}`}><div className="ledger-activity"><span className="activity-icon"><Activity size={15} /></span><div><strong>{item.label || item.description || item.type || 'Reward event'}</strong><small>{item.reference || item.id || 'Server record'}</small></div></div><span className="ledger-date">{formatDateTime(item.created_at)}</span><span><em className="status-tag">{item.status || 'verified'}</em></span><strong className="ledger-amount">{formatINRFromPaise(item.amount_paise)}</strong></div>)}</> : <div className="empty-state"><ChartNoAxesCombined size={22} /><strong>No reward records</strong><span>{connected ? 'There are currently no reward-ledger entries for this account.' : 'The app will not estimate earnings locally.'}</span></div>}</section><SetupNotice title={connected ? 'Data source verified by connection' : 'Backend connection required'}>{backendState.message} The server must verify ad events and maintain the authoritative reward ledger.</SetupNotice><button className="secondary-button" onClick={() => navigate('profile')}>View connection status <ArrowRight size={15} /></button></>;
}

function SummaryCard({ label, value, note, icon: Icon, tone }) { return <section className="summary-card"><div className={`summary-icon ${tone}`}><Icon size={18} /></div><span className="summary-label">{label}</span><strong className="summary-value">{value}</strong><p>{note}</p></section>; }

function WalletPage({ notify, dashboard, backendState, onWithdraw }) {
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [sending, setSending] = useState(false);
  const connected = backendState.status === 'connected' && Boolean(dashboard);
  const wallet = dashboard?.wallet || {};
  const payoutEnabled = connected && dashboard?.services?.payout_enabled === true;
  const withdrawals = Array.isArray(dashboard?.withdrawals) ? dashboard.withdrawals : [];
  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const result = await onWithdraw({ amount, upiId });
      notify(result?.message || 'The Ads+ server accepted the withdrawal request for processing.');
      setAmount('');
      setUpiId('');
    } catch (error) {
      notify(error?.message || 'Withdrawal request failed.');
    } finally { setSending(false); }
  };
  return <><PageHeading eyebrow="WALLET & PAYOUTS" title="Wallet" subtitle={connected ? 'Balance and payout history from your connected Ads+ account.' : 'No local wallet balance is invented or stored.'} /><section className="wallet-page-grid"><section className="wallet-main-card"><div className="wallet-main-top"><span><Wallet size={16} /> AVAILABLE BALANCE</span><LockKeyhole size={16} /></div><strong>{formatINRFromPaise(connected ? wallet.available_paise : undefined)}</strong><p>{connected ? 'Reported by Ads+ server' : 'Waiting for verified account data'}</p><div className="wallet-mini-stats"><div><small>Pending rewards</small><b>{formatINRFromPaise(connected ? wallet.pending_paise : undefined)}</b></div><div><small>Total earned</small><b>{formatINRFromPaise(connected ? wallet.total_earned_paise : undefined)}</b></div></div></section><section className="section-card withdraw-card"><div className="section-header"><div><h2>Withdraw funds</h2><p>{payoutEnabled ? 'Submit a request for server-side validation.' : 'Withdrawals are controlled by the Ads+ backend.'}</p></div><span className="small-icon"><ArrowUpRight size={18} /></span></div><div className="warning-callout"><CircleAlert size={17} /><p><strong>{payoutEnabled ? 'Server validation required.' : 'Not available yet.'}</strong> {payoutEnabled ? 'The server must confirm the available balance, account status and payout eligibility before accepting a request.' : 'The payout service must be enabled by Ads+ before a withdrawal can be submitted.'}</p></div><form className="withdraw-form" onSubmit={submit}><label htmlFor="withdraw-amount">Amount (INR)</label><div className="amount-input-wrap"><span>₹</span><input id="withdraw-amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Enter amount" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!payoutEnabled || sending} required /></div><label htmlFor="withdraw-upi">UPI ID / payout destination</label><input id="withdraw-upi" type="text" autoComplete="off" placeholder="Enter your approved payout ID" value={upiId} onChange={(event) => setUpiId(event.target.value)} disabled={!payoutEnabled || sending} required /><p className="field-helper">The payout provider and server—not this app—must validate and execute the payment.</p><button className="primary-button form-submit" type="submit" disabled={!payoutEnabled || sending}>{sending ? 'Submitting…' : payoutEnabled ? 'Request withdrawal' : 'Withdrawals unavailable'} <LockKeyhole size={15} /></button></form></section></section><section className="section-card payment-explainer"><div className="explainer-icon"><ShieldCheck size={19} /></div><div><h2>Secure payout process</h2><p>Only server-side ledger balances and verified payout-provider results may be treated as real. Never trust a balance stored only in the browser.</p></div></section><section className="section-card"><div className="section-header"><div><h2>Withdrawal activity</h2><p>Confirmed requests returned by the Ads+ backend.</p></div></div><ActivityList items={connected ? withdrawals : []} emptyTitle="No live withdrawal records" emptyText={connected ? 'The backend has not returned any withdrawal requests.' : 'Sign in and connect a real backend to view payout history.'} /></section></>;
}

function CouponsPage({ notify, dashboard, backendState }) {
  const [expandedList, setExpandedList] = useState('');
  const connected = backendState?.status === 'connected' && Boolean(dashboard);
  const referrals = dashboard?.referrals || {};
  const active = Array.isArray(referrals.active_codes) ? referrals.active_codes : [];
  const expired = Array.isArray(referrals.expired_codes) ? referrals.expired_codes : [];
  const earnings = referrals.earnings || {};
  const generated = Number.isInteger(referrals.generated_this_month) ? referrals.generated_this_month : null;
  const remaining = generated === null ? null : Math.max(0, 2 - generated);
  const enabled = connected && dashboard?.services?.referrals_enabled === true;
  const money = v => Number.isInteger(v) ? formatINRFromPaise(v) : '—';
  const generate = () => {
    if (!connected) return notify('Backend not connected. No code was generated.');
    if (!enabled) return notify('Referral service is not enabled by the server.');
    if (remaining === 0) return notify('Monthly limit reached: maximum 2 codes.');
    return notify('Code-generation API is not implemented. No code was generated.');
  };
  const copy = async code => {
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(code);
      notify('Referral code copied.');
    } catch { notify('Copy unavailable. Copy the code manually.'); }
  };
  const CodeList = ({ items, isExpired = false }) => items.length ? <div className="refer-code-list">
    {items.map((item, i) => <article className="refer-code-row" key={item.id || item.code || i}>
      <div className="refer-code-main"><strong>{item.code || 'Code unavailable'}</strong>
        <small>{isExpired ? 'Expired' : 'Expires'}: {item.expires_at ? formatDateTime(item.expires_at) : 'Unavailable'}</small></div>
      <span className={'refer-status ' + (isExpired ? 'is-expired' : 'is-active')}>{isExpired ? 'Expired' : 'Active'}</span>
      {!isExpired && item.code && <button type="button" className="refer-copy-button" onClick={() => copy(item.code)}>Copy</button>}
    </article>)}
  </div> : <div className="refer-empty"><Link2 size={20}/><strong>{isExpired ? 'No expired codes' : 'No active codes yet'}</strong><span>Server-provided code history appears here when connected.</span></div>;
  return <>
    <PageHeading eyebrow="GROW WITH ADS+" title="Refer & Earn" subtitle="Share referral codes and track verified rewards."/>
    <section className="refer-hero"><div className="refer-hero-copy">
      <span className="refer-kicker"><Gift size={14}/> YOUR REFERRAL HUB</span>
      <h2>Share your link.<br/>Grow together.</h2>
      <p>Invite people to Ads+. The server controls codes, expiry and rewards.</p>
      <button className="refer-generate-button" type="button" onClick={generate} disabled={!connected || !enabled || remaining === 0}><Plus size={17}/> Generate Code <ArrowRight size={16}/></button>
      <span className="refer-hero-footnote"><ShieldCheck size={13}/> No fake codes or earnings</span>
    </div><div className="refer-hero-art" aria-hidden="true"><div className="refer-orbit refer-orbit-one"/><div className="refer-orbit refer-orbit-two"/><div className="refer-gift-graphic"><Gift size={53} strokeWidth={1.35}/></div><span className="refer-spark refer-spark-one">✦</span><span className="refer-spark refer-spark-two">✧</span></div></section>
    <div className="refer-limit-banner"><span className="refer-limit-icon"><Clock3 size={18}/></span><div><strong>Monthly code limit</strong><p>Maximum 2 codes per account per month. Each expires one month after generation.</p></div><span className="refer-limit-count">{remaining === null ? '— / 2' : remaining + ' / 2 left'}</span></div>
    {!enabled && <div className="refer-connection-note"><CircleAlert size={17}/><div><strong>Referral service not connected</strong><p>{connected ? 'The server has not enabled referrals or supplied referral data.' : 'Connect the backend to generate codes and load verified earnings.'}</p></div></div>}
    <div className="refer-stat-grid">
      <section className="refer-stat-card"><span className="refer-stat-icon"><Link2 size={18}/></span><span className="refer-stat-label">Active codes</span><strong>{connected ? active.length : ''}</strong><small>Currently valid</small></section>
      <section className="refer-stat-card"><span className="refer-stat-icon refer-icon-purple"><Clock3 size={18}/></span><span className="refer-stat-label">Expired codes</span><strong>{connected ? expired.length : ''}</strong><small>Past code history</small></section>
      <section className="refer-stat-card"><span className="refer-stat-icon refer-icon-green"><Wallet size={18}/></span><span className="refer-stat-label">Total earned</span><strong>{money(connected ? earnings.total_earned_paise : undefined)}</strong><small>Verified total only</small></section>
    </div>
    <section className="section-card refer-section"><div className="section-header"><div><h2><Link2 size={18}/> Generated codes</h2><p>Active codes and expiry dates.</p></div><div className="refer-header-actions"><span className="refer-section-count">{connected ? active.length : ''}</span><button type="button" className="refer-expand-button" aria-label="Expand generated codes" onClick={() => setExpandedList('active')}>⛶</button></div></div><CodeList items={connected ? active : []}/></section>
    <section className="section-card refer-section"><div className="section-header"><div><h2><Clock3 size={18}/> Expired codes</h2><p>Past code history.</p></div><div className="refer-header-actions"><span className="refer-section-count">{connected ? expired.length : ''}</span><button type="button" className="refer-expand-button" aria-label="Expand expired codes" onClick={() => setExpandedList('expired')}>⛶</button></div></div><CodeList items={connected ? expired : []} isExpired/></section>
    <section className="section-card refer-section"><div className="section-header"><div><h2><ChartNoAxesCombined size={18}/> Referral earnings</h2><p>Amounts confirmed by the server.</p></div><ShieldCheck size={18}/></div><div className="refer-earnings-grid"><div><span>Pending</span><strong>{money(connected ? earnings.pending_paise : undefined)}</strong><small>Awaiting verification</small></div><div><span>Paid</span><strong>{money(connected ? earnings.paid_paise : undefined)}</strong><small>Confirmed payouts</small></div><div><span>Total earned</span><strong>{money(connected ? earnings.total_earned_paise : undefined)}</strong><small>Verified lifetime total</small></div></div><div className="refer-security-note"><LockKeyhole size={16}/><p>Monthly limits, expiry and earnings must be enforced by the server—not browser storage.</p></div></section>

    {expandedList && <div className="refer-fullscreen" role="dialog" aria-modal="true" aria-label="Referral code list">
      <header className="refer-fullscreen-header">
        <div><span>ADS+ REFERRALS</span><h2>{expandedList === 'active' ? 'Generated codes' : 'Expired codes'}</h2><p>{expandedList === 'active' ? 'Your active codes and expiry dates.' : 'Your expired code history.'}</p></div>
        <button type="button" className="refer-close-button" onClick={() => setExpandedList('')} aria-label="Close list">×</button>
      </header>
      <div className="refer-fullscreen-content">
        <div className="refer-fullscreen-summary"><strong>{connected ? (expandedList === 'active' ? active.length : expired.length) : '—'}</strong><span>{expandedList === 'active' ? 'Active codes' : 'Expired codes'}</span></div>
        <CodeList items={connected ? (expandedList === 'active' ? active : expired) : []} isExpired={expandedList === 'expired'}/>
      </div>
      <footer className="refer-fullscreen-footer"><button type="button" onClick={() => setExpandedList('')}>Back to Refer &amp; Earn</button></footer>
    </div>}
  </>;
}
function RuleRow({ number, title, detail }) { return <div className="rule-row"><span className="rule-number">{number}</span><div><strong>{title}</strong><p>{detail}</p></div><CheckCircle2 size={17} className="rule-check" /></div>; }

function ProfilePage({ navigate, notify, dashboard, backendState, authUser, authLoading, onConnect, onSignOut }) {
  const connected = backendState.status === 'connected' && Boolean(dashboard);
  const profile = dashboard?.user || dashboard?.profile || {};
  const services = dashboard?.services || {};
  const connectionStatus = connected ? 'Connected' : backendState.status === 'not_configured' ? 'Needs setup' : backendState.status === 'error' ? 'Connection error' : 'Not linked';
  return <><PageHeading eyebrow="YOUR ACCOUNT" title="Profile & settings" subtitle="Account details and services come from the Ads+ backend when connected." /><section className="profile-hero"><div className="profile-avatar-large">{String(profile.display_name || profile.name || 'A').slice(0,1).toUpperCase()}</div><div className="profile-main-copy"><h2>{profile.display_name || profile.name || 'Ads+ account'}</h2><p>{authUser?.email || profile.email || 'No Google account signed in'}</p><div className="profile-chips"><span><span className={`status-point ${connected ? 'status-point-on' : ''}`} /> {connectionStatus}</span><span><ShieldCheck size={13} /> Server-verified account</span></div></div>{authUser ? <button className="secondary-button" onClick={onSignOut}>Sign out <LogOut size={14} /></button> : <button className="google-signin-button" onClick={onConnect} disabled={authLoading}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9V33C9.3 39.7 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 17.9z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4 16.1 4 9.3 8.3 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2z"/></svg>{authLoading ? 'Checking…' : 'Continue with Google'}</button>}</section><div className="profile-grid"><section className="section-card"><div className="section-header"><div><h2>Account connections</h2><p>Live status returned by the server.</p></div></div><ConnectionRow icon={Mail} title="Google account" detail={authUser?.email || 'Sign in with your Google account'} status={authUser ? 'Signed in' : authLoading ? 'Checking…' : 'Not signed in'} /><ConnectionRow icon={Globe2} title="Browser extension" detail="The extension must share this authenticated account" status={services.extension_connected ? 'Connected' : 'Not linked'} /><ConnectionRow icon={CreditCard} title="Payout service" detail="Real payouts require an approved provider" status={services.payout_enabled ? 'Enabled' : 'Not enabled'} /></section><section className="section-card"><div className="section-header"><div><h2>Connection details</h2><p>Current app/server state.</p></div><Settings2 size={18} /></div><div className="empty-state"><LockKeyhole size={22} /><strong>{connected ? 'Account data loaded' : 'Account not connected'}</strong><span>{backendState.message}</span></div>{!authUser && <button className="google-signin-button settings-action" onClick={onConnect} disabled={authLoading}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9V33C9.3 39.7 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 17.9z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4 16.1 4 9.3 8.3 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2z"/></svg>{authLoading ? 'Checking…' : 'Continue with Google'}</button>}{connected && <button className="secondary-button settings-action" onClick={() => notify('Use the refresh button in the top bar to reload server data.')}>Refresh guidance</button>}</section></div><section className="section-card account-safety"><span className="safety-icon"><LockKeyhole size={20} /></span><div><h2>Data safety</h2><p>The dashboard uses an authenticated API response. Wallet balances, creator attribution and withdrawals must be validated and stored by the server, not trusted from browser storage.</p></div><button className="text-link" onClick={() => navigate('help')}>Read help <ArrowRight size={14} /></button></section></>;
}

function ConnectionRow({ icon: Icon, title, detail, status }) { return <div className="connection-row"><span className="connection-icon"><Icon size={17} /></span><div className="connection-copy"><strong>{title}</strong><small>{detail}</small></div><span className="connection-status"><span />{status}</span></div>; }

function HelpPage({ notify }) { const [openFaq, setOpenFaq] = useState(0); const faqs = [
  ['Are earnings active?', 'Earnings appear only when the configured backend returns verified ad events. This app does not make up a balance or credit client-side rewards.'],
  ['Can I withdraw money?', 'The withdrawal form is enabled only when the authenticated backend marks payout service as enabled. The server must validate balance and eligibility, then use a real payout provider.'],
  ['Will the extension share my account?', 'The extension must authenticate with the same Ads+ backend. The dashboard reads the extension status returned by that server.'],
  ['How will creator codes work?', 'The dashboard submits the code to the backend. The server must validate the active code, record its creator, and preserve historical attribution.'],
]; return <><PageHeading eyebrow="ADS+ SUPPORT" title="Help centre" subtitle="Clear information about account setup, rewards and withdrawals." /><section className="help-hero"><div className="help-orb large"><Headphones size={25} /></div><div><div className="eyebrow">ADS+ SUPPORT</div><h2>We’ll keep it clear.</h2><p>Connect services before using account features.</p></div><button className="secondary-button" onClick={() => notify('Support inbox needs to be configured.') }><MessageCircle size={15} /> Contact support</button></section><section className="section-card faq-card"><div className="section-header"><div><h2>Frequently asked questions</h2><p>Tap a question to read the answer.</p></div><CircleHelp size={19} /></div>{faqs.map(([q,a],i)=><div className={`faq-item ${openFaq===i?'faq-open':''}`} key={q}><button onClick={() => setOpenFaq(openFaq===i?-1:i)} aria-expanded={openFaq===i}><span>{q}</span><span className="faq-toggle">{openFaq===i?<X size={15}/>:<Plus size={15}/>}</span></button>{openFaq===i&&<p>{a}</p>}</div>)}</section><section className="section-card support-info-grid"><div><ShieldCheck size={19}/><strong>Safety first</strong><p>Never share a banking PIN, UPI PIN or password with support.</p></div><div><Smartphone size={19}/><strong>Built for mobile</strong><p>The interface adapts to small screens and desktop layouts.</p></div><div><CircleAlert size={19}/><strong>Setup status</strong><p>Authentication, extension sync and payouts still need to be configured.</p></div></section></>; }

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
