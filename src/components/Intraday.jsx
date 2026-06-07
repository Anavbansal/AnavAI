import React, { useState, useEffect } from 'react'
import { useLivePrice } from '../hooks/useLivePrice'

const f2 = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})
const fc = n => `₹${f2(n)}`

function Badge({label, color='var(--accent2)', bg}) {
  return <span style={{padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",
    background:bg||`${color}15`,color,border:`1px solid ${color}33`}}>{label}</span>
}

function Row({label, value, color='var(--text)', pass}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'1px solid #1f2d4533'}}>
      {pass!==undefined && <span style={{color:pass?'var(--green)':'var(--red)',fontSize:13,flexShrink:0}}>{pass?'✓':'✗'}</span>}
      <span style={{fontSize:12,color:'var(--text2)',flex:1}}>{label}</span>
      <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color}}>{value}</span>
    </div>
  )
}

function Section({title, children}) {
  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:10}}>
      <div style={{padding:'8px 12px',background:'var(--bg2)',borderBottom:'1px solid var(--border)',
        fontSize:11,fontWeight:700,color:'var(--text2)',letterSpacing:.8,textTransform:'uppercase'}}>
        {title}
      </div>
      <div style={{padding:'4px 12px 8px'}}>{children}</div>
    </div>
  )
}

const IST_WINDOWS = [
  {label:'9:15–10:00',desc:'Opening — high vol, momentum trades',color:'var(--green)',mins:[555,600]},
  {label:'10:00–11:30',desc:'Trend confirmation phase',color:'var(--amber)',mins:[600,690]},
  {label:'11:30–13:30',desc:'Lunch lull — avoid, whipsaw likely',color:'var(--red)',mins:[690,810]},
  {label:'13:30–15:30',desc:'Power hour — strong directional moves',color:'var(--green)',mins:[810,930]},
]

