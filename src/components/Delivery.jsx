import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const f2 = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})
const fc = n => `₹${f2(n)}`

function Row({label,value,color='var(--text)',sub}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'7px 0',borderBottom:'1px solid #1f2d4522'}}>
      <span style={{fontSize:12,color:'var(--text2)'}}>{label}</span>
      <div style={{textAlign:'right'}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color}}>{value}</div>
        {sub&&<div style={{fontSize:10,color:'var(--text3)'}}>{sub}</div>}
      </div>
    </div>
  )
}

function Section({title,children}) {
  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:10}}>
      <div style={{padding:'8px 12px',background:'var(--bg2)',borderBottom:'1px solid var(--border)',
        fontSize:11,fontWeight:700,color:'var(--text2)',letterSpacing:.8,textTransform:'uppercase'}}>{title}</div>
      <div style={{padding:'4px 12px 8px'}}>{children}</div>
    </div>
  )
}

const SECTOR_MAP = {
  'RELIANCE':'Energy','TCS':'IT','HDFCBANK':'Banking','INFY':'IT','ICICIBANK':'Banking',
  'SBIN':'Banking','WIPRO':'IT','TATAMOTORS':'Auto','TATASTEEL':'Metals','NTPC':'Power',
  'SUNPHARMA':'Pharma','ADANIENT':'Conglomerate','ZOMATO':'Consumer Tech',
  'NATIONALUM':'Metals','RVNL':'Infra','IRFC':'Finance','TATAPOWER':'Power',
}

