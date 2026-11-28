import React, { useEffect, useState } from 'react';

import { createRoot } from 'react-dom/client';
import {
  Activity, Moon, Sun, ArrowRight, ArrowUpRight, CheckCircle2,
  ChevronRight, CircleAlert, CircleHelp, Clock3, CreditCard, Eye,
  Headphones, Home, LockKeyhole, LogOut,
  Menu, MessageCircle, Plus, Settings2, ShieldCheck, Wallet, X, UserRound, ChartNoAxesCombined, Mail
} from 'lucide-react';
import './styles.css';
import './update.css';
import './dark-mode.css';
import { apiRequest, clearAccessToken, formatDateTime, formatINRFromPaise, getAccessToken, setAccessToken, readApiConfig } from './adsplus-api.js';
import { getAdditionalUserInfo, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';

// Public user app: any Google account may sign in. Admin API routes retain server-side UID authorization.
const CANONICAL_HOST = 'app.adsplusprof.me';
if (window.location.hostname === 'adsplus-user-app-staging.onrender.com' &&
    window.location.search.includes('canonical=1')) {
  window.location.replace('https://' + CANONICAL_HOST + window.location.pathname + window.location.search.replace(/[?&]canonical=1/, '') + window.location.hash);
}

const NAV = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'earnings', label: 'Earnings', icon: ChartNoAxesCombined },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

