import React, { useState, useMemo } from 'react'

const f = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})

export default function RiskCalculator() {
  const [capital, setCapital] = useState(500000)
  const [riskPct, setRiskPct] = useState(1)
  const [entry,   setEntry]   = useState(0)
  const [sl,      setSl]      = useState(0)
  const [target,  setTarget]  = useState(0)

  const calc = useMemo(() => {
    const riskAmt   = (capital * riskPct) / 100
    const slDist    = entry > 0 && sl > 0 ? Math.abs(entry - sl) : 0
    const qty       = slDist > 0 ? Math.floor(riskAmt / slDist) : 0
    const investment= qty * entry
    const maxLoss   = qty * slDist
    const profitT   = target > 0 && qty > 0 ? qty * Math.abs(target - entry) : 0
    const rr        = maxLoss > 0 ? (profitT / maxLoss) : 0
    const breakeven = entry
    return { riskAmt, slDist, qty, investment, maxLoss, profitT, rr, breakeven }
  }, [capital, riskPct, entry, sl, target])

  const inpStyle = {
    width:'100%', background:'var(--bg2)', border:'1px solid var(--border)',
    borderRadius:6, color:'var(--text)', padding:'8px 12px',
    fontSize:14, outline:'none', fontFamily:"'DM Mono',monospace",
    transition:'border-color .15s',
  }

  return (
    <div className="card anim-fade">
      <div className="card-header">
        <span style={{fontSize:16}}>🎯</span>
        <span className="card-title">Risk Calculator</span>
        <span style={{marginLeft:'auto',fontSize:11,color:'var(--text3)'}}>Position Sizing Tool</span>
      </div>

      <div style={{padding:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        {/* Inputs */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            {label:'Capital (₹)', val:capital, set:setCapital, hint:'Total trading capital'},
            {label:'Risk per Trade (%)', val:riskPct, set:setRiskPct, hint:'Max % of capital to risk', step:'0.1'},
            {label:'Entry Price (₹)', val:entry||'', set:setEntry, hint:'Your planned entry price'},
            {label:'Stop Loss (₹)', val:sl||'', set:setSl, hint:'Stop loss level'},
            {label:'Target (₹)', val:target||'', set:setTarget, hint:'Profit target'},
          ].map(f2 => (
            <div key={f2.label}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:4,letterSpacing:.5}}>{f2.label}</div>
              <input type="number" value={f2.val} step={f2.step||'1'}
                onChange={e=>f2.set(Number(e.target.value))}
                style={inpStyle}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}
                placeholder={f2.hint}
              />
            </div>
          ))}
        </div>

        {/* Results */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',marginBottom:4,letterSpacing:.5,textTransform:'uppercase'}}>Position Analysis</div>

          {[
            {l:'Risk Amount',   v:`₹${f(calc.riskAmt)}`, c:calc.riskAmt>0?'var(--red)':'var(--text)'},
            {l:'SL Distance',   v:`₹${f(calc.slDist)}`,  c:'var(--text2)'},
            {l:'Quantity',      v:`${calc.qty} shares`,   c:'var(--accent2)', big:true},
            {l:'Investment',    v:`₹${f(calc.investment)}`, c:'var(--text)'},
            {l:'Max Loss',      v:`₹${f(calc.maxLoss)}`,  c:'var(--red)'},
            {l:'Profit @ T',    v:`₹${f(calc.profitT)}`,  c:'var(--green)'},
            {l:'Risk:Reward',   v:`1 : ${calc.rr.toFixed(2)}`, c:calc.rr>=2?'var(--green)':calc.rr>=1.5?'var(--amber)':'var(--red)', big:true},
          ].map(x=>(
            <div key={x.l} style={{
              display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'9px 12px', background:'var(--bg2)',
              border:'1px solid var(--border)', borderRadius:8,
            }}>
              <span style={{fontSize:12,color:'var(--text3)',fontWeight:500}}>{x.l}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontWeight:x.big?700:500,fontSize:x.big?16:13,color:x.c}}>{x.v}</span>
            </div>
          ))}

          {/* Position size bar */}
          {calc.investment > 0 && capital > 0 && (
            <div style={{marginTop:4}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:11,color:'var(--text3)'}}>Capital deployed</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text2)'}}>
                  {((calc.investment/capital)*100).toFixed(1)}%
                </span>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{
                  width:`${Math.min(100,(calc.investment/capital)*100)}%`,
                  background: (calc.investment/capital)>0.5 ? 'var(--red)' : (calc.investment/capital)>0.25 ? 'var(--amber)' : 'var(--green)',
                }}/>
              </div>
            </div>
          )}

          {/* Advice */}
          <div style={{marginTop:4,padding:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,fontSize:12,lineHeight:1.6,color:'var(--text3)'}}>
            {calc.rr >= 2
              ? <span style={{color:'var(--green)'}}>✓ <strong>Good setup!</strong> R:R {calc.rr.toFixed(2)} is excellent. Max loss ₹{f(calc.maxLoss)} is within {riskPct}% risk rule.</span>
              : calc.rr >= 1.5
              ? <span style={{color:'var(--amber)'}}>⚡ Acceptable R:R {calc.rr.toFixed(2)}. Consider widening target or tightening SL.</span>
              : calc.qty > 0
              ? <span style={{color:'var(--red)'}}>⚠ R:R {calc.rr.toFixed(2)} is low. Minimum recommended is 1.5:1. Adjust target or SL.</span>
              : <span style={{color:'var(--text3)'}}>Enter entry, SL and target to calculate position size.</span>
            }
          </div>
        </div>
      </div>

      {/* Kelly Criterion bonus */}
      {calc.rr > 0 && (
        <div style={{borderTop:'1px solid var(--border)',padding:'12px 16px',background:'var(--bg)'}}>
          <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,letterSpacing:.5,marginBottom:6,textTransform:'uppercase'}}>Kelly Criterion Suggestion</div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
            Assuming 55% win rate: Kelly% = <strong style={{color:'var(--accent2)'}}>{Math.max(0, ((0.55*(calc.rr+1)-1)/calc.rr*100)).toFixed(1)}%</strong> of capital.
            <span style={{color:'var(--text3)',marginLeft:8}}>Use half-Kelly for conservative sizing.</span>
          </div>
        </div>
      )}
    </div>
  )
}
