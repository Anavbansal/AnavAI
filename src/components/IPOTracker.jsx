import React, { useState, useEffect, useCallback } from 'react'

const API = 'https://api.allorigins.win/raw?url=' // CORS proxy for NSE

// ── Helpers ──────────────────────────────────────────────────────────────────
const f = (n, d=0) => Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:d, maximumFractionDigits:d})
const fc = n => `₹${f(n)}`
const fDate = s => { try { return new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) } catch { return s } }

function Badge({label, color='var(--accent2)', pulse}) {
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',gap:4,
      padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700,
      fontFamily:"'DM Mono',monospace",
      background:`${color}18`,color,border:`1px solid ${color}33`,
    }}>
      {pulse && <span style={{width:6,height:6,borderRadius:'50%',background:color,
        animation:'pulse 1.5s infinite',boxShadow:`0 0 5px ${color}`}}/>}
      {label}
    </span>
  )
}

function StatCard({label, value, sub, color='var(--text)'}) {
  return (
    <div style={{padding:'10px 12px',background:'var(--surface)',
      border:'1px solid var(--border)',borderRadius:8}}>
      <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.8,marginBottom:4,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color}}>{value}</div>
      {sub && <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{sub}</div>}
    </div>
  )
}

// ── IPO Card ─────────────────────────────────────────────────────────────────
function IPOCard({ ipo, expanded, onToggle }) {
  const now = new Date()
  const open  = ipo.openDate  ? new Date(ipo.openDate)  : null
  const close = ipo.closeDate ? new Date(ipo.closeDate) : null
  const allot = ipo.allotDate ? new Date(ipo.allotDate) : null

  const status = !open ? 'upcoming'
    : now < open  ? 'upcoming'
    : now > close ? (allot && now > allot ? 'allotment' : 'closed')
    : 'open'

  const statusConfig = {
    open:      { label:'OPEN',      color:'var(--green)' },
    upcoming:  { label:'UPCOMING',  color:'var(--amber)' },
    closed:    { label:'CLOSED',    color:'var(--text3)' },
    allotment: { label:'ALLOTMENT', color:'var(--accent2)' },
  }
  const sc = statusConfig[status]

  const minInv = ipo.lotSize && ipo.priceHigh
    ? ipo.lotSize * ipo.priceHigh : 0

  const subPct = ipo.subscriptionStatus
  const totalSub = subPct?.total || 0

  return (
    <div style={{background:'var(--surface)',border:`1px solid ${status==='open'?'var(--green)33':'var(--border)'}`,
      borderRadius:10,overflow:'hidden',transition:'border .2s'}}>

      {/* Header row */}
      <div onClick={onToggle} style={{padding:'12px 14px',cursor:'pointer',
        display:'flex',alignItems:'flex-start',gap:10,justifyContent:'space-between'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:5,flexWrap:'wrap'}}>
            <Badge label={sc.label} color={sc.color} pulse={status==='open'}/>
            {ipo.smeIpo && <Badge label="SME" color='var(--amber)'/>}
            {totalSub > 0 && <Badge label={`${f(totalSub,1)}x`} color={totalSub>10?'var(--green)':'var(--text2)'}/>}
          </div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,
            color:'var(--text)',marginBottom:2,lineHeight:1.3}}>
            {ipo.companyName}
          </div>
          <div style={{fontSize:11,color:'var(--text3)',display:'flex',gap:12,flexWrap:'wrap'}}>
            {ipo.priceLow && ipo.priceHigh && (
              <span>💰 {fc(ipo.priceLow)} – {fc(ipo.priceHigh)}</span>
            )}
            {minInv > 0 && <span>Min: {fc(minInv)}</span>}
            {close && <span>📅 Closes {fDate(ipo.closeDate)}</span>}
          </div>
        </div>
        <span style={{fontSize:16,color:'var(--text3)',flexShrink:0,marginTop:2}}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{borderTop:'1px solid var(--border)',padding:'12px 14px',
          display:'flex',flexDirection:'column',gap:12}}>

          {/* Stats grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            <StatCard label="Price Band"
              value={ipo.priceLow ? `${fc(ipo.priceLow)}–${fc(ipo.priceHigh)}` : '–'}
              color='var(--accent2)'/>
            <StatCard label="Lot Size" value={ipo.lotSize ? `${ipo.lotSize} shares` : '–'}/>
            <StatCard label="Min Investment" value={minInv ? fc(minInv) : '–'} color='var(--amber)'/>
            <StatCard label="Open Date"  value={ipo.openDate  ? fDate(ipo.openDate)  : '–'}/>
            <StatCard label="Close Date" value={ipo.closeDate ? fDate(ipo.closeDate) : '–'}/>
            <StatCard label="Allotment"  value={ipo.allotDate ? fDate(ipo.allotDate) : '–'}/>
          </div>

          {/* Issue size */}
          {ipo.issueSize && (
            <div style={{fontSize:12,color:'var(--text2)'}}>
              Issue Size: <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600,color:'var(--text)'}}>
                {ipo.issueSize}
              </span>
            </div>
          )}

          {/* Subscription status */}
          {subPct && (subPct.qib||subPct.nii||subPct.retail) && (
            <div>
              <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,letterSpacing:.8,
                textTransform:'uppercase',marginBottom:8}}>Subscription Status</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[
                  {k:'QIB',    v:subPct.qib,    color:'var(--accent2)'},
                  {k:'NII/HNI',v:subPct.nii,    color:'var(--amber)'},
                  {k:'Retail', v:subPct.retail,  color:'var(--green)'},
                  {k:'Employee',v:subPct.employee,color:'#a78bfa'},
                  {k:'Total',  v:subPct.total,   color:'var(--text)'},
                ].filter(x=>x.v!=null && x.v>0).map(row=>(
                  <div key={row.k} style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:11,color:'var(--text3)',minWidth:64}}>{row.k}</span>
                    <div style={{flex:1,height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,background:row.color,
                        width:`${Math.min(100, (row.v/Math.max(subPct.total||1,50))*100)}%`}}/>
                    </div>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,
                      fontWeight:700,color:row.color,minWidth:44,textAlign:'right'}}>
                      {f(row.v,2)}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GMP */}
          {ipo.gmp != null && ipo.gmp !== 0 && (
            <div style={{padding:'8px 12px',background:ipo.gmp>0?'#22c55e10':'#ef444410',
              border:`1px solid ${ipo.gmp>0?'#22c55e33':'#ef444433'}`,borderRadius:8}}>
              <span style={{fontSize:11,color:'var(--text3)'}}>Grey Market Premium (GMP): </span>
              <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,
                color:ipo.gmp>0?'var(--green)':'var(--red)',fontSize:13}}>
                {ipo.gmp>0?'+':''}{fc(ipo.gmp)}
              </span>
              {ipo.priceHigh && <span style={{fontSize:11,color:'var(--text3)'}}> ({((ipo.gmp/ipo.priceHigh)*100).toFixed(1)}%)</span>}
              <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>
                ⚠ GMP is unofficial & unregulated — for reference only
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {status === 'open' && <>
              <a href={`https://zerodha.com/ipo/`} target="_blank" rel="noopener noreferrer"
                style={{padding:'8px 14px',borderRadius:7,background:'#387ed1',color:'#fff',
                  fontSize:12,fontWeight:700,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
                🔵 Apply on Zerodha
              </a>
              <a href={`https://groww.in/ipo`} target="_blank" rel="noopener noreferrer"
                style={{padding:'8px 14px',borderRadius:7,background:'#00d09c',color:'#fff',
                  fontSize:12,fontWeight:700,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
                🟢 Apply on Groww
              </a>
              <a href={`https://www.angelone.in/ipo`} target="_blank" rel="noopener noreferrer"
                style={{padding:'8px 14px',borderRadius:7,background:'#f07b24',color:'#fff',
                  fontSize:12,fontWeight:700,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
                🟠 Angel One
              </a>
            </>}
            {(status==='closed'||status==='allotment') && ipo.registrar && (
              <a href={allotmentLink(ipo.registrar)} target="_blank" rel="noopener noreferrer"
                style={{padding:'8px 14px',borderRadius:7,background:'var(--accent)',color:'#fff',
                  fontSize:12,fontWeight:700,textDecoration:'none'}}>
                🔍 Check Allotment ({ipo.registrar})
              </a>
            )}
            <a href={`https://www.nseindia.com/market-data/all-upcoming-issues-ipo`}
              target="_blank" rel="noopener noreferrer"
              style={{padding:'8px 14px',borderRadius:7,border:'1px solid var(--border)',
                color:'var(--text2)',fontSize:12,fontWeight:600,textDecoration:'none'}}>
              📋 NSE Details
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function allotmentLink(registrar='') {
  const r = registrar.toLowerCase()
  if (r.includes('kfin') || r.includes('karvy'))
    return 'https://ipostatus.kfintech.com/'
  if (r.includes('link intime') || r.includes('linkintime'))
    return 'https://linkintime.co.in/MIPO/Ipoallotment.html'
  if (r.includes('bigshare'))
    return 'https://www.bigshareonline.com/IPO_Allotment.aspx'
  if (r.includes('mcs') || r.includes('maheshwari'))
    return 'https://www.mcsregistrars.com/'
  return 'https://www.bseindia.com/investors/appli_check.aspx'
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function IPOTracker() {
  const [ipos,      setIpos]    = useState([])
  const [loading,   setLoading] = useState(true)
  const [error,     setError]   = useState(null)
  const [expanded,  setExpanded]= useState(null)
  const [tab,       setTab]     = useState('open') // open | upcoming | recent

  const fetchIPOs = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // NSE India IPO data
      const nseUrl = 'https://www.nseindia.com/api/allIpo'
      const res = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(nseUrl)}`,
        { headers: { 'Accept': 'application/json' } }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // NSE returns: { upcoming:[], openIpos:[], closedIpos:[] }
      const transform = (arr=[], status) => (arr||[]).map(d => ({
        companyName:  d.companyName || d.name || 'Unknown',
        symbol:       d.symbol || '',
        openDate:     d.bidOpenDate  || d.openDate,
        closeDate:    d.bidCloseDate || d.closeDate,
        allotDate:    d.tentativeAllotDate || d.allotmentDate,
        listingDate:  d.listingDate,
        priceLow:     parseFloat(d.minPrice || d.priceLow  || 0) || null,
        priceHigh:    parseFloat(d.maxPrice || d.priceHigh || 0) || null,
        lotSize:      parseInt(d.lotSize || 0) || null,
        issueSize:    d.issueSize || d.issueSizeInCrores ? `₹${d.issueSizeInCrores || d.issueSize} Cr` : null,
        registrar:    d.registrarName || d.registrar || '',
        smeIpo:       d.smeIpo || false,
        subscriptionStatus: d.subscriptionStatus ? {
          qib:      parseFloat(d.subscriptionStatus.qib    || 0),
          nii:      parseFloat(d.subscriptionStatus.nii    || 0),
          retail:   parseFloat(d.subscriptionStatus.retail || 0),
          employee: parseFloat(d.subscriptionStatus.employee || 0),
          total:    parseFloat(d.subscriptionStatus.total  || 0),
        } : null,
        gmp: null, // GMP needs separate source
        _status: status,
      }))

      const all = [
        ...transform(data.openIpos,     'open'),
        ...transform(data.upcoming,     'upcoming'),
        ...transform(data.closedIpos,   'closed'),
      ]
      setIpos(all)
    } catch(e) {
      // Fallback — use hardcoded sample if NSE blocked
      setError('NSE API unavailable — showing cached data')
      setIpos(FALLBACK_IPOS)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchIPOs() }, [fetchIPOs])

  const filtered = ipos.filter(i => {
    if (tab === 'open')     return i._status === 'open'
    if (tab === 'upcoming') return i._status === 'upcoming'
    if (tab === 'recent')   return i._status === 'closed'
    return true
  })

  const openCount     = ipos.filter(i=>i._status==='open').length
  const upcomingCount = ipos.filter(i=>i._status==='upcoming').length

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
        background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px'}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:'var(--text)',
            display:'flex',alignItems:'center',gap:8}}>
            🚀 IPO Tracker
            {openCount > 0 && (
              <span style={{padding:'2px 8px',borderRadius:20,background:'#22c55e20',
                color:'var(--green)',fontSize:11,fontWeight:700}}>
                {openCount} Open Now
              </span>
            )}
          </div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
            NSE India · Live subscription data · Apply links
          </div>
        </div>
        <button onClick={fetchIPOs} disabled={loading}
          style={{marginLeft:'auto',padding:'6px 14px',borderRadius:7,border:'1px solid var(--border)',
            background:'transparent',color:'var(--text2)',cursor:'pointer',fontSize:12,fontWeight:600}}>
          {loading ? '⟳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:4,background:'var(--bg2)',border:'1px solid var(--border)',
        borderRadius:8,padding:3}}>
        {[
          {id:'open',     label:`🟢 Open Now (${openCount})`},
          {id:'upcoming', label:`🟡 Upcoming (${upcomingCount})`},
          {id:'recent',   label:'⚪ Recently Closed'},
          {id:'all',      label:`📋 All (${ipos.length})`},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:'7px 4px',borderRadius:6,border:'none',cursor:'pointer',
            fontSize:11,fontWeight:600,transition:'all .15s',textAlign:'center',
            background:tab===t.id?'var(--accent)':'transparent',
            color:tab===t.id?'#fff':'var(--text3)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{padding:'8px 14px',background:'#f59e0b15',border:'1px solid #f59e0b33',
          borderRadius:8,fontSize:12,color:'var(--amber)'}}>
          ⚠ {error}
        </div>
      )}

      {/* IPO list */}
      {loading ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,
          padding:40,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
          <div style={{width:20,height:20,borderRadius:'50%',border:'2px solid var(--border)',
            borderTopColor:'var(--accent)',animation:'spin 1s linear infinite'}}/>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text3)'}}>
            Fetching IPO data from NSE...
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:'center',padding:'32px 16px',
          background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
          <div style={{fontSize:32,marginBottom:8,opacity:.3}}>🚀</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:'var(--text3)'}}>
            {tab==='open' ? 'No IPOs open right now' :
             tab==='upcoming' ? 'No upcoming IPOs found' : 'No recent IPOs'}
          </div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map((ipo,i) => (
            <IPOCard
              key={i}
              ipo={ipo}
              expanded={expanded===i}
              onToggle={()=>setExpanded(expanded===i?null:i)}
            />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div style={{fontSize:10,color:'var(--text3)',padding:'8px 12px',
        background:'var(--bg2)',borderRadius:8,lineHeight:1.6}}>
        ℹ IPO applications can only be made through your broker (Zerodha, Groww, Angel One etc.) via ASBA/UPI. 
        AnavAI provides tracking & information only — not financial advice.
        GMP (Grey Market Premium) is unofficial and unregulated.
      </div>
    </div>
  )
}

// ── Fallback data (when NSE API blocked) ─────────────────────────────────────
const FALLBACK_IPOS = [
  {
    companyName: 'NSE API Temporarily Unavailable',
    openDate: null, closeDate: null, allotDate: null,
    priceLow: null, priceHigh: null, lotSize: null,
    issueSize: null, registrar: '', smeIpo: false,
    subscriptionStatus: null, gmp: null,
    _status: 'upcoming',
  }
]
