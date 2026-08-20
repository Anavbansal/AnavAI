import React, { useState, useCallback } from 'react'
import { searchMutualFunds, getMutualFundNAV } from '../services/marketData'

// Simple SVG line chart — no recharts dependency (avoids React context errors)
function SimpleChart({ data }) {
  if (!data || data.length < 2) return null
  const w = 600, h = 130, pad = { t:8, r:8, b:24, l:48 }
  const minV = Math.min(...data.map(d=>d.nav))
  const maxV = Math.max(...data.map(d=>d.nav))
  const rng  = maxV - minV || 1
  const xS = i => pad.l + (i / (data.length-1)) * (w - pad.l - pad.r)
  const yS = v => pad.t + (1 - (v-minV)/rng) * (h - pad.t - pad.b)
  const pts = data.map((d,i) => `${xS(i).toFixed(1)},${yS(d.nav).toFixed(1)}`).join(' ')
  const areaBot = h - pad.b
  const area = `M${xS(0)},${areaBot} ` +
    data.map((d,i)=>`L${xS(i).toFixed(1)},${yS(d.nav).toFixed(1)}`).join(' ') +
    ` L${xS(data.length-1)},${areaBot} Z`
  // X-axis labels (every 30 points)
  const labels = data.filter((_,i) => i===0 || i===data.length-1 || i%30===0)
    .map((d,_,arr) => { const i=data.indexOf(d); return {x:xS(i),label:d.date?.slice(0,7)||''} })

  const [hover, setHover] = useState(null)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height:h,display:'block'}}
      onMouseLeave={()=>setHover(null)}
      onMouseMove={e=>{
        const rect=e.currentTarget.getBoundingClientRect()
        const mx=(e.clientX-rect.left)/rect.width*w
        const idx=Math.round((mx-pad.l)/(w-pad.l-pad.r)*(data.length-1))
        if(idx>=0&&idx<data.length) setHover({idx,x:xS(idx),y:yS(data[idx].nav),d:data[idx]})
      }}>
      <defs>
        <linearGradient id="ng" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5865f2" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#5865f2" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ng)"/>
      <polyline points={pts} fill="none" stroke="#5865f2" strokeWidth="1.5"/>
      {labels.map((l,i)=>(
        <text key={i} x={l.x} y={h-6} fill="#3a5a7a" fontSize="9" textAnchor="middle">{l.label}</text>
      ))}
      <text x={pad.l-4} y={pad.t+4} fill="#3a5a7a" fontSize="9" textAnchor="end">{maxV.toFixed(0)}</text>
      <text x={pad.l-4} y={h-pad.b} fill="#3a5a7a" fontSize="9" textAnchor="end">{minV.toFixed(0)}</text>
      {hover && <>
        <line x1={hover.x} y1={pad.t} x2={hover.x} y2={h-pad.b} stroke="#5865f288" strokeWidth="1" strokeDasharray="3,3"/>
        <circle cx={hover.x} cy={hover.y} r="4" fill="#5865f2" stroke="#fff" strokeWidth="1.5"/>
        <rect x={Math.min(hover.x+6,w-110)} y={hover.y-22} width={105} height={20} rx="4" fill="#0e1420" stroke="#1f2d45"/>
        <text x={Math.min(hover.x+10,w-106)} y={hover.y-8} fill="#e2e8f0" fontSize="10" fontFamily="monospace">
          {hover.d.date}: ₹{hover.d.nav.toFixed(4)}
        </text>
      </>}
    </svg>
  )
}

