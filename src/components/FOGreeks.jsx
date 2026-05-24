import React, { useMemo, useState } from 'react'
import { fmt } from '../utils/indicators'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const C = {
  bull:'#00e87a', bear:'#ff2d55', accent:'#00cfff', vwap:'#ffd700',
  border:'#162030', bg:'#050d17', panel:'#091522',
  text:'#7aa8c8', dim:'#2a4a6a', white:'#cce0f5',
  ceClr:'#00cfff', peClr:'#ff6090',
}

function IV_Badge({ iv }) {
  const c = iv>30?'#ff8800':iv>20?'#ffd700':'#7aa8c8'
  return <span style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:c, fontSize:11}}>{iv}%</span>
}

function OIBar({ ceOI, peOI }) {
  const total = ceOI + peOI
  if (!total) return null
  const cePct = (ceOI/total*100).toFixed(1)
  const pePct = (peOI/total*100).toFixed(1)
  return (
    <div style={{display:'flex', gap:4, alignItems:'center', marginTop:4}}>
      <span style={{fontFamily:'Share Tech Mono', color:C.ceClr, fontSize:9}}>{cePct}%</span>
      <div style={{flex:1, height:4, background:C.border, borderRadius:2, display:'flex', overflow:'hidden'}}>
        <div style={{width:`${cePct}%`, background:C.ceClr, opacity:0.7}}/>
        <div style={{flex:1, background:C.peClr, opacity:0.7}}/>
      </div>
      <span style={{fontFamily:'Share Tech Mono', color:C.peClr, fontSize:9}}>{pePct}%</span>
    </div>
  )
}

