import React from 'react'

const f = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})

export default function AIInsights({ ai, data, loading }) {
  if (loading) return (
    <div className="card" style={{display:'flex',alignItems:'center',gap:12,padding:24}}>
      <div className="anim-spin" style={{width:20,height:20,border:'2px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',flexShrink:0}}/>
      <span style={{color:'var(--text3)',fontSize:13}}>Running AI analysis…</span>
    </div>
  )
  if (!ai) return (
    <div className="card" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,gap:10}}>
      <div style={{fontSize:36,opacity:.12}}>🤖</div>
      <div style={{color:'var(--text3)',fontSize:13}}>AI insights appear after analysis</div>
    </div>
  )

  const v = ai.verdict||'HOLD'
  const vclr = v==='BUY'?'var(--green)':v==='SELL'?'var(--red)':'var(--amber)'
  const conf = Math.min(100,Math.max(0,ai.confidence??50))

  return (
    <div className="card anim-fade">
      <div className="card-header">
        <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#5865f2,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🤖</div>
        <div>
          <div className="card-title">AI Analysis</div>
          <div style={{fontSize:10,color:'var(--text3)'}}>Groq · llama-3.3-70b</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <span className={`verdict verdict-${v}`}>{v}</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:vclr}}>{conf}%</span>
        </div>
      </div>

      <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
        {/* Confidence bar */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
            <span style={{fontSize:11,color:'var(--text3)',fontWeight:600}}>CONFIDENCE</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:vclr,fontWeight:700}}>{conf}%</span>
          </div>
          <div className="progress">
            <div className="progress-fill" style={{width:`${conf}%`,background:`linear-gradient(90deg,${vclr}88,${vclr})`}}/>
          </div>
        </div>

        {/* Summary */}
        {ai.summary && (
          <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,padding:12,background:'var(--bg2)',borderRadius:8,border:'1px solid var(--border)'}}>
            {ai.summary}
          </div>
        )}

        {/* Trade levels */}
        {ai.entry > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[
              {n:'Entry',  v:`₹${f(ai.entry)}`,   c:'var(--accent2)', bg:'#5865f210'},
              {n:'Target', v:`₹${f(ai.target)}`,  c:'var(--green)',   bg:'#22c55e10'},
              {n:'SL',     v:`₹${f(ai.stopLoss)}`,c:'var(--red)',     bg:'#f43f5e10'},
            ].map(x=>(
              <div key={x.n} style={{padding:'10px',background:x.bg,border:`1px solid ${x.c}33`,borderRadius:8,textAlign:'center'}}>
                <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,marginBottom:3,letterSpacing:.5}}>{x.n}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:500,fontSize:14,color:x.c}}>{x.v}</div>
              </div>
            ))}
          </div>
        )}

        {/* R:R */}
        {ai.riskReward > 0 && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'var(--bg3)',borderRadius:8,border:'1px solid var(--border)'}}>
            <span style={{fontSize:12,color:'var(--text3)',fontWeight:600}}>Risk : Reward</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700,color:ai.riskReward>=2?'var(--green)':ai.riskReward>=1.5?'var(--amber)':'var(--red)'}}>
              1 : {ai.riskReward.toFixed(1)}
            </span>
          </div>
        )}

        {/* Reasons */}
        {ai.reasons?.length > 0 && (
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:8}}>Why {v}</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {ai.reasons.slice(0,4).map((r,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,color:'var(--text2)'}}>
                  <span style={{color:'var(--green)',fontWeight:700,flexShrink:0,marginTop:1}}>✓</span>{r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {ai.risks?.length > 0 && (
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:8}}>Key Risks</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {ai.risks.slice(0,3).map((r,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,color:'var(--text2)'}}>
                  <span style={{color:'var(--red)',fontWeight:700,flexShrink:0,marginTop:1}}>⚠</span>{r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TF alignment */}
        {ai.timeframeAlignment && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
            {Object.entries(ai.timeframeAlignment).map(([k,val])=>{
              const c=val==='BULLISH'?'var(--green)':val==='BEARISH'?'var(--red)':'var(--amber)'
              return (
                <div key={k} style={{padding:'8px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,textAlign:'center'}}>
                  <div style={{fontSize:9,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>{k.replace(/([A-Z])/g,' $1').trim()}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:c}}>{val||'–'}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