export default function Delivery({ data, ai }) {
  const [fundamentals, setFundamentals] = useState(null)
  const [tab, setTab] = useState('swing')

  // Fetch fundamentals
  useEffect(()=>{
    if (!data?.symbol) return
    const token = localStorage.getItem('upstox_access_token') || ''
    fetch(`${API_BASE_URL}/fundamentals?symbol=${data.symbol}`, {
      headers: token ? {Authorization:`Bearer ${token}`} : {}
    })
      .then(r=>r.json())
      .then(d=>{ if(d?.status==='success') setFundamentals(d.data) })
      .catch(()=>{})
  },[data?.symbol])

  if (!data || !ai) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      padding:40,gap:10,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
      <div style={{fontSize:36,opacity:.12}}>📦</div>
      <div style={{color:'var(--text3)',fontSize:13}}>Run delivery analysis to see swing signals</div>
    </div>
  )

  const bull = ai.verdict==='BUY', bear = ai.verdict==='SELL'
  const vclr = bull?'var(--green)':bear?'var(--red)':'var(--amber)'

  const pd = data.pdhdpl
  const fib = data.fibonacci
  const obv = data.obv
  const adx = data.adx
  const high52w = data.high52w || 0
  const low52w  = data.low52w  || 0
  const price   = data.price   || 0
  const pct52   = high52w > low52w ? ((price-low52w)/(high52w-low52w)*100).toFixed(1) : null
  const volComp = data.volComparison
  const sector  = SECTOR_MAP[data.symbol] || fundamentals?.sector || '–'

  // Swing targets
  const entry   = ai.entry   || price
  const target1 = ai.target  || (fib?.fib236 || price*1.05)
  const target2 = fib?.fib1272 || price*1.10
  const sl      = ai.stopLoss|| (fib?.fib618 || price*0.95)

  return (
    <div style={{display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px 10px 0 0',
        padding:'10px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{fontSize:16}}>📦</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>Delivery / Swing</span>
        <div style={{marginLeft:'auto',display:'flex',gap:4}}>
          {['swing','52w','volume','fundamentals'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:'3px 9px',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,
              background:tab===t?'var(--accent)':'var(--bg2)',
              color:tab===t?'#fff':'var(--text3)',
            }}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* SWING TAB */}
      {tab==='swing' && <>
        {/* Verdict */}
        <Section title="🎯 Swing Signal">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0'}}>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:vclr,letterSpacing:2}}>{ai.verdict}</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Confidence: {ai.confidence}% · R:R {ai.riskReward?.toFixed(1)}:1</div>
            </div>
            <div>
              <div style={{width:56,height:56,borderRadius:'50%',border:`3px solid ${vclr}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:vclr}}>
                {ai.confidence}%
              </div>
            </div>
          </div>
          <Row label="Entry"    value={fc(entry)}   color="var(--accent2)"/>
          <Row label="Target 1" value={fc(target1)} color="var(--green)"/>
          <Row label="Target 2" value={fc(target2)} color="var(--green)" sub="Fib extension"/>
          <Row label="Stop Loss" value={fc(sl)}     color="var(--red)"/>
        </Section>

        {/* EMA Alignment */}
        <Section title="📈 EMA Trend Structure">
          {[{l:'EMA9',v:data.ema9||0},{l:'EMA20',v:data.ema20},{l:'EMA50',v:data.ema50},{l:'EMA200',v:data.ema200}].map(e=>(
            <Row key={e.l} label={e.l} value={fc(e.v)}
              color={price>e.v?'var(--green)':'var(--red)'}
              sub={price>e.v?'Price above — bullish':'Price below — bearish'}/>
          ))}
          <Row label="EMA20 vs EMA50" value={data.ema20>data.ema50?'EMA20 > EMA50 (Bull)':'EMA20 < EMA50 (Bear)'}
            color={data.ema20>data.ema50?'var(--green)':'var(--red)'}/>
        </Section>

        {/* OBV + ADX */}
        <Section title="📊 Volume Flow & Trend Strength">
          {obv && <Row label="OBV Trend" value={obv.trend} color={obv.trend==='ACCUMULATION'?'var(--green)':obv.trend==='DISTRIBUTION'?'var(--red)':'var(--text3)'}/>}
          {adx && <Row label="ADX (Trend Strength)" value={`${adx.adx} — ${adx.trend}`} color={adx.adx>=30?'var(--green)':adx.adx>=20?'var(--amber)':'var(--text3)'}/>}
          {adx && <Row label="+DI / -DI" value={`${adx.pdi} / ${adx.mdi}`} color={adx.pdi>adx.mdi?'var(--green)':'var(--red)'}/>}
        </Section>

        {/* Fibonacci */}
        {fib && (
          <Section title="🌀 Fibonacci Levels">
            {[
              ['0%',    fib.fib0,   'var(--text3)'],
              ['23.6%', fib.fib236, 'var(--amber)'],
              ['38.2%', fib.fib382, 'var(--amber)'],
              ['50%',   fib.fib500, 'var(--accent2)'],
              ['61.8%', fib.fib618, 'var(--green)'],
              ['100%',  fib.fib1000,'var(--text3)'],
              ['127.2%',fib.fib1272,'var(--green)'],
              ['161.8%',fib.fib1618,'var(--green)'],
            ].map(([k,v,c])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',
                borderBottom:'1px solid #1f2d4522',
                background:v&&Math.abs(price-v)<(data.atr||10)*2?`${c}08`:'transparent'}}>
                <span style={{fontSize:11,color:c,fontFamily:"'DM Mono',monospace"}}>{k}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:c}}>{fc(v)}</span>
                {v&&Math.abs(price-v)<(data.atr||10)*2&&<span style={{fontSize:9,color:c}}>← CMP NEAR</span>}
              </div>
            ))}
          </Section>
        )}
      </>}

      {/* 52W TAB */}
      {tab==='52w' && <>
        <Section title="📅 52-Week Range">
          <Row label="52W High" value={fc(high52w)} color="var(--red)"/>
          <Row label="52W Low"  value={fc(low52w)}  color="var(--green)"/>
          <Row label="Current"  value={fc(price)}   color={price>high52w*0.95?'var(--red)':price<low52w*1.05?'var(--green)':'var(--text)'}/>
          {pct52 && <Row label="Position in Range" value={`${pct52}% from low`}
            color={Number(pct52)>80?'var(--red)':Number(pct52)<20?'var(--green)':'var(--amber)'}
            sub={Number(pct52)>90?'⚠ Near 52W high — risk high':Number(pct52)<10?'📈 Near 52W low — opportunity?':'Mid-range'}/>}
          {high52w>0&&<div style={{margin:'10px 0',height:12,background:'var(--border)',borderRadius:6,overflow:'hidden',position:'relative'}}>
            <div style={{position:'absolute',height:'100%',width:`${pct52||50}%`,
              background:`linear-gradient(90deg,var(--green),var(--amber),var(--red))`,borderRadius:6}}/>
            <div style={{position:'absolute',left:`${pct52||50}%`,top:-2,width:4,height:16,
              background:'#fff',borderRadius:2,transform:'translateX(-50%)'}}/>
          </div>}
          {pd && <><Row label="Prev Day High (PDH)" value={fc(pd.pdh)} color="var(--red)"/>
          <Row label="Prev Day Low (PDL)"  value={fc(pd.pdl)} color="var(--green)"/>
          <Row label="Prev Day Close (PDC)"value={fc(pd.pdc)} color="var(--text2)"/></>}
        </Section>

        {/* Multi-timeframe trend */}
        <Section title="📊 Multi-Timeframe Trend">
          {[['Short-term (M5)',data.m5Trend],['Medium-term (M15)',data.m15Trend],
            ['EMA20 vs 50',data.ema20>data.ema50?'BULLISH':'BEARISH'],
            ['EMA50 vs 200',data.ema50>(data.ema200||0)?'BULLISH':'BEARISH'],
          ].map(([l,v])=>(
            <Row key={l} label={l} value={v||'–'} color={v==='BULLISH'?'var(--green)':v==='BEARISH'?'var(--red)':'var(--amber)'}/>
          ))}
        </Section>
      </>}

      {/* VOLUME TAB */}
      {tab==='volume' && <>
        <Section title="📊 Volume Analysis">
          {volComp && <>
            <Row label="Today's Volume"  value={(volComp.todayVol/1000).toFixed(0)+'K'} color="var(--text)"/>
            <Row label="10-Day Avg"      value={(volComp.avgVol/1000).toFixed(0)+'K'}   color="var(--text3)"/>
            <Row label="Volume Ratio"    value={`${volComp.ratio}x`}
              color={volComp.ratio>2?'var(--green)':volComp.ratio>1.4?'var(--amber)':'var(--text3)'}/>
            <Row label="Signal"          value={volComp.signal.replace('_',' ')}
              color={volComp.signal==='VERY_HIGH'||volComp.signal==='HIGH'?'var(--green)':'var(--text3)'}/>
          </>}
          <Row label="Volume Ratio (curr)" value={`${(data.volumeRatio||1).toFixed(2)}x`}
            color={(data.volumeRatio||1)>1.4?'var(--green)':'var(--text3)'}/>
          {obv&&<Row label="OBV Trend" value={obv.trend} color={obv.trend==='ACCUMULATION'?'var(--green)':obv.trend==='DISTRIBUTION'?'var(--red)':'var(--text3)'}/>}
        </Section>
        <Section title="🏭 Sector Context">
          <Row label="Sector" value={sector} color="var(--accent2)"/>
          <Row label="Market Cap" value={data.riskProfile?.profile||'–'} color="var(--text2)"/>
          <Row label="Regime" value={(data.regime||'–').replace(/_/g,' ')} color="var(--text2)"/>
        </Section>
      </>}

      {/* FUNDAMENTALS TAB */}
      {tab==='fundamentals' && (
        <Section title="🏢 Fundamental Data">
          {fundamentals ? <>
            <Row label="Company"      value={fundamentals.company_name||data.symbol} color="var(--text)"/>
            <Row label="Sector"       value={fundamentals.sector||'–'}               color="var(--accent2)"/>
            <Row label="Industry"     value={fundamentals.industry||'–'}             color="var(--text2)"/>
            {fundamentals.pe_ratio&&<Row label="P/E Ratio"   value={fundamentals.pe_ratio?.toFixed(1)||'–'}
              color={fundamentals.pe_ratio>40?'var(--red)':fundamentals.pe_ratio<15?'var(--green)':'var(--amber)'}/>}
            {fundamentals.pb_ratio&&<Row label="P/B Ratio"   value={fundamentals.pb_ratio?.toFixed(2)||'–'}
              color={fundamentals.pb_ratio>5?'var(--red)':fundamentals.pb_ratio<1?'var(--green)':'var(--amber)'}/>}
            {fundamentals.eps&&<Row label="EPS (₹)"         value={fc(fundamentals.eps)} color="var(--text)"/>}
            {fundamentals.dividend_yield&&<Row label="Div Yield" value={`${fundamentals.dividend_yield?.toFixed(2)}%`}
              color={fundamentals.dividend_yield>2?'var(--green)':'var(--text3)'}/>}
            {fundamentals.market_cap&&<Row label="Market Cap" value={`₹${(fundamentals.market_cap/1e7).toFixed(0)} Cr`}
              color="var(--text2)"/>}
            {fundamentals.week52High&&<Row label="52W High" value={fc(fundamentals.week52High)} color="var(--red)"/>}
            {fundamentals.week52Low &&<Row label="52W Low"  value={fc(fundamentals.week52Low)}  color="var(--green)"/>}
          </> : (
            <div style={{padding:'16px 0',textAlign:'center',color:'var(--text3)',fontSize:13}}>
              Loading fundamentals… <br/>
              <span style={{fontSize:11}}>Requires valid Upstox token or NSE API access</span>
            </div>
          )}
        </Section>
      )}
    </div>
  )
}
