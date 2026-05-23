import React from 'react'
import { fmt } from '../utils/indicators'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Delivery({ data, ai }) {
  if (!data || !ai) return (
    <div className="panel flex items-center justify-center py-10 gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>📦</div>
      <div>
        <div className="font-display text-muted text-xs tracking-widest">DELIVERY IDLE</div>
        <div className="font-mono text-dim mt-1" style={{ fontSize: 11 }}>Run analysis for swing/positional view</div>
      </div>
    </div>
  )

  const closes = data.candles.map(c => c.close)
  const chartData = data.candles.slice(-30).map(c => ({
    date: new Date(c.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    price: c.close,
  }))

  const min = Math.min(...closes.slice(-30))
  const max = Math.max(...closes.slice(-30))
  const bull = data.price >= closes[closes.length - 2]
  const verdict = ai.verdict
  const accentColor = verdict === 'BUY' ? '#00ff88' : verdict === 'SELL' ? '#ff3366' : '#ffd700'

  // Swing targets
  const swingTarget1 = +(data.resistance * 1.018).toFixed(2)
  const swingTarget2 = +(data.resistance * 1.042).toFixed(2)
  const swingSL = +(data.support * 0.985).toFixed(2)

  // Fundamental score (estimated)
  const peScore = 20 // placeholder PE
  const fundamentalBias = peScore < 18 ? 'VALUE' : peScore < 28 ? 'FAIR VALUE' : 'EXPENSIVE'
  const fundamentalColor = peScore < 18 ? '#00ff88' : peScore < 28 ? '#ffd700' : '#ff3366'

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">📦 Delivery / Swing Trade</div>
        <span className="ml-auto font-mono" style={{ fontSize: 10, color: accentColor }}>
          {verdict} — {ai.confidence}% confidence
        </span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* 30-day area chart */}
        <div style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#3a5a7a', fontSize: 9 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis domain={[min * 0.998, max * 1.002]} hide />
              <Tooltip formatter={v => `₹${fmt(v)}`} contentStyle={{ background: '#0a1520', border: '1px solid #1a3050', fontFamily: 'Share Tech Mono', fontSize: 11 }} />
              <Area type="monotone" dataKey="price" stroke={accentColor} fill="url(#priceGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Swing levels */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'SWING ENTRY', val: `₹${fmt(ai.entry ?? data.ema50)}`, color: '#00d4ff' },
            { label: 'SWING SL', val: `₹${fmt(swingSL)}`, color: '#ff3366' },
            { label: 'TARGET 1', val: `₹${fmt(swingTarget1)}`, color: '#00ff88' },
            { label: 'TARGET 2', val: `₹${fmt(swingTarget2)}`, color: '#00ff88' },
          ].map(l => (
            <div key={l.label} className="p-2 border border-border/50">
              <div className="font-mono text-dim uppercase tracking-wider" style={{ fontSize: 10 }}>{l.label}</div>
              <div className="font-display font-bold mt-1" style={{ fontSize: 14, color: l.color }}>{l.val}</div>
            </div>
          ))}
        </div>

        {/* Trend analysis */}
        <div className="border-t border-border/50 pt-3">
          <div className="font-mono text-accent uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Trend Analysis</div>
          {[
            { label: 'Short-term (1-5 days)', val: data.m5Trend },
            { label: 'Medium-term (1-4 weeks)', val: data.m15Trend },
            { label: 'Long-term (1-3 months)', val: data.price > data.ema50 ? 'BULLISH' : 'BEARISH' },
          ].map(t => (
            <div key={t.label} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
              <span className="font-mono text-muted" style={{ fontSize: 12 }}>{t.label}</span>
              <span className="font-display font-bold" style={{ fontSize: 12, color: t.val === 'BULLISH' ? '#00ff88' : t.val === 'BEARISH' ? '#ff3366' : '#ffd700' }}>
                {t.val}
              </span>
            </div>
          ))}
        </div>

        {/* Fundamental note */}
        <div className="p-2 border border-border/50" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="font-mono text-dim uppercase tracking-wider mb-1" style={{ fontSize: 10 }}>Valuation Context</div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-muted" style={{ fontSize: 12 }}>Estimated P/E: ~{peScore}x</span>
            <span className="font-mono border px-2 py-0.5" style={{ fontSize: 11, color: fundamentalColor, borderColor: fundamentalColor }}>
              {fundamentalBias}
            </span>
          </div>
          <div className="font-mono text-dim mt-1" style={{ fontSize: 11 }}>
            Connect Fyers/Zerodha API in .env for real fundamental data
          </div>
        </div>
      </div>
    </div>
  )
}
