import React, { useState, useEffect, useRef } from 'react'
import { searchInstruments, getInstrumentBySymbol } from '../utils/instrumentSearch'

const QUICK = [
  { label:'NIFTY 50',   sym:'NIFTY' },
  { label:'BANK NIFTY', sym:'BANKNIFTY' },
  { label:'FIN NIFTY',  sym:'FINNIFTY' },
  { label:'RELIANCE',   sym:'RELIANCE' },
  { label:'TCS',        sym:'TCS' },
  { label:'HDFCBANK',   sym:'HDFCBANK' },
  { label:'INFY',       sym:'INFY' },
  { label:'ICICIBANK',  sym:'ICICIBANK' },
  { label:'SBIN',       sym:'SBIN' },
  { label:'WIPRO',      sym:'WIPRO' },
  { label:'BAJFINANCE', sym:'BAJFINANCE' },
  { label:'ADANIENT',   sym:'ADANIENT' },
]

const TIMEFRAMES = [
  {label:'1m',val:'1'},{label:'3m',val:'3'},{label:'5m',val:'5'},
  {label:'15m',val:'15'},{label:'30m',val:'30'},{label:'1H',val:'60'},{label:'D',val:'D'},
]

export default function SearchBar({ onAnalyze, loading }) {
  const [symbol, setSymbol] = useState('NIFTY')
  const [tf, setTf]         = useState('5')
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const q = symbol.trim()
    if (q.length < 1) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(() => {
      if (!cancelled) {
        const matches = searchInstruments(q)
        setSuggestions(matches)
      }
    }, 100)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [symbol])

  function submit(input = symbol, t = tf) {
    const raw = typeof input === 'string' ? input : input?.tradingSymbol || input?.symbol || ''
    const clean = raw.trim().toUpperCase()
    if (!clean) return
    
    setSymbol(clean)
    setSuggestions([])
    setShowSug(false)
    
    // Get instrument details including instrumentKey
    const instrument = getInstrumentBySymbol(clean) || { symbol: clean, instrumentKey: '' }
    
    onAnalyze({
      symbol: clean,
      instrumentKey: instrument.instrumentKey || ''
    }, t)
  }

  function pickSuggestion(item) {
    submit(item, tf)
  }

  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex gap-2">
        {/* Symbol input with autocomplete */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent" style={{ fontSize:16 }}>⌕</span>
          <input
            ref={inputRef}
            value={symbol}
            onChange={e => { setSymbol(e.target.value.toUpperCase()); setShowSug(true) }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="NIFTY / RELIANCE / HDFCBANK / TCS..."
            className="w-full bg-panel border border-border text-gray-200 font-mono text-sm outline-none focus:border-accent transition-colors"
            style={{ padding:'10px 12px 10px 36px', letterSpacing:1 }}
          />
          {/* Suggestions dropdown */}
          {showSug && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 border border-border" style={{ background:'#0a1520', marginTop:2 }}>
              {suggestions.map(item => (
                <div key={item.instrumentKey || item.symbol} onMouseDown={() => pickSuggestion(item)}
                  className="px-3 py-2 cursor-pointer hover:bg-bg3 font-mono text-sm text-gray-200 border-b border-border/40 last:border-0"
                  style={{ letterSpacing:1 }}>
                  <span className="text-accent">{item.tradingSymbol || item.symbol}</span>
                  <span className="text-dim"> {item.exchange} {item.segment}</span>
                  <div className="text-dim" style={{ fontSize: 11 }}>
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeframe buttons */}
        <div className="flex gap-1">
          {TIMEFRAMES.map(t => (
            <button key={t.val} onClick={() => setTf(t.val)}
              className={`font-mono border px-2.5 py-2 transition-all text-xs ${
                tf === t.val
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border text-muted hover:border-accent hover:text-accent'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <button onClick={() => submit()} disabled={loading}
          className="btn-accent px-5 py-2 font-display font-bold tracking-widest text-xs">
          {loading ? '⟳ LOADING...' : '▶ ANALYZE'}
        </button>
      </div>

      {/* Quick symbol chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map(q => (
          <button key={q.sym} onClick={() => { setSymbol(q.sym); submit(q.sym, tf) }}
            className={`font-mono border px-3 py-1 transition-all text-xs ${
              symbol === q.sym
                ? 'border-accent2 text-accent2 bg-accent2/5'
                : 'border-border text-muted hover:border-accent2 hover:text-accent2'
            }`}
            style={{ background:'#0d1825' }}>
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}
