import React, { useState, useEffect, useRef } from 'react'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import PricePanel from '../components/PricePanel'
import { lazy, Suspense } from 'react'

// Always loaded (critical path)
import AIInsights from '../components/AIInsights'
import NewsPanel from '../components/NewsPanel'

// Lazy loaded (heavy components)
const CandleChart        = lazy(() => import('../components/CandleChart'))
const Intraday           = lazy(() => import('../components/Intraday'))
const Delivery           = lazy(() => import('../components/Delivery'))
const FOGreeks           = lazy(() => import('../components/FOGreeks'))
const Portfolio          = lazy(() => import('../components/Portfolio'))
const MutualFunds        = lazy(() => import('../components/MutualFunds'))
const CompanyFundamentals= lazy(() => import('../components/CompanyFundamentals'))
const AIAssistant        = lazy(() => import('../components/AIAssistant'))
const RiskCalculator     = lazy(() => import('../components/RiskCalculator'))
const MarketScanner      = lazy(() => import('../components/MarketScanner'))
const PriceAlerts        = lazy(() => import('../components/PriceAlerts'))
const EconomicCalendar   = lazy(() => import('../components/EconomicCalendar'))
const PersonalFinance    = lazy(() => import('../components/PersonalFinance'))

// Suspense fallback
function TabLoader() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      height:200,gap:12,color:'var(--text3)'}}>
      <div className="anim-spin" style={{width:20,height:20,border:'3px solid var(--border)',
        borderTopColor:'var(--accent)',borderRadius:'50%'}}/>
      <span style={{fontSize:13}}>Loading...</span>
    </div>
  )
}
import { useAnalysis } from '../hooks/useAnalysis'
import { useLivePrice } from '../hooks/useLivePrice'

// Bottom nav tabs (mobile) — keep to 5 max
const MOBILE_TABS = [
  {id:'overview',  label:'Home',    icon:'📊'},
  {id:'intraday',  label:'Intraday',icon:'⚡'},
  {id:'scanner',   label:'Scanner', icon:'📡'},
  {id:'alerts',    label:'Alerts',  icon:'🔔'},
  {id:'portfolio', label:'More',    icon:'☰'},
]

// All tabs for desktop tab bar
const ALL_TABS = [
  {id:'overview',  label:'Overview',    icon:'📊'},
  {id:'intraday',  label:'Intraday',    icon:'⚡'},
  {id:'delivery',  label:'Delivery',    icon:'📦'},
  {id:'fo',        label:'F&O',         icon:'⚙'},
  {id:'scanner',   label:'Scanner',     icon:'📡'},
  {id:'alerts',    label:'Alerts',      icon:'🔔'},
  {id:'calendar',  label:'Calendar',    icon:'📅'},
  {id:'risk',      label:'Risk Calc',   icon:'🎯'},
  {id:'portfolio', label:'Portfolio',   icon:'💼'},
  {id:'mf',        label:'Mutual Funds',icon:'🏦'},
]

const NO_REFETCH = new Set(['portfolio','mf','scanner','alerts','calendar','risk','pf'])
const MODE = {overview:'tech',intraday:'intraday',delivery:'delivery',fo:'fo'}

// Hook: detect mobile
function useIsMobile() {
  const [mob, setMob] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}

