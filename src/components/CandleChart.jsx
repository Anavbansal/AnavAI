import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts'
import { fmt, calcEMASeries } from '../utils/indicators'

const COLORS = {
  bull:'#00e87a', bear:'#ff2d55', accent:'#00cfff', vwap:'#ffd700',
  ema9:'#ff8c00', ema20:'#00cfff', ema50:'#b06aff', ema200:'#ff6b6b',
  bb:'#6060ff', border:'#162030', bg:'#050d17', panel:'#091522',
  text:'#7aa8c8', dim:'#2a4a6a', white:'#cce0f5',
}

const TF_PERIODS = [
  { label:'1D', candles:78, showTime:true },
  { label:'5D', candles:390, showTime:true },
  { label:'11W', candles:1155, showTime:false },
  { label:'30D', candles:1200, showTime:false },
  { label:'1Y', candles:365, showTime:false },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const bull = d.close >= d.open
  const chgPct = d.open > 0 ? ((d.close - d.open) / d.open * 100).toFixed(2) : '0'
  return (
    <div style={{
      background:'#05101acc', border:`1px solid ${bull ? COLORS.bull+'66':'#ff2d5566'}`,
      borderRadius:6, padding:'8px 12px', fontFamily:'Share Tech Mono,monospace',
      fontSize:11, boxShadow:`0 4px 24px ${bull?COLORS.bull:'#ff2d55'}18`, minWidth:160,
    }}>
      <div style={{color:bull?COLORS.bull:COLORS.bear, fontWeight:'bold', marginBottom:6, fontSize:12}}>
        {bull?'▲':'▼'} ₹{fmt(d.close)} &nbsp;
        <span style={{color:COLORS.text, fontSize:10}}>{bull?'+':''}{chgPct}%</span>
      </div>
      {[['O',d.open],['H',d.high],['L',d.low],['C',d.close]].map(([k,v])=>(
        <div key={k} style={{display:'flex',justifyContent:'space-between',gap:16,lineHeight:1.7}}>
          <span style={{color:COLORS.dim}}>{k}</span>
          <span style={{color:COLORS.white}}>₹{fmt(v)}</span>
        </div>
      ))}
      <div style={{display:'flex',justifyContent:'space-between',gap:16,lineHeight:1.7,marginTop:3,borderTop:`1px solid ${COLORS.border}`,paddingTop:3}}>
        <span style={{color:COLORS.dim}}>Vol</span>
        <span style={{color:COLORS.text}}>{d.volume>1e6?(d.volume/1e6).toFixed(2)+'M':(d.volume/1e3).toFixed(0)+'K'}</span>
      </div>
    </div>
  )
}

function Legend({ items }) {
  return (
    <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}>
      {items.map(({color,label,dash})=>(
        <div key={label} style={{display:'flex',alignItems:'center',gap:5}}>
          <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth="1.5" strokeDasharray={dash?'4 3':'none'}/></svg>
          <span style={{fontFamily:'Share Tech Mono',color:COLORS.dim,fontSize:9,letterSpacing:1}}>{label}</span>
        </div>
      ))}
    </div>
  )
}

