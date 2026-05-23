import React, { useMemo, useState } from 'react'
import { fmt } from '../utils/indicators'

export default function FOGreeks({ data }) {
  const [showAll, setShowAll] = useState(false)

  const rows = useMemo(() => {
    if (!data?.optionChain) return []
    const map = new Map()
    for (const g of data.optionChain) {
      const row = map.get(g.strikePrice) ?? { strike: g.strikePrice, ce: null, pe: null }
      if (g.optionType === 'CE') row.ce = g; else row.pe = g
      map.set(g.strikePrice, row)
    }
    return Array.from(map.values()).sort((a, b) => a.strike - b.strike)
  }, [data])

  const atm = data ? Math.round(data.price / 50) * 50 : 0
  const displayRows = showAll ? rows : rows.filter(r => Math.abs(r.strike - atm) <= 150)

  if (!data) return (
    <div className="panel flex flex-col items-center justify-center py-10 gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>📊</div>
      <div className="font-display text-muted text-xs tracking-widest">OPTIONS CHAIN IDLE</div>
    </div>
  )

  const colH = 'font-mono text-dim uppercase tracking-wider text-center py-2 px-1'
  const fStyle = { fontSize: 10, letterSpacing: 1 }

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">⚙ F&amp;O Option Chain — Greeks (Black-Scholes)</div>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-muted" style={{ fontSize: 10 }}>
            SPOT ₹{fmt(data.price)} · ATM {atm}
          </span>
          <button onClick={() => setShowAll(s => !s)}
            className="font-mono border border-border text-muted px-2 py-0.5 hover:border-accent hover:text-accent transition-colors"
            style={{ fontSize: 10 }}>
            {showAll ? 'SHOW LESS' : 'SHOW ALL'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#0d1825', borderBottom: '1px solid #1a3050' }}>
              <th className={colH} style={{ ...fStyle, color: '#00d4ff', width: 80 }}>CE LTP</th>
              <th className={colH} style={fStyle}>CE Δ</th>
              <th className={colH} style={fStyle}>CE OI</th>
              <th className={colH} style={fStyle}>CE IV%</th>
              <th className={colH} style={{ ...fStyle, color: '#c8dff0', width: 90, background: 'rgba(0,212,255,0.05)' }}>STRIKE</th>
              <th className={colH} style={fStyle}>PE IV%</th>
              <th className={colH} style={fStyle}>PE OI</th>
              <th className={colH} style={fStyle}>PE Δ</th>
              <th className={colH} style={{ ...fStyle, color: '#ff3366', width: 80 }}>PE LTP</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(row => {
              const isATM = row.strike === atm
              const rowBg = isATM ? 'rgba(0,212,255,0.06)' : 'transparent'
              const ceITM = row.strike < data.price
              const peITM = row.strike > data.price

              return (
                <tr key={row.strike}
                  style={{ borderBottom: '1px solid #1a305033', background: rowBg }}>
                  {/* CE side */}
                  <td className="text-center py-2 px-1 font-display font-bold" style={{ fontSize: 12, color: '#00d4ff', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                    {row.ce ? `₹${fmt(row.ce.ltp)}` : '—'}
                  </td>
                  <td className="text-center font-mono" style={{ fontSize: 11, color: '#c8dff0', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                    {row.ce ? row.ce.delta.toFixed(3) : '—'}
                  </td>
                  <td className="text-center font-mono" style={{ fontSize: 11, color: '#6a9ab8', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                    {row.ce ? `${(row.ce.oi / 1000).toFixed(0)}K` : '—'}
                  </td>
                  <td className="text-center font-mono" style={{ fontSize: 11, color: row.ce?.iv > 25 ? '#ffd700' : '#c8dff0', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                    {row.ce ? `${row.ce.iv}%` : '—'}
                  </td>

                  {/* Strike */}
                  <td className="text-center font-display font-black py-2"
                    style={{ fontSize: 13, color: isATM ? '#00d4ff' : '#c8dff0', background: 'rgba(0,212,255,0.04)', border: isATM ? '1px solid #00d4ff44' : 'none' }}>
                    {row.strike}
                    {isATM && <span className="font-mono text-accent block" style={{ fontSize: 9, letterSpacing: 1 }}>ATM</span>}
                  </td>

                  {/* PE side */}
                  <td className="text-center font-mono" style={{ fontSize: 11, color: row.pe?.iv > 25 ? '#ffd700' : '#c8dff0', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                    {row.pe ? `${row.pe.iv}%` : '—'}
                  </td>
                  <td className="text-center font-mono" style={{ fontSize: 11, color: '#6a9ab8', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                    {row.pe ? `${(row.pe.oi / 1000).toFixed(0)}K` : '—'}
                  </td>
                  <td className="text-center font-mono" style={{ fontSize: 11, color: '#c8dff0', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                    {row.pe ? row.pe.delta.toFixed(3) : '—'}
                  </td>
                  <td className="text-center py-2 px-1 font-display font-bold" style={{ fontSize: 12, color: '#ff3366', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                    {row.pe ? `₹${fmt(row.pe.ltp)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Greeks legend */}
      <div className="flex gap-4 px-3 py-2 border-t border-border flex-wrap">
        {[['Δ Delta', 'directional exposure (-1 to +1)'], ['θ Theta', 'time decay per day'], ['ν Vega', 'sensitivity to IV change'], ['γ Gamma', 'rate of delta change'], ['IV', 'implied volatility %']].map(([k, v]) => (
          <div key={k} className="font-mono text-dim" style={{ fontSize: 10 }}>
            <span className="text-accent">{k}</span>: {v}
          </div>
        ))}
      </div>
    </div>
  )
}
