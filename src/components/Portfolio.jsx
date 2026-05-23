import React, { useState } from 'react'
import { fmt, getBasePrice } from '../utils/indicators'

const DEMO_HOLDINGS = [
  { symbol: 'RELIANCE', qty: 10, avgPrice: 2780, lastPrice: 2890 },
  { symbol: 'TCS', qty: 5, avgPrice: 3600, lastPrice: 3754 },
  { symbol: 'HDFCBANK', qty: 20, avgPrice: 1550, lastPrice: 1612 },
  { symbol: 'INFY', qty: 15, avgPrice: 1480, lastPrice: 1548 },
  { symbol: 'ICICIBANK', qty: 25, avgPrice: 1210, lastPrice: 1289 },
]

export default function Portfolio({ onSelectSymbol }) {
  const [holdings, setHoldings] = useState(DEMO_HOLDINGS)
  const [addForm, setAddForm] = useState({ symbol: '', qty: '', avgPrice: '' })
  const [showAdd, setShowAdd] = useState(false)

  const processed = holdings.map(h => {
    const mv = h.lastPrice * h.qty
    const iv = h.avgPrice * h.qty
    const pnl = mv - iv
    const pnlPct = (pnl / iv) * 100
    return { ...h, mv, iv, pnl, pnlPct }
  })

  const totalMV = processed.reduce((a, h) => a + h.mv, 0)
  const totalIV = processed.reduce((a, h) => a + h.iv, 0)
  const totalPnL = totalMV - totalIV
  const totalPnLPct = (totalPnL / totalIV) * 100
  const dayPnL = totalMV * 0.0032 // simulated day pnl

  function addHolding() {
    if (!addForm.symbol || !addForm.qty || !addForm.avgPrice) return
    setHoldings(prev => [...prev, {
      symbol: addForm.symbol.toUpperCase(),
      qty: parseInt(addForm.qty),
      avgPrice: parseFloat(addForm.avgPrice),
      lastPrice: getBasePrice(addForm.symbol) || parseFloat(addForm.avgPrice) * (1 + (Math.random() - 0.45) * 0.06),
    }])
    setAddForm({ symbol: '', qty: '', avgPrice: '' })
    setShowAdd(false)
  }

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">💼 Portfolio</div>
        <button onClick={() => setShowAdd(s => !s)}
          className="ml-auto font-mono border border-border text-muted px-2 py-0.5 hover:border-accent hover:text-accent transition-colors"
          style={{ fontSize: 10 }}>
          {showAdd ? '✕ CANCEL' : '+ ADD'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-px border-b border-border" style={{ background: '#1a3050' }}>
        {[
          { label: 'Portfolio Value', val: `₹${fmt(totalMV, 0)}`, color: '#c8dff0' },
          { label: 'Total P&L', val: `${totalPnL >= 0 ? '+' : ''}₹${fmt(totalPnL, 0)}`, color: totalPnL >= 0 ? '#00ff88' : '#ff3366' },
          { label: 'Day P&L', val: `${dayPnL >= 0 ? '+' : ''}₹${fmt(dayPnL, 0)}`, color: dayPnL >= 0 ? '#00ff88' : '#ff3366' },
        ].map(s => (
          <div key={s.label} className="bg-panel p-3 text-center">
            <div className="font-mono text-dim uppercase tracking-wider" style={{ fontSize: 10 }}>{s.label}</div>
            <div className="font-display font-bold mt-1" style={{ fontSize: 13, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Add holding form */}
      {showAdd && (
        <div className="p-3 border-b border-border flex gap-2">
          {['SYMBOL', 'QTY', 'AVG PRICE'].map((lbl, i) => (
            <input key={lbl} placeholder={lbl}
              value={[addForm.symbol, addForm.qty, addForm.avgPrice][i]}
              onChange={e => setAddForm(f => ({ ...f, [['symbol', 'qty', 'avgPrice'][i]]: e.target.value }))}
              className="flex-1 bg-bg3 border border-border text-gray-200 font-mono text-xs px-2 py-1.5 outline-none focus:border-accent"
            />
          ))}
          <button onClick={addHolding} className="btn-accent px-3 py-1.5 text-xs font-display tracking-wider">ADD</button>
        </div>
      )}

      {/* Holdings table */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0d1825', borderBottom: '1px solid #1a3050' }}>
              {['Symbol', 'Qty', 'Avg', 'LTP', 'P&L', 'P&L%'].map(h => (
                <th key={h} className="font-mono text-dim uppercase text-left px-3 py-2" style={{ fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processed.map(h => (
              <tr key={h.symbol} onClick={() => onSelectSymbol?.(h.symbol)}
                className="border-b hover:bg-bg3 cursor-pointer transition-colors"
                style={{ borderColor: '#1a305033' }}>
                <td className="px-3 py-2 font-display font-bold text-accent" style={{ fontSize: 12 }}>{h.symbol}</td>
                <td className="px-3 py-2 font-mono text-gray-200" style={{ fontSize: 12 }}>{h.qty}</td>
                <td className="px-3 py-2 font-mono text-muted" style={{ fontSize: 12 }}>₹{fmt(h.avgPrice)}</td>
                <td className="px-3 py-2 font-mono text-gray-200" style={{ fontSize: 12 }}>₹{fmt(h.lastPrice)}</td>
                <td className="px-3 py-2 font-display font-bold" style={{ fontSize: 12, color: h.pnl >= 0 ? '#00ff88' : '#ff3366' }}>
                  {h.pnl >= 0 ? '+' : ''}₹{fmt(h.pnl, 0)}
                </td>
                <td className="px-3 py-2 font-mono" style={{ fontSize: 12, color: h.pnlPct >= 0 ? '#00ff88' : '#ff3366' }}>
                  {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
