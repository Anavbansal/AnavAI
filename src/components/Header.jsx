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
  {sym:'MARUTI',p:12450,c:+0.67},{sym:'ASIANPAINT',p:2820,c:-0.43},
]

export default function Header() {
  const [time, setTime] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const pad = n => String(n).padStart(2,'0')
      setTime(`${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())} IST`)
      const d = ist.getDay(), m = ist.getHours()*60+ist.getMinutes()
      setOpen(d>=1&&d<=5&&m>=555&&m<930)
    }
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id)
  },[])

  const tickers = [...TICKERS,...TICKERS]

  return (
    <header style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:200 }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 20px', gap:16 }}>
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

        {/* Market status pill */}
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'5px 13px', borderRadius:20,
          background: open ? 'rgba(34,197,94,.08)' : 'var(--surface)',
          border: `1px solid ${open ? '#22c55e33' : 'var(--border)'}`,
          fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600,
        }}>
          <span style={{
            width:6,height:6,borderRadius:'50%',display:'inline-block',
            background: open ? 'var(--green)' : 'var(--text3)',
            boxShadow: open ? '0 0 6px var(--green)' : 'none',
            animation: open ? 'pulse 2s infinite' : 'none',
          }}/>
          <span style={{ color: open ? 'var(--green)' : 'var(--text3)' }}>
            {open ? 'Market Open' : 'Market Closed'}
          </span>
        </div>

        {/* Time */}
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'var(--text3)', fontWeight:500 }}>{time}</div>

        {/* User + logout */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            width:30, height:30, borderRadius:'50%',
            background:'linear-gradient(135deg,#5865f2,#a78bfa)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13, fontWeight:700, color:'#fff', fontFamily:"'Syne',sans-serif",
          }}>A</div>
          <button onClick={() => { localStorage.removeItem('anav.auth'); nav('/') }}
            className="btn btn-ghost" style={{ fontSize:12, padding:'5px 12px' }}>
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
