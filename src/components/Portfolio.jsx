import React, { useState } from 'react'

const f = (n,d=2) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})
const DEMO = [
  {symbol:'RELIANCE', qty:10, avgPrice:2780, ltp:2890},
  {symbol:'TCS',      qty:5,  avgPrice:3600, ltp:3754},
  {symbol:'HDFCBANK', qty:20, avgPrice:1550, ltp:1612},
  {symbol:'INFY',     qty:15, avgPrice:1480, ltp:1548},
  {symbol:'ICICIBANK',qty:25, avgPrice:1210, ltp:1289},
]

export default function Portfolio({ onSelectSymbol }) {
  const [holdings, setHoldings] = useState(DEMO)
  const [form, setForm] = useState({sym:'',qty:'',avg:''})
  const [showForm, setShowForm] = useState(false)

  const rows = holdings.map(h => {
    const mv=h.ltp*h.qty, iv=h.avgPrice*h.qty, pnl=mv-iv, pct=(pnl/iv)*100
    return {...h, mv, iv, pnl, pct}
  })
  const totMV  = rows.reduce((s,r)=>s+r.mv,0)
  const totIV  = rows.reduce((s,r)=>s+r.iv,0)
  const totPnL = totMV-totIV
  const totPct = totIV>0 ? (totPnL/totIV)*100 : 0
  const pclr   = totPnL>=0 ? 'var(--green)' : 'var(--red)'

  function add() {
    if (!form.sym||!form.qty||!form.avg) return
    setHoldings(p=>[...p,{symbol:form.sym.toUpperCase(),qty:+form.qty,avgPrice:+form.avg,ltp:+form.avg*1.02}])
    setForm({sym:'',qty:'',avg:''}); setShowForm(false)
  }
  function remove(sym) { setHoldings(p=>p.filter(h=>h.symbol!==sym)) }

  return (
    <div className="card anim-fade">
      <div className="card-header">
        <span style={{fontSize:16}}>💼</span>
        <span className="card-title">Portfolio</span>
        <button onClick={()=>setShowForm(s=>!s)} className="btn btn-ghost"
          style={{marginLeft:'auto',fontSize:12,padding:'4px 12px'}}>
          {showForm ? '✕ Cancel' : '+ Add Holding'}
        </button>
      </div>

      {/* Summary strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:'var(--border)'}}>
        {[
          {l:'Portfolio Value',v:`₹${f(totMV,0)}`,c:'var(--text)'},
          {l:'Invested',v:`₹${f(totIV,0)}`,c:'var(--text2)'},
          {l:'Total P&L',v:`${totPnL>=0?'+':''}₹${f(Math.abs(totPnL),0)}`,c:pclr},
          {l:'Returns',v:`${totPct>=0?'+':''}${totPct.toFixed(2)}%`,c:pclr},
        ].map(s=>(
          <div key={s.l} style={{background:'var(--surface)',padding:'12px 14px',textAlign:'center'}}>
            <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,letterSpacing:.8,textTransform:'uppercase',marginBottom:4}}>{s.l}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontWeight:500,fontSize:15,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{padding:16,borderBottom:'1px solid var(--border)',display:'flex',gap:8,flexWrap:'wrap'}}>
          {[{p:'Symbol',k:'sym'},{p:'Qty',k:'qty'},{p:'Avg Price',k:'avg'}].map(f2=>(
            <input key={f2.k} placeholder={f2.p} value={form[f2.k]}
              onChange={e=>setForm(x=>({...x,[f2.k]:e.target.value}))}
              className="input" style={{flex:1,minWidth:100,height:38,fontSize:13}}/>
          ))}
          <button onClick={add} className="btn btn-primary" style={{height:38,padding:'0 16px',fontSize:13}}>Add</button>
        </div>
      )}

      {/* Holdings table */}
      <div style={{overflowX:'auto'}}>
        <table className="data-table" style={{minWidth:640}}>
          <thead>
            <tr>
              {['Symbol','Qty','Avg Price','LTP','Curr Value','P&L','Return %',''].map(h=>(
                <th key={h} style={{textAlign:h===''?'center':'left'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const clr = r.pnl>=0?'var(--green)':'var(--red)'
              return (
                <tr key={r.symbol}>
                  <td style={{cursor:'pointer'}} onClick={()=>onSelectSymbol?.(r.symbol)}>
                    <span style={{color:'var(--accent2)',fontWeight:600}}>{r.symbol}</span>
                  </td>
                  <td>{r.qty}</td>
                  <td>₹{f(r.avgPrice)}</td>
                  <td style={{color:'var(--text)',fontWeight:600}}>₹{f(r.ltp)}</td>
                  <td>₹{f(r.mv,0)}</td>
                  <td style={{color:clr}}>{r.pnl>=0?'+':''}₹{f(Math.abs(r.pnl),0)}</td>
                  <td style={{color:clr}}>{r.pct>=0?'+':''}{r.pct.toFixed(2)}%</td>
                  <td style={{textAlign:'center'}}>
                    <button onClick={()=>remove(r.symbol)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14}}
                      onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                      onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{padding:'10px 16px',borderTop:'1px solid var(--border)',fontSize:11,color:'var(--text3)'}}>
        Prices are illustrative. Connect Upstox for live portfolio data.
      </div>
    </div>
  )
}