function App() {
  const [page, setPage] = useState('home');
  const [darkMode, setDarkMode] = useState(() => { try { return window.localStorage.getItem('adsplus.theme') === 'dark'; } catch { return false; } });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [payoutIdempotencyKey, setPayoutIdempotencyKey] = useState(() => window.crypto.randomUUID());
  const [backendState, setBackendState] = useState({ status: 'checking', message: 'Checking your Ads+ account…' });
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3600);
  };
  const navigate = (target) => {
    window.history.pushState({}, '', '/');
    setPage(target);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const refreshData = () => setRefreshKey((v) => v + 1);

  useEffect(() => {
    const onPopState = () => setPage('home');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (user) user.getIdToken(true).then((token) => { setAccessToken(token); refreshData(); }).catch((error) => console.error('Firebase token refresh failed:', error));
      else clearAccessToken();
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
      setBackendState({ status: 'checking', message: 'Checking your account…' });
      const config = await readApiConfig(true);
      if (!active) return;
      if (!config.apiBaseUrl) {
        setDashboard(null);
        setBackendState({ status: 'not_configured', message: 'Ads+ account services are temporarily unavailable. Please try again shortly.' });
        return;
      }
      const token = authUser ? await authUser.getIdToken() : getAccessToken();
      if (!token) {
        setDashboard(null);
        setBackendState({ status: 'signed_out', message: 'Sign in with Google to view your earnings.' });
        return;
      }
      try {
        const [earnings, history, payoutResponse] = await Promise.all([
          apiRequest('/v1/me/earnings', { accessToken: token }),
          apiRequest('/v1/me/earnings/history?limit=50&offset=0', { accessToken: token }),
          apiRequest('/v1/payouts?limit=50&offset=0', { accessToken: token })
        ]);
        if (!active) return;
        const toPaise = (milli) => { try { return (BigInt(milli || 0) / 1000n).toString(); } catch { return '0'; } };
        const entries = (history.items || []).map(item => ({
          id: item.id, type: item.kind, label: item.kind === 'payout' ? 'Payout request' : 'Verified ad reward',
          description: item.kind === 'payout' ? 'Payout request' : 'Verified ad reward',
          created_at: item.created_at, status: item.status, reference: item.reference,
          amount_paise: item.amount_paise ?? toPaise(item.amount_milli_paise)
        }));
        const payoutItems = entries.filter(item => item.type === 'payout');
        setDashboard({
          user: { id: authUser?.uid || '', email: authUser?.email || '', display_name: authUser?.displayName || '' },
          wallet: {
            available_paise: earnings.wallet_balance_paise ?? toPaise(earnings.wallet_balance_milli_paise),
            pending_paise: toPaise(earnings.pending_rewards_milli_paise),
            total_earned_paise: toPaise(earnings.credited_rewards_milli_paise)
          },
          services: { payout_enabled: true },
          recent_activity: entries.slice(0, 8), reward_ledger: entries.filter(item => item.type === 'reward'),
          withdrawals: (payoutResponse.items || []).map(item => ({
            id: item.id, type: 'payout', label: 'Payout request',
            description: 'Payout request', created_at: item.created_at,
            status: item.status, amount_paise: item.amount_paise
          })), earnings
        });
        setBackendState({ status: 'connected', message: 'Your Ads+ account is connected. Your balance and reward history are up to date.' });
      } catch (error) {
        if (!active) return;
        setDashboard(null);
        setBackendState({ status: !getAccessToken() ? 'signed_out' : 'error', message: error?.message || 'Could not load your earnings. Please refresh and try again.' });
      }
    })();
    return () => { active = false; };
  }, [refreshKey, authUser]);

  const connectAccount = async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const additionalInfo = getAdditionalUserInfo(credential);
      console.info('Ads+ Google sign-in completed.', {
        isNewUser: additionalInfo?.isNewUser === true
      });
      const token = await credential.user.getIdToken(true);
      setAccessToken(token);
      refreshData();
      notify('Google sign-in successful. Loading your verified earnings.');
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
      setBackendState({ status: 'signed_out', message: 'Google account signed out. Your Ads+ account is disconnected.' });
      notify('Google account signed out.');
    } catch (error) {
      notify(error?.message || 'Could not sign out.');
    }
  };

  const requestWithdrawal = async ({ amount, upiId }) => {
    const amountText = String(amount ?? '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) throw new Error('Enter an amount with up to 2 decimal places.');
    const [whole, fraction = ''] = amountText.split('.');
    const paise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2,'0'));
    if (paise < 2000n) throw new Error('Minimum payout is ₹20.');
    if (!upiId || !upiId.trim()) throw new Error('Enter the payout destination requested by Ads+.');
    let result;
    try {
      result = await apiRequest('/v1/payouts', {
        method: 'POST',
        body: { amount_paise: paise.toString(), upi_id: upiId.trim() },
        headers: { 'Idempotency-Key': payoutIdempotencyKey }
});
    } catch (error) {
      // Definitive 4xx rejection: rotate for the next corrected request.
      // Network/5xx errors remain ambiguous, so retain the key for retry.
      if (Number.isInteger(error.status) && error.status < 500) {
        setPayoutIdempotencyKey(window.crypto.randomUUID());
      }
      throw error;
    }
    setPayoutIdempotencyKey(window.crypto.randomUUID());
    refreshData();
    return result;
  };

  if (authLoading) return <div className="owner-lock-screen"><div className="owner-lock-card"><LockKeyhole size={26}/><h1>Ads+</h1><p>Checking your Google sign-in…</p></div></div>;
  if (!authUser) return <div className="owner-lock-screen"><div className="owner-lock-card"><img src="/logo-black.png" alt="Ads+"/><h1>Welcome to Ads+</h1><p>Sign in with Google to access your Ads+ account.</p><button className="google-signin-button" onClick={connectAccount}>Continue with Google</button><small></small></div></div>;

  const profile = dashboard?.user || dashboard?.profile || {};
  const navItems = NAV;
  const statusLabel = ({ checking: 'CHECKING', not_configured: 'SETUP NEEDED', signed_out: 'SIGN IN REQUIRED', connected: 'CONNECTED', error: 'CONNECTION ERROR' })[backendState.status] || 'ACCOUNT STATUS';
  return <div className={`app-shell ${darkMode ? 'theme-dark' : 'theme-light'}`}>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('home')} aria-label="Ads+ home">
        <span className="brand-mark adsplus-brand-mark"><img className="adsplus-logo-image adsplus-logo-light" src="/logo-black.png" alt="Ads+ logo" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('logo-missing'); }} /><img className="adsplus-logo-image adsplus-logo-dark" src="/logo-white.png" alt="" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('logo-missing'); }} /><span className="brand-logo-fallback">A<span>+</span></span></span>
        <span className="brand-copy"><strong>Ads<span>+</span></strong></span>
      </button>
      
      <nav className="side-nav" aria-label="Main navigation">{navItems.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} className={`nav-item ${page === item.id ? 'selected' : ''}`} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span>{page === item.id && <span className="nav-dot" />}</button>;
      })}</nav>
      <div className="sidebar-spacer" />
      <button className="text-link sidebar-help-link" onClick={() => navigate('help')}><Headphones size={16} /> Help centre</button>
      <div className="side-user"><div className="avatar">{String(authUser?.displayName || profile.display_name || profile.name || 'A').slice(0,1).toUpperCase()}</div><div className="side-user-copy"><strong>{authUser?.displayName || profile.display_name || profile.name || 'Ads+ account'}</strong><small>{profile.email || (backendState.status === 'connected' ? 'Connected' : 'Not connected')}</small></div><button className="icon-quiet" onClick={() => navigate('profile')} aria-label="Open profile"><ChevronRight size={16} /></button></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-quiet" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button><div className="breadcrumb"><strong>{pageLabel(page)}</strong></div></div><div className="topbar-actions"><button type="button" className={`theme-toggle ${darkMode ? 'is-dark' : 'is-light'}`} role="switch" aria-checked={darkMode} aria-label={darkMode ? 'Turn dark mode off' : 'Turn dark mode on'} title={darkMode ? 'Dark mode: on' : 'Dark mode: off'} onClick={() => setDarkMode((value) => !value)}><span className="theme-toggle-icon">{darkMode ? <Sun size={17} /> : <Moon size={17} />}</span><span className="theme-toggle-label">Dark mode</span><span className="theme-switch-track"><span className="theme-switch-thumb" /></span></button><button className="notification-btn icon-quiet" aria-label="Refresh account information" onClick={refreshData}><Activity size={18} /></button><button className="top-avatar" onClick={() => navigate('profile')} aria-label="Your profile">{String(profile.display_name || profile.name || 'A').slice(0,1).toUpperCase()}</button></div></header>
      <main className="page-content">
        {page === 'home' && <HomePage navigate={navigate} dashboard={dashboard} backendState={backendState} />}
        {page === 'earnings' && <EarningsPage navigate={navigate} dashboard={dashboard} backendState={backendState} />}
        {page === 'wallet' && <WalletPage notify={notify} dashboard={dashboard} backendState={backendState} onWithdraw={requestWithdrawal} />}
        {page === 'profile' && <ProfilePage navigate={navigate} notify={notify} dashboard={dashboard} backendState={backendState} authUser={authUser} authLoading={authLoading} onConnect={connectAccount} onSignOut={signOut} />}
        {page === 'help' && <HelpPage notify={notify} />}
      </main>
      
    </div>
    <nav className="mobile-tabbar" aria-label="Mobile navigation">{NAV.map((item) => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'current' : ''} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label}</span></button>; })}</nav>
    {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}