export default function Dashboard() {
  const [tab,    setTab]    = useState('overview')
  const [sym,    setSym]    = useState('NIFTY')
  const [curSym, setCurSym] = useState('NIFTY')
  const [curTf,  setCurTf]  = useState('5')
  const [curTfi, setCurTfi] = useState(1) // index in TIMEFRAMES array
  const { data, ai, loading, error, analyze } = useAnalysis()
  // Live WebSocket price for current symbol
  const { priceData: livePriceData, connected: wsConnected } = useLivePrice(sym)
  const isMobile = useIsMobile()
  const [moreOpen, setMoreOpen] = useState(false)

  // Read Upstox token from URL after OAuth redirect
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const token   = params.get('upstox_token')
    const refresh = params.get('upstox_refresh')
    const err     = params.get('upstox_error')
    if (token) {
      localStorage.setItem('upstox_access_token', token)
      if (refresh) localStorage.setItem('upstox_refresh_token', refresh)
      localStorage.setItem('upstox_token_ts', Date.now().toString())
      window.history.replaceState({}, '', '/dashboard')
    }
    if (err) window.history.replaceState({}, '', '/dashboard')
    analyze('NIFTY','5','tech')
  }, [])

  // Close more drawer on tab change
  function changeTab(t) {
    setMoreOpen(false)
    setTab(t)
    if (NO_REFETCH.has(t)) return
    analyze(curSym, t==='delivery'?'D':curTf, MODE[t]||'tech')
  }

  const handleAnalyze = useCallback((input, tf='5') => {
    const s2 = typeof input==='string' ? input : (input?.symbol||'NIFTY')
    setSym(s2); setCurSym(input); setCurTf(tf)
    analyze(input, tab==='delivery'?'D':tf, MODE[tab]||'tech')
  }, [analyze, tab])

  function handleTfChange(tf, tfi) {
    setCurTf(tf)
    if (tfi !== undefined) setCurTfi(tfi)
    analyze(curSym, tf, MODE[tab]||'tech')
  }
  const handleSelectSymbol = useCallback((s) => { setSym(s); setCurSym(s); analyze(s,'5','tech'); setTab('overview'); window.scrollTo({top:0,behavior:'smooth'}) }, [analyze])

  const ikey = data?.instrumentKey || ''
  const G = {gap:12}

  const chart = <CandleChart data={data} ai={ai} onTfChange={handleTfChange} activeTfi={curTfi}/>
  const insights = <AIInsights ai={ai} data={data} loading={loading}/>
  const news = <NewsPanel symbol={sym} instrumentKey={ikey}/>

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)'}}>
      <Header/>

      <main className="main-content" style={{flex:1,padding:'12px 16px',display:'flex',flexDirection:'column',gap:12,maxWidth:1600,margin:'0 auto',width:'100%'}}>

        {/* Search */}
        <SearchBar onAnalyze={handleAnalyze} loading={loading}/>

        {/* Desktop tab bar */}
        {!isMobile && (
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div className="tab-bar">
              {ALL_TABS.map(t=>(
                <button key={t.id} className={`tab-btn ${tab===t.id?'active':''}`}
                  onClick={()=>changeTab(t.id)}
                  style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:13}}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            {data && (
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--text3)',flexShrink:0}}>
                <span style={{fontFamily:"'DM Mono',monospace"}}>{data.symbol}</span>
                <span style={{width:4,height:4,borderRadius:'50%',background:'var(--text3)'}}/>
                <span style={{fontFamily:"'DM Mono',monospace",color:wsConnected?'var(--green)':data.quality?.source==='UPSTOX_LIVE'?'var(--green)':'var(--amber)'}}>
                  {wsConnected?`● Live ₹${livePriceData?.price?.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})||''}`:data.quality?.source==='UPSTOX_LIVE'?'● Live':'● Data'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && <div style={{padding:'10px 14px',background:'#f43f5e10',border:'1px solid #f43f5e33',borderRadius:8,color:'var(--red)',fontSize:13}}>⚠ {error}</div>}

        {/* Loading */}
        {loading && (
          <div style={{display:'flex',alignItems:'center',gap:12,padding:16,background:'var(--surface)',borderRadius:10,border:'1px solid var(--border)'}}>
            <div className="anim-spin" style={{width:20,height:20,border:'3px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Analyzing {sym}…</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>Fetching real-time data and running AI analysis</div>
            </div>
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab==='overview' && !loading && (
          <div style={{display:'flex',flexDirection:'column',...G}}>
            {/* Mobile: chart full width first, then price panel */}
            {isMobile ? (
              <>
                {chart}
                <PricePanel data={data} ai={ai} loading={loading}/>
                {insights}
                {news}
                <CompanyFundamentals symbol={data?.symbol||sym} instrumentKey={ikey}/>
              </>
            ) : (
              <>
                <div style={{display:'grid',gridTemplateColumns:'300px 1fr',...G}}>
                  <PricePanel data={data} ai={ai} loading={loading}/>
                  {chart}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',...G}}>
                  {insights}
                  {news}
                </div>
                <CompanyFundamentals symbol={data?.symbol||sym} instrumentKey={ikey}/>
              </>
            )}
          </div>
        )}

        {/* ── INTRADAY ── */}
        {tab==='intraday' && !loading && (
          isMobile ? (
            <div style={{display:'flex',flexDirection:'column',...G}}>
              {chart}
              <Intraday data={data} ai={ai}/>
              {insights}
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'340px 1fr',...G}}>
              <Intraday data={data} ai={ai}/>
              <div style={{display:'flex',flexDirection:'column',...G}}>{chart}{insights}</div>
            </div>
          )
        )}

        {/* ── DELIVERY ── */}
        {tab==='delivery' && !loading && (
          isMobile ? (
            <div style={{display:'flex',flexDirection:'column',...G}}>
              {chart}
              <Delivery data={data} ai={ai}/>
              {news}
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'340px 1fr',...G}}>
              <Delivery data={data} ai={ai}/>
              <div style={{display:'flex',flexDirection:'column',...G}}>{chart}{news}</div>
            </div>
          )
        )}

        {/* ── F&O ── */}
        {tab==='fo' && !loading && (
          <div style={{display:'flex',flexDirection:'column',...G}}>
            <FOGreeks data={data}/>
            {isMobile ? <>{insights}<PricePanel data={data} ai={ai}/></> : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',...G}}>
                {insights}<PricePanel data={data} ai={ai}/>
              </div>
            )}
          </div>
        )}

        {tab==='scanner'  && <Suspense fallback={<TabLoader/>}><MarketScanner onSelectSymbol={handleSelectSymbol}/></Suspense>}
        {tab==='alerts'   && <Suspense fallback={<TabLoader/>}><PriceAlerts data={data}/></Suspense>}
        {tab==='calendar' && <Suspense fallback={<TabLoader/>}><EconomicCalendar/></Suspense>}
        {tab==='risk'     && <Suspense fallback={<TabLoader/>}><RiskCalculator/></Suspense>}
        {tab==='portfolio'&& <Suspense fallback={<TabLoader/>}><Portfolio onSelectSymbol={handleSelectSymbol}/></Suspense>}
        {tab==='pf'        && <Suspense fallback={<TabLoader/>}><PersonalFinance/></Suspense>}
        {tab==='mf'       && <MutualFunds/>}

      </main>

      {/* ── Mobile bottom navigation ── */}
      {isMobile && (
        <>
          <nav className="mobile-nav">
            {[
              {id:'overview',  label:'Home',    icon:'📊'},
              {id:'intraday',  label:'Intraday',icon:'⚡'},
              {id:'delivery',  label:'Delivery',icon:'📦'},
              {id:'fo',        label:'F&O',     icon:'⚙'},
              {id:'__more__',  label:'More',    icon:'☰'},
            ].map(t=>(
              <button key={t.id}
                className={`mobile-nav-item ${tab===t.id||
                  (t.id==='__more__'&&['scanner','alerts','calendar','risk','portfolio','mf'].includes(tab))
                  ?'active':''}`}
                onClick={()=>{ if(t.id==='__more__') setMoreOpen(o=>!o); else { setMoreOpen(false); changeTab(t.id); } }}>
                <span className="nav-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* More drawer */}
          {moreOpen && (
            <div style={{
              position:'fixed', bottom:58, left:0, right:0, zIndex:499,
              background:'var(--bg2)', borderTop:'1px solid var(--border)',
              padding:'12px 16px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8,
            }}>
              {[
                {id:'scanner',  label:'Scanner',    icon:'📡'},
                {id:'alerts',   label:'Alerts',     icon:'🔔'},
                {id:'calendar', label:'Calendar',   icon:'📅'},
                {id:'risk',     label:'Risk Calc',  icon:'🎯'},
                {id:'portfolio',label:'Portfolio',  icon:'💼'},
                {id:'mf',       label:'MF',         icon:'🏦'},
                {id:'pf',       label:'My Finance', icon:'💼'},
              ].map(t=>(
                <button key={t.id}
                  onClick={()=>{ changeTab(t.id); setMoreOpen(false); }}
                  style={{
                    padding:'10px 6px', borderRadius:8, border:'1px solid var(--border)',
                    background: tab===t.id ? '#5865f220' : 'var(--surface)',
                    color: tab===t.id ? 'var(--accent2)' : 'var(--text2)',
                    cursor:'pointer', display:'flex', flexDirection:'column',
                    alignItems:'center', gap:4, fontSize:11, fontWeight:500,
                    fontFamily:"'DM Sans',sans-serif",
                  }}>
                  <span style={{fontSize:20}}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Suspense fallback={null}><AIAssistant data={data} ai={ai}/></Suspense>

      {/* Mobile: move FAB above bottom nav */}
      <style>{`
        @media (max-width: 768px) {
          .ai-fab { bottom: 70px !important; right: 14px !important; }
          .ai-chat-panel { bottom: 134px !important; right: 8px !important; left: 8px !important; width: auto !important; }
        }
      `}</style>

      {!isMobile && (
        <footer style={{textAlign:'center',padding:'10px',borderTop:'1px solid var(--border)',fontSize:11,color:'var(--text3)',background:'var(--bg2)'}}>
          ⚠ For personal educational use only · Not SEBI investment advice
        </footer>
      )}
    </div>
  )
}
