import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const r2  = n => Math.round(n * 100) / 100
const fc  = n => `₹${Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`
const pct = (a,b) => b ? ((a-b)/b*100) : 0

const MF_STORAGE_KEY    = 'anavai_mf_portfolio'
const MF_SEEDED_KEY     = 'anavai_mf_seeded_v1'   // bump to re-seed

// Stable key for navMap — prefer ISIN, fallback to schemeName
const navKey = f => f.isin || f.schemeName

// ── Pre-loaded funds from user's CAS PDF (Oct 2026) ──────────────────────────
// schemeCode resolved lazily on Render via mfapi.in; left blank here so
// the live backend resolves and caches them on first NAV fetch.
const CAS_SEED_FUNDS = [
  {
    schemeCode:  '152406',
    schemeName:  'Bajaj Finserv Large & Mid Cap Fund - Regular Plan - Growth',
    isin:        'INF0QA701730',
    folio:       '7773657665',
    amc:         'Bajaj Finserv Mutual Fund',
    units:       7323.253,
    avgNav:      11.88,
    costValue:   87000,
    addedAt:     1728000000000,
  },
  {
    schemeCode:  '',
    schemeName:  'Bandhan Mid Cap Fund - Regular Plan - Growth',
    isin:        'INF194KB1DM6',
    folio:       '4263637',
    amc:         'Bandhan Mutual Fund',
    units:       3099.683,
    avgNav:      16.454,
    costValue:   51000,
    addedAt:     1728000000000,
  },
  {
    schemeCode:  '',
    schemeName:  'Invesco India Financial Services Fund - Regular Plan Growth',
    isin:        'INF205K01155',
    folio:       '31014963355',
    amc:         'Invesco Mutual Fund',
    units:       1247.049,
    avgNav:      106.25,
    costValue:   132500,
    addedAt:     1728000000000,
  },
  {
    schemeCode:  '',
    schemeName:  'Invesco India Small Cap Fund - Regular Plan Growth',
    isin:        'INF205K011T7',
    folio:       '31042334532',
    amc:         'Invesco Mutual Fund',
    units:       314.488,
    avgNav:      44.52,
    costValue:   14000,
    addedAt:     1728000000000,
  },
  {
    schemeCode:  '',
    schemeName:  'Mahindra Manulife Flexi Cap Fund - Regular - Growth',
    isin:        'INF174V01AP8',
    folio:       '1000543712',
    amc:         'Mahindra Manulife Mutual Fund',
    units:       9979.966,
    avgNav:      13.277,
    costValue:   132500,
    addedAt:     1728000000000,
  },
  {
    schemeCode:  '',
    schemeName:  'Mirae Asset Multicap Fund - Regular Plan - Growth',
    isin:        'INF769K01KH4',
    folio:       '77780532686',
    amc:         'Mirae Asset Mutual Fund',
    units:       3791.603,
    avgNav:      14.243,
    costValue:   54000,
    addedAt:     1728000000000,
  },
]

function loadPortfolio() {
  try {
    const existing = JSON.parse(localStorage.getItem(MF_STORAGE_KEY) || '[]')
    // Seed once if never seeded and portfolio is empty
    if (!localStorage.getItem(MF_SEEDED_KEY) && existing.length === 0) {
      localStorage.setItem(MF_STORAGE_KEY, JSON.stringify(CAS_SEED_FUNDS))
      localStorage.setItem(MF_SEEDED_KEY, '1')
      return CAS_SEED_FUNDS
    }
    return existing
  } catch { return [] }
}
function savePortfolio(data) {
  localStorage.setItem(MF_STORAGE_KEY, JSON.stringify(data))
}

// Simple SVG line chart
function SimpleChart({ data }) {
  const [hover, setHover] = useState(null)
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
  const labels = data.filter((_,i) => i===0||i===data.length-1||i%30===0)
    .map((d) => { const i=data.indexOf(d); return {x:xS(i),label:d.date?.slice(0,7)||''} })
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
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ng)"/>
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="1.5"/>
      {labels.map((l,i)=>(
        <text key={i} x={l.x} y={h-6} fill="var(--text3)" fontSize="9" textAnchor="middle">{l.label}</text>
      ))}
      <text x={pad.l-4} y={pad.t+4} fill="var(--text3)" fontSize="9" textAnchor="end">{maxV.toFixed(0)}</text>
      <text x={pad.l-4} y={h-pad.b} fill="var(--text3)" fontSize="9" textAnchor="end">{minV.toFixed(0)}</text>
      {hover && <>
        <line x1={hover.x} y1={pad.t} x2={hover.x} y2={h-pad.b} stroke="#6366f188" strokeWidth="1" strokeDasharray="3,3"/>
        <circle cx={hover.x} cy={hover.y} r="4" fill="#6366f1" stroke="#fff" strokeWidth="1.5"/>
        <rect x={Math.min(hover.x+6,w-110)} y={hover.y-22} width={105} height={20} rx="4" fill="#0e1420" stroke="#1f2d45"/>
        <text x={Math.min(hover.x+10,w-106)} y={hover.y-8} fill="#e2e8f0" fontSize="10" fontFamily="monospace">
          {hover.d.date}: ₹{hover.d.nav.toFixed(4)}
        </text>
      </>}
    </svg>
  )
}

