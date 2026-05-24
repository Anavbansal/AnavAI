import React, { useMemo } from 'react'
import { fmt } from '../utils/indicators'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const C = {
  bull:'#00e87a', bear:'#ff2d55', accent:'#00cfff', vwap:'#ffd700',
  ema20:'#00cfff', border:'#162030', bg:'#050d17', panel:'#091522',
  text:'#7aa8c8', dim:'#2a4a6a', white:'#cce0f5',
}

function Pill({ val, pass, size='sm' }) {
  const color = pass ? C.bull : C.bear
  return (
    <span style={{
      fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:size==='lg'?13:10,
      padding: size==='lg'?'3px 10px':'2px 7px',
      border:`1px solid ${color}55`, borderRadius:3,
      color, background:`${color}11`,
      letterSpacing:1,
    }}>{val}</span>
  )
}

function MeterBar({ val, min=0, max=100, color, height=4 }) {
  const pct = Math.max(0, Math.min(100, ((val-min)/(max-min||1))*100))
  return (
    <div style={{height, background:'#0d1825', borderRadius:2, overflow:'hidden', marginTop:3}}>
      <div style={{height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${color}88,${color})`, borderRadius:2, transition:'width .5s ease'}}/>
    </div>
  )
}

export default function Intraday({ data, ai }) {
  const miniData = useMemo(()=>{
    if (!data?.candles?.length) return []
    return data.candles.slice(-80).map(c=>({
      t: new Date(c.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),
      price: c.close, vwap: data.vwap,
    }))
  },[data])

  if (!data || !ai) return (
    <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8,
      display:'flex', alignItems:'center', justifyContent:'center', height:320, flexDirection:'column', gap:12}}>
      <div style={{fontSize:44, opacity:0.15}}>⚡</div>
      <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:11, letterSpacing:4}}>INTRADAY · RUN ANALYSIS</div>
    </div>
  )

  const bull  = ai.verdict==='BUY'
  const bear  = ai.verdict==='SELL'
  const vclr  = bull ? C.bull : bear ? C.bear : '#ffd700'
  const stBull = data.supertrend?.direction==='up'
  const bbPct  = data.bb ? Math.max(0,Math.min(100,((data.price-data.bb.lower)/Math.max(data.bb.upper-data.bb.lower,1))*100)) : 50

  const signals = [
    { label:'Price vs VWAP',      pass: data.price>data.vwap,            weight:'HIGH',
      val:  `${data.price>data.vwap?'+':''}${((data.price-data.vwap)/data.vwap*100).toFixed(2)}%`,
      detail:`₹${fmt(data.price)} vs ₹${fmt(data.vwap)}` },
    { label:'Price vs EMA20',     pass: data.price>data.ema20,           weight:'HIGH',
      val:  data.price>data.ema20?'▲ ABOVE':'▼ BELOW',
      detail:`EMA20 ₹${fmt(data.ema20)} | EMA50 ₹${fmt(data.ema50)}` },
    { label:'Supertrend',         pass: stBull,                          weight:'HIGH',
      val:  stBull?'▲ BULLISH':'▼ BEARISH',
      detail:`ST @ ₹${fmt(data.supertrend?.value||0)}` },
    { label:'MACD Histogram',     pass: data.macd?.histogram>0,          weight:'HIGH',
      val:  data.macd?.histogram>0?`+${data.macd.histogram.toFixed(3)}`:data.macd?.histogram?.toFixed(3)||'0',
      detail:`MACD ${data.macd?.macd?.toFixed(3)} | Sig ${data.macd?.signal?.toFixed(3)}` },
    { label:'ADX Trend Strength', pass: (data.adx?.adx||0)>20,           weight:'HIGH',
      val:  `ADX ${data.adx?.adx||'N/A'}`,
      detail:`+DI ${data.adx?.plusDI||'–'} | -DI ${data.adx?.minusDI||'–'} | ${(data.adx?.adx||0)>30?'STRONG TREND':(data.adx?.adx||0)>20?'TREND':'NO TREND'}` },
    { label:'RSI Zone',           pass: data.rsi>45&&data.rsi<72,        weight:'MED',
      val:  `RSI ${data.rsi?.toFixed(1)}`,
      detail: data.rsi>70?'Overbought':data.rsi<30?'Oversold':data.rsi>50?'Bullish zone':'Bearish zone' },
    { label:'StochRSI',           pass: (data.stochRSI||50)<80&&(data.stochRSI||50)>15, weight:'MED',
      val:  `S-RSI ${data.stochRSI||'N/A'}`,
      detail: (data.stochRSI||50)>80?'Overbought':(data.stochRSI||50)<20?'Oversold — buy zone':'Neutral' },
    { label:'OBV Trend',          pass: data.obvTrend==='RISING',        weight:'MED',
      val:  data.obvTrend||'N/A',
      detail:'On-Balance Volume — confirms price move with volume' },
    { label:'Volume Confirmation', pass: (data.volumeRatio||0)>1,        weight:'MED',
      val:  `${(data.volumeRatio||1).toFixed(2)}x avg`,
      detail: (data.volumeRatio||1)>1.5?'Strong — high conviction':(data.volumeRatio||1)>1?'Above avg':'Below avg — weak signal' },
    { label:'Multi-TF Alignment', pass: data.trendConsistency==='CONFIRMED', weight:'HIGH',
      val:  data.trendConsistency,
      detail:`M1:${data.m1Trend} | M5:${data.m5Trend} | M15:${data.m15Trend}` },
    { label:'PCR / OI Bias',      pass: (data.pcr||1)>0.9,              weight:'MED',
      val:  data.pcr>1.2?'▲ BULLISH':data.pcr<0.8?'▼ BEARISH':'→ NEUTRAL',
      detail:`PCR ${(data.pcr||1).toFixed(2)} — ${data.pcr>1.2?'Puts dominant (bullish)':data.pcr<0.8?'Calls dominant (bearish)':'Balanced'}` },
  ]

  const highSignals  = signals.filter(s=>s.weight==='HIGH')
  const highPass     = highSignals.filter(s=>s.pass).length
  const totalPass    = signals.filter(s=>s.pass).length
  const score        = Math.round((totalPass/signals.length)*100)
  const highScore    = Math.round((highPass/highSignals.length)*100)

  return (
    <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', display:'flex', flexDirection:'column'}}>
      {/* Header */}
      <div style={{padding:'9px 14px', borderBottom:`1px solid ${C.border}`, background:C.panel, display:'flex', alignItems:'center', gap:10}}>
        <span style={{fontFamily:'Share Tech Mono', color:C.accent, fontSize:11, fontWeight:'bold', letterSpacing:2}}>⚡ INTRADAY SIGNAL BOARD</span>
        <div style={{marginLeft:'auto', display:'flex', gap:10, alignItems:'center'}}>
          <span style={{fontFamily:'Share Tech Mono', fontSize:10, color:C.dim}}>HIGH {highPass}/{highSignals.length}</span>
          <span style={{fontFamily:'Share Tech Mono', fontSize:10, color: score>=65?C.bull:score<=40?C.bear:'#ffd700'}}>SCORE {score}/100</span>
        </div>
      </div>

      {/* Verdict banner */}
      <div style={{
        padding:'10px 14px', borderBottom:`2px solid ${vclr}33`,
        background:`linear-gradient(135deg,${vclr}0d,transparent 70%)`,
        display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'center',
      }}>
        <div style={{
          fontFamily:'Rajdhani,sans-serif', fontWeight:900, fontSize:32, color:vclr, letterSpacing:5,
          textShadow:`0 0 24px ${vclr}55, 0 0 60px ${vclr}22`,
        }}>{ai.verdict}</div>
        <div>
          <div style={{fontFamily:'Share Tech Mono', color:C.text, fontSize:11}}>
            Entry ₹{fmt(ai.entry??0)} · Target ₹{fmt(ai.target??0)} · SL ₹{fmt(ai.stopLoss??0)}
          </div>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:10, marginTop:3}}>
            R:R {(ai.riskReward??0).toFixed(1)}:1 · Conf {ai.confidence}% · {(data.regime||'').replace('_',' ')}
          </div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9, letterSpacing:1}}>CONF</div>
          <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:vclr, fontSize:24}}>{ai.confidence}%</div>
          <MeterBar val={ai.confidence} color={vclr} height={3}/>
        </div>
      </div>

      {/* Mini chart */}
      {miniData.length>0 && (
        <div style={{height:80, borderBottom:`1px solid ${C.border}`}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={miniData} margin={{top:4,right:4,bottom:0,left:0}}>
              <defs>
                <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={vclr} stopOpacity={0.35}/>
                  <stop offset="100%" stopColor={vclr} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="price" stroke={vclr} fill="url(#intGrad)" strokeWidth={1.6} dot={false}/>
              <Area type="monotone" dataKey="vwap" stroke={C.vwap} fill="none" strokeWidth={1} strokeDasharray="4 3" dot={false}/>
              <XAxis dataKey="t" hide/>
              <YAxis hide domain={['auto','auto']}/>
              <Tooltip formatter={v=>[`₹${fmt(v)}`,'Price']} contentStyle={{background:C.bg,border:`1px solid ${C.border}`,fontFamily:'Share Tech Mono',fontSize:10}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 4-cell indicator grid */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:1, background:C.border, borderBottom:`1px solid ${C.border}`}}>
        {[
          {n:'RSI(14)',   v:(data.rsi||50).toFixed(1), c:data.rsi>70?C.bear:data.rsi<30?C.bull:'#ffd700', sub:data.rsi>70?'OVERBOUGHT':data.rsi<30?'OVERSOLD':'NEUTRAL', pct:data.rsi, mn:0, mx:100},
          {n:'STOCH RSI', v:(data.stochRSI||50).toFixed(1), c:(data.stochRSI||50)>80?C.bear:(data.stochRSI||50)<20?C.bull:C.text, sub:(data.stochRSI||50)>80?'OB ZONE':(data.stochRSI||50)<20?'OS ZONE':'MID', pct:data.stochRSI||50, mn:0, mx:100},
          {n:'ADX',       v:(data.adx?.adx||0).toFixed(1), c:(data.adx?.adx||0)>30?C.bull:(data.adx?.adx||0)>20?'#ffd700':C.bear, sub:(data.adx?.adx||0)>30?'STRONG TREND':(data.adx?.adx||0)>20?'TRENDING':'WEAK', pct:data.adx?.adx||0, mn:0, mx:60},
          {n:'VOL RATIO', v:`${(data.volumeRatio||1).toFixed(2)}x`, c:(data.volumeRatio||1)>1.5?C.bull:(data.volumeRatio||1)<0.7?C.bear:'#ffd700', sub:(data.volumeRatio||1)>1.5?'HIGH VOL':(data.volumeRatio||1)<0.7?'LOW VOL':'NORMAL', pct:data.volumeRatio||1, mn:0, mx:3},
        ].map(m=>(
          <div key={m.n} style={{background:C.bg, padding:'8px 10px'}}>
            <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9, letterSpacing:1}}>{m.n}</div>
            <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:m.c, fontSize:16, marginTop:1}}>{m.v}</div>
            <MeterBar val={m.pct} min={m.mn} max={m.mx} color={m.c}/>
            <div style={{fontFamily:'Share Tech Mono', color:m.c, fontSize:8, marginTop:2, letterSpacing:1}}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Signal checklist */}
      <div style={{padding:'0 14px 10px', overflowY:'auto', maxHeight:340}}>
        <div style={{fontFamily:'Share Tech Mono', color:C.accent, fontSize:9, letterSpacing:2, padding:'8px 0 6px', borderBottom:`1px solid ${C.border}33`}}>
          SIGNAL CHECKLIST — {totalPass}/{signals.length} PASSING
        </div>
        {signals.map((s,i)=>(
          <div key={i} style={{
            display:'grid', gridTemplateColumns:'18px 1fr auto', alignItems:'start',
            gap:8, padding:'7px 0', borderBottom:`1px solid ${C.border}33`,
          }}>
            <span style={{color:s.pass?C.bull:C.bear, fontSize:14, lineHeight:1.4}}>{s.pass?'✓':'✗'}</span>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontFamily:'Share Tech Mono', color:C.white, fontSize:11}}>{s.label}</span>
                <span style={{fontFamily:'Share Tech Mono', fontSize:8, padding:'1px 5px',
                  border:`1px solid ${s.weight==='HIGH'?'#ffd70033':'#2a4a6a'}`,
                  color:s.weight==='HIGH'?'#ffd700':C.dim, borderRadius:2}}>{s.weight}</span>
              </div>
              <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:10, marginTop:2}}>{s.detail}</div>
            </div>
            <Pill val={s.val} pass={s.pass}/>
          </div>
        ))}
      </div>

      {/* BB position bar */}
      <div style={{padding:'8px 14px', borderTop:`1px solid ${C.border}`}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:5}}>
          <span style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9}}>BB LOWER ₹{fmt(data.bb?.lower??0)}</span>
          <span style={{fontFamily:'Share Tech Mono', color:C.text, fontSize:9}}>BOLLINGER BAND POSITION ({bbPct.toFixed(0)}%)</span>
          <span style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9}}>BB UPPER ₹{fmt(data.bb?.upper??0)}</span>
        </div>
        <div style={{height:6, background:'#0d1825', borderRadius:3, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', top:0, bottom:0, left:0, right:0, background:'linear-gradient(90deg,#ff2d5522,#ffd70022,#00e87a22)'}}/>
          <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', left:`calc(${bbPct}% - 4px)`, width:8, height:8, borderRadius:'50%', background:vclr, boxShadow:`0 0 8px ${vclr}`}}/>
        </div>
      </div>
    </div>
  )
}
