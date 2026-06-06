import React, { useState, useEffect, useRef } from 'react'
import { searchSymbol } from '../services/marketData'

const QUICK = [
  {label:'NIFTY 50',sym:'NIFTY'},{label:'BANK NIFTY',sym:'BANKNIFTY'},
  {label:'RELIANCE',sym:'RELIANCE'},{label:'TCS',sym:'TCS'},
  {label:'HDFCBANK',sym:'HDFCBANK'},{label:'INFY',sym:'INFY'},
  {label:'ICICIBANK',sym:'ICICIBANK'},{label:'SBIN',sym:'SBIN'},
  {label:'WIPRO',sym:'WIPRO'},{label:'BAJFINANCE',sym:'BAJFINANCE'},
]

const TFS = [
  {l:'1m',v:'1'},{l:'3m',v:'3'},{l:'5m',v:'5'},
  {l:'15m',v:'15'},{l:'30m',v:'30'},{l:'1H',v:'60'},{l:'D',v:'D'},
]

export default function SearchBar({ onAnalyze, loading }) {
  const [sym, setSym]   = useState('NIFTY')
  const [tf, setTf]     = useState('5')
  const [sugg, setSugg] = useState([])
  const [show, setShow] = useState(false)
  const ref = useRef()

  useEffect(()=>{
    let c=false
    if (sym.trim().length<2) { setSugg([]); return }
    const t=setTimeout(async()=>{
      try { const r=await searchSymbol(sym); if(!c) setSugg(r.slice(0,8)) }
      catch { if(!c) setSugg([]) }
    },200)
    return ()=>{ c=true; clearTimeout(t) }
  },[sym])

  function go(input=sym, t=tf) {
    const raw=typeof input==='string'?input:(input?.tradingSymbol||input?.symbol||'')
    const clean=raw.trim().toUpperCase()
    if(!clean) return
    setSym(clean); setSugg([]); setShow(false)
    if(typeof input==='string') onAnalyze(clean,t)
    else onAnalyze({symbol:clean,instrumentKey:input?.instrumentKey||''},t)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',gap:8,alignItems:'stretch'}}>
        {/* Search input */}
        <div style={{flex:1,position:'relative'}}>
          <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#475569'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={ref}
            value={sym}
            onChange={e=>{setSym(e.target.value.toUpperCase());setShow(true)}}
            onKeyDown={e=>e.key==='Enter'&&go()}
            onFocus={()=>setShow(true)}
            onBlur={()=>setTimeout(()=>setShow(false),150)}
            placeholder="Search stock, index, F&O..."
            className="input"
            style={{paddingLeft:40,height:44,fontSize:14,fontFamily:'Inter'}}
          />
          {/* Suggestions */}
          {show && sugg.length>0 && (
            <div style={{
              position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:200,
              background:'#151c2c',border:'1px solid #2a3f5f',borderRadius:10,
              boxShadow:'0 8px 32px rgba(0,0,0,0.5)',overflow:'hidden',
            }}>
              {sugg.map(item=>(
                <div key={item.instrumentKey||item.symbol}
                  onMouseDown={()=>go(item)}
                  style={{
                    padding:'10px 14px',cursor:'pointer',
                    borderBottom:'1px solid #1f2d45',
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                    transition:'background .1s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='#1a2235'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div>
                    <div style={{fontFamily:'JetBrains Mono',fontWeight:700,fontSize:13,color:'#f1f5f9'}}>
                      {item.tradingSymbol||item.symbol}
                    </div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:1}}>{item.name}</div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'#1f2d45',color:'#94a3b8',fontFamily:'JetBrains Mono'}}>{item.exchange}</span>
                    {item.segment && <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'#6366f120',color:'#6366f1',fontFamily:'JetBrains Mono'}}>{item.segment}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeframe */}
        <div style={{display:'flex',gap:3,background:'#111827',borderRadius:8,padding:3,border:'1px solid #1f2d45'}}>
          {TFS.map(t=>(
            <button key={t.v} onClick={()=>setTf(t.v)} style={{
              padding:'4px 10px',borderRadius:6,cursor:'pointer',border:'none',
              fontFamily:'JetBrains Mono',fontSize:11,fontWeight:600,transition:'all .15s',
              background:tf===t.v?'#1e2a3d':'transparent',
              color:tf===t.v?'#f1f5f9':'#64748b',
              ...(tf===t.v?{border:'1px solid #2a3f5f'}:{}),
            }}>{t.l}</button>
          ))}
        </div>

        <button onClick={()=>go()} disabled={loading} className="btn btn-primary" style={{height:44,padding:'0 20px',fontSize:14,whiteSpace:'nowrap'}}>
          {loading
            ? <span style={{display:'flex',alignItems:'center',gap:8}}><div className="animate-spin" style={{width:16,height:16,border:'2px solid #ffffff40',borderTopColor:'#fff',borderRadius:'50%'}}/>Analyzing...</span>
            : '▶ Analyze'}
        </button>
      </div>

      {/* Quick chips */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {QUICK.map(q=>(
          <button key={q.sym} onClick={()=>{setSym(q.sym);go(q.sym,tf)}} style={{
            padding:'4px 12px',borderRadius:20,cursor:'pointer',
            border:`1px solid ${sym===q.sym?'#6366f1':'#1f2d45'}`,
            background:sym===q.sym?'#6366f115':'#111827',
            color:sym===q.sym?'#a5b4fc':'#64748b',
            fontSize:12,fontWeight:500,transition:'all .15s',
          }}
          onMouseEnter={e=>{if(sym!==q.sym){e.currentTarget.style.borderColor='#2a3f5f';e.currentTarget.style.color='#94a3b8'}}}
          onMouseLeave={e=>{if(sym!==q.sym){e.currentTarget.style.borderColor='#1f2d45';e.currentTarget.style.color='#64748b'}}}>
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}
