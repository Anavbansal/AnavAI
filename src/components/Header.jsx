import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, UPSTOX_REDIRECT_URI } from '../config'

const TICKERS = [
  {sym:'NIFTY 50',p:24850,c:+0.42},{sym:'BANK NIFTY',p:52210,c:+0.61},
  {sym:'SENSEX',p:81500,c:+0.38},{sym:'RELIANCE',p:2890,c:+1.23},
  {sym:'TCS',p:3754,c:-0.34},{sym:'HDFCBANK',p:1612,c:+0.87},
  {sym:'INFY',p:1548,c:+0.56},{sym:'ICICIBANK',p:1289,c:+1.12},
  {sym:'SBIN',p:821,c:-0.45},{sym:'WIPRO',p:468,c:+0.33},
  {sym:'BAJFINANCE',p:7180,c:+0.78},{sym:'ADANIENT',p:2340,c:+2.15},
]

export default function Header() {
  const [time, setTime]         = useState('')
  const [mktOpen, setMktOpen]   = useState(false)
  const [tokenStatus, setToken] = useState('none')
  const [menuOpen, setMenu]     = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone:'Asia/Kolkata' }))
      const p = n => String(n).padStart(2,'0')
      setTime(`${p(ist.getHours())}:${p(ist.getMinutes())}:${p(ist.getSeconds())} IST`)
      const d = ist.getDay(), m = ist.getHours()*60+ist.getMinutes()
      setMktOpen(d>=1&&d<=5&&m>=555&&m<930)
    }
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id)
  },[])

  useEffect(() => {
    const token = localStorage.getItem('upstox_access_token')
    const ts    = localStorage.getItem('upstox_token_ts')
    if (token && ts && Date.now()-Number(ts) < 23*3600*1000) setToken('active')
    else { localStorage.removeItem('upstox_access_token'); setToken('none') }
  },[])

  async function connectUpstox() {
    setToken('connecting')
    try {
      const res  = await fetch(`${API_BASE_URL}/auth/url`)
      const data = await res.json()
      if (data?.data?.authorizationUrl) window.location.href = data.data.authorizationUrl
      else { alert('Cannot get auth URL. Check server env vars.'); setToken('none') }
    } catch(e) { alert('Server error: '+e.message); setToken('none') }
  }

  function disconnect() {
    localStorage.removeItem('upstox_access_token')
    localStorage.removeItem('upstox_refresh_token')
    localStorage.removeItem('upstox_token_ts')
    setToken('none')
  }

  const tickers = [...TICKERS,...TICKERS]

  return (
    <header style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:200 }}>
      {/* ── Desktop header ── */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 20px', gap:12 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#5865f2,#22c55e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📈</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17, color:'var(--text)' }}>AnavAI</div>
            <div style={{ fontSize:9, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase' }}>Stock Terminal</div>
          </div>
        </div>

        <div style={{flex:1}}/>

        {/* Market status — hide on small mobile */}
        <div className="header-desktop" style={{
          display:'flex', alignItems:'center', gap:6, padding:'5px 13px',
          borderRadius:20, background:mktOpen?'rgba(34,197,94,.08)':'var(--surface)',
          border:`1px solid ${mktOpen?'#22c55e33':'var(--border)'}`,
          fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600,
        }}>
          <span style={{ width:6, height:6, borderRadius:'50%', display:'inline-block',
            background:mktOpen?'var(--green)':'var(--text3)',
            boxShadow:mktOpen?'0 0 6px var(--green)':'none',
            animation:mktOpen?'pulse 2s infinite':'none' }}/>
          <span style={{ color:mktOpen?'var(--green)':'var(--text3)' }}>
            {mktOpen?'Market Open':'Market Closed'}
          </span>
        </div>

        {/* Connect button */}
        {tokenStatus === 'active' ? (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20,
              background:'#22c55e10', border:'1px solid #22c55e33',
              fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, color:'var(--green)' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block', animation:'pulse 2s infinite' }}/>
              Upstox Live
            </div>
            <button onClick={disconnect} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:13 }}>✕</button>
          </div>
        ) : (
          <button onClick={connectUpstox} disabled={tokenStatus==='connecting'} style={{
            display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20,
            cursor:'pointer', fontSize:12, fontWeight:600, border:'none',
            background:tokenStatus==='connecting'?'var(--bg2)':'linear-gradient(135deg,#5865f2,#22c55e)',
            color:tokenStatus==='connecting'?'var(--text3)':'#fff',
            boxShadow:tokenStatus==='connecting'?'none':'0 4px 16px #5865f244',
          }}>
            {tokenStatus==='connecting'
              ? <><span className="anim-spin" style={{display:'inline-block',width:12,height:12,border:'2px solid #ffffff40',borderTopColor:'#fff',borderRadius:'50%'}}/> Connecting...</>
              : '🔗 Connect Upstox'}
          </button>
        )}

        {/* Time — desktop only */}
        <div className="header-desktop" style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'var(--text3)' }}>{time}</div>

        {/* Logout */}
        <button onClick={()=>{localStorage.removeItem('anav.auth');nav('/')}}
          className="btn btn-ghost" style={{ fontSize:12, padding:'5px 12px' }}>
          Sign out
        </button>
      </div>

      {/* Ticker tape */}
      <div style={{ overflow:'hidden', borderTop:'1px solid var(--border)', background:'var(--bg)', padding:'4px 0' }}>
        <div className="anim-ticker" style={{ display:'flex', gap:24, width:'max-content' }}>
          {tickers.map((t,i)=>(
            <span key={i} style={{ display:'flex', alignItems:'center', gap:6, fontFamily:"'DM Mono',monospace", fontSize:11, whiteSpace:'nowrap' }}>
              <span style={{ color:'var(--text2)', fontWeight:500 }}>{t.sym}</span>
              <span style={{ color:'var(--text)', fontWeight:500 }}>{t.p.toLocaleString('en-IN')}</span>
              <span style={{ color:t.c>=0?'var(--green)':'var(--red)', fontWeight:700 }}>
                {t.c>=0?'▲':'▼'}{Math.abs(t.c).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
