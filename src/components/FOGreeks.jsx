import React, { useMemo, useState, useEffect } from 'react'
import { fmt } from '../utils/indicators'
import { API_BASE_URL } from '../config'

export default function FOGreeks({ data }) {
  const [showAll, setShowAll] = useState(false)
  const [activeTab, setActiveTab] = useState('chain')
  const [realOC, setRealOC] = useState(null)
  const [ocLoading, setOcLoading] = useState(false)

  // Fetch real NSE option chain
  useEffect(() => {
    if (!data?.symbol) return
    const sym = data.symbol.replace('NIFTY 50','NIFTY').replace('NIFTY50','NIFTY')
    setOcLoading(true)
    const token = localStorage.getItem('upstox_access_token') || ''
    fetch(`${API_BASE_URL}/api/optionchain?symbol=${sym}`, {
      headers: token ? { Authorization:`Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(d => {
        if (d.status === 'success' && d.data?.length > 0) {
          setRealOC(d)
          console.log(`[F&O] Real NSE data: ${d.data.length} strikes, PCR=${d.pcr}`)
        }
      })
      .catch(e => console.warn('[F&O] NSE fetch failed:', e.message))
      .finally(() => setOcLoading(false))
  }, [data?.symbol])

  // Use real data if available, else fall back to mock
  const activeOCData = realOC?.data || (data?.optionChain ? null : null)

  const rows = useMemo(() => {
    // Use real NSE chain if available
    if (realOC?.data?.length > 0) {
      return realOC.data
        .map(r => ({
          strike: r.strike,
          ce: r.ce ? { ltp:r.ce.ltp, delta:r.ce.delta||0, oi:r.ce.oi||0, iv:r.ce.iv||0, theta:0, gamma:0 } : null,
          pe: r.pe ? { ltp:r.pe.ltp, delta:r.pe.delta||0, oi:r.pe.oi||0, iv:r.pe.iv||0, theta:0, gamma:0 } : null,
        }))
        .sort((a,b) => a.strike - b.strike)
    }
    if (!data?.optionChain) return []
    const map = new Map()
    for (const g of data.optionChain) {
      const row = map.get(g.strikePrice) ?? { strike: g.strikePrice, ce: null, pe: null }
      if (g.optionType === 'CE') row.ce = g; else row.pe = g
      map.set(g.strikePrice, row)
    }
    return Array.from(map.values()).sort((a, b) => a.strike - b.strike)
  }, [data, realOC])

  const atm = data ? Math.round(data.price / 50) * 50 : 0
  const displayRows = showAll ? rows : rows.filter(r => Math.abs(r.strike - atm) <= 200)

  // PCR calculation
  // Use real NSE data if available
  const chainData = realOC?.data || []
  const totalCE_OI = chainData.length > 0
    ? chainData.reduce((s,r)=>(r.ce?.oi||0)+s,0)
    : (data?.optionChain?.filter(g=>g.optionType==='CE').reduce((s,g)=>s+g.oi,0) || 0)
  const totalPE_OI = chainData.length > 0
    ? chainData.reduce((s,r)=>(r.pe?.oi||0)+s,0)
    : (data?.optionChain?.filter(g=>g.optionType==='PE').reduce((s,g)=>s+g.oi,0) || 0)
  const pcrVal = realOC?.pcr || (totalCE_OI > 0 ? (totalPE_OI / totalCE_OI) : data?.pcr || 1)
  const pcrBias = pcrVal > 1.3 ? 'STRONG BULL' : pcrVal > 1.1 ? 'BULLISH' : pcrVal > 0.9 ? 'NEUTRAL' : pcrVal > 0.7 ? 'BEARISH' : 'STRONG BEAR'
  const pcrColor = pcrVal > 1.2 ? '#00ff88' : pcrVal < 0.8 ? '#ff3366' : '#ffd700'

  // Max OI for visualization bar
  const maxCE_OI = Math.max(...(data?.optionChain?.filter(g=>g.optionType==='CE').map(g=>g.oi) || [1]))
  const maxPE_OI = Math.max(...(data?.optionChain?.filter(g=>g.optionType==='PE').map(g=>g.oi) || [1]))

  const maxPain = realOC?.maxPain || data?.maxPain || 0
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
          {ocLoading && <span style={{fontSize:10,color:'var(--amber)',fontFamily:"'DM Mono',monospace"}}>● Fetching NSE...</span>}
          {realOC && <span style={{fontSize:10,color:'var(--green)',fontFamily:"'DM Mono',monospace"}}>● NSE Live OC</span>}
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
        {[['chain','Options Chain'],['oi','OI Visual'],['strategy','Strategies'],['ivrank','IV Rank'],['spread','Spread Calc']].map(([id,label])=>(
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

      {/* IV RANK TAB */}
      {activeTab === 'ivrank' && (
        <div className="p-3 flex flex-col gap-3">
          <div className="font-mono text-dim" style={{fontSize:10}}>
            IV Rank measures where current IV sits within its 52-week range. IV Percentile shows % of days with lower IV.
          </div>
          {(() => {
            const ivr = data?.ivData
            const ivAvgLocal = data?.optionChain?.length > 0
              ? +(data.optionChain.reduce((s,g)=>s+g.iv,0)/data.optionChain.length).toFixed(1) : ivAvg
            return (
              <>
                <div style={{padding:12,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8}}>
                  <div className="font-mono text-dim uppercase" style={{fontSize:9,marginBottom:6}}>CURRENT IV</div>
                  <div className="font-display font-bold" style={{fontSize:28,color:ivAvgLocal>25?'var(--red)':ivAvgLocal<12?'var(--green)':'var(--amber)'}}>{ivAvgLocal}%</div>
                  <div className="font-mono text-dim" style={{fontSize:10}}>{ivAvgLocal>25?'HIGH IV — Sell options (Strangles, IC)':ivAvgLocal<12?'LOW IV — Buy options (Straddles, Spreads)':'NORMAL IV — Neutral strategies'}</div>
                </div>
                {ivr && (
                  <>
                    <div style={{padding:10,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8}}>
                      <div className="font-mono text-dim uppercase" style={{fontSize:9,marginBottom:4}}>IV RANK (52W)</div>
                      <div className="font-display font-bold" style={{fontSize:22,color:ivr.ivRank>70?'var(--red)':ivr.ivRank<30?'var(--green)':'var(--amber)'}}>{ivr.ivRank}%</div>
                      <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden',marginTop:6}}>
                        <div style={{height:'100%',width:`${ivr.ivRank}%`,background:ivr.ivRank>70?'var(--red)':ivr.ivRank<30?'var(--green)':'var(--amber)',borderRadius:3}}/>
                      </div>
                      <div className="font-mono text-dim" style={{fontSize:10,marginTop:4}}>Historical Vol: {ivr.historicalVol}%</div>
                    </div>
                    <div className="font-mono text-dim p-2 border border-border/50" style={{fontSize:10}}>
                      {ivr.ivRank > 70 ? '📌 High IV Rank → Consider SELLING options: Short Straddle, Iron Condor, Covered Call' :
                       ivr.ivRank < 30 ? '📌 Low IV Rank → Consider BUYING options: Long Straddle, Long Strangle, Debit Spreads' :
                       '📌 Mid IV Rank → Neutral strategies work best: Bull/Bear Spreads, Calendar Spreads'}
                    </div>
                  </>
                )}

                {/* Theta decay calendar */}
                <div>
                  <div className="font-mono text-accent uppercase tracking-widest mb-2" style={{fontSize:10}}>THETA DECAY CALENDAR</div>
                  <div className="font-mono text-dim" style={{fontSize:10,marginBottom:8}}>
                    Time value erosion for ATM option (approx). Theta accelerates as expiry approaches.
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid var(--border)'}}>
                        {['Days to Expiry','Daily Theta%','Weekly Theta%','Strategy'].map(h=>(
                          <th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:9,color:'var(--text3)',fontFamily:"'DM Mono',monospace",fontWeight:600}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [30,'0.3%','2.1%','Buy options — plenty of time'],
                        [21,'0.4%','2.8%','Debit spreads favorable'],
                        [14,'0.6%','4.2%','Theta picks up — be careful buying'],
                        [7, '1.2%','8.4%','Sell options — time decay fast'],
                        [3, '2.8%','—',  'Sell options — rapid decay'],
                        [1, '8%+', '—',  'Extreme theta — only sell'],
                      ].map(([d,dt,wt,strat])=>(
                        <tr key={d} style={{borderBottom:'1px solid var(--border)22'}}>
                          <td style={{padding:'6px 8px',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text)'}}>{d}d</td>
                          <td style={{padding:'6px 8px',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--red)'}}>{dt}</td>
                          <td style={{padding:'6px 8px',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--red)'}}>{wt}</td>
                          <td style={{padding:'6px 8px',fontSize:10,color:'var(--text3)'}}>{strat}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* SPREAD CALCULATOR TAB */}
      {activeTab === 'spread' && <SpreadCalculator price={data?.price||0} atm={atm}/>}

    </div>
  )
}

function SpreadCalculator({ price, atm }) {
  const [strategy, setStrategy] = React.useState('bull_call')
  const [lowerStrike, setLower] = React.useState(atm - 100)
  const [upperStrike, setUpper] = React.useState(atm + 100)
  const [lowerPrem, setLowerP] = React.useState(200)
  const [upperPrem, setUpperP] = React.useState(80)
  const [lots, setLots] = React.useState(1)
  const lotSize = 50 // NIFTY lot size

  const calc = React.useMemo(()=>{
    if (strategy === 'bull_call') {
      const netDebit = lowerPrem - upperPrem
      const maxProfit = (upperStrike - lowerStrike - netDebit) * lots * lotSize
      const maxLoss   = netDebit * lots * lotSize
      const breakeven = lowerStrike + netDebit
      return { netDebit, maxProfit, maxLoss, breakeven, type:'Debit' }
    } else if (strategy === 'bear_put') {
      const netDebit = upperPrem - lowerPrem
      const maxProfit = (upperStrike - lowerStrike - netDebit) * lots * lotSize
      const maxLoss   = netDebit * lots * lotSize
      const breakeven = upperStrike - netDebit
      return { netDebit, maxProfit, maxLoss, breakeven, type:'Debit' }
    } else if (strategy === 'bull_put') {
      const netCredit = upperPrem - lowerPrem
      const maxProfit = netCredit * lots * lotSize
      const maxLoss   = (upperStrike - lowerStrike - netCredit) * lots * lotSize
      const breakeven = upperStrike - netCredit
      return { netCredit, maxProfit, maxLoss, breakeven, type:'Credit' }
    } else { // bear_call
      const netCredit = lowerPrem - upperPrem
      const maxProfit = netCredit * lots * lotSize
      const maxLoss   = (upperStrike - lowerStrike - netCredit) * lots * lotSize
      const breakeven = lowerStrike + netCredit
      return { netCredit, maxProfit, maxLoss, breakeven, type:'Credit' }
    }
  },[strategy,lowerStrike,upperStrike,lowerPrem,upperPrem,lots])

  const fc2 = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0})}`
  const rr = calc.maxLoss > 0 ? (calc.maxProfit/calc.maxLoss).toFixed(2) : '∞'

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="font-mono text-accent uppercase tracking-widest" style={{fontSize:10}}>Options Spread Calculator</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {[['bull_call','Bull Call Spread'],['bear_put','Bear Put Spread'],['bull_put','Bull Put Spread'],['bear_call','Bear Call Spread']].map(([id,label])=>(
          <button key={id} onClick={()=>setStrategy(id)} style={{
            padding:'7px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,textAlign:'left',
            background:strategy===id?'var(--accent)':'var(--surface2)',
            color:strategy===id?'#fff':'var(--text2)',transition:'all .15s',
          }}>{label}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {[
          ['Lower Strike',lowerStrike,setLower],['Upper Strike',upperStrike,setUpper],
          ['Lower Premium',lowerPrem,setLowerP],['Upper Premium',upperPrem,setUpperP],
        ].map(([label,val,set])=>(
          <div key={label}>
            <div className="font-mono text-dim" style={{fontSize:9,marginBottom:3}}>{label}</div>
            <input type="number" value={val} onChange={e=>set(Number(e.target.value))}
              style={{width:'100%',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:5,
                color:'var(--text)',padding:'6px 10px',fontSize:13,outline:'none',fontFamily:"'DM Mono',monospace"}}/>
          </div>
        ))}
      </div>
      <div>
        <div className="font-mono text-dim" style={{fontSize:9,marginBottom:3}}>Lots (1 lot = {lotSize} qty)</div>
        <input type="number" value={lots} min={1} onChange={e=>setLots(Math.max(1,Number(e.target.value)))}
          style={{width:80,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:5,
            color:'var(--text)',padding:'6px 10px',fontSize:13,outline:'none',fontFamily:"'DM Mono',monospace"}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
        {[
          {l:calc.type==='Debit'?'Net Debit':'Net Credit', v:fc2(calc.netDebit||calc.netCredit), c:'var(--accent2)'},
          {l:'Breakeven', v:fc2(calc.breakeven), c:'var(--amber)'},
          {l:'Max Profit', v:fc2(calc.maxProfit), c:'var(--green)'},
          {l:'Max Loss',   v:fc2(calc.maxLoss),   c:'var(--red)'},
        ].map(x=>(
          <div key={x.l} style={{padding:'10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8}}>
            <div className="font-mono text-dim" style={{fontSize:9,marginBottom:3}}>{x.l}</div>
            <div className="font-display font-bold" style={{fontSize:16,color:x.c}}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'10px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,textAlign:'center'}}>
        <div className="font-mono text-dim" style={{fontSize:10}}>Risk : Reward</div>
        <div className="font-display font-bold" style={{fontSize:22,color:Number(rr)>=2?'var(--green)':Number(rr)>=1?'var(--amber)':'var(--red)'}}>1 : {rr}</div>
      </div>
    </div>
  )
}

}