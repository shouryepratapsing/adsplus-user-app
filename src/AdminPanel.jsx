import React,{useCallback,useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithPopup,signOut} from 'firebase/auth';
import {auth,googleProvider} from './firebase.js';
import {readApiConfig} from './adsplus-api.js';
import './admin.css';

const money=(milli)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2}).format(Number(milli||0)/100000);
const moneyPaise=(p)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2}).format(Number(p||0)/100);
async function getApiOrigin(){return (await readApiConfig(true)).apiBaseUrl;}
function AdminPanel(){
 const [user,setUser]=useState(null),[authReady,setAuthReady]=useState(false),[admin,setAdmin]=useState(null),[metrics,setMetrics]=useState(null),[users,setUsers]=useState([]),[payouts,setPayouts]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const call=useCallback(async(path,options={})=>{
  const current=auth.currentUser;if(!current)throw new Error('Sign in with your authorized admin Google account.');
  const origin=await getApiOrigin();if(!origin)throw new Error('Ads+ API URL is missing in public/adsplus-config.json');
  const token=await current.getIdToken(true);
  const response=await fetch(origin+path,{...options,headers:{Accept:'application/json',Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},body:options.body?JSON.stringify(options.body):undefined,mode:'cors',credentials:'omit'});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'API request failed ('+response.status+')');
  return body;
 },[]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const a=await call('/v1/admin/auth');setAdmin(a.admin);
   const [d,u,p]=await Promise.all([call('/v1/admin/dashboard'),call('/v1/admin/users?limit=50&offset=0'),call('/v1/admin/payouts?limit=50&offset=0')]);
   setMetrics(d.metrics||{});setUsers(u.items||[]);setPayouts(p.items||[]);
  }catch(e){setAdmin(null);setError(e.message||'Could not load admin data.');}
  finally{setLoading(false);}
 },[call]);
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true);if(!u){setAdmin(null);setMetrics(null);setUsers([]);setPayouts([]);}}),[]);
 useEffect(()=>{if(user)refresh();},[user,refresh]);
 const act=async(fn,msg)=>{try{await fn();setNotice(msg);await refresh();}catch(e){setError(e.message||'Action failed');}};
 if(!authReady)return <AdminFrame><p>Checking sign-in…</p></AdminFrame>;
 if(!user)return <AdminFrame><section className="admin-login"><span className="admin-eyebrow">ADS+ ADMIN</span><h1>Authorized access only</h1><p>Sign in with the Firebase account whose UID is allowlisted by the API.</p><button onClick={()=>signInWithPopup(auth,googleProvider)}>Sign in with Google</button></section></AdminFrame>;
 return <AdminFrame>
  <header className="admin-top"><div><span className="admin-eyebrow">ADS+ CONTROL ROOM</span><h1>Admin dashboard</h1><p>{admin?admin.role+' administrator · '+(admin.email||admin.uid):'Verifying admin UID…'}</p></div><div className="admin-top-actions"><button className="admin-secondary" onClick={refresh}>Refresh</button><button className="admin-secondary" onClick={()=>signOut(auth)}>Sign out</button></div></header>
  {error&&<div className="admin-alert" role="alert">{error}</div>}{notice&&<div className="admin-notice" role="status">{notice}</div>}
  {admin&&<>
   <section className="admin-metrics">
    <Metric label="Users" value={metrics?.users_total}/><Metric label="Active users" value={metrics?.users_active}/><Metric label="Suspended" value={metrics?.users_banned}/><Metric label="Campaigns live" value={metrics?.campaigns_active}/><Metric label="Impressions · 24h" value={metrics?.impressions_24h}/><Metric label="Gross earned" value={money(metrics?.revenue_total_milli_paise)}/><Metric label="Platform share" value={money(metrics?.platform_share_total_milli_paise)}/><Metric label="Pending payouts" value={metrics?.payouts_pending}/>
   </section>
   <section className="admin-panel"><div className="admin-section-title"><div><h2>Users</h2><p>Server status and lifetime verified rewards.</p></div><span>{users.length} shown</span></div><div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Status</th><th>Rewards · lifetime</th><th>Pending</th><th>Actions</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><strong>{u.display_name||'Account'}</strong><small>{u.email||u.id}</small></td><td><span className={'admin-status '+(u.status==='active'?'is-active':'is-suspended')}>{u.status}</span></td><td>{money(u.earned_total_milli_paise)}</td><td>{money(u.earned_pending_milli_paise)}</td><td><button className="admin-action" disabled={loading||u.id===auth.currentUser?.uid} onClick={()=>act(()=>call('/v1/admin/users/'+u.id,{method:'PATCH',body:{status:u.status==='active'?'suspended':'active'}}),u.status==='active'?'User suspended':'User reactivated')}>{u.status==='active'?'Ban':'Unban'}</button></td></tr>)}</tbody></table></div></section>
   <section className="admin-panel"><div className="admin-section-title"><div><h2>Payout requests</h2><p>UPI is masked by the API. ₹ amounts shown in paise conversion.</p></div><span>{payouts.length} shown</span></div><div className="admin-table-wrap"><table><thead><tr><th>User / request</th><th>Amount</th><th>UPI</th><th>Status</th><th>Review</th></tr></thead><tbody>{payouts.map(p=><tr key={p.id}><td><strong>{p.display_name||p.email||p.user_id}</strong><small>{p.id}</small></td><td>{moneyPaise(p.amount_paise)}</td><td>{p.upi_id||'—'}</td><td><span className="admin-status">{p.status}</span></td><td className="admin-payout-actions">{p.status==='pending'&&<><button className="admin-action" onClick={()=>act(()=>call('/v1/admin/payouts/'+p.id,{method:'PATCH',body:{action:'approve'}}),'Payout approved')}>Approve</button><button className="admin-action danger" onClick={()=>act(()=>call('/v1/admin/payouts/'+p.id,{method:'PATCH',body:{action:'reject'}}),'Payout rejected')}>Reject</button></>}{p.status==='approved'&&<button className="admin-action" onClick={()=>{const utr=window.prompt('Enter bank UTR / transfer reference');if(utr)act(()=>call('/v1/admin/payouts/'+p.id,{method:'PATCH',body:{action:'mark_paid',utr_reference:utr.trim()}}),'Payout marked paid');}}>Mark paid</button>}{['paid','rejected','void'].includes(p.status)&&<span>Closed</span>}</td></tr>)}</tbody></table></div></section>
  </>}
  {loading&&<p className="admin-loading">Syncing live server data…</p>}
 </AdminFrame>;
}
function Metric({label,value}){return <article className="admin-metric"><span>{label}</span><strong>{value===undefined?'—':value}</strong></article>}
function AdminFrame({children}){return <main className="admin-root"><div className="admin-wrap">{children}<footer>Ads+ Admin · actions are verified and audited by the API.</footer></div></main>}
export default AdminPanel;
