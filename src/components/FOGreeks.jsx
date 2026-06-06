import React, { useMemo, useState } from 'react'
import { fmt } from '../utils/indicators'

export default function FOGreeks({ data }) {
  const [showAll, setShowAll] = useState(false)
  const [activeTab, setActiveTab] = useState('chain')

  const rows = useMemo(() => {
    if (!data?.optionChain) return []
    const map = new Map()
    for (const g of data.optionChain) {
      const row = map.get(g.strikePrice) ?? { strike: g.strikePrice, ce: null, pe: null }
      if (g.optionType === 'CE') row.ce = g; else row.pe = g
      map.set(g.strikePrice, row)
    }
    return Array.from(map.values()).sort((a, b) => a.strike - b.strike)
  }, [data])

  const atm = data ? Math.round(data.price / 50) * 50 : 0
  const displayRows = showAll ? rows : rows.filter(r => Math.abs(r.strike - atm) <= 200)

  // PCR calculation
  const totalCE_OI = data?.optionChain?.filter(g=>g.optionType==='CE').reduce((s,g)=>s+g.oi,0) || 0
  const totalPE_OI = data?.optionChain?.filter(g=>g.optionType==='PE').reduce((s,g)=>s+g.oi,0) || 0
  const pcrVal = totalCE_OI > 0 ? (totalPE_OI / totalCE_OI) : data?.pcr || 1
  const pcrBias = pcrVal > 1.3 ? 'STRONG BULL' : pcrVal > 1.1 ? 'BULLISH' : pcrVal > 0.9 ? 'NEUTRAL' : pcrVal > 0.7 ? 'BEARISH' : 'STRONG BEAR'
  const pcrColor = pcrVal > 1.2 ? '#00ff88' : pcrVal < 0.8 ? '#ff3366' : '#ffd700'

  // Max OI for visualization bar
  const maxCE_OI = Math.max(...(data?.optionChain?.filter(g=>g.optionType==='CE').map(g=>g.oi) || [1]))
  const maxPE_OI = Math.max(...(data?.optionChain?.filter(g=>g.optionType==='PE').map(g=>g.oi) || [1]))

  const maxPain = data?.maxPain || 0
  const foStrategies = data?.foStrategies || []
  const ivAvg = data?.optionChain?.length > 0
    ? +(data.optionChain.reduce((s,g)=>s+g.iv,0)/data.optionChain.length).toFixed(1) : 0

  if (!data) return (
    <div className="panel flex flex-col items-center justify-center py-10 gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>📊</div>
      <div className="font-display text-muted text-xs tracking-widest">OPTIONS CHAIN IDLE</div>
    </div>
  )

  const colH = 'font-mono text-dim uppercase tracking-wider text-center py-2 px-1'
  const fStyle = { fontSize: 10, letterSpacing: 1 }

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">⚙ F&amp;O Analytics</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-muted" style={{ fontSize: 10 }}>
            SPOT ₹{fmt(data.price)} · ATM {atm}
          </span>
        </div>
      </div>

      {/* PCR + IV Summary Bar */}
      <div className="grid grid-cols-3 gap-px border-b border-border" style={{background:'#1a3050'}}>
        <div className="bg-panel p-2">
          <div className="font-mono text-dim uppercase" style={{fontSize:9}}>Put-Call Ratio</div>
          <div className="font-display font-bold" style={{fontSize:16, color:pcrColor}}>{pcrVal.toFixed(2)}</div>
          <div className="font-mono" style={{fontSize:10, color:pcrColor}}>{pcrBias}</div>
        </div>
        <div className="bg-panel p-2">
          <div className="font-mono text-dim uppercase" style={{fontSize:9}}>Avg IV</div>
          <div className="font-display font-bold" style={{fontSize:16, color:ivAvg>20?'#ffd700':'#c8dff0'}}>{ivAvg}%</div>
          <div className="font-mono text-dim" style={{fontSize:10}}>{ivAvg>25?'HIGH (sell options)':ivAvg<12?'LOW (buy options)':'NORMAL'}</div>
        </div>
        <div className="bg-panel p-2">
          <div className="font-mono text-dim uppercase" style={{fontSize:9}}>Max Pain</div>
          <div className="font-display font-bold" style={{fontSize:16, color:'#00d4ff'}}>₹{fmt(maxPain,0)}</div>
          <div className="font-mono text-dim" style={{fontSize:10}}>
            {maxPain > 0 ? (data.price > maxPain ? `₹${(data.price-maxPain).toFixed(0)} above pain` : `₹${(maxPain-data.price).toFixed(0)} below pain`) : 'N/A'}
          </div>
        </div>
      </div>

      {/* PCR Visual Bar */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex justify-between font-mono text-dim mb-1" style={{fontSize:10}}>
          <span style={{color:'#ff3366'}}>BEARISH ← PE OI</span>
          <span style={{color:'#00d4ff'}}>PCR {pcrVal.toFixed(2)}</span>
          <span style={{color:'#00ff88'}}>CE OI → BULLISH</span>
        </div>
        <div className="relative h-3 rounded overflow-hidden" style={{background:'#1a3050'}}>
          {/* CE bar (right side from center) */}
          <div className="absolute top-0 bottom-0" style={{
            left: '50%',
            width: `${Math.min(48, (totalCE_OI/(totalCE_OI+totalPE_OI+1))*96)}%`,
            background: 'linear-gradient(90deg, #00ff8866, #00ff88)',
          }}/>
          {/* PE bar (left side from center) */}
          <div className="absolute top-0 bottom-0" style={{
            right: '50%',
            width: `${Math.min(48, (totalPE_OI/(totalCE_OI+totalPE_OI+1))*96)}%`,
            background: 'linear-gradient(270deg, #ff336666, #ff3366)',
          }}/>
          <div className="absolute top-0 bottom-0 w-0.5 bg-accent" style={{left:'50%'}}/>
        </div>
        <div className="flex justify-between font-mono text-dim mt-1" style={{fontSize:9}}>
          <span>{(totalPE_OI/1000).toFixed(0)}K PE OI</span>
          <span>{(totalCE_OI/1000).toFixed(0)}K CE OI</span>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex border-b border-border">
        {[['chain','Options Chain'],['oi','OI Visual'],['strategy','Strategies']].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            className={`font-mono px-3 py-1.5 transition-colors flex-1 ${activeTab===id?'text-accent border-b-2 border-accent bg-accent/5':'text-muted hover:text-accent/70'}`}
            style={{fontSize:10}}>
            {label}
          </button>
        ))}
      </div>

      {/* OPTIONS CHAIN TAB */}
      {activeTab === 'chain' && (
        <>
          <div className="flex justify-between items-center px-3 py-1">
            <span className="font-mono text-dim" style={{fontSize:10}}>
              {displayRows.length} strikes shown
            </span>
            <button onClick={() => setShowAll(s => !s)}
              className="font-mono border border-border text-muted px-2 py-0.5 hover:border-accent hover:text-accent transition-colors"
              style={{ fontSize: 10 }}>
              {showAll ? 'NEAR ATM' : 'SHOW ALL'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#0d1825', borderBottom: '1px solid #1a3050' }}>
                  <th className={colH} style={{ ...fStyle, color: '#00d4ff', width: 72 }}>CE LTP</th>
                  <th className={colH} style={fStyle}>CE Δ</th>
                  <th className={colH} style={fStyle}>CE OI</th>
                  <th className={colH} style={fStyle}>CE IV%</th>
                  <th className={colH} style={{ ...fStyle, color: '#c8dff0', width: 88, background: 'rgba(0,212,255,0.05)' }}>STRIKE</th>
                  <th className={colH} style={fStyle}>PE IV%</th>
                  <th className={colH} style={fStyle}>PE OI</th>
                  <th className={colH} style={fStyle}>PE Δ</th>
                  <th className={colH} style={{ ...fStyle, color: '#ff3366', width: 72 }}>PE LTP</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => {
                  const isATM = row.strike === atm
                  const isMaxPain = row.strike === maxPain
                  const ceITM = row.strike < data.price, peITM = row.strike > data.price
                  const rowBg = isATM ? 'rgba(0,212,255,0.06)' : isMaxPain ? 'rgba(255,215,0,0.04)' : 'transparent'

                  return (
                    <tr key={row.strike} style={{ borderBottom: '1px solid #1a305033', background: rowBg }}>
                      <td className="text-center py-1.5 px-1 font-display font-bold"
                        style={{ fontSize: 11, color: '#00d4ff', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                        {row.ce ? `₹${fmt(row.ce.ltp)}` : '—'}
                      </td>
                      <td className="text-center font-mono"
                        style={{ fontSize: 10, color: '#c8dff0', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                        {row.ce ? row.ce.delta.toFixed(3) : '—'}
                      </td>
                      <td className="text-center font-mono"
                        style={{ fontSize: 10, color: '#6a9ab8', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                        {row.ce ? `${(row.ce.oi/1000).toFixed(0)}K` : '—'}
                      </td>
                      <td className="text-center font-mono"
                        style={{ fontSize: 10, color: row.ce?.iv > 22 ? '#ffd700' : '#c8dff0', background: ceITM ? 'rgba(0,255,136,0.04)' : 'transparent' }}>
                        {row.ce ? `${row.ce.iv}%` : '—'}
                      </td>
                      <td className="text-center font-display font-black py-1.5"
                        style={{ fontSize: 12, color: isATM ? '#00d4ff' : isMaxPain ? '#ffd700' : '#c8dff0',
                          background: 'rgba(0,212,255,0.04)', border: isATM ? '1px solid #00d4ff44' : isMaxPain ? '1px solid #ffd70044' : 'none' }}>
                        {row.strike}
                        {isATM && <span className="font-mono text-accent block" style={{ fontSize: 8 }}>ATM</span>}
                        {isMaxPain && !isATM && <span className="font-mono block" style={{ fontSize: 8, color: '#ffd700' }}>MAX PAIN</span>}
                      </td>
                      <td className="text-center font-mono"
                        style={{ fontSize: 10, color: row.pe?.iv > 22 ? '#ffd700' : '#c8dff0', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                        {row.pe ? `${row.pe.iv}%` : '—'}
                      </td>
                      <td className="text-center font-mono"
                        style={{ fontSize: 10, color: '#6a9ab8', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                        {row.pe ? `${(row.pe.oi/1000).toFixed(0)}K` : '—'}
                      </td>
                      <td className="text-center font-mono"
                        style={{ fontSize: 10, color: '#c8dff0', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                        {row.pe ? row.pe.delta.toFixed(3) : '—'}
                      </td>
                      <td className="text-center py-1.5 px-1 font-display font-bold"
                        style={{ fontSize: 11, color: '#ff3366', background: peITM ? 'rgba(255,51,102,0.04)' : 'transparent' }}>
                        {row.pe ? `₹${fmt(row.pe.ltp)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 px-3 py-2 border-t border-border flex-wrap">
            {[['Δ Delta','directional (-1 to +1)'],['θ Theta','daily time decay'],['ν Vega','IV sensitivity'],['γ Gamma','delta rate of change']].map(([k,v])=>(
              <div key={k} className="font-mono text-dim" style={{fontSize:10}}>
                <span className="text-accent">{k}</span>: {v}
              </div>
            ))}
          </div>
        </>
      )}

      {/* OI VISUAL TAB */}
      {activeTab === 'oi' && (
        <div className="p-3 flex flex-col gap-2">
          <div className="font-mono text-dim mb-1" style={{fontSize:10}}>
            Open Interest by Strike — larger bar = more OI = stronger support/resistance
          </div>
          {displayRows.slice(0,12).map(row => {
            const ceW = row.ce ? (row.ce.oi / maxCE_OI * 100) : 0
            const peW = row.pe ? (row.pe.oi / maxPE_OI * 100) : 0
            const isATM = row.strike === atm, isMaxPain = row.strike === maxPain
            return (
              <div key={row.strike} className="flex items-center gap-2">
                {/* CE OI bar (left side) */}
                <div className="flex-1 flex justify-end">
                  <div className="h-4 rounded-l transition-all"
                    style={{ width:`${ceW}%`, background:'linear-gradient(270deg, #00d4ff33, #00d4ff88)',
                      border:'1px solid #00d4ff22', minWidth: ceW>0?2:0 }}/>
                </div>
                {/* Strike label */}
                <div className="text-center flex-shrink-0" style={{width:72}}>
                  <span className="font-mono font-bold"
                    style={{fontSize:11, color:isATM?'#00d4ff':isMaxPain?'#ffd700':'#c8dff0'}}>
                    {row.strike}
                  </span>
                  {isATM && <span className="font-mono block" style={{fontSize:8, color:'#00d4ff'}}>ATM</span>}
                  {isMaxPain && !isATM && <span className="font-mono block" style={{fontSize:8, color:'#ffd700'}}>PAIN</span>}
                </div>
                {/* PE OI bar (right side) */}
                <div className="flex-1">
                  <div className="h-4 rounded-r transition-all"
                    style={{ width:`${peW}%`, background:'linear-gradient(90deg, #ff336633, #ff336688)',
                      border:'1px solid #ff336622', minWidth: peW>0?2:0 }}/>
                </div>
              </div>
            )
          })}
          <div className="flex justify-between font-mono text-dim mt-1" style={{fontSize:10}}>
            <span style={{color:'#00d4ff'}}>◀ CALL OI (CE)</span>
            <span style={{color:'#ff3366'}}>PUT OI (PE) ▶</span>
          </div>
          <div className="font-mono text-dim text-center mt-1 p-2 border border-border/50" style={{fontSize:10}}>
            High CE OI at a strike = strong resistance. High PE OI = strong support.
            Max Pain ₹{fmt(maxPain,0)} = strike where most options expire worthless.
          </div>
        </div>
      )}

      {/* STRATEGY TAB */}
      {activeTab === 'strategy' && (
        <div className="p-3 flex flex-col gap-3">
          {foStrategies.length === 0 ? (
            <div className="text-center text-muted font-mono py-6" style={{fontSize:12}}>
              Run analysis to see F&O strategy suggestions
            </div>
          ) : (
            <>
              <div className="font-mono text-accent uppercase tracking-widest" style={{fontSize:10}}>
                Suggested F&O Strategies — based on IV {ivAvg}%, PCR {pcrVal.toFixed(2)}, {data.ai?.verdict || 'HOLD'} verdict
              </div>
              {foStrategies.map((s, i) => (
                <div key={i} className="p-3 border border-border/50"
                  style={{ background: i===0 ? 'rgba(0,212,255,0.04)' : 'transparent' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-display font-bold" style={{fontSize:14, color:'#00d4ff'}}>
                      {i===0 && <span className="text-accent mr-1" style={{fontSize:10}}>★ TOP PICK</span>}
                      {s.name}
                    </div>
                    <div className="flex gap-2">
                      <span className="font-mono border px-1" style={{fontSize:9, color:'#ffd700', borderColor:'#ffd70033'}}>
                        Risk: {s.risk}
                      </span>
                      <span className="font-mono border px-1" style={{fontSize:9, color:'#00ff88', borderColor:'#00ff8833'}}>
                        Reward: {s.reward}
                      </span>
                    </div>
                  </div>
                  <div className="font-mono text-dim" style={{fontSize:11}}>{s.reason}</div>
                </div>
              ))}

              {/* ATM Option Trade */}
              {data.ai?.optionSuggestion && (
                <div className="p-2 border font-mono" style={{fontSize:11, color:'#00d4ff', borderColor:'#00d4ff33', background:'rgba(0,212,255,0.05)'}}>
                  <div className="text-dim mb-1" style={{fontSize:9, letterSpacing:2}}>RECOMMENDED TRADE</div>
                  {data.ai.optionSuggestion}
                </div>
              )}

              <div className="p-2 border border-border/30 font-mono text-dim" style={{fontSize:10, background:'rgba(255,215,0,0.03)'}}>
                ⚠ These are educational suggestions only. Always manage risk with defined stop-losses.
                F&O trading involves substantial risk of loss. Consult a SEBI-registered advisor.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
