import React, { useState, useEffect, useRef } from 'react'
import { searchSymbol } from '../services/marketData'

const WATCHLIST = [
  {l:'NIFTY 50',s:'NIFTY'},{l:'BANK NIFTY',s:'BANKNIFTY'},
  {l:'RELIANCE',s:'RELIANCE'},{l:'TCS',s:'TCS'},
  {l:'HDFCBANK',s:'HDFCBANK'},{l:'INFY',s:'INFY'},
  {l:'ICICIBANK',s:'ICICIBANK'},{l:'SBIN',s:'SBIN'},
  {l:'WIPRO',s:'WIPRO'},{l:'BAJFINANCE',s:'BAJFINANCE'},
  {l:'MARUTI',s:'MARUTI'},{l:'ADANIENT',s:'ADANIENT'},
]

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

export default function SearchBar({ onAnalyze, loading }) {
  const [sym, setSym]   = useState('NIFTY')
  const [sugg, setSugg] = useState([])
  const [show, setShow] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref = useRef()

  useEffect(() => {
    let cancelled = false
    const q = sym.trim()
    if (q.length < 2) { setSugg([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await searchSymbol(q)
        if (!cancelled) setSugg(r.slice(0,8))
      } catch { if (!cancelled) setSugg([]) }
    }, 220)
    return () => { cancelled=true; clearTimeout(t) }
  }, [sym])

  function go(input=sym) {
    const raw = typeof input === 'string' ? input : (input?.tradingSymbol||input?.symbol||'')
    const clean = raw.trim().toUpperCase()
    if (!clean) return
    setSym(clean); setSugg([]); setShow(false); setFocused(false)
    if (typeof input==='string') onAnalyze(clean, '5')
    else onAnalyze({ symbol: clean, instrumentKey: input?.instrumentKey||'' }, '5')
  }

  return (
    <div>
      {/* Search row */}
      <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{
            position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
            color: focused ? 'var(--accent2)' : 'var(--text3)',
            transition:'color .15s', pointerEvents:'none',
          }}><SearchIcon/></span>
          <input
            ref={ref}
            value={sym}
            onChange={e => { setSym(e.target.value.toUpperCase()); setShow(true) }}
            onKeyDown={e => e.key==='Enter' && go()}
            onFocus={() => { setShow(true); setFocused(true) }}
            onBlur={() => { setTimeout(()=>{setShow(false);setFocused(false)},160) }}
            placeholder="Search stocks, indices, F&O…"
            className="input"
            style={{ height:46, paddingLeft:42, fontSize:14, fontFamily:"'DM Sans',sans-serif" }}
          />

          {/* Dropdown */}
          {show && sugg.length > 0 && (
            <div style={{
              position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:300,
              background:'var(--surface)', border:'1px solid var(--bd2)',
              borderRadius:10, boxShadow:'var(--shadow-lg)', overflow:'hidden',
            }}>
              {sugg.map(item => (
                <div key={item.instrumentKey||item.symbol}
                  onMouseDown={() => go(item)}
                  style={{
                    padding:'10px 14px', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    transition:'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:500, fontSize:13, color:'var(--text)' }}>
                      {item.tradingSymbol||item.symbol}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{item.name}</div>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    <span className="badge badge-accent">{item.exchange}</span>
                    {item.segment && <span className="badge badge-blue" style={{fontSize:9}}>{item.segment}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => go()} disabled={loading} className="btn btn-primary"
          style={{ height:46, padding:'0 22px', fontSize:14, fontFamily:"'Syne',sans-serif", fontWeight:700 }}>
          {loading
            ? <span style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="anim-spin" style={{display:'inline-block',width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%'}}/>
                Analyzing…
              </span>
            : '▶ Analyze'}
        </button>
      </div>

      {/* Watchlist chips */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
        {WATCHLIST.map(q => {
          const active = sym === q.s
          return (
            <button key={q.s}
              onClick={() => { setSym(q.s); go(q.s) }}
              style={{
                padding:'4px 12px', borderRadius:20, cursor:'pointer',
                border:`1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? '#5865f215' : 'var(--bg2)',
                color: active ? 'var(--accent2)' : 'var(--text3)',
                fontSize:12, fontWeight:500, transition:'all .15s',
                fontFamily:"'DM Sans',sans-serif",
              }}
              onMouseEnter={e => { if(!active) { e.currentTarget.style.borderColor='var(--bd2)'; e.currentTarget.style.color='var(--text2)' }}}
              onMouseLeave={e => { if(!active) { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text3)' }}}>
              {q.l}
            </button>
          )
        })}
      </div>
    </div>
  )
}
