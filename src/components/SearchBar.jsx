import React, { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../config'
import { ALL_SYMBOLS } from '../data/symbols'

// Symbol database imported from src/data/symbols.js (298+ stocks)
const SYMBOLS = ALL_SYMBOLS

// ─── Smart local search ───────────────────────────────────────────────────────
function smartSearch(query) {
  if (!query || query.trim().length < 1) return []
  const q = query.trim().toUpperCase()
  return SYMBOLS
    .map(sym => {
      const sU = sym.s.toUpperCase(), nU = sym.n.toUpperCase()
      let score = 0
      if (sU === q)               score = 200
      else if (sU.startsWith(q))  score = 150
      else if (nU.startsWith(q))  score = 120
      else if (sU.includes(q))    score = 80
      else if (nU.includes(q))    score = 50
      else return null
      if (sym.seg === 'INDEX') score += 10
      return { ...sym, score }
    })
    .filter(Boolean)
    .sort((a,b) => b.score - a.score)
    .slice(0, 10)
}

const SEG_COLOR = {
  'INDEX': { bg:'#5865f220', color:'#7c8af7', label:'INDEX' },
  'EQ':    { bg:'#22c55e15', color:'#22c55e', label:'EQ' },
}

export default function SearchBar({ onAnalyze, loading }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(-1)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // Instant search on every keystroke — local DB first, server for full NSE list
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    // Immediate local results
    const local = smartSearch(query)
    setResults(local)
    setHovered(-1)
    // Also search server for full NSE results (debounced)
    const t = setTimeout(async () => {
      try {
        const token = localStorage.getItem('upstox_access_token') || ''
        const r = await fetch(
          `${API_BASE_URL}/api/search?q=${encodeURIComponent(query.trim())}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )
        const data = await r.json()
        const serverResults = (data.results || []).map(item => ({
          s: item.tradingSymbol || item.symbol || '',
          n: item.name || item.shortName || '',
          e: item.exchange || 'NSE',
          seg: (item.segment || '').replace('NSE_','').replace('BSE_','') || 'EQ',
          k: item.instrumentKey || '',
          fromServer: true,
        })).filter(x => x.s)
        // Merge: local first, then server results not in local
        const localSyms = new Set(local.map(l => l.s))
        const merged = [
          ...local,
          ...serverResults.filter(sr => !localSyms.has(sr.s))
        ].slice(0, 15)
        setResults(merged)
      } catch {
        // Server unavailable — keep local results
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  function select(sym) {
    setQuery(sym.s)
    setResults([])
    setFocused(false)
    onAnalyze({ symbol: sym.s, instrumentKey: sym.k }, '5')
  }

  function onKeyDown(e) {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHovered(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHovered(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hovered >= 0) select(results[hovered])
      else if (results[0]) select(results[0])
      else onAnalyze(query.trim().toUpperCase(), '5')
    } else if (e.key === 'Escape') {
      setResults([]); setFocused(false); inputRef.current?.blur()
    }
  }

  const showDropdown = focused && results.length > 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

      {/* Search box */}
      <div style={{ position:'relative' }}>
        {/* Icon */}
        <svg style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
          color: focused ? 'var(--accent2)' : 'var(--text3)', transition:'color .15s', pointerEvents:'none' }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value.toUpperCase()); setFocused(true) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onKeyDown={onKeyDown}
          placeholder="Search stocks, indices… e.g. REL, HDFC, NIFTY"
          className="input"
          autoComplete="off"
          style={{
            height: 46, paddingLeft: 42, paddingRight: 100,
            fontSize: 14, fontFamily:"'DM Sans',sans-serif",
            borderColor: focused ? 'var(--accent)' : 'var(--border)',
            boxShadow: focused ? '0 0 0 3px #5865f220' : 'none',
          }}
        />

        {/* Inline analyze button */}
        <button
          onClick={() => {
            if (results[0]) select(results[0])
            else onAnalyze(query.trim().toUpperCase() || 'NIFTY', '5')
          }}
          disabled={loading}
          className="btn btn-primary"
          style={{
            position:'absolute', right:4, top:'50%', transform:'translateY(-50%)',
            height:38, padding:'0 14px', fontSize:13,
            fontFamily:"'Syne',sans-serif", fontWeight:700,
          }}>
          {loading
            ? <span className="anim-spin" style={{ display:'inline-block', width:14, height:14, border:'2px solid #ffffff40', borderTopColor:'#fff', borderRadius:'50%' }}/>
            : '▶'}
        </button>

        {/* ── Dropdown ── */}
        {showDropdown && (
          <div ref={listRef} style={{
            position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:1000,
            background:'var(--surface)', border:'1px solid var(--bd2)',
            borderRadius:10, boxShadow:'0 12px 40px rgba(0,0,0,.6)',
            overflow:'hidden',
          }}>
            {/* Header */}
            <div style={{ padding:'6px 14px', background:'var(--bg2)', borderBottom:'1px solid var(--border)',
              fontSize:10, color:'var(--text3)', fontWeight:600, letterSpacing:1,
              display:'flex', justifyContent:'space-between' }}>
              <span>RESULTS ({results.length})</span>
              <span>↑↓ navigate · Enter select · Esc close</span>
            </div>

            {results.map((sym, i) => {
              const seg = SEG_COLOR[sym.seg] || SEG_COLOR.EQ
              const isHovered = hovered === i
              return (
                <div
                  key={sym.k}
                  onMouseDown={() => select(sym)}
                  onMouseEnter={() => setHovered(i)}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    background: isHovered ? 'var(--surface2)' : 'transparent',
                    transition:'background .1s',
                  }}>
                  {/* Symbol */}
                  <div style={{ minWidth:90 }}>
                    <div style={{
                      fontFamily:"'DM Mono',monospace", fontWeight:600,
                      fontSize:14, color: isHovered ? 'var(--accent2)' : 'var(--text)',
                      letterSpacing:.5,
                    }}>{sym.s}</div>
                  </div>
                  {/* Name */}
                  <div style={{ flex:1, fontSize:12, color:'var(--text2)', lineHeight:1.3 }}>
                    {sym.n}
                  </div>
                  {/* Badges */}
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
                      background: seg.bg, color: seg.color,
                      fontFamily:"'DM Mono',monospace", fontWeight:600 }}>
                      {seg.label}
                    </span>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
                      background:'#1e2d42', color:'var(--text3)',
                      fontFamily:"'DM Mono',monospace" }}>
                      {sym.e}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick watchlist chips */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {['NIFTY','BANKNIFTY','RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','SBIN','WIPRO','ADANIENT'].map(chip => (
          <button key={chip}
            onClick={() => { setQuery(chip); onAnalyze({ symbol:chip, instrumentKey: SYMBOLS.find(s=>s.s===chip)?.k||'' }, '5') }}
            style={{
              padding:'4px 11px', borderRadius:20, cursor:'pointer',
              border:`1px solid ${query===chip ? 'var(--accent)' : 'var(--border)'}`,
              background: query===chip ? '#5865f215' : 'var(--bg2)',
              color: query===chip ? 'var(--accent2)' : 'var(--text3)',
              fontSize:12, fontWeight:500, transition:'all .15s',
              fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap',
            }}
            onMouseEnter={e => { if(query!==chip){ e.currentTarget.style.borderColor='var(--bd2)'; e.currentTarget.style.color='var(--text2)' }}}
            onMouseLeave={e => { if(query!==chip){ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text3)' }}}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