export default function CandleChart({ data, ai }) {
  const [tfIdx, setTfIdx] = useState(0)
  const [showEMA9, setShowEMA9] = useState(false)
  const [showEMA50, setShowEMA50] = useState(true)
  const [showEMA200, setShowEMA200] = useState(false)
  const [showBB, setShowBB] = useState(false)
  const tf = TF_PERIODS[tfIdx]

  const { chartData } = useMemo(() => {
    if (!data?.candles?.length) return { chartData: [] }
    const all = data.candles
    const slice = all.slice(-tf.candles)
    const closes = all.map(c=>c.close)
    // Compute full EMA series from all candles, then slice
    const allE9   = calcEMASeries(closes, 9)
    const allE20  = data.ema20Series?.length ? data.ema20Series : calcEMASeries(closes, 20)
    const allE50  = calcEMASeries(closes, 50)
    const allE200 = calcEMASeries(closes, 200)
    // BB series
    const allBBU=[], allBBL=[], allBBM=[]
    for (let i=0;i<closes.length;i++) {
      if (i<19) { allBBU.push(null);allBBL.push(null);allBBM.push(null);continue }
      const sl=closes.slice(i-19,i+1)
      const m=sl.reduce((a,b)=>a+b,0)/20
      const sd=Math.sqrt(sl.reduce((s,v)=>s+(v-m)**2,0)/20)
      allBBU.push(+(m+2*sd).toFixed(2)); allBBL.push(+(m-2*sd).toFixed(2)); allBBM.push(+m.toFixed(2))
    }
    const si = all.length - slice.length
    const avgVol = slice.reduce((s,c)=>s+c.volume,0)/Math.max(slice.length,1)
    const cd = slice.map((c,i)=>{
      const gi = si+i
      const ts = new Date(c.timestamp)
      const isIntraday = tf.showTime
      const label = isIntraday
        ? ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
        : ts.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
      const bull = c.close >= c.open
      const bodyH = Math.abs(c.close-c.open)
      const bodyBase = Math.min(c.open,c.close)
      return {
        ...c, label,
        bullBody: bull ? bodyH : 0,
        bearBody: bull ? 0 : bodyH,
        bodyBase,
        wick: c.high - c.low,
        e9:  allE9[gi]  != null ? +allE9[gi].toFixed(2)  : null,
        e20: allE20[gi] != null ? +allE20[gi].toFixed(2) : null,
        e50: allE50[gi] != null ? +allE50[gi].toFixed(2) : null,
        e200:allE200[gi]!= null ? +allE200[gi].toFixed(2): null,
        bbu: allBBU[gi], bbl: allBBL[gi], bbm: allBBM[gi],
        vwap: data.vwap,
        volRatio: avgVol>0 ? c.volume/avgVol : 1,
      }
    })
    return { chartData: cd }
  }, [data, tfIdx])

  if (!data) return (
    <div style={{background:COLORS.bg,border:`1px solid ${COLORS.border}`,borderRadius:8,
      display:'flex',alignItems:'center',justifyContent:'center',height:420,flexDirection:'column',gap:14}}>
      <div style={{fontSize:52,opacity:0.12}}>📈</div>
      <div style={{fontFamily:'Share Tech Mono',color:COLORS.dim,fontSize:11,letterSpacing:4}}>CHART LOADS ON ANALYSIS</div>
    </div>
  )

  const allCloses = chartData.map(d=>d.close)
  const allHighs  = chartData.map(d=>d.high)
  const allLows   = chartData.map(d=>d.low)
  const min = Math.min(...allLows)*0.9982
  const max = Math.max(...allHighs)*1.0018
  const barSz = Math.max(1.5, Math.min(9, 600/Math.max(chartData.length,1)))
  const tickInterval = Math.max(1, Math.floor(chartData.length/7))

  const OVERLAY_BTNS = [
    {key:'ema9',  label:'EMA9',   color:COLORS.ema9,   active:showEMA9,   toggle:()=>setShowEMA9(v=>!v)},
    {key:'ema50', label:'EMA50',  color:COLORS.ema50,  active:showEMA50,  toggle:()=>setShowEMA50(v=>!v)},
    {key:'ema200',label:'EMA200', color:COLORS.ema200, active:showEMA200, toggle:()=>setShowEMA200(v=>!v)},
    {key:'bb',    label:'BB(20)', color:COLORS.bb,     active:showBB,     toggle:()=>setShowBB(v=>!v)},
  ]

  const legendItems = [
    {color:COLORS.ema20, label:'EMA20'},
    {color:COLORS.vwap,  label:'VWAP', dash:true},
    ...(showEMA9  ? [{color:COLORS.ema9,  label:'EMA9'}]  : []),
    ...(showEMA50 ? [{color:COLORS.ema50, label:'EMA50'}] : []),
    ...(showEMA200? [{color:COLORS.ema200,label:'EMA200'}]: []),
    ...(showBB    ? [{color:COLORS.bb,    label:'BB(2σ)', dash:true}] : []),
    ...(ai?.entry > 0  ? [{color:COLORS.accent, label:`Entry ₹${fmt(ai.entry,0)}`, dash:true}]   : []),
    ...(ai?.target > 0 ? [{color:COLORS.bull,   label:`T ₹${fmt(ai.target,0)}`, dash:true}]      : []),
    ...(ai?.stopLoss>0 ? [{color:COLORS.bear,   label:`SL ₹${fmt(ai.stopLoss,0)}`, dash:true}]   : []),
  ]

  return (
    <div style={{background:COLORS.bg, border:`1px solid ${COLORS.border}`, borderRadius:8, overflow:'hidden', display:'flex', flexDirection:'column'}}>
      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',padding:'9px 14px',borderBottom:`1px solid ${COLORS.border}`,background:COLORS.panel,gap:8,flexWrap:'wrap'}}>
        <span style={{fontFamily:'Share Tech Mono',color:COLORS.accent,fontSize:11,fontWeight:'bold',letterSpacing:2}}>
          {data.symbol} &nbsp;·&nbsp; PRICE ACTION
        </span>
        {/* Timeframe */}
        <div style={{display:'flex',gap:3,marginLeft:'auto'}}>
          {TF_PERIODS.map((p,i)=>(
            <button key={p.label} onClick={()=>setTfIdx(i)} style={{
              fontFamily:'Share Tech Mono',fontSize:10,padding:'3px 9px',borderRadius:3,cursor:'pointer',transition:'all .15s',
              background: tfIdx===i ? `${COLORS.accent}22`:'transparent',
              border:`1px solid ${tfIdx===i ? COLORS.accent : COLORS.border}`,
              color: tfIdx===i ? COLORS.accent : COLORS.dim,
            }}>{p.label}</button>
          ))}
        </div>
        {/* Overlays */}
        <div style={{display:'flex',gap:3,marginLeft:8}}>
          {OVERLAY_BTNS.map(b=>(
            <button key={b.key} onClick={b.toggle} style={{
              fontFamily:'Share Tech Mono',fontSize:9,padding:'2px 7px',borderRadius:3,cursor:'pointer',
              background: b.active ? `${b.color}22`:'transparent',
              border:`1px solid ${b.active ? b.color : COLORS.border}`,
              color: b.active ? b.color : COLORS.dim,
            }}>{b.label}</button>
          ))}
        </div>
      </div>

      {/* Main Chart */}
      <div style={{height:310,padding:'6px 0 0 0'}}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{top:4,right:56,bottom:2,left:4}}>
            <defs>
              <linearGradient id="cgBull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.bull} stopOpacity={0.95}/>
                <stop offset="100%" stopColor={COLORS.bull} stopOpacity={0.65}/>
              </linearGradient>
              <linearGradient id="cgBear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.bear} stopOpacity={0.95}/>
                <stop offset="100%" stopColor={COLORS.bear} stopOpacity={0.65}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{fill:COLORS.dim,fontSize:9,fontFamily:'Share Tech Mono'}}
              tickLine={false} axisLine={{stroke:COLORS.border}} interval={tickInterval}/>
            <YAxis domain={[min,max]} orientation="right"
              tick={{fill:COLORS.dim,fontSize:9,fontFamily:'Share Tech Mono'}}
              tickLine={false} axisLine={false}
              tickFormatter={v=>'₹'+fmt(v,0)} width={58}/>
            <Tooltip content={<CustomTooltip/>} cursor={{stroke:COLORS.border,strokeWidth:1}}/>

            {/* BB bands */}
            {showBB && <Line type="monotone" dataKey="bbu" stroke={COLORS.bb} strokeWidth={1} dot={false} strokeDasharray="3 2" strokeOpacity={0.55}/>}
            {showBB && <Line type="monotone" dataKey="bbm" stroke={COLORS.bb} strokeWidth={0.7} dot={false} strokeOpacity={0.3}/>}
            {showBB && <Line type="monotone" dataKey="bbl" stroke={COLORS.bb} strokeWidth={1} dot={false} strokeDasharray="3 2" strokeOpacity={0.55}/>}

            {/* VWAP */}
            <Line type="monotone" dataKey="vwap" stroke={COLORS.vwap} strokeWidth={1.3} dot={false} strokeDasharray="5 3" strokeOpacity={0.85}/>
            {/* EMA20 — always */}
            <Line type="monotone" dataKey="e20" stroke={COLORS.ema20} strokeWidth={1.6} dot={false} strokeOpacity={0.9}/>
            {/* Optional overlays */}
            {showEMA9   && <Line type="monotone" dataKey="e9"   stroke={COLORS.ema9}   strokeWidth={1.2} dot={false} strokeOpacity={0.8}/>}
            {showEMA50  && <Line type="monotone" dataKey="e50"  stroke={COLORS.ema50}  strokeWidth={1.2} dot={false} strokeOpacity={0.75}/>}
            {showEMA200 && <Line type="monotone" dataKey="e200" stroke={COLORS.ema200} strokeWidth={1.2} dot={false} strokeOpacity={0.7}/>}

            {/* Candle bodies */}
            <Bar dataKey="bullBody" fill="url(#cgBull)" barSize={barSz} radius={[1,1,0,0]}/>
            <Bar dataKey="bearBody" fill="url(#cgBear)" barSize={barSz} radius={[1,1,0,0]}/>

            {/* Trade levels */}
            {ai?.entry>0    && <ReferenceLine y={ai.entry}    stroke={COLORS.accent} strokeDasharray="4 3" strokeWidth={1.2} label={{value:`ENTRY ₹${fmt(ai.entry,0)}`,fill:COLORS.accent,fontSize:9,position:'insideTopRight',fontFamily:'Share Tech Mono'}}/>}
            {ai?.target>0   && <ReferenceLine y={ai.target}   stroke={COLORS.bull}   strokeDasharray="4 3" strokeWidth={1.2} label={{value:`TGT ₹${fmt(ai.target,0)}`,fill:COLORS.bull,fontSize:9,position:'insideTopRight',fontFamily:'Share Tech Mono'}}/>}
            {ai?.stopLoss>0 && <ReferenceLine y={ai.stopLoss} stroke={COLORS.bear}   strokeDasharray="4 3" strokeWidth={1.2} label={{value:`SL ₹${fmt(ai.stopLoss,0)}`,fill:COLORS.bear,fontSize:9,position:'insideBottomRight',fontFamily:'Share Tech Mono'}}/>}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume */}
      <div style={{height:56,borderTop:`1px solid ${COLORS.border}88`}}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{top:0,right:56,bottom:0,left:4}}>
            <XAxis dataKey="label" hide/>
            <YAxis hide/>
            <Tooltip content={()=>null}/>
            <Bar dataKey="volume" barSize={barSz}
              fill={COLORS.accent} opacity={0.28}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Indicator strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',borderTop:`1px solid ${COLORS.border}`,background:COLORS.panel}}>
        {[
          {n:'RSI(14)', v:(data.rsi||50).toFixed(1), c:data.rsi>70?COLORS.bear:data.rsi<30?COLORS.bull:'#ffd700'},
          {n:'VWAP',    v:`₹${fmt(data.vwap,0)}`, c:COLORS.vwap},
          {n:'EMA20',   v:`₹${fmt(data.ema20,0)}`, c:COLORS.ema20},
          {n:'EMA50',   v:`₹${fmt(data.ema50,0)}`, c:COLORS.ema50},
          {n:'ATR',     v:`₹${fmt(data.atr)}`, c:COLORS.text},
          {n:'MACD',    v:data.macd?.histogram>0?'▲ BULL':'▼ BEAR', c:data.macd?.histogram>0?COLORS.bull:COLORS.bear},
        ].map(x=>(
          <div key={x.n} style={{padding:'7px 4px',textAlign:'center',borderRight:`1px solid ${COLORS.border}`}}>
            <div style={{fontFamily:'Share Tech Mono',color:COLORS.dim,fontSize:9,letterSpacing:1}}>{x.n}</div>
            <div style={{fontFamily:'Rajdhani,Share Tech Mono',fontWeight:700,color:x.c,fontSize:12,marginTop:2}}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Legend row */}
      <div style={{padding:'6px 14px',borderTop:`1px solid ${COLORS.border}`,background:COLORS.panel}}>
        <Legend items={legendItems}/>
      </div>
    </div>
  )
}
