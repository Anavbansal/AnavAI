import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TICKERS = [
  {sym:'NIFTY 50',p:24850,c:+0.42},{sym:'BANK NIFTY',p:52210,c:+0.61},
  {sym:'SENSEX',p:81500,c:+0.38},{sym:'FIN NIFTY',p:23480,c:-0.18},
  {sym:'RELIANCE',p:2890,c:+1.23},{sym:'TCS',p:3754,c:-0.34},
  {sym:'HDFCBANK',p:1612,c:+0.87},{sym:'INFY',p:1548,c:+0.56},
  {sym:'ICICIBANK',p:1289,c:+1.12},{sym:'SBIN',p:821,c:-0.45},
  {sym:'WIPRO',p:468,c:+0.33},{sym:'BAJFINANCE',p:7180,c:+0.78},
  {sym:'ADANIENT',p:2340,c:+2.15},{sym:'LT',p:3612,c:-0.22},
  {sym:'AXISBANK',p:1148,c:+0.91},{sym:'KOTAKBANK',p:2180,c:-0.15},
]

export default function Header() {
  const [time, setTime] = useState('')
  const [mktOpen, setMktOpen] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      setTime(`${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}:${String(ist.getSeconds()).padStart(2,'0')} IST`)
      const d = ist.getDay(), m = ist.getHours()*60+ist.getMinutes()
      setMktOpen(d>=1&&d<=5&&m>=555&&m<930)
    }
    tick(); const id = setInterval(tick,1000); return ()=>clearInterval(id)
  }, [])

  function logout() { localStorage.removeItem('anav.auth'); nav('/') }

  const tickers = [...TICKERS,...TICKERS]

  return (
    <header style={{ background:'#0e1420', borderBottom:'1px solid #1f2d45', position:'sticky', top:0, zIndex:100 }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', padding:'12px 20px', gap:16 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:'linear-gradient(135deg, #6366f1, #10b981)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
          }}>📈</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#f1f5f9', letterSpacing:-0.3 }}>AnavAI</div>
            <div style={{ fontSize:9, color:'#475569', fontWeight:500, letterSpacing:0.5 }}>STOCK TERMINAL</div>
          </div>
        </div>

        <div style={{ flex:1 }}/>

        {/* Market status */}
        <div style={{
          display:'flex', alignItems:'center', gap:6, padding:'4px 12px',
          background: mktOpen ? '#064e3b20' : '#1e293b',
          border: `1px solid ${mktOpen ? '#10b98133' : '#1f2d45'}`,
          borderRadius:20, fontSize:11, fontFamily:'JetBrains Mono, monospace',
          fontWeight:600,
        }}>
          <div style={{
            width:6, height:6, borderRadius:'50%',
            background: mktOpen ? '#10b981' : '#475569',
            boxShadow: mktOpen ? '0 0 6px #10b981' : 'none',
            animation: mktOpen ? 'pulse 2s infinite' : 'none',
          }}/>
          <span style={{ color: mktOpen ? '#10b981' : '#64748b' }}>
            {mktOpen ? 'Market Open' : 'Market Closed'}
          </span>
        </div>

        {/* Time */}
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'#64748b', fontWeight:500 }}>
          {time}
        </div>

        {/* Logout */}
        <button onClick={logout} className="btn btn-ghost" style={{ fontSize:12, padding:'6px 12px' }}>
          Sign out
        </button>
      </div>

      {/* Ticker tape */}
      <div style={{
        overflow:'hidden', borderTop:'1px solid #1f2d45',
        background:'#0b0f19', padding:'5px 0',
      }}>
        <div className="animate-ticker" style={{ display:'flex', gap:32, width:'max-content' }}>
          {tickers.map((t,i)=>(
            <span key={i} style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'JetBrains Mono, monospace', fontSize:11, whiteSpace:'nowrap' }}>
              <span style={{ color:'#94a3b8', fontWeight:600 }}>{t.sym}</span>
              <span style={{ color:'#f1f5f9', fontWeight:500 }}>{t.p.toLocaleString('en-IN')}</span>
              <span style={{ color: t.c>=0 ? '#10b981' : '#ef4444', fontWeight:700 }}>
                {t.c>=0?'▲':'▼'}{Math.abs(t.c).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
