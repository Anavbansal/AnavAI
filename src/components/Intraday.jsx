import React from 'react'
import { fmt } from '../utils/indicators'

export default function Intraday({ data, ai }) {
  if (!data || !ai) return (
    <div className="panel flex items-center justify-center py-10 text-center gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>⚡</div>
      <div>
        <div className="font-display text-muted text-xs tracking-widest">INTRADAY IDLE</div>
        <div className="font-mono text-dim mt-1" style={{ fontSize: 11 }}>Run analysis to see intraday signals</div>
      </div>
    </div>
  )

  const bull = ai.verdict === 'BUY'
  const bear = ai.verdict === 'SELL'
  const accentColor = bull ? '#00ff88' : bear ? '#ff3366' : '#ffd700'

  const signals = [
    { label: 'VWAP Signal', val: data.price > data.vwap ? '▲ ABOVE VWAP' : '▼ BELOW VWAP', pass: data.price > data.vwap, weight: 'HIGH' },
    { label: 'EMA20 Signal', val: data.price > data.ema20 ? '▲ ABOVE EMA20' : '▼ BELOW EMA20', pass: data.price > data.ema20, weight: 'HIGH' },
    { label: 'RSI Signal', val: `RSI ${data.rsi.toFixed(1)} — ${data.rsi > 60 ? 'Bullish' : data.rsi < 40 ? 'Bearish' : 'Neutral'}`, pass: data.rsi > 50, weight: 'MED' },
    { label: 'MACD Signal', val: data.macd.histogram > 0 ? '▲ Histogram Positive' : '▼ Histogram Negative', pass: data.macd.histogram > 0, weight: 'MED' },
    { label: 'Volume', val: `${data.volumeRatio.toFixed(2)}x avg volume`, pass: data.volumeRatio > 1.0, weight: 'MED' },
    { label: 'MTF Align', val: data.trendConsistency, pass: data.trendConsistency === 'CONFIRMED', weight: 'HIGH' },
  ]

  const passed = signals.filter(s => s.pass).length
  const score = Math.round((passed / signals.length) * 100)

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">⚡ Intraday Signal Board</div>
        <span className="ml-auto font-mono" style={{ fontSize: 10, color: accentColor }}>
          Score: {score}/100
        </span>
      </div>

      <div className="p-3 grid grid-cols-1 gap-2">
        {/* Main signal */}
        <div className="p-3 border text-center mb-1" style={{ borderColor: accentColor, background: `${accentColor}08` }}>
          <div className="font-display font-black" style={{ fontSize: 20, color: accentColor, letterSpacing: 3 }}>
            {ai.verdict}
          </div>
          <div className="font-mono text-muted mt-1" style={{ fontSize: 11 }}>
            Entry: ₹{fmt(ai.entry ?? 0)} · Target: ₹{fmt(ai.target ?? 0)} · SL: ₹{fmt(ai.stopLoss ?? 0)}
          </div>
          <div className="font-mono text-dim mt-0.5" style={{ fontSize: 11 }}>
            RR: {(ai.riskReward ?? 0).toFixed(1)}:1 · Confidence: {ai.confidence}%
          </div>
        </div>

        {/* Signal checklist */}
        <div className="font-mono text-accent uppercase tracking-widest mb-1" style={{ fontSize: 10 }}>Signal Checklist</div>
        {signals.map((s, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
            <span style={{ color: s.pass ? '#00ff88' : '#ff3366', fontSize: 14 }}>{s.pass ? '✓' : '✗'}</span>
            <span className="font-mono text-muted flex-1" style={{ fontSize: 11 }}>{s.label}</span>
            <span className="font-mono" style={{ fontSize: 11, color: s.pass ? '#00ff88' : '#ff3366' }}>{s.val}</span>
            <span className="font-mono border px-1" style={{ fontSize: 9, color: '#3a5a7a', borderColor: '#1a3050' }}>{s.weight}</span>
          </div>
        ))}

        {/* Option signal if any */}
        {ai.optionSuggestion && (
          <div className="mt-2 p-2 border font-mono" style={{ fontSize: 12, color: '#00d4ff', borderColor: '#00d4ff33', background: 'rgba(0,212,255,0.05)' }}>
            <div className="text-dim mb-1" style={{ fontSize: 10, letterSpacing: 2 }}>OPTION PLAY</div>
            {ai.optionSuggestion}
          </div>
        )}

        {/* BB position */}
        <div className="mt-1 p-2 border border-border/50">
          <div className="font-mono text-dim uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Bollinger Band Position</div>
          <div className="flex justify-between font-mono" style={{ fontSize: 11 }}>
            <span className="text-danger">Lower: ₹{fmt(data.bb.lower)}</span>
            <span className="text-accent">Mid: ₹{fmt(data.bb.middle)}</span>
            <span className="text-danger" style={{ color: '#ff6b35' }}>Upper: ₹{fmt(data.bb.upper)}</span>
          </div>
          <div className="mt-2 h-1.5 rounded" style={{ background: '#1a3050', position: 'relative' }}>
            <div className="absolute top-0 bottom-0 rounded" style={{
              background: accentColor,
              left: `${Math.max(0, Math.min(96, ((data.price - data.bb.lower) / Math.max(data.bb.upper - data.bb.lower, 1)) * 100))}%`,
              width: 4
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
