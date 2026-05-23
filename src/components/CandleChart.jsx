import React, { useMemo } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fmt } from '../utils/indicators'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const bull = d.close >= d.open
  return (
    <div className="panel border border-border p-2 font-mono" style={{ fontSize: 11 }}>
      <div style={{ color: bull ? '#00ff88' : '#ff3366' }} className="font-bold mb-1">
        {bull ? '▲' : '▼'} ₹{fmt(d.close)}
      </div>
      {[['O', d.open], ['H', d.high], ['L', d.low], ['C', d.close], ['V', (d.volume / 1000).toFixed(0) + 'K']].map(([k, v]) => (
        <div key={k} className="flex gap-3 justify-between">
          <span className="text-dim">{k}</span>
          <span className="text-gray-200">{typeof v === 'number' ? fmt(v) : v}</span>
        </div>
      ))}
    </div>
  )
}

export default function CandleChart({ data, ai }) {
  const chartData = useMemo(() => {
    if (!data) return []
    const candles = data.candles.slice(-60)
    return candles.map((c, i) => ({
      ...c,
      ema20: data.ema20Series[data.ema20Series.length - 60 + i] ?? data.ema20,
      vwap: data.vwap,
      bullBody: c.close >= c.open ? [c.open, c.close] : null,
      bearBody: c.close < c.open ? [c.close, c.open] : null,
      high: c.high,
      low: c.low,
      label: new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }))
  }, [data])

  if (!data) return (
    <div className="panel flex items-center justify-center" style={{ height: 280 }}>
      <div className="text-center opacity-30">
        <div style={{ fontSize: 36 }}>📈</div>
        <div className="font-mono text-muted mt-2" style={{ fontSize: 11 }}>CHART LOADS ON ANALYSIS</div>
      </div>
    </div>
  )

  const closes = chartData.map(d => d.close)
  const min = Math.min(...closes) * 0.998
  const max = Math.max(...closes) * 1.002

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">Price Action</div>
        <div className="flex gap-4 ml-auto font-mono" style={{ fontSize: 10 }}>
          <span style={{ color: '#00d4ff' }}>— EMA20</span>
          <span style={{ color: '#ffd700' }}>-- VWAP</span>
          {ai?.entry && <span style={{ color: '#00ff88' }}>· ENTRY</span>}
        </div>
      </div>
      <div style={{ height: 260, padding: '8px 4px 8px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
            <XAxis dataKey="label" tick={{ fill: '#3a5a7a', fontSize: 9, fontFamily: 'Share Tech Mono' }}
              tickLine={false} axisLine={{ stroke: '#1a3050' }} interval={Math.floor(chartData.length / 6)} />
            <YAxis domain={[min, max]} tick={{ fill: '#3a5a7a', fontSize: 9, fontFamily: 'Share Tech Mono' }}
              tickLine={false} axisLine={false} tickFormatter={v => fmt(v, 0)} width={52} />
            <Tooltip content={<CustomTooltip />} />

            {/* Bull candles */}
            <Bar dataKey="bullBody" fill="#00ff88" fillOpacity={0.7} />
            {/* Bear candles */}
            <Bar dataKey="bearBody" fill="#ff3366" fillOpacity={0.7} />

            {/* EMA20 */}
            <Line type="monotone" dataKey="ema20" stroke="#00d4ff" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
            {/* VWAP */}
            <Line type="monotone" dataKey="vwap" stroke="#ffd700" strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.7} />

            {/* Entry/Target/SL reference lines */}
            {ai?.entry && <ReferenceLine y={ai.entry} stroke="#00d4ff" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'ENTRY', fill: '#00d4ff', fontSize: 9 }} />}
            {ai?.target && <ReferenceLine y={ai.target} stroke="#00ff88" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'TGT', fill: '#00ff88', fontSize: 9 }} />}
            {ai?.stopLoss && <ReferenceLine y={ai.stopLoss} stroke="#ff3366" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'SL', fill: '#ff3366', fontSize: 9 }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Indicator bar */}
      <div className="grid grid-cols-5 gap-px border-t border-border" style={{ background: '#1a3050' }}>
        {[
          { name: 'RSI', val: data.rsi.toFixed(1), color: data.rsi > 70 ? '#ff3366' : data.rsi < 30 ? '#00ff88' : '#ffd700' },
          { name: 'VWAP', val: `₹${fmt(data.vwap, 0)}`, color: '#ffd700' },
          { name: 'EMA20', val: `₹${fmt(data.ema20, 0)}`, color: '#00d4ff' },
          { name: 'ATR', val: fmt(data.atr), color: '#c8dff0' },
          { name: 'MACD', val: data.macd.histogram > 0 ? '▲ BULL' : '▼ BEAR', color: data.macd.histogram > 0 ? '#00ff88' : '#ff3366' },
        ].map(ind => (
          <div key={ind.name} className="bg-panel py-2 text-center">
            <div className="font-mono text-dim" style={{ fontSize: 10 }}>{ind.name}</div>
            <div className="font-display font-bold" style={{ fontSize: 11, color: ind.color }}>{ind.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
