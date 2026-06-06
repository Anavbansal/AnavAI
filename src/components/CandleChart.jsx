import React, { useMemo, useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { calcEMASeries } from '../utils/indicators'

const G = { green:'#10b981', red:'#ef4444', blue:'#6366f1', yellow:'#f59e0b', purple:'#a78bfa', orange:'#f97316', bg:'#0b0f19', card:'#151c2c', border:'#1f2d45' }

const PERIODS = [
  {label:'1D', bars:80,  intraday:true},
  {label:'5D', bars:400, intraday:false},
  {label:'1M', bars:1200,intraday:false},
  {label:'3M', bars:90,  daily:true},
  {label:'1Y', bars:365, daily:true},
]

function Tooltip_({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload; if (!d) return null
  const bull = d.close >= d.open
  const chg = d.open > 0 ? ((d.close-d.open)/d.open*100).toFixed(2) : '0'
  const fmtN = n => n?.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) ?? '–'
  return (
    <div className="chart-tooltip">
      <div style={{ color: bull?G.green:G.red, fontWeight:700, marginBottom:8, fontSize:12 }}>
        ₹{fmtN(d.close)} <span style={{color:'#64748b',fontWeight:400}}>{bull?'+':''}{chg}%</span>
      </div>
      {[['O',d.open],['H',d.high],['L',d.low],['C',d.close]].map(([k,v])=>(
        <div key={k} style={{display:'flex',justifyContent:'space-between',gap:20,lineHeight:1.8,color:'#94a3b8'}}>
          <span>{k}</span><span style={{color:'#f1f5f9'}}>₹{fmtN(v)}</span>
        </div>
      ))}
      {d.volume > 0 && (
        <div style={{display:'flex',justifyContent:'space-between',gap:20,lineHeight:1.8,borderTop:'1px solid #1f2d45',marginTop:6,paddingTop:6,color:'#64748b'}}>
          <span>Vol</span><span>{d.volume>1e6?(d.volume/1e6).toFixed(2)+'M':(d.volume/1e3).toFixed(0)+'K'}</span>
        </div>
      )}
    </div>
  )
}

const OVERLAYS = [
  {key:'ema9',  label:'EMA 9',   color:'#f97316'},
  {key:'ema20', label:'EMA 20',  color:'#6366f1'},
  {key:'ema50', label:'EMA 50',  color:'#a78bfa'},
  {key:'ema200',label:'EMA 200', color:'#ef4444'},
  {key:'vwap',  label:'VWAP',    color:'#f59e0b', dash:true},
  {key:'bbu',   label:'BB',      color:'#3b82f6', dash:true},
]

export default function CandleChart({ data, ai }) {
  const [pi, setPi] = useState(0)
  const [active, setActive] = useState({ema20:true, vwap:true})
  const p = PERIODS[pi]

  const { chart } = useMemo(()=>{
    if (!data?.candles?.length) return { chart:[] }
    const all = data.candles
    const isDaily = p.daily
    const slice = isDaily ? all.slice(-p.bars) : all.slice(-p.bars)
    const closes = all.map(c=>c.close)
    const e9   = calcEMASeries(closes,9)
    const e20  = calcEMASeries(closes,20)
    const e50  = calcEMASeries(closes,50)
    const e200 = calcEMASeries(closes,200)
    // BB
    const bbu=[],bbl=[]
    for(let i=0;i<closes.length;i++){
      if(i<19){bbu.push(null);bbl.push(null);continue}
      const sl=closes.slice(i-19,i+1),m=sl.reduce((a,b)=>a+b,0)/20
      const sd=Math.sqrt(sl.reduce((s,v)=>s+(v-m)**2,0)/20)
      bbu.push(+(m+2*sd).toFixed(2));bbl.push(+(m-2*sd).toFixed(2))
    }
    const si=all.length-slice.length
    const avgVol=slice.reduce((s,c)=>s+c.volume,0)/Math.max(slice.length,1)
    const chart=slice.map((c,i)=>{
      const gi=si+i, ts=new Date(c.timestamp)
      const bull=c.close>=c.open
      return {
        ...c,
        label: p.intraday
          ? ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
          : ts.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),
        bullBody: bull?Math.abs(c.close-c.open):0,
        bearBody: bull?0:Math.abs(c.close-c.open),
        bodyBase: Math.min(c.open,c.close),
        ema9:  e9[gi]!=null?+e9[gi].toFixed(2):null,
        ema20: e20[gi]!=null?+e20[gi].toFixed(2):null,
        ema50: e50[gi]!=null?+e50[gi].toFixed(2):null,
        ema200:e200[gi]!=null?+e200[gi].toFixed(2):null,
        bbu:   bbu[gi], bbl: bbl[gi],
        vwap:  data.vwap,
        volColor: c.volume>avgVol*1.4?(bull?G.green:G.red):(bull?G.green+'66':G.red+'66'),
      }
    })
    return { chart }
  },[data, pi])

  if (!data) return (
    <div className="card" style={{height:420,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
      <div style={{fontSize:48,opacity:0.1}}>📊</div>
      <div style={{color:'#475569',fontSize:13}}>Search and analyze a symbol to view chart</div>
    </div>
  )

  const fmtN = n => n?.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0}) ?? ''
  const allC  = chart.map(d=>d.close), allH=chart.map(d=>d.high), allL=chart.map(d=>d.low)
  const mn = Math.min(...allL)*0.9982, mx = Math.max(...allH)*1.0018
  const barSz = Math.max(1, Math.min(10, 560/Math.max(chart.length,1)))
  const tickInt = Math.max(1,Math.floor(chart.length/7))
  const last = chart[chart.length-1]
  const bull = last?.close >= last?.open

  function toggleOverlay(k) { setActive(a=>({...a,[k]:!a[k]})) }

  const currentPrice = data.price || 0
  const priceColor = currentPrice > (chart[chart.length-2]?.close||currentPrice) ? G.green : G.red

  return (
    <div className="card" style={{display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #1f2d45',gap:12,flexWrap:'wrap'}}>
        {/* Symbol + price */}
        <div>
          <span style={{fontWeight:700,fontSize:15,color:'#f1f5f9'}}>{data.symbol}</span>
          <span style={{marginLeft:10,fontFamily:'JetBrains Mono',fontSize:16,fontWeight:700,color:priceColor}}>
            ₹{currentPrice.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
          </span>
          {data.changePct != null && (
            <span style={{marginLeft:8,fontSize:12,color:priceColor}}>
              {data.changePct>=0?'+':''}{data.changePct?.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Period selectors */}
        <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
          {PERIODS.map((pp,i)=>(
            <button key={pp.label} onClick={()=>setPi(i)} className="tab-btn" style={{
              fontSize:11,padding:'3px 10px',
              ...(pi===i?{background:'#1e2a3d',color:'#f1f5f9',border:'1px solid #2a3f5f'}:{})
            }}>{pp.label}</button>
          ))}
        </div>

        {/* Overlay toggles */}
        <div style={{display:'flex',gap:4}}>
          {OVERLAYS.map(o=>(
            <button key={o.key} onClick={()=>toggleOverlay(o.key)} style={{
              fontSize:10,padding:'2px 8px',borderRadius:4,cursor:'pointer',fontFamily:'JetBrains Mono',
              background: active[o.key]?`${o.color}22`:'transparent',
              border:`1px solid ${active[o.key]?o.color:'#1f2d45'}`,
              color: active[o.key]?o.color:'#475569',transition:'all .15s',
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* Main price chart */}
      <div style={{flex:1,height:280}}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{top:8,right:60,bottom:4,left:4}}>
            <defs>
              <linearGradient id="bullG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={G.green} stopOpacity={0.95}/>
                <stop offset="100%" stopColor={G.green} stopOpacity={0.6}/>
              </linearGradient>
              <linearGradient id="bearG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={G.red} stopOpacity={0.95}/>
                <stop offset="100%" stopColor={G.red} stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{fill:'#475569',fontSize:9,fontFamily:'JetBrains Mono'}} tickLine={false} axisLine={{stroke:'#1f2d45'}} interval={tickInt}/>
            <YAxis domain={[mn,mx]} orientation="right" tick={{fill:'#475569',fontSize:9,fontFamily:'JetBrains Mono'}} tickLine={false} axisLine={false} tickFormatter={v=>'₹'+fmtN(v)} width={60}/>
            <Tooltip content={<Tooltip_/>} cursor={{stroke:'#2a3f5f',strokeWidth:1}}/>

            {/* BB */}
            {active.bbu && <Line type="monotone" dataKey="bbu" stroke={G.blue} strokeWidth={1} dot={false} strokeDasharray="3 2" strokeOpacity={0.5}/>}
            {active.bbu && <Line type="monotone" dataKey="bbl" stroke={G.blue} strokeWidth={1} dot={false} strokeDasharray="3 2" strokeOpacity={0.5}/>}

            {/* EMAs */}
            {active.vwap  && <Line type="monotone" dataKey="vwap"  stroke={G.yellow}  strokeWidth={1.4} dot={false} strokeDasharray="5 3" strokeOpacity={0.85}/>}
            {active.ema20 && <Line type="monotone" dataKey="ema20" stroke="#6366f1"   strokeWidth={1.6} dot={false} strokeOpacity={0.9}/>}
            {active.ema9  && <Line type="monotone" dataKey="ema9"  stroke={G.orange}  strokeWidth={1.2} dot={false} strokeOpacity={0.8}/>}
            {active.ema50 && <Line type="monotone" dataKey="ema50" stroke="#a78bfa"   strokeWidth={1.2} dot={false} strokeOpacity={0.75}/>}
            {active.ema200&& <Line type="monotone" dataKey="ema200"stroke={G.red}     strokeWidth={1.2} dot={false} strokeOpacity={0.7}/>}

            {/* Candle bodies */}
            <Bar dataKey="bullBody" fill="url(#bullG)" barSize={barSz} radius={[1,1,0,0]}/>
            <Bar dataKey="bearBody" fill="url(#bearG)" barSize={barSz} radius={[1,1,0,0]}/>

            {/* Trade levels */}
            {ai?.entry>0    && <ReferenceLine y={ai.entry}    stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.2} label={{value:`Entry ₹${fmtN(ai.entry)}`,fill:'#6366f1',fontSize:9,position:'insideTopRight',fontFamily:'JetBrains Mono'}}/>}
            {ai?.target>0   && <ReferenceLine y={ai.target}   stroke={G.green} strokeDasharray="4 3" strokeWidth={1.2} label={{value:`Target ₹${fmtN(ai.target)}`,fill:G.green,fontSize:9,position:'insideTopRight',fontFamily:'JetBrains Mono'}}/>}
            {ai?.stopLoss>0 && <ReferenceLine y={ai.stopLoss} stroke={G.red}   strokeDasharray="4 3" strokeWidth={1.2} label={{value:`SL ₹${fmtN(ai.stopLoss)}`,fill:G.red,fontSize:9,position:'insideBottomRight',fontFamily:'JetBrains Mono'}}/>}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume chart */}
      <div style={{height:52,borderTop:'1px solid #1f2d4522'}}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{top:0,right:60,bottom:0,left:4}}>
            <XAxis dataKey="label" hide/>
            <YAxis hide/>
            <Tooltip content={()=>null}/>
            <Bar dataKey="volume" barSize={barSz} fill="#6366f1" opacity={0.25} radius={[1,1,0,0]}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Indicator strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',borderTop:'1px solid #1f2d45',background:'#0e1420'}}>
        {[
          {n:'RSI',  v:(data.rsi||50).toFixed(1), c:data.rsi>70?G.red:data.rsi<30?G.green:G.yellow},
          {n:'VWAP', v:'₹'+fmtN(data.vwap), c:G.yellow},
          {n:'EMA20',v:'₹'+fmtN(data.ema20), c:'#6366f1'},
          {n:'MACD', v:data.macd?.histogram>0?'▲ BULL':'▼ BEAR', c:data.macd?.histogram>0?G.green:G.red},
          {n:'ATR',  v:data.atr?.toFixed(2)||'–', c:'#94a3b8'},
          {n:'ADX',  v:data.adx?.adx?.toFixed(0)||'–', c:(data.adx?.adx||0)>25?G.green:'#94a3b8'},
        ].map(x=>(
          <div key={x.n} style={{padding:'7px 8px',textAlign:'center',borderRight:'1px solid #1f2d4566'}}>
            <div style={{fontSize:9,color:'#475569',fontWeight:600,letterSpacing:0.8,textTransform:'uppercase'}}>{x.n}</div>
            <div style={{fontFamily:'JetBrains Mono',fontWeight:700,color:x.c,fontSize:11,marginTop:2}}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:14,padding:'7px 16px',borderTop:'1px solid #1f2d4566',flexWrap:'wrap',background:'#0e1420'}}>
        {OVERLAYS.filter(o=>active[o.key]).map(o=>(
          <div key={o.key} style={{display:'flex',alignItems:'center',gap:5}}>
            <svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke={o.color} strokeWidth="1.5" strokeDasharray={o.dash?'4 3':'none'}/></svg>
            <span style={{fontFamily:'JetBrains Mono',color:'#475569',fontSize:9}}>{o.label}</span>
          </div>
        ))}
        {ai?.entry>0 && <div style={{display:'flex',alignItems:'center',gap:5}}><svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono',color:'#475569',fontSize:9}}>Entry</span></div>}
        {ai?.target>0 && <div style={{display:'flex',alignItems:'center',gap:5}}><svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke={G.green} strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono',color:'#475569',fontSize:9}}>Target</span></div>}
        {ai?.stopLoss>0 && <div style={{display:'flex',alignItems:'center',gap:5}}><svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke={G.red} strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono',color:'#475569',fontSize:9}}>Stop Loss</span></div>}
      </div>
    </div>
  )
}
