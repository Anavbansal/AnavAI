import React from 'react'

const fmt = (n, d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})

// Circular confidence gauge (CSS-based, no external deps)
function ConfidenceGauge({ value, verdict }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = verdict === 'BUY' ? '#00ff88' : verdict === 'SELL' ? '#ff3366' : '#ffd700'
  const r = 28, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const riskLabel = pct >= 78 ? 'HIGH CONF' : pct >= 65 ? 'MODERATE' : pct >= 52 ? 'LOW CONF' : 'WAIT'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <svg width={72} height={72} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={36} cy={36} r={r} fill="none" stroke="#1a3050" strokeWidth={5} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.7s ease', filter:`drop-shadow(0 0 4px ${color}66)` }} />
        <text x={36} y={36} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={13} fontFamily="'Share Tech Mono'" fontWeight="bold"
          style={{ transform:'rotate(90deg)', transformOrigin:'36px 36px' }}>
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize:9, letterSpacing:2, color, fontFamily:'Share Tech Mono' }}>{riskLabel}</div>
    </div>
  )
}

export default function PricePanel({ data, loading }) {
  if (loading) return (
    <div className="panel flex flex-col items-center justify-center py-12 gap-3">
      <div className="animate-spin-slow w-10 h-10 rounded-full border-2 border-border" style={{borderTopColor:'#00d4ff'}}/>
      <div className="font-mono text-accent animate-blink" style={{fontSize:12,letterSpacing:2}}>FETCHING LIVE DATA...</div>
    </div>
  )
  if (!data) return (
    <div className="panel flex flex-col items-center justify-center py-12 gap-3">
      <div style={{fontSize:36,opacity:0.3}}>📡</div>
      <div className="font-display text-muted text-sm tracking-widest">AWAITING SIGNAL</div>
      <div className="font-mono text-dim text-center" style={{fontSize:11}}>Enter symbol and click ANALYZE</div>
    </div>
  )

  const ai   = data.ai || data.aiAnalysis
  const bull  = data.change >= 0
  const pColor = bull ? '#00ff88' : '#ff3366'
  const verdict = ai?.verdict || 'HOLD'
  const vClass  = verdict === 'BUY' ? 'verdict-buy' : verdict === 'SELL' ? 'verdict-sell' : 'verdict-hold'
  const conf    = Math.min(100, Math.max(0, ai?.confidence ?? 50))
  const confColor = verdict === 'BUY' ? '#00ff88' : verdict === 'SELL' ? '#ff3366' : '#ffd700'
  const isLive = data.quality?.source === 'UPSTOX_LIVE'
  const isMock = data.quality?.source === 'UNKNOWN' || data._isMock

  const regimeColors = {TREND_UP:'#00ff88',TREND_DOWN:'#ff3366',HIGH_VOL_CHOP:'#ffd700',RANGE:'#6a9ab8'}
  const rColor = regimeColors[data.regime] ?? '#6a9ab8'

  const riskProfile = data.riskProfile
  const riskColors = { LOW:'#00ff88', MODERATE:'#ffd700', HIGH:'#ff6b35', 'VERY HIGH':'#ff3366' }
  const riskColor = riskColors[riskProfile?.profile] || '#6a9ab8'

  const guidance = data.investmentGuidance
  const guidanceColor = guidance?.shouldInvest ? (verdict === 'BUY' ? '#00ff88' : '#ff3366') : '#ffd700'

  return (
    <div className="panel animate-fadein">
      {/* Source badge */}
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2" style={{background:'rgba(0,0,0,0.2)'}}>
        <span className="font-mono" style={{fontSize:10, color: isLive?'#00ff88':isMock?'#ff6b35':'#ffd700', letterSpacing:1}}>
          {isLive ? '● UPSTOX LIVE' : isMock ? '⚠ MOCK DATA' : '○ BACKEND'}
        </span>
        <span className="font-mono text-dim ml-auto" style={{fontSize:10}}>
          {data.candles?.length} candles · {data.timeframe}m
        </span>
      </div>

      {/* Price */}
      <div className="text-center px-4 py-4 border-b border-border">
        <div className="font-mono text-muted uppercase tracking-widest mb-1" style={{fontSize:11}}>
          {data.symbol}
        </div>
        <div className="font-display font-black" style={{fontSize:34, color:pColor, textShadow:`0 0 20px ${pColor}55`}}>
          ₹{fmt(data.price)}
        </div>
        <div className="font-mono mt-1" style={{fontSize:12, color:pColor}}>
          {data.change>=0?'+':''}{fmt(data.change)} ({data.changePct>=0?'+':''}{(data.changePct||0).toFixed(2)}%)
        </div>
        <div className="font-mono text-dim mt-1" style={{fontSize:11}}>
          O:{fmt(data.open)} H:{fmt(data.high)} L:{fmt(data.low)}
        </div>
      </div>

      {/* Verdict + Confidence Gauge */}
      {ai && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="flex-1 flex flex-col items-center">
            <div className={`inline-block font-display font-black border-2 px-5 py-1.5 ${vClass}`}
              style={{fontSize:20, letterSpacing:4}}>
              {verdict}
            </div>
            {ai.score != null && (
              <div className="font-mono text-muted mt-1.5" style={{fontSize:10}}>
                Score: <span style={{color:confColor}}>{ai.score}/100</span>
                {ai.bullVotes != null && (
                  <span className="ml-2">({ai.bullVotes}↑ {ai.bearVotes}↓)</span>
                )}
              </div>
            )}
            <div className="w-full mt-2 h-1 rounded overflow-hidden" style={{background:'#0d1825'}}>
              <div className="h-full transition-all duration-700 rounded"
                style={{width:`${conf}%`, background:`linear-gradient(90deg,${confColor}88,${confColor})`}}/>
            </div>
            <div className="font-mono text-muted mt-1" style={{fontSize:11}}>
              RR: {ai.riskReward?.toFixed(1)||'N/A'}:1
            </div>
          </div>
          <ConfidenceGauge value={conf} verdict={verdict} />
        </div>
      )}

      {/* Investment Guidance */}
      {guidance && (
        <div className="px-3 py-2 border-b border-border"
          style={{ background: guidance.shouldInvest ? `${guidanceColor}08` : 'rgba(255,215,0,0.04)' }}>
          <div className="font-mono uppercase tracking-widest mb-1" style={{fontSize:9, color: guidanceColor}}>
            Investment Signal
          </div>
          <div className="flex items-center justify-between">
            <div className="font-display font-bold" style={{fontSize:12, color:guidanceColor}}>
              {guidance.action || 'HOLD / WAIT'}
            </div>
            <div className="font-mono border px-2 py-0.5" style={{fontSize:10, color:guidanceColor, borderColor:guidanceColor}}>
              {guidance.positionSize !== 'NONE' ? `~${guidance.capitalPct}% capital` : 'STAY OUT'}
            </div>
          </div>
          <div className="font-mono text-dim mt-1" style={{fontSize:10, lineHeight:1.5}}>
            {guidance.guidance}
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px" style={{background:'#1a3050'}}>
        {[
          {label:'VWAP',     val:`₹${fmt(data.vwap)}`, color:data.price>data.vwap?'#00ff88':'#ff3366'},
          {label:'EMA 20',  val:`₹${fmt(data.ema20)}`, color:data.price>data.ema20?'#00ff88':'#ff3366'},
          {label:'RSI(14)', val:(data.rsi||50).toFixed(1), color:data.rsi>70?'#ff3366':data.rsi<30?'#00ff88':'#ffd700'},
          {label:'ATR',     val:fmt(data.atr||0), color:'#c8dff0'},
          {label:'VOL RATIO',val:`${(data.volumeRatio||1).toFixed(2)}x`, color:data.volumeRatio>1.2?'#00ff88':data.volumeRatio<0.7?'#ff3366':'#ffd700'},
          {label:'PCR',     val:(data.pcr||0).toFixed(2), color:data.pcr>1.2?'#00ff88':data.pcr<0.8?'#ff3366':'#ffd700'},
        ].map(m=>(
          <div key={m.label} className="metric-cell">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value font-display" style={{color:m.color}}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Advanced indicators */}
      <div className="grid grid-cols-3 gap-px border-t border-border" style={{background:'#1a3050'}}>
        <div className="metric-cell">
          <div className="metric-label">EMA 50</div>
          <div className="metric-value font-display" style={{color:data.price>data.ema50?'#00ff88':'#ff3366'}}>
            ₹{fmt(data.ema50||0)}
          </div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">SUPERTREND</div>
          <div className="metric-value font-display" style={{color:data.supertrend?.direction==='up'?'#00ff88':'#ff3366'}}>
            {data.supertrend?.direction==='up'?'▲ BULL':'▼ BEAR'}
          </div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">ADX</div>
          <div className="metric-value font-display" style={{
            color: data.adx?.adx >= 40 ? '#00ff88' : data.adx?.adx >= 25 ? '#ffd700' : '#6a9ab8'
          }}>
            {data.adx?.adx || '—'} <span style={{fontSize:9}}>{data.adx?.trend || ''}</span>
          </div>
        </div>
      </div>

      {/* Risk Profile */}
      {riskProfile && (
        <div className="px-3 py-2 border-t border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-dim uppercase tracking-widest" style={{fontSize:9}}>Risk Profile</div>
            <div className="font-mono text-dim mt-0.5" style={{fontSize:10}}>{riskProfile.description?.slice(0,50)}...</div>
          </div>
          <div className="font-display font-bold border px-2 py-0.5 ml-2 flex-shrink-0"
            style={{fontSize:11, color:riskColor, borderColor:riskColor}}>
            {riskProfile.profile}
          </div>
        </div>
      )}

      {/* Trade Levels */}
      {ai && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-1.5">
          {[
            {label:'ENTRY',      val:`₹${fmt(ai.entry||0)}`, color:'#00d4ff'},
            {label:'TARGET',     val:`₹${fmt(ai.target||0)}`, color:'#00ff88'},
            {label:'STOP LOSS',  val:`₹${fmt(ai.stopLoss||0)}`, color:'#ff3366'},
            {label:'SUPPORT',    val:`₹${fmt(data.support)}`, color:'#00ff88'},
            {label:'RESISTANCE', val:`₹${fmt(data.resistance)}`, color:'#ff6b35'},
          ].map(l=>(
            <div key={l.label} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
              <span className="font-mono text-muted" style={{fontSize:11,letterSpacing:1}}>{l.label}</span>
              <span className="font-display font-bold" style={{fontSize:13,color:l.color}}>{l.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* MTF + Regime */}
      <div className="border-t border-border">
        <div className="grid grid-cols-3 gap-px" style={{background:'#1a3050'}}>
          {[{label:'M1',val:data.m1Trend},{label:'M5',val:data.m5Trend},{label:'M15',val:data.m15Trend}].map(t=>(
            <div key={t.label} className="bg-panel py-2 text-center">
              <div className="font-mono text-dim" style={{fontSize:10}}>{t.label}</div>
              <div className="font-display font-bold" style={{fontSize:11,
                color:t.val==='BULLISH'?'#00ff88':t.val==='BEARISH'?'#ff3366':'#ffd700'}}>
                {t.val||'—'}
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="font-mono text-dim" style={{fontSize:10}}>REGIME</span>
          <span className="font-mono border px-2 py-0.5 ml-auto"
            style={{fontSize:10, color:rColor, borderColor:rColor, background:`${rColor}11`}}>
            {(data.regime||'RANGE').replace(/_/g,' ')}
          </span>
        </div>
      </div>
    </div>
  )
}