function pageLabel(page) { return ({ home: 'Overview', earnings: 'Earnings', wallet: 'Wallet', profile: 'Profile', help: 'Help centre' })[page] || 'Overview'; }
function PageHeading({ title, subtitle, action }) { return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>; }
function SweetEmptyBox({ icon: Icon = Activity, title }) {
  return <div className="sweet-empty-box" role="status">
    <span className="sweet-empty-icon"><Icon size={20} /></span>
    <strong>{title}</strong>
  </div>;
}

function ActivityList({ items, emptyTitle }) {
  if (!Array.isArray(items) || items.length === 0) return <SweetEmptyBox title={emptyTitle} />;
  return <div className="activity-list">{items.map((item, index) => <div className="activity-row" key={item.id || `${item.created_at || 'event'}-${index}`}><span className="activity-icon"><Activity size={16} /></span><div className="activity-copy"><strong>{item.label || item.description || item.type || 'Verified Ads+ activity'}</strong><small>{formatDateTime(item.created_at || item.createdAt)}</small></div><strong className="activity-amount">{formatINRFromPaise(item.amount_paise)}</strong></div>)}</div>;
}
function countLabel(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat('en-IN').format(Number(value)); }

function HomePage({ navigate, dashboard, backendState }) {
  const connected = backendState.status === 'connected' && Boolean(dashboard);
  const wallet = dashboard?.wallet || {};
  const activity = Array.isArray(dashboard?.recent_activity) ? dashboard.recent_activity : [];
  return <>
    <PageHeading
      title="Welcome to Ads+."
      subtitle={connected ? 'Your Ads+ account is up to date.' : 'Sign in to view your verified Ads+ account and earnings.'}
      action={<span className="profile-status"><span className={`status-point ${connected ? 'status-point-on' : ''}`} /> {connected ? 'Account connected' : backendState.status === 'error' ? 'Connection error' : 'Sign in required'}</span>}
    />
    <section className="wallet-hero">
      <div className="wallet-hero-top"><span className="hero-kicker"><Wallet size={15} /> AVAILABLE BALANCE</span><Eye size={17} /></div>
      <div className="hero-amount">{formatINRFromPaise(connected ? wallet.available_paise : undefined)}</div>
      <div className="hero-under">{connected ? 'Available balance' : 'Sign in to view your available balance'}</div>
      <div className="hero-rule" />
      <div className="hero-bottom">
        <div><small>Total earned</small><strong>{formatINRFromPaise(connected ? wallet.total_earned_paise : undefined)}</strong></div>
        <div><small>Pending rewards</small><strong>{formatINRFromPaise(connected ? wallet.pending_paise : undefined)}</strong></div>
        <button className="hero-button" onClick={() => navigate('wallet')}>Wallet <ArrowUpRight size={16} /></button>
      </div>
      <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" />
    </section>
    <section className="section-card">
      <div className="section-header">
        <div><h2>Recent activity</h2></div>
        <button className="text-link" onClick={() => navigate('earnings')}>See all <ArrowRight size={14} /></button>
      </div>
      <ActivityList
        items={connected ? activity.slice(0, 8) : []}
        emptyTitle="No recent activity"
      />
    </section>
    <SweetEmptyBox title={connected ? 'Account connected' : 'Sign in to continue'} icon={ShieldCheck} />
  </>;
}