export default function FOGreeks({ data }) {
  const [showAll, setShowAll] = useState(false)
  const [view, setView] = useState('chain') // 'chain' | 'oi' | 'iv'

  const { rows, atm, oiChartData, ivChartData, totalCEOI, totalPEOI, maxPain } = useMemo(()=>{
    if (!data?.optionChain) return { rows:[], atm:0, oiChartData:[], ivChartData:[], totalCEOI:0, totalPEOI:0, maxPain:0 }
    const map = new Map()
    for (const g of data.optionChain) {
      const row = map.get(g.strikePrice) ?? { strike:g.strikePrice, ce:null, pe:null }
      if (g.optionType==='CE') row.ce=g; else row.pe=g
      map.set(g.strikePrice, row)
    }
    const allRows = Array.from(map.values()).sort((a,b)=>a.strike-b.strike)
    const spot = data.price
    const atmStrike = allRows.reduce((best,r)=>Math.abs(r.strike-spot)<Math.abs(best.strike-spot)?r:best, allRows[0] || {strike:0})
    const atm = atmStrike.strike

    const oiChart = allRows.map(r=>({
      strike: r.strike,
      CE_OI: r.ce ? +(r.ce.oi/1e5).toFixed(2) : 0,
      PE_OI: r.pe ? +(r.pe.oi/1e5).toFixed(2) : 0,
    }))
    const ivChart = allRows.map(r=>({
      strike: r.strike,
      CE_IV: r.ce?.iv||0,
      PE_IV: r.pe?.iv||0,
    }))

    let totCE=0, totPE=0
    allRows.forEach(r=>{ totCE+=(r.ce?.oi||0); totPE+=(r.pe?.oi||0) })

    // Max Pain: strike where total OI expiry loss is minimum
    let mpStrike=atm, mpLoss=Infinity
    allRows.forEach(row=>{
      const s = row.strike
      let loss = 0
      allRows.forEach(r=>{ loss += (r.ce?.oi||0)*Math.max(s-r.strike,0) + (r.pe?.oi||0)*Math.max(r.strike-s,0) })
      if (loss < mpLoss) { mpLoss=loss; mpStrike=s }
    })

    return { rows:allRows, atm, oiChartData:oiChart, ivChartData:ivChart, totalCEOI:totCE, totalPEOI:totPE, maxPain:mpStrike }
  },[data])

  if (!data) return (
    <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8,
      display:'flex', alignItems:'center', justifyContent:'center', height:320, flexDirection:'column', gap:12}}>
      <div style={{fontSize:44, opacity:0.15}}>⚙</div>
      <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:11, letterSpacing:4}}>F&O · RUN ANALYSIS</div>
    </div>
  )

  const pcr = totalCEOI>0 ? (totalPEOI/totalCEOI) : data.pcr || 1
  const pcrClr = pcr>1.2?C.bull:pcr<0.8?C.bear:'#ffd700'
  const displayRows = showAll ? rows : rows.filter(r=>Math.abs(r.strike-atm)<=200)

  const colH = {fontFamily:'Share Tech Mono', color:C.dim, fontSize:9, letterSpacing:1, textAlign:'center', padding:'7px 4px', background:C.panel}
  const cell = (color, itm) => ({fontFamily:'Share Tech Mono', fontSize:11, textAlign:'center', padding:'6px 4px', color, background: itm?`${color}08`:'transparent'})

  return (
    <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'9px 14px', borderBottom:`1px solid ${C.border}`, background:C.panel, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
        <span style={{fontFamily:'Share Tech Mono', color:C.accent, fontSize:11, fontWeight:'bold', letterSpacing:2}}>⚙ F&O OPTION CHAIN</span>
        <div style={{display:'flex', gap:12, marginLeft:8, alignItems:'center'}}>
          <span style={{fontFamily:'Share Tech Mono', color:C.text, fontSize:10}}>SPOT ₹{fmt(data.price)} · ATM {atm}</span>
          <span style={{fontFamily:'Share Tech Mono', fontSize:10, color:pcrClr}}>PCR {pcr.toFixed(2)} — {pcr>1.2?'BULLISH OI':pcr<0.8?'BEARISH OI':'NEUTRAL'}</span>
          <span style={{fontFamily:'Share Tech Mono', color:'#ffd700', fontSize:10}}>MAX PAIN {maxPain}</span>
        </div>
        <div style={{marginLeft:'auto', display:'flex', gap:4}}>
          {['chain','oi','iv'].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{fontFamily:'Share Tech Mono', fontSize:9, padding:'2px 8px', borderRadius:3, cursor:'pointer',
              background:view===v?`${C.accent}22`:'transparent', border:`1px solid ${view===v?C.accent:C.border}`, color:view===v?C.accent:C.dim}}>{v.toUpperCase()}</button>
          ))}
          <button onClick={()=>setShowAll(v=>!v)} style={{fontFamily:'Share Tech Mono', fontSize:9, padding:'2px 8px', borderRadius:3, cursor:'pointer',
            background:'transparent', border:`1px solid ${C.border}`, color:C.dim}}>{showAll?'±200':'ALL'}</button>
        </div>
      </div>

      {/* Totals row */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:1, background:C.border, borderBottom:`1px solid ${C.border}`}}>
        {[
          {label:'TOTAL CE OI',   val: totalCEOI>1e5?(totalCEOI/1e5).toFixed(2)+'L':(totalCEOI/1e3).toFixed(0)+'K', color:C.ceClr},
          {label:'TOTAL PE OI',   val: totalPEOI>1e5?(totalPEOI/1e5).toFixed(2)+'L':(totalPEOI/1e3).toFixed(0)+'K', color:C.peClr},
          {label:'PCR',           val: pcr.toFixed(3), color:pcrClr},
          {label:'MAX PAIN',      val: `₹${maxPain}`, color:'#ffd700'},
          {label:'IV SKEW',       val: rows.length>0&&rows[0]?.ce&&rows[rows.length-1]?.ce ? `${(rows[rows.length-1].ce.iv - rows[0].ce.iv).toFixed(1)}%` : 'N/A', color:C.text},
        ].map(x=>(
          <div key={x.label} style={{background:C.bg, padding:'7px 10px', textAlign:'center'}}>
            <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:8, letterSpacing:1}}>{x.label}</div>
            <div style={{fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:x.color, fontSize:15, marginTop:2}}>{x.val}</div>
          </div>
        ))}
      </div>

      {/* OBV Chart or IV Chart */}
      {view==='oi' && (
        <div style={{height:160, padding:'8px 8px 0', borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9, letterSpacing:2, padding:'0 6px 6px'}}>OI BY STRIKE (Lakhs)</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={oiChartData} margin={{top:0,right:4,bottom:0,left:0}} barCategoryGap="15%">
              <XAxis dataKey="strike" tick={{fill:C.dim,fontSize:8,fontFamily:'Share Tech Mono'}} tickLine={false} axisLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,fontFamily:'Share Tech Mono',fontSize:10}} formatter={(v,n)=>[v+'L',n]}/>
              <Bar dataKey="CE_OI" fill={C.ceClr} opacity={0.7} radius={[2,2,0,0]}>
                {oiChartData.map((e,i)=><Cell key={i} fill={e.strike===atm?C.accent:C.ceClr}/>)}
              </Bar>
              <Bar dataKey="PE_OI" fill={C.peClr} opacity={0.7} radius={[2,2,0,0]}>
                {oiChartData.map((e,i)=><Cell key={i} fill={e.strike===atm?'#ffaa00':C.peClr}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {view==='iv' && (
        <div style={{height:160, padding:'8px 8px 0', borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9, letterSpacing:2, padding:'0 6px 6px'}}>IMPLIED VOLATILITY SKEW (%)</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ivChartData} margin={{top:0,right:4,bottom:0,left:0}} barCategoryGap="15%">
              <XAxis dataKey="strike" tick={{fill:C.dim,fontSize:8,fontFamily:'Share Tech Mono'}} tickLine={false} axisLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{background:C.bg,border:`1px solid ${C.border}`,fontFamily:'Share Tech Mono',fontSize:10}} formatter={(v,n)=>[v+'%',n]}/>
              <Bar dataKey="CE_IV" fill={C.ceClr} opacity={0.65} radius={[2,2,0,0]}/>
              <Bar dataKey="PE_IV" fill={C.peClr} opacity={0.65} radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Option chain table */}
      {view==='chain' && (
        <div style={{overflowX:'auto', overflowY:'auto', maxHeight:420}}>
          <table style={{width:'100%', borderCollapse:'collapse', minWidth:750}}>
            <thead style={{position:'sticky', top:0, zIndex:2}}>
              <tr>
                <th style={{...colH, color:C.ceClr, width:72}}>CE LTP</th>
                <th style={{...colH}}>CE Δ</th>
                <th style={{...colH}}>CE θ</th>
                <th style={{...colH}}>CE OI</th>
                <th style={{...colH}}>CE IV</th>
                <th style={{...colH, color:C.white, width:96, background:'#0d1e2e'}}>STRIKE</th>
                <th style={{...colH}}>PE IV</th>
                <th style={{...colH}}>PE OI</th>
                <th style={{...colH}}>PE θ</th>
                <th style={{...colH}}>PE Δ</th>
                <th style={{...colH, color:C.peClr, width:72}}>PE LTP</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(row=>{
                const isATM = row.strike===atm
                const isMaxPain = row.strike===maxPain
                const ceITM = row.strike < data.price
                const peITM = row.strike > data.price
                const rowBg = isATM?'rgba(0,207,255,0.07)':isMaxPain?'rgba(255,215,0,0.05)':'transparent'
                return (
                  <tr key={row.strike} style={{borderBottom:`1px solid ${C.border}33`, background:rowBg}}>
                    {/* CE side */}
                    <td style={{...cell(C.ceClr,ceITM), fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13}}>
                      {row.ce?`₹${fmt(row.ce.ltp)}`:'—'}
                    </td>
                    <td style={cell(C.text,ceITM)}>{row.ce?row.ce.delta.toFixed(3):'—'}</td>
                    <td style={cell('#ff8800',ceITM)}>{row.ce?row.ce.theta?.toFixed(3):'—'}</td>
                    <td style={cell('#6a9ab8',ceITM)}>{row.ce?`${(row.ce.oi/1e3).toFixed(0)}K`:'—'}</td>
                    <td style={cell(row.ce?.iv>30?'#ff8800':C.text,ceITM)}><IV_Badge iv={row.ce?.iv||0}/></td>
                    {/* Strike */}
                    <td style={{
                      textAlign:'center', fontFamily:'Rajdhani,sans-serif', fontWeight:900, fontSize:14,
                      color:isATM?C.accent:isMaxPain?'#ffd700':C.white,
                      background: isATM?'rgba(0,207,255,0.1)':isMaxPain?'rgba(255,215,0,0.08)':'rgba(0,0,0,0.2)',
                      border: isATM?`1px solid ${C.accent}55`:isMaxPain?'1px solid #ffd70055':'none',
                      padding:'6px 2px',
                    }}>
                      {row.strike}
                      {isATM&&<div style={{fontFamily:'Share Tech Mono',color:C.accent,fontSize:8,letterSpacing:1}}>ATM</div>}
                      {isMaxPain&&!isATM&&<div style={{fontFamily:'Share Tech Mono',color:'#ffd700',fontSize:8,letterSpacing:1}}>MAX PAIN</div>}
                    </td>
                    {/* PE side */}
                    <td style={cell(row.pe?.iv>30?'#ff8800':C.text,peITM)}><IV_Badge iv={row.pe?.iv||0}/></td>
                    <td style={cell('#6a9ab8',peITM)}>{row.pe?`${(row.pe.oi/1e3).toFixed(0)}K`:'—'}</td>
                    <td style={cell('#ff8800',peITM)}>{row.pe?row.pe.theta?.toFixed(3):'—'}</td>
                    <td style={cell(C.text,peITM)}>{row.pe?row.pe.delta.toFixed(3):'—'}</td>
                    <td style={{...cell(C.peClr,peITM), fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13}}>
                      {row.pe?`₹${fmt(row.pe.ltp)}`:'—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* OI heatmap row */}
      {view==='chain' && (
        <div style={{padding:'8px 14px', borderTop:`1px solid ${C.border}`}}>
          <div style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9, letterSpacing:2, marginBottom:4}}>CE vs PE OI DISTRIBUTION</div>
          <OIBar ceOI={totalCEOI} peOI={totalPEOI}/>
          <div style={{display:'flex', gap:16, marginTop:6, flexWrap:'wrap'}}>
            {[['Δ Delta','direction -1 to +1'],['θ Theta','time decay/day'],['IV','implied vol %'],['ATM','at the money'],['MAX PAIN','min expiry loss strike']].map(([k,v])=>(
              <div key={k} style={{fontFamily:'Share Tech Mono', color:C.dim, fontSize:9}}>
                <span style={{color:C.accent}}>{k}</span>: {v}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
