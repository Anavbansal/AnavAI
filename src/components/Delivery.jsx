import React, { useMemo, useState } from 'react'
import { fmt, calcEMASeries } from '../utils/indicators'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Bar } from 'recharts'

const C = {
  bull:'#00e87a', bear:'#ff2d55', accent:'#00cfff', vwap:'#ffd700',
  ema20:'#00cfff', ema50:'#b06aff', ema200:'#ff6b6b',
  border:'#162030', bg:'#050d17', panel:'#091522',
  text:'#7aa8c8', dim:'#2a4a6a', white:'#cce0f5',
}

const PERIODS = [
  { label:'11W', days:77 },
  { label:'30D', days:30 },
  { label:'90D', days:90 },
  { label:'6M',  days:180 },
  { label:'1Y',  days:365 },
]

function TrendBadge({ val }) {
  const c = val==='BULLISH'?C.bull:val==='BEARISH'?C.bear:'#ffd700'
  return <span style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, padding:'2px 9px', border:`1px solid ${c}44`, borderRadius:3, color:c, background:`${c}0f`, letterSpacing:1}}>{val||'N/A'}</span>
}

export default function Delivery({ data, ai }) {
  const [period, setPeriod] = useState('30D')
  const days = PERIODS.find(p=>p.label===period)?.days ?? 30

  const { chartData, stats } = useMemo(()=>{
    if (!data?.candles?.length) return { chartData:[], stats:{} }
    const all = data.candles
    const slice = all.slice(-days)
    const closes = all.map(c=>c.close)
    const allE20  = calcEMASeries(closes, 20)
    const allE50  = calcEMASeries(closes, 50)
    const allE200 = calcEMASeries(closes, 200)
    const si = all.length - slice.length
    const cd = slice.map((c,i)=>{
      const gi = si+i
      return {
        date: new Date(c.timestamp).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),
        price:c.close, open:c.open, high:c.high, low:c.low, volume:c.volume,
        e20: allE20[gi]  != null ? +allE20[gi].toFixed(2)  : null,
        e50: allE50[gi]  != null ? +allE50[gi].toFixed(2)  : null,
        e200:allE200[gi] != null ? +allE200[gi].toFixed(2) : null,
        bull: c.close >= c.open,
      }
    })
    const periodHigh = +Math.max(...slice.map(c=>c.high)).toFixed(2)
    const periodLow  = +Math.min(...slice.map(c=>c.low)).toFixed(2)
    const rangeP = periodLow>0 ? ((periodHigh-periodLow)/periodLow*100).toFixed(2) : '0'
    const fromH  = periodHigh>0 ? ((data.price-periodHigh)/periodHigh*100).toFixed(2) : '0'
    const fromL  = periodLow>0  ? ((data.price-periodLow)/periodLow*100).toFixed(2)  : '0'
    const avgVol = slice.reduce((s,c)=>s+c.volume,0)/Math.max(slice.length,1)
    const stats = { periodHigh, periodLow, rangeP, fromH, fromL, avgVol }
    return { chartData:cd, stats }
  },[data,days])

  if (!data || !ai) return (
    <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8,
      display:'flex', alignItems:'center', justifyContent:'center', height:320, flexDirection:'column', gap:12}}>
      <div style={{fontSize:44, opacity:0.15}}>📦</div>
      <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:11, letterSpacing:4}}>DELIVERY · RUN ANALYSIS</div>
    </div>
  )

  const verdict = ai.verdict
  const vclr = verdict==='BUY'?C.bull:verdict==='SELL'?C.bear:'#ffd700'
  const allPrices = chartData.map(d=>d.price)
  const minP = Math.min(...allPrices)*0.997
  const maxP = Math.max(...allPrices)*1.003
  const barSz = Math.max(1.5, Math.min(8, 600/Math.max(chartData.length,1)))

  const e20now  = chartData[chartData.length-1]?.e20  ?? data.ema20
  const e50now  = chartData[chartData.length-1]?.e50  ?? data.ema50
  const e200now = chartData[chartData.length-1]?.e200 ?? data.ema200

  const swingSL = ai.stopLoss   || +(stats.periodLow*0.992).toFixed(2)
  const swingT1 = ai.target     || +(stats.periodHigh*1.012).toFixed(2)
  const swingT2 = +(swingT1*(1+(swingT1-swingSL)/Math.max(swingT1,1)*0.6)).toFixed(2)
  const entryLvl = ai.entry     || e20now
  const rr = swingSL>0 ? ((swingT1-entryLvl)/Math.max(entryLvl-swingSL,1)).toFixed(2) : 'N/A'

  const trendShort = data.price>e20now  ? 'BULLISH' : 'BEARISH'
  const trendMed   = data.price>e50now  ? 'BULLISH' : 'BEARISH'
  const trendLong  = data.price>e200now ? 'BULLISH' : 'BEARISH'
  const stTrend    = data.supertrend?.direction==='up' ? 'BULLISH' : 'BEARISH'
  const adxStr     = data.adx ? `ADX ${data.adx.adx} — ${data.adx.adx>30?'Strong trend':data.adx.adx>20?'Trending':'Weak/ranging'}` : 'N/A'

  // Delivery-specific: above/below key levels
  const above52wH = data.high52w>0 ? ((data.price-data.high52w)/data.high52w*100).toFixed(2) : null
  const above52wL = data.low52w>0  ? ((data.price-data.low52w)/data.low52w*100).toFixed(2)   : null

  return (
    <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'9px 14px', borderBottom:`1px solid ${C.border}`, background:C.panel, display:'flex', alignItems:'center', gap:10}}>
        <span style={{fontFamily:'Share Tech Mono', color:C.accent, fontSize:11, fontWeight:'bold', letterSpacing:2}}>📦 DELIVERY / SWING TRADE</span>
        <div style={{marginLeft:'auto', display:'flex', gap:3}}>
          {PERIODS.map(p=>(
            <button key={p.label} onClick={()=>setPeriod(p.label)} style={{
              fontFamily:'Share Tech Mono', fontSize:10, padding:'2px 9px', borderRadius:3, cursor:'pointer',
              background: period===p.label?`${C.accent}22`:'transparent',
              border:`1px solid ${period===p.label?C.accent:C.border}`,
              color: period===p.label?C.accent:C.dim,
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* AI Signal Row */}
      <div style={{
        padding:'10px 14px', borderBottom:`2px solid ${vclr}33`,
        background:`linear-gradient(135deg,${vclr}0c,transparent)`,
        display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:14, alignItems:'center',
      }}>
        <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:900, fontSize:30, color:vclr, letterSpacing:5, textShadow:`0 0 20px ${vclr}44`}}>{verdict}</div>
        <div>
          <div style={{fontFamily:'Share Tech Mono', color:C.text, fontSize:11}}>R:R {rr}:1 · Confidence {ai.confidence}%</div>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:10, marginTop:2}}>{(ai.summary||'').slice(0,90)}{ai.summary?.length>90?'...':''}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9}}>ADX</div>
          <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color: (data.adx?.adx||0)>30?C.bull:(data.adx?.adx||0)>20?'#ffd700':C.bear, fontSize:18}}>{data.adx?.adx||'–'}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9}}>OBV</div>
          <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color: data.obvTrend==='RISING'?C.bull:data.obvTrend==='FALLING'?C.bear:'#ffd700', fontSize:11, letterSpacing:1}}>{data.obvTrend||'–'}</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{height:220, borderBottom:`1px solid ${C.border}`}}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{top:6,right:52,bottom:2,left:4}}>
            <defs>
              <linearGradient id="dlvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={vclr} stopOpacity={0.22}/>
                <stop offset="100%" stopColor={vclr} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{fill:C.dim,fontSize:9,fontFamily:'Share Tech Mono'}} tickLine={false} axisLine={{stroke:C.border}} interval={Math.max(1,Math.floor(chartData.length/7))}/>
            <YAxis domain={[minP,maxP]} orientation="right" tick={{fill:C.dim,fontSize:9,fontFamily:'Share Tech Mono'}} tickLine={false} axisLine={false} tickFormatter={v=>'₹'+fmt(v,0)} width={54}/>
            <Tooltip formatter={v=>`₹${fmt(v)}`} contentStyle={{background:C.bg,border:`1px solid ${C.border}`,fontFamily:'Share Tech Mono',fontSize:10}}/>
            <Area type="monotone" dataKey="price" stroke={vclr} fill="url(#dlvGrad)" strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="e20"  stroke={C.ema20}  strokeWidth={1.3} dot={false} strokeOpacity={0.8}/>
            <Line type="monotone" dataKey="e50"  stroke={C.ema50}  strokeWidth={1.3} dot={false} strokeOpacity={0.75}/>
            <Line type="monotone" dataKey="e200" stroke={C.ema200} strokeWidth={1.2} dot={false} strokeOpacity={0.65}/>
            <ReferenceLine y={swingSL}  stroke={C.bear}   strokeDasharray="4 3" strokeWidth={1} label={{value:`SL`,fill:C.bear,fontSize:9,fontFamily:'Share Tech Mono',position:'insideTopRight'}}/>
            <ReferenceLine y={swingT1}  stroke={C.bull}   strokeDasharray="4 3" strokeWidth={1} label={{value:`T1`,fill:C.bull,fontSize:9,fontFamily:'Share Tech Mono',position:'insideTopRight'}}/>
            <ReferenceLine y={entryLvl} stroke={C.accent} strokeDasharray="4 3" strokeWidth={1} label={{value:`E`,fill:C.accent,fontSize:9,fontFamily:'Share Tech Mono',position:'insideTopRight'}}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Trade level grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:C.border, borderBottom:`1px solid ${C.border}`}}>
        {[
          {label:'ENTRY',    val:`₹${fmt(entryLvl)}`, color:C.accent},
          {label:'STOP LOSS',val:`₹${fmt(swingSL)}`,  color:C.bear},
          {label:'TARGET 1', val:`₹${fmt(swingT1)}`,  color:C.bull},
          {label:'TARGET 2', val:`₹${fmt(swingT2)}`,  color:'#00bb55'},
        ].map(l=>(
          <div key={l.label} style={{background:C.bg, padding:'8px 10px'}}>
            <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9, letterSpacing:1}}>{l.label}</div>
            <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:l.color, fontSize:15, marginTop:2}}>{l.val}</div>
          </div>
        ))}
      </div>

      {/* Period stats */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:1, background:C.border, borderBottom:`1px solid ${C.border}`}}>
        {[
          {label:`${period} HIGH`, val:`₹${fmt(stats.periodHigh,0)}`, color:C.bull},
          {label:`${period} LOW`,  val:`₹${fmt(stats.periodLow,0)}`,  color:C.bear},
          {label:'RANGE',          val:`${stats.rangeP}%`,              color:C.text},
          {label:'FROM HIGH',      val:`${stats.fromH}%`,              color:parseFloat(stats.fromH)<-5?C.bear:C.bull},
          ...(above52wH!=null?[{label:'VS 52W HIGH', val:`${above52wH}%`, color:parseFloat(above52wH)>-3?C.bull:C.bear}]:[{label:'52W HIGH', val:data.high52w?`₹${fmt(data.high52w,0)}`:'N/A', color:C.text}]),
        ].map(l=>(
          <div key={l.label} style={{background:C.bg, padding:'7px 10px'}}>
            <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:8, letterSpacing:1}}>{l.label}</div>
            <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:l.color, fontSize:13, marginTop:2}}>{l.val}</div>
          </div>
        ))}
      </div>

      {/* Trend table */}
      <div style={{padding:'10px 14px'}}>
        <div style={{fontFamily:'Share Tech Mono', color:C.accent, fontSize:9, letterSpacing:2, marginBottom:8}}>MULTI-TIMEFRAME TREND ANALYSIS</div>
        {[
          {label:`Short (EMA20 ₹${fmt(e20now,0)})`,   val:trendShort, detail:`Price ${data.price>e20now?'above':'below'} 20-day EMA`},
          {label:`Medium (EMA50 ₹${fmt(e50now,0)})`,  val:trendMed,   detail:`Price ${data.price>e50now?'above':'below'} 50-day EMA`},
          {label:`Long (EMA200 ₹${fmt(e200now,0)})`,  val:trendLong,  detail:`Price ${data.price>e200now?'above':'below'} 200-day EMA — ${trendLong==='BULLISH'?'Bull Market':'Bear Market'}`},
          {label:'Supertrend',                          val:stTrend,    detail:`ST value ₹${fmt(data.supertrend?.value||0,0)}`},
          {label:'ADX Strength',                        val:data.adx?.adx>30?'STRONG':(data.adx?.adx||0)>20?'TRENDING':'WEAK', detail:adxStr},
          {label:'OBV Volume',                          val:data.obvTrend||'N/A', detail:'On-Balance Volume confirms institutional flow'},
        ].map(t=>(
          <div key={t.label} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${C.border}33`}}>
            <div>
              <div style={{fontFamily:'Share Tech Mono', color:C.text, fontSize:11}}>{t.label}</div>
              <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:10}}>{t.detail}</div>
            </div>
            <TrendBadge val={t.val}/>
          </div>
        ))}
      </div>
    </div>
  )
}
