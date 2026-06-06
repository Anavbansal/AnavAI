import React from 'react'

const f = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})

export default function AIInsights({ ai, data, loading }) {
  if (loading) return (
    <div className="card" style={{padding:24,display:'flex',alignItems:'center',gap:12}}>
      <div className="animate-spin" style={{width:20,height:20,border:'2px solid #1f2d45',borderTopColor:'#6366f1',borderRadius:'50%',flexShrink:0}}/>
      <span style={{color:'#64748b',fontSize:13}}>Running AI analysis...</span>
    </div>
  )
  if (!ai) return (
    <div className="card" style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40,flexDirection:'column',gap:10}}>
      <div style={{fontSize:36,opacity:0.15}}>🤖</div>
      <div style={{color:'#475569',fontSize:13}}>AI insights will appear after analysis</div>
    </div>
  )

  const v = ai.verdict||'HOLD'
  const vclr = v==='BUY'?'#10b981':v==='SELL'?'#ef4444':'#f59e0b'

  return (
    <div className="card animate-fade">
      <div className="card-header">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#6366f1,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🤖</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:'#f1f5f9'}}>AI Analysis</div>
            <div style={{fontSize:11,color:'#64748b'}}>Powered by Groq · llama-3.3-70b</div>
          </div>
        </div>
        <span className={`tag ${v.toLowerCase()}`} style={{marginLeft:'auto'}}>{v}</span>
      </div>

      <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
        {/* Summary */}
        {ai.summary && (
          <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.7,padding:'12px',background:'#0e1420',borderRadius:8,border:'1px solid #1f2d45'}}>
            {ai.summary}
          </div>
        )}

        {/* Entry/Target/SL */}
        {ai.entry > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[
              {n:'Entry',  v:`₹${f(ai.entry)}`,   c:'#6366f1', bg:'#6366f110'},
              {n:'Target', v:`₹${f(ai.target)}`,  c:'#10b981', bg:'#10b98110'},
              {n:'Stop L', v:`₹${f(ai.stopLoss)}`,c:'#ef4444', bg:'#ef444410'},
            ].map(x=>(
              <div key={x.n} style={{padding:'10px',background:x.bg,border:`1px solid ${x.c}33`,borderRadius:8,textAlign:'center'}}>
                <div style={{fontSize:10,color:'#64748b',fontWeight:600,marginBottom:4}}>{x.n}</div>
                <div style={{fontFamily:'JetBrains Mono',fontWeight:700,fontSize:14,color:x.c}}>{x.v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reasons */}
        {ai.reasons?.length > 0 && (
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8}}>Why {v}</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {ai.reasons.map((r,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,color:'#94a3b8'}}>
                  <span style={{color:'#10b981',fontWeight:700,flexShrink:0}}>✓</span>{r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {ai.risks?.length > 0 && (
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8}}>Key Risks</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {ai.risks.map((r,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,color:'#94a3b8'}}>
                  <span style={{color:'#ef4444',fontWeight:700,flexShrink:0}}>⚠</span>{r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeframe alignment */}
        {ai.timeframeAlignment && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
            {Object.entries(ai.timeframeAlignment).map(([k,v])=>{
              const c=v==='BULLISH'?'#10b981':v==='BEARISH'?'#ef4444':'#f59e0b'
              return (
                <div key={k} style={{padding:'8px',background:'#0e1420',border:'1px solid #1f2d45',borderRadius:6,textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:0.8,marginBottom:3}}>{k.replace(/([A-Z])/g,' $1').trim()}</div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:10,fontWeight:700,color:c}}>{v||'–'}</div>
                </div>
              )
            })}
          </div>
        )}

        {ai.newsImpact && (
          <div style={{padding:'10px 12px',background:'#111827',borderRadius:6,border:'1px solid #1f2d45',fontSize:11,color:'#64748b',lineHeight:1.6}}>
            <span style={{color:'#475569',fontWeight:700}}>OI / Volume: </span>{ai.newsImpact}
          </div>
        )}
      </div>
    </div>
  )
}