function EarningsPage({ navigate, dashboard, backendState }) {
  const connected = backendState.status === 'connected' && Boolean(dashboard);
  const wallet = dashboard?.wallet || {};
  const records = Array.isArray(dashboard?.reward_ledger) ? dashboard.reward_ledger : (Array.isArray(dashboard?.recent_activity) ? dashboard.recent_activity : []);
  return <><PageHeading title="Earnings" subtitle={connected ? 'Your verified rewards and their status.' : 'Sign in to view your verified earnings.'} /><div className="earnings-summary-grid"><SummaryCard label="Total earnings" value={formatINRFromPaise(connected ? wallet.total_earned_paise : undefined)} note="Total earned" icon={ChartNoAxesCombined} tone="brown" /><SummaryCard label="Available" value={formatINRFromPaise(connected ? wallet.available_paise : undefined)} note="Withdrawable balance" icon={Wallet} tone="lavender" /><SummaryCard label="Pending" value={formatINRFromPaise(connected ? wallet.pending_paise : undefined)} note="Pending rewards" icon={Clock3} tone="platinum" /></div><section className="section-card earnings-chart-card"><div className="section-header"><div><h2>Reward activity</h2></div></div><ActivityList items={connected ? records.slice(0, 8) : []} emptyTitle="No earnings yet" /></section><section className="section-card"><div className="section-header"><div><h2>Reward history</h2></div><span className="record-count">{connected ? `${records.length} records` : '0 records'}</span></div>{connected && records.length > 0 ? <><div className="ledger-header"><span>ACTIVITY</span><span>DATE</span><span>STATUS</span><span>AMOUNT</span></div>{records.map((item, index) => <div className="ledger-row" key={item.id || `${item.created_at || 'record'}-${index}`}><div className="ledger-activity"><span className="activity-icon"><Activity size={15} /></span><div><strong>{item.label || item.description || item.type || 'Reward event'}</strong><small>{item.reference || item.id || 'Ads+ record'}</small></div></div><span className="ledger-date">{formatDateTime(item.created_at)}</span><span><em className="status-tag">{item.status || 'verified'}</em></span><strong className="ledger-amount">{formatINRFromPaise(item.amount_paise)}</strong></div>)}</> : <SweetEmptyBox title="No reward history" icon={ChartNoAxesCombined} />}</section><SweetEmptyBox title={connected ? 'Rewards verified' : 'Sign in to continue'} icon={ShieldCheck} /><button className="secondary-button" onClick={() => navigate('profile')}>Account settings <ArrowRight size={15} /></button></>;
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
      notify(result?.message || 'Your withdrawal request has been submitted.');
      setAmount('');
      setUpiId('');
    } catch (error) {
      notify(error?.message || 'Withdrawal request failed.');
    } finally { setSending(false); }
  };
  return <><PageHeading title="Wallet" subtitle={connected ? 'Your balance and payout history.' : 'Sign in to view your balance and request a payout.'} /><section className="wallet-page-grid"><section className="wallet-main-card"><div className="wallet-main-top"><span><Wallet size={16} /> AVAILABLE BALANCE</span><LockKeyhole size={16} /></div><strong>{formatINRFromPaise(connected ? wallet.available_paise : undefined)}</strong><p>{connected ? 'Your Ads+ balance' : 'Sign in to view your balance.'}</p><div className="wallet-mini-stats"><div><small>Pending rewards</small><b>{formatINRFromPaise(connected ? wallet.pending_paise : undefined)}</b></div><div><small>Total earned</small><b>{formatINRFromPaise(connected ? wallet.total_earned_paise : undefined)}</b></div></div></section><section className="section-card withdraw-card"><div className="section-header"><div><h2>Withdraw funds</h2><p>{payoutEnabled ? 'Submit a payout request.' : 'Payouts are not available yet.'}</p></div><span className="small-icon"><ArrowUpRight size={18} /></span></div><div className="warning-callout"><CircleAlert size={17} /><p><strong>{payoutEnabled ? 'Verification required.' : 'Not available yet.'}</strong> {payoutEnabled ? 'Ads+ checks your available balance and payout eligibility before accepting your request.' : 'Payouts will be available once this feature is enabled.'}</p></div><form className="withdraw-form" onSubmit={submit}><label htmlFor="withdraw-amount">Amount (INR)</label><div className="amount-input-wrap"><span>₹</span><input id="withdraw-amount" type="number" inputMode="decimal" min="20" step="0.01" placeholder="Enter amount" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!payoutEnabled || sending} required /></div><label htmlFor="withdraw-upi">UPI ID / payout destination</label><input id="withdraw-upi" type="text" autoComplete="off" placeholder="Enter your approved payout ID" value={upiId} onChange={(event) => setUpiId(event.target.value)} disabled={!payoutEnabled || sending} required /><p className="field-helper">Ads+ will verify your payout details before processing the payment.</p><button className="primary-button form-submit" type="submit" disabled={!payoutEnabled || sending}>{sending ? 'Submitting…' : payoutEnabled ? 'Request withdrawal' : 'Withdrawals unavailable'} <LockKeyhole size={15} /></button></form></section></section><section className="section-card payment-explainer"><div className="explainer-icon"><ShieldCheck size={19} /></div><div><h2>Secure payout process</h2><p>Ads+ verifies your balance and payout status to keep your account accurate and secure. Never share your UPI PIN or banking password.</p></div></section><section className="section-card"><div className="section-header"><div><h2>Withdrawal activity</h2><p>Your recent withdrawal requests.</p></div></div><ActivityList items={connected ? withdrawals : []} emptyTitle="No withdrawals yet" /></section></>;
}

