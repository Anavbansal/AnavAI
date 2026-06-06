import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, UPSTOX_REDIRECT_URI } from '../config'

const TICKERS = [
  {sym:'NIFTY 50',p:24850,c:+0.42},{sym:'BANK NIFTY',p:52210,c:+0.61},
  {sym:'SENSEX',p:81500,c:+0.38},{sym:'FIN NIFTY',p:23480,c:-0.18},
  {sym:'RELIANCE',p:2890,c:+1.23},{sym:'TCS',p:3754,c:-0.34},
  {sym:'HDFCBANK',p:1612,c:+0.87},{sym:'INFY',p:1548,c:+0.56},
  {sym:'ICICIBANK',p:1289,c:+1.12},{sym:'SBIN',p:821,c:-0.45},
  {sym:'WIPRO',p:468,c:+0.33},{sym:'BAJFINANCE',p:7180,c:+0.78},
  {sym:'ADANIENT',p:2340,c:+2.15},{sym:'LT',p:3612,c:-0.22},
  {sym:'AXISBANK',p:1148,c:+0.91},{sym:'KOTAKBANK',p:2180,c:-0.15},
  {sym:'MARUTI',p:12450,c:+0.67},{sym:'ASIANPAINT',p:2820,c:-0.43},
]

export default function Header() {
  const [time, setTime]       = useState('')
  const [mktOpen, setMktOpen] = useState(false)
  const [tokenStatus, setTokenStatus] = useState('none') // 'none' | 'active' | 'connecting'
  const nav = useNavigate()

  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const pad = n => String(n).padStart(2,'0')
      setTime(`${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())} IST`)
      const d = ist.getDay(), m = ist.getHours()*60+ist.getMinutes()
      setMktOpen(d>=1&&d<=5&&m>=555&&m<930)
    }
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id)
  },[])

  // Check token status on mount
  useEffect(() => {
    const token = localStorage.getItem('upstox_access_token')
    const ts    = localStorage.getItem('upstox_token_ts')
    if (token && ts) {
      const age = Date.now() - Number(ts)
      // Upstox token valid for ~24 hours
      if (age < 23 * 3600 * 1000) setTokenStatus('active')
      else { localStorage.removeItem('upstox_access_token'); setTokenStatus('none') }
    }
  }, [])

  async function connectUpstox() {
    setTokenStatus('connecting')
    try {
      const res  = await fetch(`${API_BASE_URL}/auth/url?redirect_uri=${encodeURIComponent(UPSTOX_REDIRECT_URI)}`)
      const data = await res.json()
      if (data?.data?.authorizationUrl) {
        window.location.href = data.data.authorizationUrl
      } else {
        alert('Could not get Upstox auth URL. Check server environment variables.')
        setTokenStatus('none')
      }
    } catch(e) {
      alert('Server not reachable: ' + e.message)
      setTokenStatus('none')
    }
  }

  function disconnectUpstox() {
    localStorage.removeItem('upstox_access_token')
    localStorage.removeItem('upstox_refresh_token')
    localStorage.removeItem('upstox_token_ts')
    setTokenStatus('none')
  }

  function logout() { localStorage.removeItem('anav.auth'); nav('/') }

  const tickers = [...TICKERS,...TICKERS]

  return (
    <header style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:200 }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 20px', gap:12 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:34, height:34, borderRadius:10,
            background:'linear-gradient(135deg,#5865f2,#22c55e)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18, boxShadow:'0 4px 12px #5865f233',
          }}>📈</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17, color:'var(--text)', letterSpacing:-.3 }}>AnavAI</div>
            <div style={{ fontSize:9, color:'var(--text3)', fontWeight:500, letterSpacing:1, textTransform:'uppercase' }}>Stock Terminal</div>
          </div>
        </div>

        <div style={{flex:1}}/>

        {/* Market status */}
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'5px 13px', borderRadius:20,
          background: mktOpen ? 'rgba(34,197,94,.08)' : 'var(--surface)',
          border: `1px solid ${mktOpen ? '#22c55e33' : 'var(--border)'}`,
          fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600,
        }}>
          <span style={{
            width:6, height:6, borderRadius:'50%', display:'inline-block',
            background: mktOpen ? 'var(--green)' : 'var(--text3)',
            boxShadow: mktOpen ? '0 0 6px var(--green)' : 'none',
            animation: mktOpen ? 'pulse 2s infinite' : 'none',
          }}/>
          <span style={{ color: mktOpen ? 'var(--green)' : 'var(--text3)' }}>
            {mktOpen ? 'Market Open' : 'Market Closed'}
          </span>
        </div>

        {/* Upstox Connect Button */}
        {tokenStatus === 'active' ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
              borderRadius:20, background:'#22c55e10', border:'1px solid #22c55e33',
              fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, color:'var(--green)',
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block', animation:'pulse 2s infinite' }}/>
              Upstox Live
            </div>
            <button onClick={disconnectUpstox}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:11, padding:'4px 8px' }}
              title="Disconnect Upstox">
              ✕
            </button>
          </div>
        ) : (
          <button onClick={connectUpstox} disabled={tokenStatus==='connecting'}
            style={{
              display:'flex', alignItems:'center', gap:6, padding:'6px 14px',
              borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600,
              background: tokenStatus==='connecting' ? 'var(--bg2)' : 'linear-gradient(135deg,#5865f2,#22c55e)',
              border: tokenStatus==='connecting' ? '1px solid var(--border)' : 'none',
              color: tokenStatus==='connecting' ? 'var(--text3)' : '#fff',
              transition:'all .2s', boxShadow: tokenStatus==='connecting' ? 'none' : '0 4px 16px #5865f244',
            }}>
            {tokenStatus==='connecting'
              ? <><span className="anim-spin" style={{display:'inline-block',width:12,height:12,border:'2px solid #ffffff40',borderTopColor:'#fff',borderRadius:'50%'}}/> Connecting...</>
              : <>🔗 Connect Upstox Live</>}
          </button>
        )}

        {/* Time */}
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'var(--text3)', fontWeight:500 }}>{time}</div>

        {/* User avatar + logout */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            width:30, height:30, borderRadius:'50%',
            background:'linear-gradient(135deg,#5865f2,#a78bfa)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13, fontWeight:700, color:'#fff', fontFamily:"'Syne',sans-serif",
          }}>A</div>
          <button onClick={logout} className="btn btn-ghost" style={{ fontSize:12, padding:'5px 12px' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Ticker tape */}
      <div style={{ overflow:'hidden', borderTop:'1px solid var(--border)', background:'var(--bg)', padding:'4px 0' }}>
        <div className="anim-ticker" style={{ display:'flex', gap:28, width:'max-content' }}>
          {tickers.map((t,i) => (
            <span key={i} style={{ display:'flex', alignItems:'center', gap:7, fontFamily:"'DM Mono',monospace", fontSize:11, whiteSpace:'nowrap' }}>
              <span style={{ color:'var(--text2)', fontWeight:500 }}>{t.sym}</span>
              <span style={{ color:'var(--text)', fontWeight:500 }}>{t.p.toLocaleString('en-IN')}</span>
              <span style={{ color: t.c>=0 ? 'var(--green)' : 'var(--red)', fontWeight:700 }}>
                {t.c>=0?'▲':'▼'} {Math.abs(t.c).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
