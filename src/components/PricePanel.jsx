import React from 'react'

const f = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})

function Ring({ pct, color }) {
  const r=30, circ=2*Math.PI*r, dash=(pct/100)*circ
  return (
    <svg width={72} height={72} style={{transform:'rotate(-90deg)'}}>
      <circle cx={36} cy={36} r={r} fill="none" stroke="#1f2d45" strokeWidth={5}/>
      <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:'stroke-dasharray .6s ease',filter:`drop-shadow(0 0 4px ${color}66)`}}/>
      <text x={36} y={36} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={13} fontFamily="JetBrains Mono" fontWeight={700}
        style={{transform:'rotate(90deg)',transformOrigin:'36px 36px'}}>{pct}%</text>
    </svg>
  )
}

export default function PricePanel({ data, ai, loading }) {
  if (loading) return (
    <div className="card" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:300,gap:12,flexDirection:'column'}}>
      <div className="animate-spin" style={{width:28,height:28,border:'3px solid #1f2d45',borderTopColor:'#6366f1',borderRadius:'50%'}}/>
      <div style={{color:'#64748b',fontSize:12,fontFamily:'JetBrains Mono'}}>Analyzing...</div>
    </div>
  )
  if (!data) return (
    <div className="card" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:300,gap:12,flexDirection:'column'}}>
      <div style={{fontSize:40,opacity:0.15}}>📡</div>
      <div style={{color:'#475569',fontSize:13}}>Search a symbol to begin</div>
    </div>
  )

  const v = ai?.verdict||'HOLD'
  const vclr = v==='BUY'?'#10b981':v==='SELL'?'#ef4444':'#f59e0b'
  const bull = data.change>=0
  const pclr = bull ? '#10b981' : '#ef4444'
  const conf = Math.min(100,Math.max(0,ai?.confidence??50))
  const stBull = data.supertrend?.direction==='up'

  return (
    <div className="card animate-fade" style={{display:'flex',flexDirection:'column'}}>
      {/* Live badge */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:'#0e1420',borderBottom:'1px solid #1f2d45'}}>
        <span style={{fontFamily:'JetBrains Mono',fontSize:10,color:data.quality?.source==='UPSTOX_LIVE'?'#10b981':'#f59e0b',fontWeight:600}}>
          {data.quality?.source==='UPSTOX_LIVE'?'● LIVE':'● DATA'}
        </span>
        <span style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#475569'}}>
          {data.candles?.length} candles
        </span>
      </div>

      {/* Symbol + Price */}
      <div style={{padding:'16px 16px 12px',borderBottom:'1px solid #1f2d45',textAlign:'center'}}>
        <div style={{fontSize:12,fontWeight:600,color:'#64748b',letterSpacing:1,marginBottom:4}}>{data.symbol}</div>
        <div style={{fontFamily:'JetBrains Mono',fontSize:32,fontWeight:800,color:pclr,lineHeight:1}}>
          ₹{f(data.price)}
        </div>
        <div style={{marginTop:6,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span className={`stat-pill ${bull?'up':'down'}`}>
            {bull?'▲':'▼'} {Math.abs(data.change||0).toFixed(2)} ({Math.abs(data.changePct||0).toFixed(2)}%)
          </span>
        </div>
        <div style={{marginTop:8,fontFamily:'JetBrains Mono',fontSize:11,color:'#475569',display:'flex',gap:12,justifyContent:'center'}}>
          <span>O: <span style={{color:'#94a3b8'}}>₹{f(data.open)}</span></span>
          <span style={{color:'#10b981'}}>H: ₹{f(data.high)}</span>
          <span style={{color:'#ef4444'}}>L: ₹{f(data.low)}</span>
        </div>
      </div>

      {/* AI Verdict */}
      {ai && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #1f2d45',background:`${vclr}08`}}>
          <div>
            <div style={{fontFamily:'JetBrains Mono',fontSize:24,fontWeight:800,color:vclr,letterSpacing:3,textShadow:`0 0 20px ${vclr}44`}}>{v}</div>
            <div style={{fontSize:12,color:'#64748b',marginTop:3}}>R:R {ai.riskReward?.toFixed(1)||'N/A'}:1</div>
            <div style={{marginTop:4}}>
              <div className="progress" style={{width:120}}>
                <div className="progress-fill" style={{width:`${conf}%`,background:`linear-gradient(90deg,${vclr}88,${vclr})`}}/>
              </div>
              <div style={{fontSize:10,color:'#475569',fontFamily:'JetBrains Mono',marginTop:2}}>{conf}% confidence</div>
            </div>
          </div>
          <Ring pct={conf} color={vclr}/>
        </div>
      )}

      {/* Key metrics */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:1,background:'#1f2d45',borderBottom:'1px solid #1f2d45'}}>
        {[
          {n:'VWAP',  v:`₹${f(data.vwap)}`, c:data.price>data.vwap?'#10b981':'#ef4444'},
          {n:'EMA 20',v:`₹${f(data.ema20)}`,c:data.price>data.ema20?'#10b981':'#ef4444'},
          {n:'RSI(14)',v:(data.rsi||50).toFixed(1),c:data.rsi>70?'#ef4444':data.rsi<30?'#10b981':'#f59e0b'},
          {n:'ATR',   v:f(data.atr||0),c:'#94a3b8'},
          {n:'VOL',   v:`${(data.volumeRatio||1).toFixed(2)}x`,c:data.volumeRatio>1.2?'#10b981':'#64748b'},
          {n:'PCR',   v:(data.pcr||0).toFixed(2),c:data.pcr>1.2?'#10b981':data.pcr<0.8?'#ef4444':'#f59e0b'},
        ].map(m=>(
          <div key={m.n} style={{background:'#0e1420',padding:'10px 12px'}}>
            <div style={{fontSize:10,color:'#475569',fontWeight:600,letterSpacing:0.8,textTransform:'uppercase',marginBottom:3}}>{m.n}</div>
            <div style={{fontFamily:'JetBrains Mono',fontWeight:700,color:m.c,fontSize:13}}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Supertrend + EMA50 + ADX */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'#1f2d45',borderBottom:'1px solid #1f2d45'}}>
        {[
          {n:'EMA 50',v:`₹${f(data.ema50||0)}`,c:data.price>data.ema50?'#10b981':'#ef4444'},
          {n:'SUPERTREND',v:stBull?'▲ BULL':'▼ BEAR',c:stBull?'#10b981':'#ef4444'},
          {n:'ADX',v:(data.adx?.adx||0).toFixed(0),c:(data.adx?.adx||0)>25?'#10b981':'#64748b'},
        ].map(m=>(
          <div key={m.n} style={{background:'#0e1420',padding:'9px 10px'}}>
            <div style={{fontSize:9,color:'#475569',fontWeight:600,letterSpacing:0.8,textTransform:'uppercase',marginBottom:3}}>{m.n}</div>
            <div style={{fontFamily:'JetBrains Mono',fontWeight:700,color:m.c,fontSize:12}}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Trade levels */}
      {ai && (
        <div style={{padding:'12px 16px',borderBottom:'1px solid #1f2d45',display:'flex',flexDirection:'column',gap:8}}>
          {[
            {n:'Entry',     v:`₹${f(ai.entry||0)}`,   c:'#6366f1'},
            {n:'Target',    v:`₹${f(ai.target||0)}`,  c:'#10b981'},
            {n:'Stop Loss', v:`₹${f(ai.stopLoss||0)}`,c:'#ef4444'},
            {n:'Support',   v:`₹${f(data.support)}`,  c:'#10b981'},
            {n:'Resistance',v:`₹${f(data.resistance)}`,c:'#f97316'},
          ].map(l=>(
            <div key={l.n} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid #1f2d4544'}}>
              <span style={{fontSize:12,color:'#64748b',fontWeight:500}}>{l.n}</span>
              <span style={{fontFamily:'JetBrains Mono',fontWeight:700,fontSize:13,color:l.c}}>{l.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* MTF trend */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:0}}>
        {[{n:'M1',v:data.m1Trend},{n:'M5',v:data.m5Trend},{n:'M15',v:data.m15Trend}].map(t=>{
          const c=t.v==='BULLISH'?'#10b981':t.v==='BEARISH'?'#ef4444':'#f59e0b'
          return (
            <div key={t.n} style={{padding:'8px',textAlign:'center',borderRight:'1px solid #1f2d45',background:'#0b0f19'}}>
              <div style={{fontSize:10,color:'#475569',fontWeight:600,marginBottom:2}}>{t.n}</div>
              <div style={{fontFamily:'JetBrains Mono',fontSize:10,fontWeight:700,color:c}}>{t.v||'–'}</div>
            </div>
          )
        })}
      </div>

      {/* Regime */}
      <div style={{padding:'8px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#0e1420'}}>
        <span style={{fontSize:11,color:'#475569',fontWeight:500}}>Market Regime</span>
        <span style={{
          fontFamily:'JetBrains Mono',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,
          color:data.regime?.includes('UP')?'#10b981':data.regime?.includes('DOWN')?'#ef4444':'#f59e0b',
          background:data.regime?.includes('UP')?'#10b98115':data.regime?.includes('DOWN')?'#ef444415':'#f59e0b15',
          border:`1px solid ${data.regime?.includes('UP')?'#10b98133':data.regime?.includes('DOWN')?'#ef444433':'#f59e0b33'}`,
        }}>{(data.regime||'RANGE').replace(/_/g,' ')}</span>
      </div>
    </div>
  )
}