function ProfilePage({ navigate, notify, dashboard, backendState, authUser, authLoading, onConnect, onSignOut }) {
  const connected = backendState.status === 'connected' && Boolean(dashboard);
  const profile = dashboard?.user || dashboard?.profile || {};
  const services = dashboard?.services || {};
  const connectionStatus = connected ? 'Connected' : backendState.status === 'not_configured' ? 'Needs setup' : backendState.status === 'error' ? 'Connection error' : 'Not linked';
  return <><PageHeading title="Profile & settings" subtitle="Manage your account, preferences and sign-in." /><section className="profile-hero"><div className="profile-avatar-large">{String(profile.display_name || profile.name || 'A').slice(0,1).toUpperCase()}</div><div className="profile-main-copy"><h2>{profile.display_name || profile.name || 'Ads+ account'}</h2><p>{authUser?.email || profile.email || 'No Google account signed in'}</p><div className="profile-chips"><span><span className={`status-point ${connected ? 'status-point-on' : ''}`} /> {connectionStatus}</span><span><ShieldCheck size={13} /> Verified account</span></div></div>{authUser ? <button className="secondary-button" onClick={onSignOut}>Sign out <LogOut size={14} /></button> : <button className="google-signin-button" onClick={onConnect} disabled={authLoading}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9V33C9.3 39.7 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 17.9z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4 16.1 4 9.3 8.3 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2z"/></svg>{authLoading ? 'Checking…' : 'Continue with Google'}</button>}</section><div className="profile-grid"><section className="section-card"><div className="section-header"><div><h2>Account connections</h2><p>Your current account and payout status.</p></div></div><ConnectionRow icon={Mail} title="Google account" detail={authUser?.email || 'Sign in with your Google account'} status={authUser ? 'Signed in' : authLoading ? 'Checking…' : 'Not signed in'} /><ConnectionRow icon={CreditCard} title="Payout service" detail="Real payouts require an approved provider" status={services.payout_enabled ? 'Enabled' : 'Not enabled'} /></section><section className="section-card"><div className="section-header"><div><h2>Account details</h2><p>Your account status.</p></div><Settings2 size={18} /></div><SweetEmptyBox title={connected ? 'Account connected' : 'Sign in to continue'} icon={LockKeyhole} />{!authUser && <button className="google-signin-button settings-action" onClick={onConnect} disabled={authLoading}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9V33C9.3 39.7 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 17.9z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4 16.1 4 9.3 8.3 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2z"/></svg>{authLoading ? 'Checking…' : 'Continue with Google'}</button>}{connected && <button className="secondary-button settings-action" onClick={() => notify('Use the refresh button at the top to update your account information.')}>Refresh guidance</button>}</section></div><section className="section-card account-safety"><span className="safety-icon"><LockKeyhole size={20} /></span><div><h2>Data safety</h2><p>Ads+ verifies wallet balances, creator referrals and withdrawal requests to keep your account accurate and secure.</p></div><button className="text-link" onClick={() => navigate('help')}>Read help <ArrowRight size={14} /></button></section></>;
}

