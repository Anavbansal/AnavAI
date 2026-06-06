import React, { useState } from 'react'
import { fmt } from '../utils/indicators'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function Delivery({ data, ai }) {
  const [showFib, setShowFib] = useState(false)

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
  const chartData = data.candles.slice(-45).map(c => ({
    date: new Date(c.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    price: c.close,
  }))

  const min = Math.min(...closes.slice(-45))
  const max = Math.max(...closes.slice(-45))
  const verdict = ai.verdict
  const accentColor = verdict === 'BUY' ? '#00ff88' : verdict === 'SELL' ? '#ff3366' : '#ffd700'

  // Fibonacci levels
  const fib = data.fibonacci
  const pp  = data.pivotPoints?.standard
  const obv = data.obv
  const obvColor = obv?.trend === 'ACCUMULATION' ? '#00ff88' : obv?.trend === 'DISTRIBUTION' ? '#ff3366' : '#6a9ab8'

  // Better swing targets using Fibonacci
  const swingEntry  = +(data.resistance - (data.resistance - data.support) * (verdict === 'BUY' ? 0.382 : 0.618)).toFixed(2)
  const swingTarget1 = fib ? fib.fib236 : +(data.resistance * 1.018).toFixed(2)
  const swingTarget2 = fib ? fib.fib1272 : +(data.resistance * 1.042).toFixed(2)
  const swingSL      = fib ? fib.fib618  : +(data.support * 0.985).toFixed(2)

  // Trend strengths
  const ema20above50 = data.ema20 > data.ema50
  const ema50above200 = data.ema200 > 0 ? data.ema50 > data.ema200 : null
  const longTermBull = ema50above200 !== null ? ema50above200 : data.price > data.ema50

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">📦 Delivery / Swing Trade</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-muted" style={{fontSize:10}}>
            {verdict} — {ai.confidence}% conf
          </span>
          <button onClick={() => setShowFib(s=>!s)}
            className="font-mono border border-border text-muted px-2 py-0.5 hover:border-accent transition-colors"
            style={{fontSize:9}}>
            {showFib ? 'HIDE FIB' : 'FIB LEVELS'}
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* 45-day area chart */}
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#3a5a7a', fontSize: 9 }} tickLine={false} axisLine={false} interval={8} />
              <YAxis domain={[min * 0.997, max * 1.003]} hide />
              <Tooltip formatter={v => `₹${fmt(v)}`}
                contentStyle={{ background: '#0a1520', border: '1px solid #1a3050', fontFamily: 'Share Tech Mono', fontSize: 11 }} />
              {pp && <ReferenceLine y={pp.pp} stroke="#00d4ff" strokeDasharray="3 3" strokeOpacity={0.5} />}
              {pp && <ReferenceLine y={pp.r1} stroke="#ff3366" strokeDasharray="2 4" strokeOpacity={0.4} />}
              {pp && <ReferenceLine y={pp.s1} stroke="#00ff88" strokeDasharray="2 4" strokeOpacity={0.4} />}
              <Area type="monotone" dataKey="price" stroke={accentColor} fill="url(#priceGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* EMA Alignment */}
        <div className="p-2 border border-border/50">
          <div className="font-mono text-dim uppercase tracking-widest mb-2" style={{fontSize:10}}>EMA Alignment (Trend Structure)</div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label:'EMA9', val:data.ema9, above: data.price > (data.ema9||0) },
              { label:'EMA20', val:data.ema20, above: data.price > data.ema20 },
              { label:'EMA50', val:data.ema50, above: data.price > data.ema50 },
              { label:'EMA200', val:data.ema200, above: data.price > (data.ema200||0) },
            ].map(e => (
              <div key={e.label} className="flex flex-col items-center">
                <span className="font-mono text-dim" style={{fontSize:9}}>{e.label}</span>
                <span className="font-display font-bold" style={{fontSize:11, color: e.above?'#00ff88':'#ff3366'}}>
                  {e.above ? '▲' : '▼'} ₹{fmt(e.val||0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Swing Levels */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'SWING ENTRY', val: `₹${fmt(ai.entry ?? swingEntry)}`, color: '#00d4ff' },
            { label: 'SWING SL',    val: `₹${fmt(swingSL)}`, color: '#ff3366' },
            { label: 'TARGET 1',    val: `₹${fmt(swingTarget1)}`, color: '#00ff88' },
            { label: 'TARGET 2',    val: `₹${fmt(swingTarget2)}`, color: '#00ff88' },
          ].map(l => (
            <div key={l.label} className="p-2 border border-border/50">
              <div className="font-mono text-dim uppercase tracking-wider" style={{ fontSize: 10 }}>{l.label}</div>
              <div className="font-display font-bold mt-1" style={{ fontSize: 14, color: l.color }}>{l.val}</div>
            </div>
          ))}
        </div>

        {/* OBV Volume Flow */}
        {obv && (
          <div className="flex items-center gap-3 p-2 border border-border/50">
            <div style={{fontSize:20, color:obvColor}}>
              {obv.trend === 'ACCUMULATION' ? '📈' : obv.trend === 'DISTRIBUTION' ? '📉' : '➡'}
            </div>
            <div className="flex-1">
              <div className="font-mono text-dim uppercase" style={{fontSize:9}}>Volume Flow (OBV)</div>
              <div className="font-display font-bold" style={{fontSize:12, color:obvColor}}>
                {obv.trend}
              </div>
              <div className="font-mono text-dim" style={{fontSize:10}}>
                {obv.trend === 'ACCUMULATION' ? 'Smart money buying — supports bullish thesis'
                  : obv.trend === 'DISTRIBUTION' ? 'Institutional selling — bearish volume divergence'
                  : 'Volume neutral — no directional bias from OBV'}
              </div>
            </div>
          </div>
        )}

        {/* Fibonacci Levels */}
        {showFib && fib && (
          <div className="p-2 border border-border/50">
            <div className="font-mono text-accent uppercase tracking-widest mb-2" style={{fontSize:10}}>
              Fibonacci Retracement Levels ({fib.isBullish ? 'Bullish' : 'Bearish'} Swing)
            </div>
            <div className="text-dim font-mono mb-1" style={{fontSize:10}}>
              Range: ₹{fmt(fib.lowest)} → ₹{fmt(fib.highest)} (₹{fmt(fib.range)})
            </div>
            {[
              { k:'0%',   v:fib.fib0,   desc:'Swing High/Low',         c:'#c8dff0' },
              { k:'23.6%',v:fib.fib236, desc:'Shallow pullback zone',   c:'#ffd700' },
              { k:'38.2%',v:fib.fib382, desc:'Key retracement level',   c:'#ffd700' },
              { k:'50%',  v:fib.fib500, desc:'Mid-point (psychological)',c:'#00d4ff' },
              { k:'61.8%',v:fib.fib618, desc:'Golden ratio — key S/R',  c:'#00ff88' },
              { k:'78.6%',v:fib.fib786, desc:'Deep retracement',         c:'#ff6b35' },
              { k:'100%', v:fib.fib1000,desc:'Swing Low/High',           c:'#c8dff0' },
              { k:'127.2%',v:fib.fib1272,desc:'Extension target 1',     c:'#00ff8877' },
              { k:'161.8%',v:fib.fib1618,desc:'Extension target 2',     c:'#00ff8855' },
            ].map(({ k, v, desc, c }) => (
              <div key={k} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0"
                style={{ background: data.price && Math.abs(data.price - v) < (data.atr || 10)*2 ? `${c}12` : 'transparent' }}>
                <span className="font-mono" style={{fontSize:10, color:c, width:48, flexShrink:0}}>{k}</span>
                <span className="font-mono font-bold text-muted" style={{fontSize:11, width:80, flexShrink:0}}>₹{fmt(v)}</span>
                <span className="font-mono text-dim flex-1" style={{fontSize:10}}>{desc}</span>
                {data.price && Math.abs(data.price - v) < (data.atr||10)*2 && (
                  <span className="font-mono" style={{fontSize:9, color:c}}>← CMP NEAR</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pivot Points */}
        {pp && (
          <div className="p-2 border border-border/50">
            <div className="font-mono text-dim uppercase tracking-widest mb-2" style={{fontSize:10}}>Daily Pivot Points</div>
            <div className="grid grid-cols-4 gap-1">
              {[
                {k:'R2', v:pp.r2, c:'#ff3366'},
                {k:'R1', v:pp.r1, c:'#ff6b35'},
                {k:'PP', v:pp.pp, c:'#00d4ff'},
                {k:'S1', v:pp.s1, c:'#00ff88'},
                {k:'S2', v:pp.s2, c:'#00ff8888'},
              ].map(({k, v, c}) => (
                <div key={k} className="flex flex-col items-center p-1 border border-border/30"
                  style={{background: data.price && Math.abs(data.price - v) < (data.atr||10)*1.5 ? `${c}12` : 'transparent'}}>
                  <span className="font-mono" style={{fontSize:9, color:c}}>{k}</span>
                  <span className="font-mono text-muted" style={{fontSize:10}}>₹{fmt(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Analysis */}
        <div className="border-t border-border/50 pt-3">
          <div className="font-mono text-accent uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Trend Analysis</div>
          {[
            { label: 'Short-term (1-5 days)',   val: data.m5Trend,  desc: `EMA20 ${ema20above50?'above':'below'} EMA50` },
            { label: 'Medium-term (1-4 weeks)', val: data.m15Trend, desc: `EMA50 ${ema50above200===null?'vs':ema50above200?'above':'below'} EMA200` },
            { label: 'Long-term (1-3 months)',  val: longTermBull ? 'BULLISH' : 'BEARISH',
              desc: `Price ${data.ema200>0?(data.price>data.ema200?'above':'below')+' EMA200':'vs EMA50'}` },
          ].map(t => (
            <div key={t.label} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
              <div>
                <span className="font-mono text-muted block" style={{ fontSize: 12 }}>{t.label}</span>
                <span className="font-mono text-dim" style={{ fontSize: 10 }}>{t.desc}</span>
              </div>
              <span className="font-display font-bold" style={{ fontSize: 12,
                color: t.val === 'BULLISH' ? '#00ff88' : t.val === 'BEARISH' ? '#ff3366' : '#ffd700' }}>
                {t.val}
              </span>
            </div>
          ))}
        </div>

        {/* ADX for Delivery */}
        {data.adx && (
          <div className="p-2 border border-border/50">
            <div className="flex justify-between items-center">
              <span className="font-mono text-dim uppercase" style={{fontSize:10}}>Trend Conviction (ADX)</span>
              <span className="font-display font-bold" style={{fontSize:12,
                color: data.adx.adx>=40?'#00ff88':data.adx.adx>=25?'#ffd700':'#6a9ab8'}}>
                {data.adx.adx} — {data.adx.trend}
              </span>
            </div>
            <div className="font-mono text-dim mt-1" style={{fontSize:10}}>
              {data.adx.adx >= 40 ? 'Strong trend — high conviction for positional trades'
               : data.adx.adx >= 25 ? 'Trending — moderate conviction, use trend-following strategies'
               : data.adx.adx >= 15 ? 'Weak trend — exercise caution, use range strategies'
               : 'Flat market — avoid delivery trades, no clear direction'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