export default function Intraday({ data, ai }) {
  const { priceData } = useLivePrice(data?.symbol)
  const livePrice = priceData?.price || data?.price || 0

  const [nowMins, setNowMins] = useState(0)
  useEffect(()=>{
    const tick=()=>{
      const ist=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}))
      setNowMins(ist.getHours()*60+ist.getMinutes())
    }
    tick(); const id=setInterval(tick,30000); return()=>clearInterval(id)
  },[])

  if (!data || !ai) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      padding:40,gap:10,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
      <div style={{fontSize:36,opacity:.12}}>⚡</div>
      <div style={{color:'var(--text3)',fontSize:13}}>Run analysis to see intraday signals</div>
    </div>
  )

  const bull = ai.verdict==='BUY', bear = ai.verdict==='SELL'
  const vclr = bull?'var(--green)':bear?'var(--red)':'var(--amber)'

  // Signal checklist
  const signals = [
    {label:'Price vs VWAP',  val:`${livePrice>data.vwap?'▲ ABOVE':'▼ BELOW'} ₹${f2(data.vwap)}`,  pass:livePrice>data.vwap,     w:'HIGH'},
    {label:'EMA20 Trend',    val:`${livePrice>data.ema20?'▲ ABOVE':'▼ BELOW'} ₹${f2(data.ema20)}`, pass:livePrice>data.ema20,    w:'HIGH'},
    {label:'RSI Momentum',   val:`RSI ${(data.rsi||50).toFixed(1)} ${data.rsi>70?'OB':data.rsi<30?'OS':data.rsi>50?'Bull':'Bear'}`, pass:data.rsi>50&&data.rsi<72, w:'MED'},
    {label:'MACD Histogram', val:data.macd?.histogram>0?`▲ +${data.macd.histogram.toFixed(3)}`:`▼ ${(data.macd?.histogram||0).toFixed(3)}`, pass:data.macd?.histogram>0, w:'MED'},
    {label:'Supertrend',     val:`${data.supertrend?.direction==='up'?'▲ BULL':'▼ BEAR'} ₹${f2(data.supertrend?.value)}`, pass:data.supertrend?.direction==='up', w:'HIGH'},
    {label:'StochRSI K',     val:`K=${data.stochRSI?.k||50} D=${data.stochRSI?.d||50}`, pass:(data.stochRSI?.k||50)<80&&(data.stochRSI?.k||50)>20, w:'MED'},
    {label:'Volume',         val:`${(data.volumeRatio||1).toFixed(2)}x avg ${data.volComparison?.signal||''}`, pass:data.volumeRatio>1.0, w:'MED'},
    {label:'MTF Alignment',  val:data.trendConsistency==='CONFIRMED'?`✓ ALIGNED ${data.m1Trend||''}`:data.trendConsistency||'–', pass:data.trendConsistency==='CONFIRMED', w:'HIGH'},
    {label:'ADX Strength',   val:`ADX ${data.adx?.adx||0} ${data.adx?.trend||''}`, pass:(data.adx?.adx||0)>=18, w:'MED'},
    {label:'Williams %R',    val:`${data.williamsR||0}`, pass:(data.williamsR||0)<-20&&(data.williamsR||0)>-80, w:'LOW'},
  ]
  const passed = signals.filter(s=>s.pass).length
  const score  = Math.round((passed/signals.length)*100)

  // ORB
  const orb = data.orb
  const orbBest = orb?.orb15 || orb?.orb30 || orb?.orb60
  const orbSignalColor = orb?.signal==='BULLISH_BREAKOUT'?'var(--green)':orb?.signal==='BEARISH_BREAKDOWN'?'var(--red)':'var(--amber)'

  // Gap
  const gap = data.gapAnalysis
  const gapColor = gap?.gapPct>0?'var(--green)':gap?.gapPct<0?'var(--red)':'var(--text3)'

  // PDH/PDL
  const pd = data.pdhdpl

  // VWAP Bands
  const vb = data.vwapBands

  // Circuit limits
  const cl = data.circuitLimits

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>

      {/* Header */}
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px 10px 0 0',
        padding:'10px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{fontSize:16}}>⚡</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'var(--text)'}}>Intraday Signal Board</span>
        <span className={`verdict verdict-${ai.verdict}`} style={{marginLeft:'auto',fontSize:16,padding:'3px 12px'}}>{ai.verdict}</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:vclr}}>{score}/100</span>
      </div>

      {/* Live Price + Gap */}
      <Section title="📡 Live Price & Pre-Market">
        <Row label="Live Price" value={fc(livePrice)} color={livePrice>=(data.price||0)?'var(--green)':'var(--red)'}/>
        {gap && <>
          <Row label="Today Open vs Prev Close"
            value={`${gap.gapPct>=0?'+':''}${gap.gapPct}% (${fc(Math.abs(gap.gapPoints))} gap)`}
            color={gapColor}/>
          <Row label="Gap Type" value={gap.type.replace(/_/g,' ')} color={gapColor}/>
          <Row label="Gap Filled" value={gap.filled?'YES — gap closed':'NO — still open'} color={gap.filled?'var(--text3)':'var(--amber)'}/>
          <Row label="Prev Close" value={fc(gap.prevClose)} color="var(--text3)"/>
        </>}
        {pd && <>
          <Row label="Prev Day High (PDH)" value={fc(pd.pdh)} color="var(--red)"/>
          <Row label="Prev Day Low (PDL)"  value={fc(pd.pdl)} color="var(--green)"/>
          <Row label="PDH Status" value={livePrice>pd.pdh?'▲ ABOVE PDH (breakout)':livePrice<pd.pdl?'▼ BELOW PDL (breakdown)':'Within PDH-PDL range'} color={livePrice>pd.pdh?'var(--green)':livePrice<pd.pdl?'var(--red)':'var(--text3)'}/>
        </>}
      </Section>

      {/* ORB */}
      <Section title="📐 Opening Range Breakout (ORB)">
        {orbBest ? <>
          <Row label="ORB High (15m)" value={orb?.orb15?fc(orb.orb15.high):'–'} color="var(--red)"/>
          <Row label="ORB Low  (15m)" value={orb?.orb15?fc(orb.orb15.low):'–'}  color="var(--green)"/>
          {orb?.orb30 && <Row label="ORB Range (30m)" value={`${fc(orb.orb30.low)} – ${fc(orb.orb30.high)}`} color="var(--text2)"/>}
          <Row label="ORB Signal" value={(orb?.signal||'–').replace(/_/g,' ')} color={orbSignalColor}/>
          <Row label="ORB Target" value={orbBest?fc(orb?.signal==='BULLISH_BREAKOUT'?orbBest.high+(orbBest.range||0):orbBest.low-(orbBest.range||0)):fc(0)} color={orbSignalColor}/>
          <Row label="ORB SL"     value={orbBest?fc(orb?.signal==='BULLISH_BREAKOUT'?orbBest.low:orbBest.high):fc(0)} color="var(--red)"/>
        </> : (
          <div style={{padding:'8px 0',fontSize:12,color:'var(--text3)'}}>
            ORB data available only during/after market hours (9:15 IST+)
          </div>
        )}
      </Section>

      {/* VWAP + Bands */}
      <Section title="📊 VWAP & Bands (±1σ, ±2σ)">
        {vb ? <>
          <Row label="VWAP" value={fc(vb.vwap)} color="var(--amber)"/>
          <Row label="+1σ Upper" value={fc(vb.upper1)} color="var(--text2)"/>
          <Row label="−1σ Lower" value={fc(vb.lower1)} color="var(--text2)"/>
          <Row label="+2σ Upper (OB Zone)" value={fc(vb.upper2)} color="var(--red)"/>
          <Row label="−2σ Lower (OS Zone)" value={fc(vb.lower2)} color="var(--green)"/>
          <Row label="Price Position" value={
            livePrice>vb.upper2?'Above +2σ (Overbought!)':
            livePrice>vb.upper1?'Between +1σ and +2σ (Bullish)':
            livePrice<vb.lower2?'Below −2σ (Oversold!)':
            livePrice<vb.lower1?'Between −1σ and −2σ (Bearish)':
            'Inside ±1σ (Normal range)'
          } color={livePrice>vb.upper2||livePrice<vb.lower2?'var(--red)':livePrice>vb.upper1||livePrice<vb.lower1?'var(--amber)':'var(--green)'}/>
        </> : <Row label="VWAP" value={fc(data.vwap)} color="var(--amber)"/>}
      </Section>

      {/* Signal Checklist */}
      <Section title={`✅ Signal Checklist (${passed}/${signals.length})`}>
        {signals.map((sig,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #1f2d4522'}}>
            <span style={{color:sig.pass?'var(--green)':'var(--red)',fontSize:12,flexShrink:0}}>{sig.pass?'✓':'✗'}</span>
            <span style={{fontSize:11,color:'var(--text2)',flex:1}}>{sig.label}</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:sig.pass?'var(--green)':'var(--red)'}}>{sig.val}</span>
            <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:sig.w==='HIGH'?'#ef444420':'#f59e0b20',
              color:sig.w==='HIGH'?'var(--red)':'var(--amber)',fontFamily:"'DM Mono',monospace"}}>{sig.w}</span>
          </div>
        ))}
        <div style={{marginTop:8,padding:'6px 10px',background:'var(--bg)',borderRadius:6,
          fontSize:11,color:'var(--text3)',display:'flex',justifyContent:'space-between'}}>
          <span>Score: <strong style={{color:vclr}}>{score}/100</strong></span>
          <span>Entry ₹{f2(ai.entry)} · T ₹{f2(ai.target)} · SL ₹{f2(ai.stopLoss)} · R:R {ai.riskReward?.toFixed(1)}:1</span>
        </div>
      </Section>

      {/* Trading Windows */}
      <Section title="🕐 IST Trading Windows">
        {IST_WINDOWS.map((w,i)=>{
          const active = nowMins>=w.mins[0]&&nowMins<w.mins[1]
          return (
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',
              borderBottom:'1px solid #1f2d4522',background:active?`${w.color}08`:'transparent',
              borderRadius:active?6:'none',paddingLeft:active?8:0}}>
              {active&&<span style={{fontSize:10,color:w.color}}>▶</span>}
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:w.color,minWidth:80}}>{w.label}</span>
              <span style={{fontSize:11,color:active?'var(--text)':'var(--text3)'}}>{w.desc}</span>
              {active&&<Badge label="NOW" color={w.color}/>}
            </div>
          )
        })}
      </Section>

      {/* Circuit Limits */}
      {cl && (
        <Section title="⚠ Circuit Limits">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
            {[
              {l:'+20% UC',v:cl.upper20,c:'var(--red)'},
              {l:'-20% LC',v:cl.lower20,c:'var(--green)'},
              {l:'+10%',v:cl.upper10,c:'#f97316'},
              {l:'-10%',v:cl.lower10,c:'#22d3ee'},
              {l:'+5%',v:cl.upper5,c:'var(--amber)'},
              {l:'-5%',v:cl.lower5,c:'var(--accent2)'},
            ].map(x=>(
              <div key={x.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 8px',
                background:'var(--bg)',borderRadius:5,border:'1px solid var(--border)'}}>
                <span style={{fontSize:10,color:'var(--text3)'}}>{x.l}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,color:x.c}}>{fc(x.v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Pivot Points */}
      {data.pivotPoints?.standard && (
        <Section title="📍 Pivot Points">
          {[['R3',data.pivotPoints.standard.r3,'var(--red)'],['R2',data.pivotPoints.standard.r2,'#f97316'],
            ['R1',data.pivotPoints.standard.r1,'var(--amber)'],['PP',data.pivotPoints.standard.pp,'var(--accent2)'],
            ['S1',data.pivotPoints.standard.s1,'var(--amber)'],['S2',data.pivotPoints.standard.s2,'#22d3ee'],
            ['S3',data.pivotPoints.standard.s3,'var(--green)']
          ].map(([k,v,c])=>(
            <Row key={k} label={k} value={fc(v)} color={c}/>
          ))}
        </Section>
      )}

    </div>
  )
}
