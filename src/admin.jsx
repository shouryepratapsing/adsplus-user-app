import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Users, Wallet, BarChart3, Ban, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from './adsplus-api.js';
import { auth } from './firebase.js';
import './admin.css';

const TABS = [
  ['dashboard','Dashboard'],['users','Users'],['campaigns','Campaigns'],['ads','Ads'],
  ['revenue','Revenue'],['earnings','Earnings'],['payouts','Payouts'],['audit-log','Audit log']
];
const PATHS = { campaigns:'/v1/admin/campaigns', ads:'/v1/admin/ads', revenue:'/v1/admin/revenue',
  earnings:'/v1/admin/earnings', payouts:'/v1/admin/payouts', 'audit-log':'/v1/admin/audit-log' };
const PAISE_FIELDS = new Set(['amount_paise','rate_paise','budget_paise','spent_paise']);
const MONEY_FIELDS = new Set(['revenue_total_milli_paise','platform_share_total_milli_paise',
  'rewards_pending_milli_paise','earned_total_milli_paise','earned_pending_milli_paise',
  'earned_rejected_milli_paise','amount_milli_paise','revenue_milli_paise','platform_milli_paise']);

function moneyMilli(value) {
  if (value === null || value === undefined || value === '') return '—';
  try {
    const paise = BigInt(value) / 1000n;
    const rupees = paise / 100n;
    const cents = String(paise % 100n).padStart(2,'0');
    return '₹' + new Intl.NumberFormat('en-IN').format(rupees) + '.' + cents;
  } catch { return '—'; }
}
function moneyPaise(value) {
  if (value === null || value === undefined || value === '') return '—';
  try {
    const paise = BigInt(value);
    const rupees = paise / 100n;
    const cents = String(paise % 100n).padStart(2,'0');
    return '₹' + new Intl.NumberFormat('en-IN').format(rupees) + '.' + cents;
  } catch { return '—'; }
}
function cell(key,value) {
  if (MONEY_FIELDS.has(key)) return moneyMilli(value);
  if (PAISE_FIELDS.has(key)) return moneyPaise(value);
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function AdminPanel({ authUser }) {
  const [token,setToken] = useState('');
  const [admin,setAdmin] = useState(null);
  const [tab,setTab] = useState('dashboard');
  const [metrics,setMetrics] = useState(null);
  const [rows,setRows] = useState([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  useEffect(() => {
    let live=true;
    if (!authUser) { setToken(''); setAdmin(null); return; }
    authUser.getIdToken(true).then(value=>{ if(live) setToken(value); })
      .catch(()=>{ if(live) setError('Firebase session could not produce an ID token. Sign in again.'); });
    return ()=>{live=false;};
  },[authUser]);

  const load = useCallback(async () => {
    if(!token) return;
    setBusy(true); setError('');
    try {
      const identity=await apiRequest('/v1/admin/auth',{accessToken:token});
      setAdmin(identity.admin);
      if(tab==='dashboard') {
        const result=await apiRequest('/v1/admin/dashboard',{accessToken:token});
        setMetrics(result.metrics||{});
        setRows([]);
      } else if(tab==='users') {
        const result=await apiRequest('/v1/admin/users?limit=100&offset=0',{accessToken:token});
        setRows(result.items||[]);
      } else {
        const result=await apiRequest((PATHS[tab]||PATHS.campaigns)+'?limit=100&offset=0',{accessToken:token});
        setRows(result.items||[]);
      }
    } catch(e) {
      setAdmin(null); setRows([]); setMetrics(null);
      setError(e?.message||'Admin API request failed. Check admin UID, Firebase and API deployment.');
    } finally { setBusy(false); }
  },[token,tab]);
  useEffect(()=>{load();},[load]);

  const updateUser=async user=>{
    if (user.firebase_uid === auth.currentUser?.uid) { setError('You cannot suspend your own admin account.'); return; }
    const status=user.status==='suspended'?'active':'suspended';
    setNotice('');
    try {
      await apiRequest('/v1/admin/users/'+encodeURIComponent(user.user_id),{
        method:'PATCH',accessToken:token,body:{status}
      });
      setNotice(status==='suspended'?'User suspended; device ad-serving is blocked.':'User reactivated.');
      await load();
    } catch(e){setError(e?.message||'User status update failed.');}
  };
  const rewardAction=async (reward,action)=>{
    try {
      await apiRequest('/v1/admin/earnings/'+encodeURIComponent(reward.id),{method:'PATCH',accessToken:token,body:{action}});
      setNotice('Reward '+action+' complete.'); await load();
    } catch(e){setError(e?.message||'Reward review failed.');}
  };
  const payoutAction=async (payout,action)=>{
    let utr_reference;
    if(action==='mark_paid') {
      utr_reference=window.prompt('Enter bank UTR / payment reference:');
      if(!utr_reference||!utr_reference.trim()) return;
    }
    try {
      await apiRequest('/v1/admin/payouts/'+encodeURIComponent(payout.id),{
        method:'PATCH',accessToken:token,body:{action,...(utr_reference?{admin_note:utr_reference.trim()}:{})}
      });
      setNotice('Payout updated: '+action); await load();
    } catch(e){setError(e?.message||'Payout review failed.');}
  };

  const columns=tab==='users'
    ? ['serial_number','user_id','email','firebase_uid','status','devices_active','ads_served','ads_viewed','clicks_total','earned_total_milli_paise','earned_pending_milli_paise','earned_rejected_milli_paise']
    : rows.length?Object.keys(rows[0]).filter(k=>!['before_data','after_data'].includes(k)).slice(0,12):[];

  return <section className="admin-shell">
    <header className="admin-heading"><div className="admin-title-icon"><ShieldCheck size={23}/></div><div><span className="admin-eyebrow">ADS+ CONTROL CENTER</span><h1>Admin panel</h1><p>{admin?admin.role+' administrator · '+(admin.email||admin.uid):'Validating Firebase identity and admin allowlist…'}</p></div><button className="admin-refresh" onClick={load} disabled={busy}><RefreshCw size={15}/>{busy?'Loading':'Refresh'}</button></header>
    {!token&&<div className="admin-message"><AlertCircle size={18}/>Waiting for a signed-in Firebase account.</div>}
    {error&&<div className="admin-message admin-error"><AlertCircle size={18}/>{error}</div>}
    {notice&&<div className="admin-message admin-success"><CheckCircle2 size={18}/>{notice}</div>}
    {admin&&<>
      <nav className="admin-tabs">{TABS.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      {tab==='dashboard'&&<div className="admin-metric-grid">{[
        ['Total users',metrics?.users_total,Users],['Active users',metrics?.users_active,CheckCircle2],
        ['Suspended',metrics?.users_banned,Ban],['Verified impressions (24h)',metrics?.impressions_24h,BarChart3],
        ['Revenue',metrics?.revenue_total_milli_paise,Wallet],['Platform share',metrics?.platform_share_total_milli_paise,Wallet],
        ['Pending rewards',metrics?.rewards_pending_milli_paise,Wallet],['Pending payouts',metrics?.payouts_pending,Wallet]
      ].map(([label,value,Icon])=><article className="admin-metric" key={label}><Icon size={17}/><span>{label}</span><strong>{MONEY_FIELDS.has(label==='Revenue'?'revenue_total_milli_paise':label==='Platform share'?'platform_share_total_milli_paise':label==='Pending rewards'?'rewards_pending_milli_paise':'')?moneyMilli(value):value??'—'}</strong></article>)}</div>}
      {tab!=='dashboard'&&<div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}{tab==='users'&&<th>Account action</th>}{(tab==='payouts'||tab==='earnings')&&<th>Review</th>}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.id||row.user_id||i}>{columns.map(k=><td key={k}>{cell(k,row[k])}</td>)}{tab==='users'&&<td><button className="admin-action" onClick={()=>updateUser(row)} disabled={row.status==='deleted'}>{row.status==='suspended'?'Unban':'Ban'}</button></td>}{tab==='earnings'&&<td className="admin-actions"><button onClick={()=>rewardAction(row,'approve')} disabled={row.status!=='requested'}>Approve</button><button onClick={()=>rewardAction(row,'reject')} disabled={row.status!=='requested'}>Reject</button></td>}{tab==='payouts'&&<td className="admin-actions"><button onClick={()=>payoutAction(row,'approve')} disabled={row.status!=='pending'}>Approve</button><button onClick={()=>payoutAction(row,'reject')} disabled={row.status!=='pending'}>Reject</button><button onClick={()=>payoutAction(row,'mark_paid')} disabled={row.status!=='approved'}>Mark paid</button></td>}</tr>)}</tbody></table>{!rows.length&&!busy&&<p className="admin-empty">No records returned for this section.</p>}</div>}
    </>}
  </section>;
}