// ── CAS Upload Modal ──────────────────────────────────────────────────────────
function CASUploadModal({ onImport, onClose }) {
  const [file,     setFile]     = useState(null)
  const [pan,      setPan]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState({}) // schemeCode/idx → bool

  async function parse() {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('cas', file)
      if (pan.trim()) form.append('pan', pan.trim().toUpperCase())
      const res  = await fetch(`${API_BASE_URL}/api/mf/parse-cas`, { method:'POST', body:form })
      const data = await res.json()
      if (data.status === 'success' && data.funds?.length > 0) {
        setResult(data.funds)
        const sel = {}
        data.funds.forEach((f,i) => { sel[i] = true })
        setSelected(sel)
      } else {
        setError(data.error || 'Koi funds nahi mila PDF mein')
      }
    } catch(e) {
      setError('Parse failed: ' + e.message)
    }
    setLoading(false)
  }

  function importSelected() {
    if (!result) return
    const toImport = result.filter((_,i) => selected[i])
    onImport(toImport)
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:9999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,
        width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',padding:24}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:'var(--text)'}}>
              📄 Import from CAS PDF
            </div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
              CAMS / KFintech Consolidated Account Statement
            </div>
          </div>
          <button onClick={onClose} style={{background:'var(--bg2)',border:'none',color:'var(--text3)',
            cursor:'pointer',fontSize:18,width:32,height:32,borderRadius:8}}>×</button>
        </div>

        {/* How to get CAS */}
        <div style={{padding:'10px 12px',background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',
          borderRadius:8,marginBottom:16,fontSize:11,color:'var(--text2)'}}>
          <div style={{fontWeight:700,marginBottom:4}}>📥 CAS PDF kaise milega?</div>
          <div>1. <a href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement"
            target="_blank" rel="noopener noreferrer" style={{color:'var(--accent)'}}>camsonline.com</a> pe jao</div>
          <div>2. Statement Type → <b>Detailed</b> select karo</div>
          <div>3. Email pe PDF aayega (password = PAN number uppercase)</div>
          <div style={{marginTop:4,color:'var(--text3)'}}>Ya MF Central → Statements → CAS</div>
        </div>

        {!result ? (<>
          {/* File upload */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:6,fontWeight:600}}>CAS PDF FILE</div>
            <label style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
              background:'var(--bg2)',border:`2px dashed ${file?'var(--accent)':'var(--border)'}`,
              borderRadius:10,cursor:'pointer',transition:'border .2s'}}>
              <span style={{fontSize:20}}>📄</span>
              <span style={{fontSize:12,color:file?'var(--text)':'var(--text3)'}}>
                {file ? file.name : 'Click karo ya PDF drop karo'}
              </span>
              <input type="file" accept=".pdf" style={{display:'none'}}
                onChange={e=>setFile(e.target.files[0])}/>
            </label>
          </div>

          {/* PAN (optional — for password) */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:6,fontWeight:600}}>
              PAN NUMBER <span style={{fontWeight:400}}>(PDF password ke liye)</span>
            </div>
            <input value={pan} onChange={e=>setPan(e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE1234F"
              style={{width:'100%',background:'var(--bg2)',border:'1px solid var(--border)',
                borderRadius:8,color:'var(--text)',padding:'9px 12px',fontSize:13,
                outline:'none',boxSizing:'border-box',fontFamily:"'DM Mono',monospace"}}/>
          </div>

          {error && <div style={{padding:'8px 12px',background:'rgba(239,68,68,0.1)',
            border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,fontSize:12,
            color:'#ef4444',marginBottom:12}}>{error}</div>}

          <button onClick={parse} disabled={!file||loading}
            style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:'pointer',
              background:(!file||loading)?'var(--border)':'var(--accent)',
              color:'#fff',fontWeight:700,fontSize:14,opacity:(!file||loading)?0.6:1}}>
            {loading ? '⟳ Parsing PDF...' : '🔍 Parse & Import Funds'}
          </button>
        </>) : (<>
          {/* Results */}
          <div style={{marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:8}}>
              ✅ {result.length} funds mila — select karo jo add karne hain:
            </div>
            <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',maxHeight:320,overflowY:'auto'}}>
              {result.map((f,i) => (
                <div key={i} onClick={()=>setSelected(p=>({...p,[i]:!p[i]}))}
                  style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',
                    borderBottom:'1px solid var(--border)',cursor:'pointer',
                    background:selected[i]?'rgba(99,102,241,0.06)':'transparent',
                    transition:'background .15s'}}>
                  <div style={{width:18,height:18,borderRadius:4,marginTop:1,flexShrink:0,
                    background:selected[i]?'var(--accent)':'var(--bg2)',
                    border:`2px solid ${selected[i]?'var(--accent)':'var(--border)'}`,
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {selected[i] && <span style={{color:'#fff',fontSize:11}}>✓</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text)',lineHeight:1.3}}>
                      {f.schemeName}
                    </div>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:2,fontFamily:"'DM Mono',monospace"}}>
                      {f.isin && `ISIN: ${f.isin} · `}
                      {f.units > 0 && `Units: ${f.units}`}
                      {f.avgNav > 0 && ` · Avg NAV: ₹${f.avgNav}`}
                      {f.amc && ` · ${f.amc}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setResult(null)}
              style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--border)',
                background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:12}}>
              ← Back
            </button>
            <button onClick={importSelected}
              disabled={!Object.values(selected).some(Boolean)}
              style={{flex:2,padding:'10px',borderRadius:8,border:'none',cursor:'pointer',
                background:'var(--accent)',color:'#fff',fontWeight:700,fontSize:13}}>
              ✅ {Object.values(selected).filter(Boolean).length} Funds Import Karo
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}

// ── Add Fund Modal ────────────────────────────────────────────────────────────
function AddFundModal({ onAdd, onClose }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [chosen,  setChosen]  = useState(null)
  const [units,   setUnits]   = useState('')
  const [avgNav,  setAvgNav]  = useState('')
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE_URL}/api/mf/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0,20) : [])
    } catch { setResults([]) }
    setLoading(false)
  }

  function choose(fund) {
    setChosen(fund)
    setResults([])
  }

  async function addFund() {
    if (!chosen || !units || !avgNav) return
    // fetch current NAV
    let currentNav = parseFloat(avgNav)
    try {
      const res  = await fetch(`${API_BASE_URL}/api/mf/nav?code=${chosen.schemeCode}`)
      const data = await res.json()
      const latest = data?.data?.[0]?.nav
      if (latest) currentNav = parseFloat(latest)
    } catch {}
    onAdd({
      schemeCode: chosen.schemeCode,
      schemeName: chosen.schemeName,
      units:      parseFloat(units),
      avgNav:     parseFloat(avgNav),
      addedAt:    Date.now(),
    })
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,
        width:'100%',maxWidth:500,padding:24}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:'var(--text)'}}>
            + Add Mutual Fund
          </span>
          <button onClick={onClose} style={{background:'var(--bg2)',border:'none',color:'var(--text3)',
            cursor:'pointer',fontSize:18,width:32,height:32,borderRadius:8}}>×</button>
        </div>

        {!chosen ? (<>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&search()}
              placeholder="Fund name — e.g. HDFC Mid Cap, Axis Bluechip..."
              style={{flex:1,background:'var(--bg2)',border:'1px solid var(--border)',
                borderRadius:8,color:'var(--text)',padding:'9px 12px',fontSize:13,outline:'none'}}/>
            <button onClick={search} disabled={loading}
              style={{padding:'9px 16px',borderRadius:8,border:'none',cursor:'pointer',
                background:'var(--accent)',color:'#fff',fontWeight:700,fontSize:12}}>
              {loading?'⟳':'Search'}
            </button>
          </div>
          {results.length > 0 && (
            <div style={{border:'1px solid var(--border)',borderRadius:8,maxHeight:260,overflowY:'auto'}}>
              {results.map(r=>(
                <div key={r.schemeCode} onClick={()=>choose(r)}
                  style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer',
                    fontSize:12,color:'var(--text)',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div>{r.schemeName}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>Code: {r.schemeCode}</div>
                </div>
              ))}
            </div>
          )}
        </>) : (<>
          <div style={{padding:'10px 12px',background:'var(--bg2)',borderRadius:8,marginBottom:16,
            fontSize:12,color:'var(--text)'}}>
            <div style={{fontWeight:700,marginBottom:4}}>{chosen.schemeName}</div>
            <div style={{color:'var(--text3)',fontSize:10}}>Code: {chosen.schemeCode}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
            <div>
              <div style={{fontSize:10,color:'var(--text3)',marginBottom:4,fontWeight:600}}>UNITS HELD</div>
              <input type="number" value={units} onChange={e=>setUnits(e.target.value)}
                placeholder="e.g. 250.345"
                style={{width:'100%',background:'var(--bg2)',border:'1px solid var(--border)',
                  borderRadius:8,color:'var(--text)',padding:'9px 12px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:'var(--text3)',marginBottom:4,fontWeight:600}}>AVG BUY NAV (₹)</div>
              <input type="number" value={avgNav} onChange={e=>setAvgNav(e.target.value)}
                placeholder="e.g. 45.23"
                style={{width:'100%',background:'var(--bg2)',border:'1px solid var(--border)',
                  borderRadius:8,color:'var(--text)',padding:'9px 12px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setChosen(null)}
              style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid var(--border)',
                background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:12}}>
              ← Back
            </button>
            <button onClick={addFund} disabled={!units||!avgNav}
              style={{flex:2,padding:'10px',borderRadius:8,border:'none',cursor:'pointer',
                background:(!units||!avgNav)?'var(--border)':'var(--accent)',
                color:'#fff',fontWeight:700,fontSize:13}}>
              Add to Portfolio
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MutualFunds() {
  const [tab,        setTab]        = useState('portfolio') // 'portfolio' | 'search'
  const [portfolio,  setPortfolio]  = useState(loadPortfolio)
  const [navMap,     setNavMap]     = useState({})   // schemeCode → {nav, date, meta}
  const [loadingNav, setLoadingNav] = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const [showCAS,    setShowCAS]    = useState(false)
  const [selected,   setSelected]   = useState(null) // for detail view
  const [aiAnalysis, setAiAnalysis] = useState({})   // navKey → {loading, data}

  // Search tab state
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [searchSel,  setSearchSel]  = useState(null)
  const [navData,    setNavData]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [loadingNAV, setLoadingNAV] = useState(false)

  // Fetch live NAV for all portfolio funds
  useEffect(() => {
    if (portfolio.length === 0) return
    let cancelled = false
    async function resolveCode(fund) {
      if (fund.schemeCode) return fund.schemeCode
      // Try to resolve via backend search (works on Render even if not here)
      try {
        const q   = encodeURIComponent(fund.schemeName.split(' ').slice(0,5).join(' '))
        const res = await fetch(`${API_BASE_URL}/api/mf/search?q=${q}`)
        const arr = await res.json()
        if (arr?.length > 0) {
          const code = String(arr[0].schemeCode)
          // Persist resolved code back to portfolio
          setPortfolio(prev => {
            const updated = prev.map(f =>
              f.isin === fund.isin || f.schemeName === fund.schemeName
                ? { ...f, schemeCode: code }
                : f
            )
            savePortfolio(updated)
            return updated
          })
          return code
        }
      } catch {}
      return null
    }

    async function fetchNavs() {
      setLoadingNav(true)
      for (const fund of portfolio) {
        if (cancelled) break
        try {
          const code = await resolveCode(fund)
          if (!code) continue
          const res  = await fetch(`${API_BASE_URL}/api/mf/nav?code=${code}`)
          const data = await res.json()
          const latest = data?.data?.[0]
          if (latest && !cancelled) {
            const key = fund.isin || fund.schemeName
            setNavMap(prev => ({
              ...prev,
              [key]: {
                nav:  parseFloat(latest.nav),
                date: latest.date,
                meta: data.meta,
                history: data.data?.slice(0,365).reverse().map(d=>({date:d.date,nav:parseFloat(d.nav)})) || [],
              }
            }))
          }
        } catch {}
        if (portfolio.indexOf(fund) < portfolio.length-1) await new Promise(r=>setTimeout(r,300))
      }
      if (!cancelled) setLoadingNav(false)
    }
    fetchNavs()
    return () => { cancelled = true }
  }, [portfolio])

  function addFund(fund) {
    const updated = [...portfolio, fund]
    setPortfolio(updated)
    savePortfolio(updated)
  }

  function importCASFunds(casFunds) {
    const newFunds = casFunds.map(f => ({
      schemeCode: f.schemeCode || '',
      schemeName: f.schemeName,
      isin:       f.isin || '',
      units:      f.units || 0,
      avgNav:     f.avgNav || 0,
      addedAt:    Date.now(),
    }))
    // Merge — don't duplicate by ISIN or name
    const existing = new Set(portfolio.map(p => p.isin || p.schemeName))
    const toAdd = newFunds.filter(f => !existing.has(f.isin || f.schemeName))
    const updated = [...portfolio, ...toAdd]
    setPortfolio(updated)
    savePortfolio(updated)
  }

  function removeFund(key) {
    const updated = portfolio.filter(f => navKey(f) !== key)
    setPortfolio(updated)
    savePortfolio(updated)
    if (selected && navKey(selected) === key) setSelected(null)
  }

  // Portfolio totals
  const totals = portfolio.reduce((acc, f) => {
    const liveNav  = navMap[navKey(f)]?.nav || 0
    const invested = f.units * f.avgNav
    const current  = liveNav > 0 ? f.units * liveNav : invested
    return { invested: acc.invested+invested, current: acc.current+current }
  }, { invested:0, current:0 })
  const totalPnl    = totals.current - totals.invested
  const totalPnlPct = totals.invested > 0 ? totalPnl/totals.invested*100 : 0

  // AI Analysis for a selected fund
  const fetchMFAnalysis = useCallback(async (fund, cagr1, cagr3, cagr5, pnlPct) => {
    const key = navKey(fund)
    if (aiAnalysis[key]?.data || aiAnalysis[key]?.loading) return
    setAiAnalysis(prev => ({ ...prev, [key]: { loading: true } }))
    try {
      const prompt = `You are an expert Indian mutual fund advisor. Analyze this fund and give a concise recommendation.

Fund: ${fund.schemeName}
Category: ${navMap[key]?.meta?.scheme_category || 'Unknown'}
1Y CAGR: ${cagr1 != null ? cagr1.toFixed(2)+'%' : 'N/A'}
3Y CAGR: ${cagr3 != null ? cagr3.toFixed(2)+'%' : 'N/A'}
5Y CAGR: ${cagr5 != null ? cagr5.toFixed(2)+'%' : 'N/A'}
User P&L: ${pnlPct != null ? pnlPct.toFixed(2)+'%' : 'N/A'}

Respond in JSON only (no markdown):
{
  "verdict": "HOLD" | "BUY MORE" | "REVIEW" | "EXIT",
  "holdFor": "e.g. 2-3 more years",
  "riskLevel": "Low" | "Moderate" | "High",
  "summary": "2-3 lines in Hinglish — simple language, practical advice",
  "pros": ["point1","point2"],
  "cons": ["point1","point2"]
}`
      const res = await fetch(`${API_BASE_URL}/api/analyze-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      if (!res.ok) throw new Error('API error')
      const raw = await res.text()
      // Extract JSON from response
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = match ? JSON.parse(match[0]) : null
      setAiAnalysis(prev => ({ ...prev, [key]: { loading: false, data: parsed } }))
    } catch {
      // Fallback local analysis
      const verdict = (cagr1||0) > 12 ? 'HOLD' : (cagr1||0) > 6 ? 'REVIEW' : 'EXIT'
      const holdFor = (cagr5||0) > 12 ? '2-3 more years' : '1 year reassess karo'
      setAiAnalysis(prev => ({ ...prev, [key]: {
        loading: false,
        data: {
          verdict,
          holdFor,
          riskLevel: (fund.schemeName||'').toLowerCase().includes('small') ? 'High' :
                     (fund.schemeName||'').toLowerCase().includes('mid')   ? 'Moderate' : 'Low',
          summary: `Is fund ka 1Y return ${cagr1!=null?cagr1.toFixed(1)+'%':'N/A'} hai. ${verdict==='HOLD'?'Performance theek hai, hold karo.':verdict==='REVIEW'?'Performance average hai, review karo.':'Performance weak hai, exit consider karo.'}`,
          pros: cagr1 > 10 ? ['Good recent returns','Market se better performance'] : ['Diversification'],
          cons: cagr1 < 8  ? ['Below average returns','Better alternatives available'] : ['Market risk']
        }
      }}))
    }
  }, [aiAnalysis, navMap])

  // Search tab
  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE_URL}/api/mf/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0,20) : [])
    } catch { setResults([]) }
    setLoading(false)
  }, [query])

  const selectFund = useCallback(async (fund) => {
    setSearchSel(fund)
    setResults([])
    setLoadingNAV(true)
    try {
      const res  = await fetch(`${API_BASE_URL}/api/mf/nav?code=${fund.schemeCode}`)
      const data = await res.json()
      setNavData(data)
    } catch { setNavData(null) }
    setLoadingNAV(false)
  }, [])

  const chartData = navData?.data?.slice(0,365).reverse().map(d=>({date:d.date,nav:parseFloat(d.nav)})) ?? []
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
      {/* Header + Tabs */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
        background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,flexWrap:'wrap'}}>
        <span style={{fontSize:16}}>🏦</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'var(--text)'}}>Mutual Funds</span>
        <div style={{display:'flex',gap:4,marginLeft:8}}>
          {['portfolio','search'].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:'5px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,
                background: tab===t ? 'var(--accent)' : 'transparent',
                color: tab===t ? '#fff' : 'var(--text3)'}}>
              {t==='portfolio' ? `📊 My Portfolio (${portfolio.length})` : '🔍 Search Funds'}
            </button>
          ))}
        </div>
        <span style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)'}}>
          Live NAV · mfapi.in
        </span>
      </div>

      {/* ── MY PORTFOLIO TAB ── */}
      {tab === 'portfolio' && (<>
        {/* Summary bar */}
        {portfolio.length > 0 && (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            {[
              {l:'Invested',   v: fc(totals.invested),                                    c:'var(--text)'},
              {l:'Current',    v: fc(totals.current),                                     c:'var(--text)'},
              {l:'P&L',        v: `${totalPnl>=0?'+':''}${fc(totalPnl)}`,                c: totalPnl>=0?'#22c55e':'#ef4444'},
              {l:'Return',     v: `${totalPnlPct>=0?'+':''}${r2(totalPnlPct)}%`,         c: totalPnlPct>=0?'#22c55e':'#ef4444'},
            ].map(m=>(
              <div key={m.l} style={{padding:'6px 12px',background:'var(--bg2)',
                border:'1px solid var(--border)',borderRadius:8}}>
                <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.8}}>{m.l}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:13,color:m.c}}>{m.v}</div>
              </div>
            ))}
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              <button onClick={()=>setShowCAS(true)}
                style={{padding:'8px 14px',borderRadius:8,border:'1px solid var(--accent)',cursor:'pointer',
                  background:'transparent',color:'var(--accent)',fontWeight:700,fontSize:12}}>
                📄 CAS Import
              </button>
              <button onClick={()=>setShowAdd(true)}
                style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',
                  background:'var(--accent)',color:'#fff',fontWeight:700,fontSize:12}}>
                + Manual Add
              </button>
            </div>
          </div>
        )}

        {/* Portfolio table */}
        {portfolio.length > 0 ? (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            {/* Header */}
            <div style={{display:'grid',gridTemplateColumns:'2.5fr 0.8fr 1fr 1fr 1.2fr 1.2fr 0.5fr',
              padding:'10px 16px',borderBottom:'1px solid var(--border)',
              fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:.8,
              textTransform:'uppercase',background:'var(--bg2)'}}>
              <span>Fund</span>
              <span style={{textAlign:'right'}}>Units</span>
              <span style={{textAlign:'right'}}>Avg NAV</span>
              <span style={{textAlign:'right'}}>Live NAV</span>
              <span style={{textAlign:'right'}}>Invested</span>
              <span style={{textAlign:'right'}}>P&amp;L</span>
              <span/>
            </div>
            {portfolio.map((fund, idx) => {
              const nav      = navMap[navKey(fund)]
              const liveNav  = nav?.nav || 0
              const invested = fund.units * fund.avgNav
              const current  = liveNav > 0 ? fund.units * liveNav : 0
              const pnlAmt   = current > 0 ? current - invested : 0
              const pnlPct   = pnlAmt !== 0 ? pnlAmt/invested*100 : 0
              const bull     = pnlAmt >= 0
              return (
                <div key={navKey(fund)}
                  style={{display:'grid',gridTemplateColumns:'2.5fr 0.8fr 1fr 1fr 1.2fr 1.2fr 0.5fr',
                    padding:'10px 16px',borderBottom:'1px solid var(--border)',
                    background: idx%2===0?'transparent':'rgba(255,255,255,0.015)',
                    cursor:'pointer',transition:'background .15s'}}
                  onClick={()=>setSelected(selected && navKey(selected)===navKey(fund)?null:fund)}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,0.06)'}
                  onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?'transparent':'rgba(255,255,255,0.015)'}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'var(--text)',lineHeight:1.3}}>
                      {fund.schemeName.length>50?fund.schemeName.slice(0,50)+'…':fund.schemeName}
                    </div>
                    {nav?.date && <div style={{fontSize:9,color:'var(--text3)',marginTop:2}}>NAV as of {nav.date}</div>}
                  </div>
                  <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text2)',alignSelf:'center'}}>{fund.units}</div>
                  <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text2)',alignSelf:'center'}}>₹{r2(fund.avgNav)}</div>
                  <div style={{textAlign:'right',alignSelf:'center'}}>
                    {liveNav>0
                      ? <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,
                          color:liveNav>=fund.avgNav?'#22c55e':'#ef4444'}}>₹{r2(liveNav)}</span>
                      : <span style={{fontSize:11,color:'var(--text3)'}}>loading…</span>}
                  </div>
                  <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text2)',alignSelf:'center'}}>
                    {fc(invested)}
                  </div>
                  <div style={{textAlign:'right',alignSelf:'center'}}>
                    {pnlAmt!==0?(<>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:bull?'#22c55e':'#ef4444'}}>
                        {bull?'+':''}{fc(pnlAmt)}
                      </div>
                      <div style={{fontSize:10,color:bull?'#22c55e':'#ef4444'}}>({bull?'+':''}{r2(pnlPct)}%)</div>
                    </>):<span style={{fontSize:11,color:'var(--text3)'}}>—</span>}
                  </div>
                  <div style={{textAlign:'right',alignSelf:'center'}}>
                    <button onClick={e=>{e.stopPropagation();removeFund(navKey(fund))}}
                      style={{background:'transparent',border:'none',color:'#ef444488',cursor:'pointer',fontSize:14,padding:2}}>
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
            {/* Totals row */}
            <div style={{display:'grid',gridTemplateColumns:'2.5fr 0.8fr 1fr 1fr 1.2fr 1.2fr 0.5fr',
              padding:'12px 16px',background:'var(--bg2)',borderTop:'2px solid var(--border)',fontSize:13,fontWeight:700}}>
              <span style={{color:'var(--text)'}}>TOTAL ({portfolio.length} funds)</span>
              <span/><span/><span/>
              <span style={{textAlign:'right',fontFamily:"'DM Mono',monospace",color:'var(--text)'}}>{fc(totals.invested)}</span>
              <span style={{textAlign:'right',fontFamily:"'DM Mono',monospace",
                color:totalPnl>=0?'#22c55e':'#ef4444'}}>
                {totalPnl!==0?`${totalPnl>=0?'+':''}${fc(totalPnl)}`:'—'}
              </span>
              <span/>
            </div>
          </div>
        ) : (
          <div style={{textAlign:'center',padding:'40px 16px',background:'var(--surface)',
            border:'1px solid var(--border)',borderRadius:10}}>
            <div style={{fontSize:36,marginBottom:12}}>🏦</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:8}}>
              Portfolio empty hai
            </div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:20}}>
              Apne mutual funds add karo — live NAV se real-time P&amp;L dikhega
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
              <button onClick={()=>setShowCAS(true)}
                style={{padding:'10px 24px',borderRadius:10,border:'2px solid var(--accent)',cursor:'pointer',
                  background:'transparent',color:'var(--accent)',fontWeight:700,fontSize:13}}>
                📄 CAS PDF se Import (Recommended)
              </button>
              <button onClick={()=>setShowAdd(true)}
                style={{padding:'10px 20px',borderRadius:10,border:'1px solid var(--border)',cursor:'pointer',
                  background:'var(--bg2)',color:'var(--text3)',fontWeight:600,fontSize:12}}>
                + Manual Add
              </button>
            </div>
          </div>
        )}

        {/* Expanded fund detail with NAV chart + AI Analysis */}
        {selected && (() => {
          const key = navKey(selected)
          const nav = navMap[key]
          const hist = nav?.history || []
          const liveNav  = nav?.nav || 0
          const invested = selected.units * selected.avgNav
          const current  = liveNav > 0 ? selected.units * liveNav : invested
          const pnlPct   = invested > 0 ? (current - invested)/invested*100 : 0
          function histCagr(years) {
            if (hist.length < 2) return null
            const idx = Math.max(0, hist.length - Math.round(years*365))
            const s = hist[idx]?.nav; const e = hist[hist.length-1]?.nav
            if (!s||!e) return null
            return (Math.pow(e/s, 1/years)-1)*100
          }
          const c1=histCagr(1), c3=histCagr(3), c5=histCagr(5)
          const ai = aiAnalysis[key]
          if (!ai && hist.length > 0) fetchMFAnalysis(selected, c1, c3, c5, pnlPct)
          const verdictColor = {
            'HOLD':'#22c55e','BUY MORE':'#6366f1','REVIEW':'#f59e0b','EXIT':'#ef4444'
          }[ai?.data?.verdict] || 'var(--text3)'
          const riskColor = {'Low':'#22c55e','Moderate':'#f59e0b','High':'#ef4444'}[ai?.data?.riskLevel]||'var(--text3)'
          return (
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16,display:'flex',flexDirection:'column',gap:14}}>
              {/* Fund title */}
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:3}}>
                  {selected.schemeName}
                </div>
                <div style={{fontSize:10,color:'var(--text3)'}}>
                  {nav?.meta?.fund_house} · {nav?.meta?.scheme_category}
                </div>
              </div>

              {/* CAGR stats */}
              {hist.length > 0 && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {[
                    {l:'1Y CAGR', v:c1!=null?`${c1.toFixed(1)}%`:'N/A', c:(c1||0)>0?'#22c55e':'#ef4444'},
                    {l:'3Y CAGR', v:c3!=null?`${c3.toFixed(1)}%`:'N/A', c:(c3||0)>0?'#22c55e':'#ef4444'},
                    {l:'5Y CAGR', v:c5!=null?`${c5.toFixed(1)}%`:'N/A', c:(c5||0)>0?'#22c55e':'#ef4444'},
                    {l:'Your P&L', v:`${pnlPct>=0?'+':''}${pnlPct.toFixed(1)}%`, c:pnlPct>=0?'#22c55e':'#ef4444'},
                  ].map(m=>(
                    <div key={m.l} style={{textAlign:'center',padding:'8px 6px',background:'var(--bg2)',borderRadius:8,border:'1px solid var(--border)'}}>
                      <div style={{fontSize:9,color:'var(--text3)',letterSpacing:.7,marginBottom:3}}>{m.l}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:13,color:m.c}}>{m.v}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* NAV Chart */}
              {hist.length > 0 && <SimpleChart data={hist}/>}

              {/* AI Analysis */}
              <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
                <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:.8,marginBottom:10}}>🤖 AI ANALYSIS</div>
                {ai?.loading && (
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 0'}}>
                    <div style={{width:16,height:16,borderRadius:'50%',border:'2px solid var(--border)',
                      borderTopColor:'var(--accent)',animation:'spin 1s linear infinite'}}/>
                    <span style={{fontSize:12,color:'var(--text3)'}}>Fund analyze ho raha hai...</span>
                  </div>
                )}
                {ai?.data && (
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {/* Verdict + Risk + Hold */}
                    <div style={{display:'grid',gridTemplateColumns:'auto auto 1fr',gap:10,alignItems:'center'}}>
                      <div style={{padding:'6px 14px',borderRadius:20,border:`2px solid ${verdictColor}`,
                        color:verdictColor,fontWeight:800,fontSize:13,letterSpacing:.5}}>
                        {ai.data.verdict}
                      </div>
                      <div style={{padding:'4px 10px',borderRadius:12,background:'var(--bg2)',
                        border:'1px solid var(--border)',fontSize:11,color:riskColor,fontWeight:600}}>
                        ⚠️ {ai.data.riskLevel} Risk
                      </div>
                      {ai.data.holdFor && (
                        <div style={{fontSize:11,color:'var(--text3)'}}>
                          🕐 Hold: <span style={{color:'var(--text)',fontWeight:600}}>{ai.data.holdFor}</span>
                        </div>
                      )}
                    </div>
                    {/* Summary */}
                    {ai.data.summary && (
                      <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6,padding:'10px 12px',
                        background:'var(--bg2)',borderRadius:8,borderLeft:'3px solid var(--accent)'}}>
                        {ai.data.summary}
                      </div>
                    )}
                    {/* Pros & Cons */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {ai.data.pros?.length > 0 && (
                        <div style={{padding:'10px 12px',background:'rgba(34,197,94,0.06)',
                          border:'1px solid rgba(34,197,94,0.2)',borderRadius:8}}>
                          <div style={{fontSize:9,fontWeight:700,color:'#22c55e',letterSpacing:.7,marginBottom:6}}>✅ PROS</div>
                          {ai.data.pros.map((p,i)=>(
                            <div key={i} style={{fontSize:11,color:'var(--text2)',marginBottom:3,lineHeight:1.4}}>• {p}</div>
                          ))}
                        </div>
                      )}
                      {ai.data.cons?.length > 0 && (
                        <div style={{padding:'10px 12px',background:'rgba(239,68,68,0.06)',
                          border:'1px solid rgba(239,68,68,0.2)',borderRadius:8}}>
                          <div style={{fontSize:9,fontWeight:700,color:'#ef4444',letterSpacing:.7,marginBottom:6}}>⚠️ CONS</div>
                          {ai.data.cons.map((c,i)=>(
                            <div key={i} style={{fontSize:11,color:'var(--text2)',marginBottom:3,lineHeight:1.4}}>• {c}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Refresh button */}
                    <button onClick={()=>{setAiAnalysis(p=>({...p,[key]:undefined}))}}
                      style={{alignSelf:'flex-end',padding:'4px 12px',borderRadius:6,border:'1px solid var(--border)',
                        background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:11}}>
                      🔄 Re-analyze
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </>)}

      {/* ── SEARCH TAB ── */}
      {tab === 'search' && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:8}}>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&search()}
              placeholder="Fund name — e.g. HDFC Mid Cap, Axis Bluechip, Parag Parikh..."
              style={{flex:1,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,
                color:'var(--text)',padding:'9px 12px',fontSize:13,outline:'none'}}/>
            <button onClick={search} disabled={loading}
              style={{padding:'9px 18px',borderRadius:8,border:'none',cursor:'pointer',
                background:'var(--accent)',color:'#fff',fontWeight:700,fontSize:12,
                opacity:loading?0.6:1}}>
              {loading?'⟳':'🔍 Search'}
            </button>
          </div>

          {results.length > 0 && !searchSel && (
            <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',maxHeight:260,overflowY:'auto'}}>
              {results.map(r=>(
                <div key={r.schemeCode} onClick={()=>selectFund(r)}
                  style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{fontSize:13,color:'var(--text)',marginBottom:2}}>{r.schemeName}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)'}}>Code: {r.schemeCode}</div>
                </div>
              ))}
            </div>
          )}

          {searchSel && (<>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
              padding:'12px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:4}}>
                  {navData?.meta?.scheme_name ?? searchSel.schemeName}
                </div>
                <div style={{fontSize:11,color:'var(--text3)'}}>
                  {navData?.meta?.fund_house} · {navData?.meta?.scheme_category}
                </div>
              </div>
              <button onClick={()=>{setSearchSel(null);setNavData(null);setResults([])}}
                style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',
                  background:'transparent',color:'var(--text3)',cursor:'pointer',fontSize:12}}>
                ✕ Close
              </button>
            </div>

            {loadingNAV && (
              <div style={{display:'flex',alignItems:'center',gap:12,padding:24,justifyContent:'center',
                background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
                <div style={{width:20,height:20,borderRadius:'50%',border:'2px solid var(--border)',
                  borderTopColor:'var(--accent)',animation:'spin 1s linear infinite'}}/>
                <span style={{fontSize:12,color:'var(--text3)'}}>Fetching live NAV...</span>
              </div>
            )}

            {!loadingNAV && chartData.length > 0 && (<>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {[
                  {l:'Current NAV', v:`₹${currentNAV.toFixed(4)}`, c:bull?'#22c55e':'#ef4444'},
                  {l:'1Y CAGR', v:cagr1Y!=null?`${r2(cagr1Y)}%`:'N/A', c:(cagr1Y||0)>0?'#22c55e':'#ef4444'},
                  {l:'3Y CAGR', v:cagr3Y!=null?`${r2(cagr3Y)}%`:'N/A', c:(cagr3Y||0)>0?'#22c55e':'#ef4444'},
                  {l:'5Y CAGR', v:cagr5Y!=null?`${r2(cagr5Y)}%`:'N/A', c:(cagr5Y||0)>0?'#22c55e':'#ef4444'},
                  {l:'Day Change', v:`${navChange>=0?'+':''}${navChange.toFixed(4)}`, c:bull?'#22c55e':'#ef4444'},
                  {l:'Data Points', v:`${chartData.length} days`, c:'var(--text3)'},
                ].map(m=>(
                  <div key={m.l} style={{padding:'10px 12px',background:'var(--surface)',
                    border:'1px solid var(--border)',borderRadius:8,textAlign:'center'}}>
                    <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.8,marginBottom:4}}>{m.l}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,color:m.c}}>{m.v}</div>
                  </div>
                ))}
              </div>
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 8px 4px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'var(--text3)',marginBottom:8,paddingLeft:8}}>
                  NAV History ({chartData.length} days)
                </div>
                <SimpleChart data={chartData}/>
              </div>
            </>)}
          </>)}

          {!searchSel && results.length === 0 && (
            <div style={{textAlign:'center',padding:'32px 16px',background:'var(--surface)',
              border:'1px solid var(--border)',borderRadius:10,opacity:.5}}>
              <div style={{fontSize:32,marginBottom:8}}>🔍</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginBottom:4}}>
                Koi bhi fund search karo
              </div>
              <div style={{fontSize:11,color:'var(--text3)'}}>Live NAV · 1Y/3Y/5Y CAGR · NAV history chart</div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddFundModal onAdd={addFund} onClose={()=>setShowAdd(false)}/>}
      {showCAS && <CASUploadModal onImport={importCASFunds} onClose={()=>setShowCAS(false)}/>}
    </div>
  )
}
