import React, { useState } from 'react'
import { fmt } from '../utils/indicators'

const IST_WINDOWS = [
  { label: '9:15 – 10:30', desc: 'Opening range — high volatility, best momentum trades', color: '#00ff88' },
  { label: '10:30 – 12:00', desc: 'Mid-morning — trend confirmation phase', color: '#ffd700' },
  { label: '12:00 – 2:00', desc: 'Lunch lull — avoid, whipsaw likely', color: '#ff3366' },
  { label: '2:00 – 3:30', desc: 'Power hour — strong directional moves, best breakouts', color: '#00ff88' },
]

function getISTWindow() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const h = ist.getHours(), m = ist.getMinutes()
  const mins = h * 60 + m
  if (mins >= 555 && mins < 630) return 0   // 9:15–10:30
  if (mins >= 630 && mins < 720) return 1   // 10:30–12:00
  if (mins >= 720 && mins < 840) return 2   // 12:00–14:00
  if (mins >= 840 && mins < 930) return 3   // 14:00–15:30
  return -1
}

export default function Intraday({ data, ai }) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  if (!data || !ai) return (
    <div className="panel flex items-center justify-center py-10 text-center gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>⚡</div>
      <div>
        <div className="font-display text-muted text-xs tracking-widest">INTRADAY IDLE</div>
        <div className="font-mono text-dim mt-1" style={{ fontSize: 11 }}>Run analysis to see intraday signals</div>
      </div>
    </div>
  )

  const bull = ai.verdict === 'BUY', bear = ai.verdict === 'SELL'
  const accentColor = bull ? '#00ff88' : bear ? '#ff3366' : '#ffd700'

  // Core signals
  const signals = [
    { label: 'VWAP Signal',  val: data.price > data.vwap ? `▲ ABOVE VWAP ₹${fmt(data.vwap)}` : `▼ BELOW VWAP ₹${fmt(data.vwap)}`, pass: data.price > data.vwap, weight: 'HIGH' },
    { label: 'EMA20 Signal', val: data.price > data.ema20 ? `▲ ABOVE EMA20 ₹${fmt(data.ema20)}` : `▼ BELOW EMA20 ₹${fmt(data.ema20)}`, pass: data.price > data.ema20, weight: 'HIGH' },
    { label: 'RSI Momentum', val: `RSI ${(data.rsi||50).toFixed(1)} — ${data.rsi>70?'OB':data.rsi<30?'OS':data.rsi>50?'Bullish':'Bearish'}`, pass: data.rsi > 50 && data.rsi < 72, weight: 'MED' },
    { label: 'MACD Hist',    val: data.macd?.histogram > 0 ? `▲ +${data.macd.histogram.toFixed(4)}` : `▼ ${data.macd?.histogram?.toFixed(4)||'0'}`, pass: data.macd?.histogram > 0, weight: 'MED' },
    { label: 'Supertrend',   val: data.supertrend?.direction === 'up' ? `▲ BULL ₹${fmt(data.supertrend.value)}` : `▼ BEAR ₹${fmt(data.supertrend?.value||0)}`, pass: data.supertrend?.direction === 'up', weight: 'HIGH' },
    { label: 'Volume Conf',  val: `${(data.volumeRatio||1).toFixed(2)}x avg — ${data.volumeRatio>1.2?'Strong':data.volumeRatio>0.8?'Normal':'Weak'}`, pass: data.volumeRatio > 1.0, weight: 'MED' },
    { label: 'MTF Align',    val: data.trendConsistency === 'CONFIRMED' ? `✓ ALL ALIGNED ${data.m1Trend}` : `✗ DIVERGENT`, pass: data.trendConsistency === 'CONFIRMED', weight: 'HIGH' },
    { label: 'ADX Trend',    val: data.adx ? `ADX ${data.adx.adx} — ${data.adx.trend}` : 'N/A', pass: data.adx?.adx >= 20 && (data.adx?.pdi > data.adx?.mdi) === bull, weight: 'MED' },
  ]
  const passed = signals.filter(s => s.pass).length
  const signalScore = Math.round((passed / signals.length) * 100)

  // Pivot points
  const pp = data.pivotPoints?.standard
  const cam = data.pivotPoints?.camarilla

  // Candle patterns
  const patterns = data.candlePatterns || []
  const bullPat = patterns.filter(p => p.type === 'BULLISH')
  const bearPat = patterns.filter(p => p.type === 'BEARISH')

  // Score breakdown from AI
  const breakdown = ai.breakdown || []

  const currentWindow = getISTWindow()

  const riskProfile = data.riskProfile
  const riskColors = { LOW:'#00ff88', MODERATE:'#ffd700', HIGH:'#ff6b35', 'VERY HIGH':'#ff3366' }
  const riskColor = riskColors[riskProfile?.profile] || '#6a9ab8'

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">⚡ Intraday Signal Board</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono" style={{ fontSize: 10, color: accentColor }}>Score: {signalScore}/100</span>
          <button onClick={() => setShowBreakdown(s=>!s)}
            className="font-mono border border-border text-muted px-2 py-0.5 hover:border-accent hover:text-accent transition-colors"
            style={{ fontSize: 9 }}>
            {showBreakdown ? 'LESS' : 'BREAKDOWN'}
          </button>
        </div>
      </div>

      <div className="p-3 grid grid-cols-1 gap-2">
        {/* Main verdict */}
        <div className="p-3 border text-center" style={{ borderColor: accentColor, background: `${accentColor}08` }}>
          <div className="font-display font-black" style={{ fontSize: 22, color: accentColor, letterSpacing: 3 }}>
            {ai.verdict}
          </div>
          <div className="font-mono text-muted mt-1" style={{ fontSize: 11 }}>
            Entry: ₹{fmt(ai.entry ?? 0)} · Target: ₹{fmt(ai.target ?? 0)} · SL: ₹{fmt(ai.stopLoss ?? 0)}
          </div>
          <div className="font-mono text-dim mt-0.5" style={{ fontSize: 11 }}>
            RR: {(ai.riskReward ?? 0).toFixed(2)}:1 · Confidence: <span style={{color:accentColor}}>{ai.confidence}%</span>
            {ai.bullVotes != null && <span className="text-dim"> · {ai.bullVotes}↑/{ai.bearVotes}↓</span>}
          </div>
        </div>

        {/* ADX Trend Strength Bar */}
        {data.adx && (
          <div className="p-2 border border-border/50">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-dim uppercase" style={{fontSize:10}}>Trend Strength (ADX)</span>
              <span className="font-mono" style={{fontSize:11, color: data.adx.adx>=40?'#00ff88':data.adx.adx>=25?'#ffd700':'#6a9ab8'}}>
                {data.adx.adx} — {data.adx.trend}
              </span>
            </div>
            <div className="h-1.5 rounded overflow-hidden" style={{background:'#1a3050'}}>
              <div className="h-full rounded transition-all"
                style={{width:`${Math.min(100, data.adx.adx)}%`,
                  background: data.adx.adx>=40?'#00ff88':data.adx.adx>=25?'#ffd700':'#6a9ab8'}}/>
            </div>
            <div className="flex justify-between font-mono text-dim mt-1" style={{fontSize:10}}>
              <span>PDI {data.adx.pdi} ↑</span>
              <span>MDI {data.adx.mdi} ↓</span>
            </div>
          </div>
        )}

        {/* Risk Profile + Investment Action */}
        {riskProfile && (
          <div className="flex gap-2">
            <div className="flex-1 p-2 border border-border/50">
              <div className="font-mono text-dim uppercase tracking-widest" style={{fontSize:9}}>Risk Profile</div>
              <div className="font-display font-bold mt-0.5" style={{fontSize:13, color:riskColor}}>
                {riskProfile.profile}
              </div>
              <div className="font-mono text-dim mt-0.5" style={{fontSize:10}}>
                ATR {riskProfile.atrPct?.toFixed(2)}% of CMP
              </div>
            </div>
            {data.investmentGuidance && (
              <div className="flex-1 p-2 border border-border/50">
                <div className="font-mono text-dim uppercase tracking-widest" style={{fontSize:9}}>Position Size</div>
                <div className="font-display font-bold mt-0.5" style={{fontSize:13, color:accentColor}}>
                  {data.investmentGuidance.positionSize}
                </div>
                <div className="font-mono text-dim mt-0.5" style={{fontSize:10}}>
                  {data.investmentGuidance.capitalPct}% of capital
                </div>
              </div>
            )}
          </div>
        )}

        {/* Candle Patterns */}
        {patterns.length > 0 && (
          <div className="p-2 border border-border/50">
            <div className="font-mono text-accent uppercase tracking-widest mb-1.5" style={{fontSize:10}}>
              Candlestick Patterns Detected
            </div>
            {patterns.slice(0,3).map((pat, i) => (
              <div key={i} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                <span style={{fontSize:12, color: pat.type==='BULLISH'?'#00ff88':pat.type==='BEARISH'?'#ff3366':'#ffd700'}}>
                  {pat.type==='BULLISH'?'▲':pat.type==='BEARISH'?'▼':'◆'}
                </span>
                <div className="flex-1">
                  <div className="font-display" style={{fontSize:11, color: pat.type==='BULLISH'?'#00ff88':pat.type==='BEARISH'?'#ff3366':'#ffd700'}}>
                    {pat.name}
                    <span className="font-mono text-dim ml-2" style={{fontSize:9}}>{pat.confidence}% conf</span>
                  </div>
                  <div className="font-mono text-dim" style={{fontSize:10}}>{pat.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Signal Checklist */}
        <div className="font-mono text-accent uppercase tracking-widest mb-1" style={{ fontSize: 10 }}>Signal Checklist</div>
        {signals.map((s, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
            <span style={{ color: s.pass ? '#00ff88' : '#ff3366', fontSize: 13 }}>{s.pass ? '✓' : '✗'}</span>
            <span className="font-mono text-muted flex-1" style={{ fontSize: 11 }}>{s.label}</span>
            <span className="font-mono" style={{ fontSize: 10, color: s.pass ? '#00ff88' : '#ff3366' }}>{s.val}</span>
            <span className="font-mono border px-1" style={{ fontSize: 9, color: '#3a5a7a', borderColor: '#1a3050' }}>{s.weight}</span>
          </div>
        ))}

        {/* AI Score Breakdown */}
        {showBreakdown && breakdown.length > 0 && (
          <div className="mt-1 border border-border/50">
            <div className="font-mono text-accent uppercase tracking-widest px-2 py-1.5 border-b border-border/50"
              style={{fontSize:10}}>
              Score Breakdown ({ai.bullVotes}↑ Bull / {ai.bearVotes}↓ Bear)
            </div>
            {breakdown.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 border-b border-border/20 last:border-0"
                style={{background: i%2===0?'rgba(0,0,0,0.1)':'transparent'}}>
                <span style={{fontSize:11, color: f.vote==='BULL'?'#00ff88':f.vote==='BEAR'?'#ff3366':'#6a9ab8',
                  width:14, flexShrink:0}}>
                  {f.vote==='BULL'?'↑':f.vote==='BEAR'?'↓':'→'}
                </span>
                <span className="font-mono font-bold text-muted" style={{fontSize:10, width:90, flexShrink:0}}>
                  {f.name}
                </span>
                <span className="font-mono text-dim flex-1" style={{fontSize:10}}>{f.reason}</span>
                <span className="font-mono border px-1 flex-shrink-0"
                  style={{fontSize:9, color: f.vote==='BULL'?'#00ff88':f.vote==='BEAR'?'#ff3366':'#6a9ab8',
                    borderColor: f.vote==='BULL'?'#00ff8844':f.vote==='BEAR'?'#ff336644':'#6a9ab844'}}>
                  {f.vote==='BULL'?'+':'-'}{f.weight}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Option Signal */}
        {ai.optionSuggestion && (
          <div className="mt-1 p-2 border font-mono" style={{ fontSize: 11, color: '#00d4ff', borderColor: '#00d4ff33', background: 'rgba(0,212,255,0.05)' }}>
            <div className="text-dim mb-1" style={{ fontSize: 10, letterSpacing: 2 }}>OPTION PLAY</div>
            {ai.optionSuggestion}
          </div>
        )}

        {/* Pivot Points */}
        {pp && (
          <div className="p-2 border border-border/50">
            <div className="font-mono text-dim uppercase tracking-widest mb-2" style={{fontSize:10}}>
              Pivot Points (Standard)
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                {k:'R3', v:pp.r3, c:'#ff3366'},
                {k:'R2', v:pp.r2, c:'#ff6b35'},
                {k:'R1', v:pp.r1, c:'#ffd70099'},
                {k:'PP', v:pp.pp, c:'#00d4ff'},
                {k:'S1', v:pp.s1, c:'#ffd70099'},
                {k:'S2', v:pp.s2, c:'#00ff8899'},
              ].map(({ k, v, c }) => (
                <div key={k} className="flex justify-between items-center px-1.5 py-1 border border-border/30"
                  style={{background: data.price && Math.abs(data.price - v) < (data.atr || 10) ? `${c}12` : 'transparent'}}>
                  <span className="font-mono" style={{fontSize:10, color:c}}>{k}</span>
                  <span className="font-mono text-muted" style={{fontSize:10}}>₹{fmt(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BB Position */}
        {data.bb && (
          <div className="p-2 border border-border/50">
            <div className="font-mono text-dim uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Bollinger Band Position</div>
            <div className="flex justify-between font-mono" style={{ fontSize: 11 }}>
              <span style={{color:'#6a9ab8'}}>Lower: ₹{fmt(data.bb.lower)}</span>
              <span className="text-accent">Mid: ₹{fmt(data.bb.middle)}</span>
              <span style={{color:'#ff6b35'}}>Upper: ₹{fmt(data.bb.upper)}</span>
            </div>
            <div className="mt-2 h-1.5 rounded" style={{ background: '#1a3050', position: 'relative' }}>
              <div className="absolute top-0 bottom-0 rounded" style={{
                background: accentColor,
                left: `${Math.max(0, Math.min(96, ((data.price - data.bb.lower) / Math.max(data.bb.upper - data.bb.lower, 1)) * 100))}%`,
                width: 4,
              }} />
            </div>
          </div>
        )}

        {/* IST Trading Windows */}
        <div className="p-2 border border-border/50">
          <div className="font-mono text-dim uppercase tracking-widest mb-2" style={{fontSize:10}}>IST Trading Windows</div>
          {IST_WINDOWS.map((w, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0"
              style={{ background: currentWindow === i ? `${w.color}10` : 'transparent' }}>
              {currentWindow === i && <span style={{fontSize:10, color:w.color}}>▶</span>}
              {currentWindow !== i && <span style={{fontSize:10, color:'#3a5a7a'}}>·</span>}
              <span className="font-mono font-bold" style={{fontSize:10, color:w.color, width:90}}>{w.label}</span>
              <span className="font-mono text-dim" style={{fontSize:10}}>{w.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
