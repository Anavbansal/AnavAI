import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TICKERS = [
  { sym: 'NIFTY 50', p: 24850, c: +0.42 }, { sym: 'BANK NIFTY', p: 52210, c: +0.61 },
  { sym: 'FIN NIFTY', p: 23480, c: -0.18 }, { sym: 'RELIANCE', p: 2890, c: +1.23 },
  { sym: 'TCS', p: 3754, c: -0.34 }, { sym: 'HDFCBANK', p: 1612, c: +0.87 },
  { sym: 'INFY', p: 1548, c: +0.56 }, { sym: 'ICICIBANK', p: 1289, c: +1.12 },
  { sym: 'SBIN', p: 821, c: -0.45 }, { sym: 'WIPRO', p: 468, c: +0.33 },
  { sym: 'ADANIENT', p: 2340, c: +2.15 }, { sym: 'LT', p: 3612, c: -0.22 },
  { sym: 'BAJFINANCE', p: 7180, c: +0.78 }, { sym: 'AXISBANK', p: 1148, c: +0.91 },
]

function fmt(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function Header() {
  const [time, setTime] = useState('')
  const [mktOpen, setMktOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const h = String(ist.getHours()).padStart(2, '0')
      const m = String(ist.getMinutes()).padStart(2, '0')
      const s = String(ist.getSeconds()).padStart(2, '0')
      setTime(`${h}:${m}:${s} IST`)
      const day = ist.getDay(), mins = ist.getHours() * 60 + ist.getMinutes()
      setMktOpen(day >= 1 && day <= 5 && mins >= 555 && mins < 930)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  function logout() {
    localStorage.removeItem('anav.auth')
    navigate('/')
  }

  const tickItems = [...TICKERS, ...TICKERS]

  return (
    <header style={{ position: 'relative', zIndex: 1 }}>
      {/* Top bar */}
      <div className="panel border-b-0" style={{ borderTop: '2px solid #00d4ff' }}>
        <div className="absolute top-0 left-0 right-0 h-0.5 animate-scanline"
          style={{ background: 'linear-gradient(90deg,transparent,#00d4ff,transparent)' }} />
        <div className="flex items-center gap-4 px-4 py-3">
          <div>
            <div className="font-display font-black text-accent glow-accent" style={{ fontSize: 20, letterSpacing: 3 }}>
              ANAV<span className="text-accent2">PRO</span>
            </div>
            <div className="font-mono text-muted uppercase tracking-widest" style={{ fontSize: 10 }}>
              Indian Equity · F&amp;O · Intraday · Delivery
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className={`flex items-center gap-2 font-mono border px-3 py-1 ${mktOpen ? 'text-accent2 border-accent2' : 'text-muted border-border'}`}
              style={{ fontSize: 11, background: mktOpen ? 'rgba(0,255,136,0.05)' : 'transparent' }}>
              <span className={`w-2 h-2 rounded-full inline-block ${mktOpen ? 'bg-accent2 animate-pulse-dot' : 'bg-muted'}`}
                style={{ boxShadow: mktOpen ? '0 0 6px #00ff88' : 'none' }} />
              {mktOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </div>
            <div className="font-mono text-muted" style={{ fontSize: 12 }}>{time}</div>
            <button onClick={logout}
              className="font-mono text-dim border border-border px-3 py-1 hover:text-danger hover:border-danger transition-colors"
              style={{ fontSize: 11 }}>
              LOGOUT
            </button>
          </div>
        </div>
      </div>

      {/* Ticker tape */}
      <div className="overflow-hidden border-y border-border py-1.5" style={{ background: '#0d1825' }}>
        <div className="flex gap-8 animate-ticker" style={{ width: 'max-content' }}>
          {tickItems.map((t, i) => (
            <span key={i} className="flex items-center gap-2 font-mono whitespace-nowrap" style={{ fontSize: 12 }}>
              <span className="text-accent font-bold">{t.sym}</span>
              <span className="text-gray-200">{fmt(t.p)}</span>
              <span className={t.c >= 0 ? 'text-bull' : 'text-bear'}>
                {t.c >= 0 ? '▲' : '▼'} {Math.abs(t.c).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