function ConnectionRow({ icon: Icon, title, detail, status }) { return <div className="connection-row"><span className="connection-icon"><Icon size={17} /></span><div className="connection-copy"><strong>{title}</strong><small>{detail}</small></div><span className="connection-status"><span />{status}</span></div>; }

function HelpPage({ notify }) { const [openFaq, setOpenFaq] = useState(0); const faqs = [
  ['Are earnings active?', 'Your earnings appear after an ad view has been verified by Ads+.'],
  ['Can I withdraw money?', 'Once payouts are enabled and your available balance meets the minimum, submit your UPI details from Wallet.'],
  ['Will the extension share my account?', 'Use the same Ads+ account when connecting the browser extension.'],
]; return <><PageHeading title="Help centre" subtitle="Account setup, earnings and payouts." /><section className="help-hero"><div className="help-orb large"><Headphones size={25} /></div><div><p>Find answers about your account, earnings and payouts.</p></div><button className="secondary-button" onClick={() => notify('Support contact is not available yet.') }><MessageCircle size={15} /> Contact support</button></section><section className="section-card faq-card"><div className="section-header"><div><h2>Frequently asked questions</h2></div><CircleHelp size={19} /></div>{faqs.map(([q,a],i)=><div className={`faq-item ${openFaq===i?'faq-open':''}`} key={q}><button onClick={() => setOpenFaq(openFaq===i?-1:i)} aria-expanded={openFaq===i}><span>{q}</span><span className="faq-toggle">{openFaq===i?<X size={15}/>:<Plus size={15}/>}</span></button>{openFaq===i&&<p>{a}</p>}</div>)}</section><section className="section-card support-info-grid"><div><ShieldCheck size={19}/><strong>Safety first</strong><p>Never share a banking PIN, UPI PIN or password with support.</p></div></section></>; }

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
