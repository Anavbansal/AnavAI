import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import PricePanel from '../components/PricePanel'
import CandleChart from '../components/CandleChart'
import AIInsights from '../components/AIInsights'
import Intraday from '../components/Intraday'
import Delivery from '../components/Delivery'
import FOGreeks from '../components/FOGreeks'
import Portfolio from '../components/Portfolio'
import MutualFunds from '../components/MutualFunds'
import NewsPanel from '../components/NewsPanel'
import CompanyFundamentals from '../components/CompanyFundamentals'
import AIAssistant from '../components/AIAssistant'
import { useAnalysis } from '../hooks/useAnalysis'

const TABS = [
  {id:'overview', label:'Overview',    icon:'📊'},
  {id:'intraday', label:'Intraday',    icon:'⚡'},
  {id:'delivery', label:'Delivery',    icon:'📦'},
  {id:'fo',       label:'F&O Greeks',  icon:'⚙'},
  {id:'portfolio',label:'Portfolio',   icon:'💼'},
  {id:'mf',       label:'Mutual Funds',icon:'🏦'},
]

const MODE = {overview:'tech',intraday:'intraday',delivery:'delivery',fo:'fo',portfolio:'tech',mf:'tech'}

export default function Dashboard() {
  const [tab,  setTab]  = useState('overview')
  const [sym,  setSym]  = useState('NIFTY')
  const [curSym, setCurSym] = useState('NIFTY')
  const [curTf,  setCurTf]  = useState('5')
  const { data, ai, loading, error, analyze } = useAnalysis()

  useEffect(() => { analyze('NIFTY','5','tech') }, [])

  function changeTab(t) {
    setTab(t)
    if (['portfolio','mf'].includes(t)) return
    const mode = MODE[t]||'tech'
    const tf   = t==='delivery'?'D':curTf
    analyze(curSym, tf, mode)
  }

  function handleAnalyze(input, tf='5') {
    const s = typeof input==='string' ? input : (input?.symbol||'NIFTY')
    setSym(s); setCurSym(input); setCurTf(tf)
    const mode = MODE[tab]||'tech'
    analyze(input, tab==='delivery'?'D':tf, mode)
  }

  function handleTfChange(tf) {
    setCurTf(tf)
    analyze(curSym, tf, MODE[tab]||'tech')
  }

  function handleSelectSymbol(s) {
    setSym(s); setCurSym(s)
    analyze(s,'5','tech')
    setTab('overview')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const ikey = data?.instrumentKey || ''

  const G = {gap:14}

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)'}}>
      <Header/>

      <main style={{flex:1,padding:'16px 20px',display:'flex',flexDirection:'column',gap:14,maxWidth:1600,margin:'0 auto',width:'100%'}}>

        {/* Search */}
        <SearchBar onAnalyze={handleAnalyze} loading={loading}/>

        {/* Tabs */}
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="tab-bar">
            {TABS.map(t=>(
              <button key={t.id} className={`tab-btn ${tab===t.id?'active':''}`}
                onClick={()=>changeTab(t.id)}
                style={{display:'flex',alignItems:'center',gap:5}}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          {data && (
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--text3)'}}>
              <span style={{fontFamily:"'DM Mono',monospace"}}>{data.symbol}</span>
              <span style={{width:4,height:4,borderRadius:'50%',background:'var(--text3)'}}/>
              <span style={{fontFamily:"'DM Mono',monospace",color:data.quality?.source==='UPSTOX_LIVE'?'var(--green)':'var(--amber)'}}>
                {data.quality?.source==='UPSTOX_LIVE'?'● Live':'● Data'}
              </span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{padding:'10px 14px',background:'#f43f5e10',border:'1px solid #f43f5e33',borderRadius:8,color:'var(--red)',fontSize:13}}>
            ⚠ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{display:'flex',alignItems:'center',gap:12,padding:20,background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)'}}>
            <div className="anim-spin" style={{width:22,height:22,border:'3px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',flexShrink:0}}/>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Analyzing {sym}…</div>
              <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>Fetching real-time data and running AI analysis</div>
            </div>
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab==='overview' && !loading && (
          <div style={{display:'flex',flexDirection:'column',...G}}>
            <div style={{display:'grid',gridTemplateColumns:'300px 1fr',...G}}>
              <PricePanel data={data} ai={ai} loading={loading}/>
              <CandleChart data={data} ai={ai} onTfChange={handleTfChange}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',...G}}>
              <AIInsights ai={ai} data={data} loading={loading}/>
              <NewsPanel symbol={sym} instrumentKey={ikey}/>
            </div>
            <CompanyFundamentals symbol={data?.symbol||sym} instrumentKey={ikey}/>
          </div>
        )}

        {/* ── INTRADAY ── */}
        {tab==='intraday' && !loading && (
          <div style={{display:'grid',gridTemplateColumns:'340px 1fr',...G}}>
            <Intraday data={data} ai={ai}/>
            <div style={{display:'flex',flexDirection:'column',...G}}>
              <CandleChart data={data} ai={ai} onTfChange={handleTfChange}/>
              <AIInsights ai={ai} data={data} loading={loading}/>
            </div>
          </div>
        )}

        {/* ── DELIVERY ── */}
        {tab==='delivery' && !loading && (
          <div style={{display:'grid',gridTemplateColumns:'340px 1fr',...G}}>
            <Delivery data={data} ai={ai}/>
            <div style={{display:'flex',flexDirection:'column',...G}}>
              <CandleChart data={data} ai={ai} onTfChange={handleTfChange}/>
              <NewsPanel symbol={sym} instrumentKey={ikey}/>
            </div>
          </div>
        )}

        {/* ── F&O ── */}
        {tab==='fo' && !loading && (
          <div style={{display:'flex',flexDirection:'column',...G}}>
            <FOGreeks data={data}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',...G}}>
              <AIInsights ai={ai} data={data} loading={loading}/>
              <PricePanel data={data} ai={ai}/>
            </div>
          </div>
        )}

        {tab==='portfolio' && <Portfolio onSelectSymbol={handleSelectSymbol}/>}
        {tab==='mf' && <MutualFunds/>}
      </main>

      <AIAssistant data={data} ai={ai}/>

      <footer style={{textAlign:'center',padding:'12px 20px',borderTop:'1px solid var(--border)',fontSize:11,color:'var(--text3)',background:'var(--bg2)'}}>
        ⚠ For personal educational use only · Not SEBI registered investment advice · Past performance ≠ future results
      </footer>
    </div>
  )
}