export default function MutualFunds() {
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [selected,   setSelected]   = useState(null)
  const [navData,    setNavData]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [loadingNAV, setLoadingNAV] = useState(false)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await searchMutualFunds(query)
      setResults(res || [])
    } catch(e) {
      setResults([])
    }
    setLoading(false)
  }, [query])

  const selectFund = useCallback(async (fund) => {
    setSelected(fund)
    setResults([])
    setLoadingNAV(true)
    try {
      const d = await getMutualFundNAV(fund.schemeCode)
      setNavData(d)
    } catch(e) {
      setNavData(null)
    }
    setLoadingNAV(false)
  }, [])

  const chartData = navData?.data?.slice(0,365).reverse().map(d=>({
    date: d.date,
    nav:  parseFloat(d.nav),
  })) ?? []

  const currentNAV = chartData[chartData.length-1]?.nav ?? 0
  const prevNAV    = chartData[chartData.length-2]?.nav ?? currentNAV
  const navChange  = currentNAV - prevNAV
  const bull       = navChange >= 0

  function cagr(data, years) {
    if (data.length < 2) return null
    const idx = Math.max(0, data.length - Math.round(years*365))
    const s = data[idx]?.nav ?? data[0].nav
    const e = data[data.length-1]?.nav
    if (!s||!e) return null
    return (Math.pow(e/s, 1/years)-1)*100
  }
  const cagr1Y = cagr(chartData, 1)
  const cagr3Y = cagr(chartData, 3)
  const cagr5Y = cagr(chartData, 5)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
        background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10}}>
        <span style={{fontSize:16}}>🏦</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'var(--text)'}}>Mutual Funds</span>
        <span style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)'}}>
          Live NAV · mfapi.in
        </span>
      </div>

      {/* Search */}
      <div style={{display:'flex',gap:8}}>
        <input value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&search()}
          placeholder="Search fund name — e.g. HDFC Mid Cap, SBI Bluechip..."
          style={{flex:1,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,
            color:'var(--text)',padding:'9px 12px',fontSize:13,outline:'none',
            fontFamily:"'DM Mono',monospace"}}/>
        <button onClick={search} disabled={loading}
          style={{padding:'9px 18px',borderRadius:8,border:'none',cursor:'pointer',
            background:'var(--accent)',color:'#fff',fontWeight:700,fontSize:12,
            opacity:loading?0.6:1}}>
          {loading?'⟳':'🔍 Search'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && !selected && (
        <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',maxHeight:260,overflowY:'auto'}}>
          {results.map(r=>(
            <div key={r.schemeCode} onClick={()=>selectFund(r)}
              style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',
                cursor:'pointer',transition:'background .15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg2)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{fontSize:13,color:'var(--text)',marginBottom:2}}>{r.schemeName}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)'}}>
                Code: {r.schemeCode}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fund Detail */}
      {selected && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {/* Fund name */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
            padding:'12px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:4}}>
                {navData?.meta?.scheme_name ?? selected.schemeName}
              </div>
              <div style={{fontSize:11,color:'var(--text3)'}}>
                {navData?.meta?.fund_house} · {navData?.meta?.scheme_category}
              </div>
            </div>
            <button onClick={()=>{setSelected(null);setNavData(null);setResults([])}}
              style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',
                background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:12}}>
              ✕ Close
            </button>
          </div>

          {/* Loading */}
          {loadingNAV && (
            <div style={{display:'flex',alignItems:'center',gap:12,padding:24,justifyContent:'center',
              background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
              <div style={{width:20,height:20,borderRadius:'50%',border:'2px solid var(--border)',
                borderTopColor:'var(--accent)',animation:'spin 1s linear infinite'}}/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text3)'}}>
                Fetching live NAV...
              </span>
            </div>
          )}

          {/* Stats + Chart */}
          {!loadingNAV && chartData.length > 0 && (
            <>
              {/* Metric cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {[
                  {l:'Current NAV', v:`₹${currentNAV.toFixed(4)}`, c:bull?'var(--green)':'var(--red)'},
                  {l:'1Y CAGR', v:cagr1Y!=null?`${cagr1Y.toFixed(2)}%`:'N/A', c:cagr1Y>0?'var(--green)':'var(--red)'},
                  {l:'3Y CAGR', v:cagr3Y!=null?`${cagr3Y.toFixed(2)}%`:'N/A', c:cagr3Y>0?'var(--green)':'var(--red)'},
                  {l:'5Y CAGR', v:cagr5Y!=null?`${cagr5Y.toFixed(2)}%`:'N/A', c:cagr5Y>0?'var(--green)':'var(--red)'},
                  {l:'Day Change', v:`${navChange>=0?'+':''}${navChange.toFixed(4)}`, c:bull?'var(--green)':'var(--red)'},
                  {l:'Data Points', v:`${chartData.length} days`, c:'var(--text3)'},
                ].map(m=>(
                  <div key={m.l} style={{padding:'10px 12px',background:'var(--surface)',
                    border:'1px solid var(--border)',borderRadius:8,textAlign:'center'}}>
                    <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.8,marginBottom:4}}>
                      {m.l}
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,color:m.c}}>
                      {m.v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 8px 4px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)',marginBottom:8,paddingLeft:8}}>
                  NAV History ({chartData.length} days)
                </div>
                <SimpleChart data={chartData}/>
              </div>
            </>
          )}

          {!loadingNAV && chartData.length === 0 && (
            <div style={{textAlign:'center',padding:24,color:'var(--text3)',fontSize:13}}>
              No NAV data available for this fund
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selected && results.length === 0 && (
        <div style={{textAlign:'center',padding:'32px 16px',
          background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,opacity:.5}}>
          <div style={{fontSize:32,marginBottom:8}}>🏦</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginBottom:4}}>
            Search Any Mutual Fund
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text3)'}}>
            Live NAV from mfapi.in — completely free
          </div>
        </div>
      )}
    </div>
  )
}
