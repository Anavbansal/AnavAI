import React from 'react'

const fmt = (n, d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})

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

  return (
    <div className="panel animate-fadein">
      {/* Data source badge */}
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

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px" style={{background:'#1a3050'}}>
        {[
          {label:'VWAP',    val:`₹${fmt(data.vwap)}`, color:data.price>data.vwap?'#00ff88':'#ff3366'},
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

      {/* Advanced indicators row */}
      <div className="grid grid-cols-2 gap-px border-t border-border" style={{background:'#1a3050'}}>
        {[
          {label:'EMA 50',     val:`₹${fmt(data.ema50||0)}`,  color:data.price>data.ema50?'#00ff88':'#ff3366'},
          {label:'SUPERTREND', val:data.supertrend?.direction==='up'?'▲ BULL':'▼ BEAR', color:data.supertrend?.direction==='up'?'#00ff88':'#ff3366'},
          {label:'ADX',        val:(data.adx?.adx||0).toFixed(1), color:(data.adx?.adx||0)>30?'#00ff88':(data.adx?.adx||0)>20?'#ffd700':'#ff3366'},
          {label:'STOCH RSI',  val:(data.stochRSI||50).toFixed(1), color:(data.stochRSI||50)>80?'#ff3366':(data.stochRSI||50)<20?'#00ff88':'#ffd700'},
          {label:'OBV TREND',  val:data.obvTrend||'N/A', color:data.obvTrend==='RISING'?'#00ff88':data.obvTrend==='FALLING'?'#ff3366':'#ffd700'},
          {label:'52W HIGH',   val:data.high52w?`₹${fmt(data.high52w,0)}`:'N/A', color:'#c8dff0'},
        ].map(m=>(
          <div key={m.label} className="metric-cell">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value font-display" style={{color:m.color}}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Verdict */}
      {ai && (
        <div className="text-center px-4 py-3 border-t border-border">
          <div className={`inline-block font-display font-black border-2 px-6 py-2 ${vClass}`}
            style={{fontSize:22, letterSpacing:4}}>
            {verdict}
          </div>
          {ai.score != null && (
            <div className="font-mono text-muted mt-1" style={{fontSize:10}}>
              Score: {ai.score}/100
            </div>
          )}
          <div className="mt-2 h-1 rounded overflow-hidden" style={{background:'#0d1825'}}>
            <div className="h-full transition-all duration-700 rounded"
              style={{width:`${conf}%`, background:`linear-gradient(90deg,${confColor}99,${confColor})`}}/>
          </div>
          <div className="font-mono text-muted mt-1" style={{fontSize:11}}>
            Confidence: {conf}% · RR: {ai.riskReward?.toFixed(1)||'N/A'}:1
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
            {(data.regime||'RANGE').replace('_',' ')}
          </span>
        </div>
      </div>
    </div>
  )
}
