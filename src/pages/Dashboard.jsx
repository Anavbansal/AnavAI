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
  { id:'overview',  label:'Overview',     icon:'📊' },
  { id:'intraday',  label:'Intraday',     icon:'⚡' },
  { id:'delivery',  label:'Delivery',     icon:'📦' },
  { id:'fogreeks',  label:'F&O Greeks',   icon:'⚙' },
  { id:'portfolio', label:'Portfolio',    icon:'💼' },
  { id:'mf',        label:'Mutual Funds', icon:'🏦' },
]

const TAB_MODE = { overview:'tech', intraday:'intraday', delivery:'delivery', fogreeks:'fo', portfolio:'tech', mf:'tech' }

export default function Dashboard() {
  const [tab, setTab] = useState('overview')
  const { data, ai, loading, error, analyze } = useAnalysis()
  const [symbol, setSymbol] = useState('NIFTY')
  const [curSym, setCurSym] = useState('NIFTY')
  const [curTf, setCurTf]   = useState('5')

  useEffect(() => { analyze('NIFTY', '5', 'tech') }, [])

  function handleTabChange(t) {
    setTab(t)
    if (['portfolio','mf'].includes(t)) return
    const mode = TAB_MODE[t] || 'tech'
    const tf   = t==='delivery' ? 'D' : curTf
    analyze(curSym, tf, mode)
  }

  function handleAnalyze(sym, tf) {
    const s = typeof sym==='string' ? sym : (sym?.symbol||'NIFTY')
    setSymbol(s); setCurSym(sym); setCurTf(tf)
    const mode = TAB_MODE[tab] || 'tech'
    analyze(sym, tab==='delivery'?'D':tf, mode)
  }

  function handleTfChange(resolution) {
    setCurTf(resolution)
    const mode = TAB_MODE[tab] || 'tech'
    // Re-analyze with new timeframe resolution
    if (curSym) analyze(curSym, resolution, mode)
  }

  function handleSelectSymbol(s) {
    setSymbol(s); setCurSym(s)
    analyze(s,'5','tech')
    setTab('overview')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const instKey = data?.instrumentKey || ''

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'#0b0f19'}}>
      <Header/>

      <main style={{flex:1,padding:'16px 20px',display:'flex',flexDirection:'column',gap:14,maxWidth:1600,margin:'0 auto',width:'100%'}}>
        {/* Search */}
        <SearchBar onAnalyze={handleAnalyze} loading={loading}/>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,background:'#111827',borderRadius:10,padding:4,width:'fit-content',border:'1px solid #1f2d45'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>handleTabChange(t.id)}
              className={`tab-btn ${tab===t.id?'active':''}`}
              style={{fontSize:13,padding:'6px 14px',display:'flex',alignItems:'center',gap:5}}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{padding:'10px 14px',background:'#7f1d1d20',border:'1px solid #ef444433',borderRadius:8,color:'#ef4444',fontSize:13}}>
            ⚠ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'20px',background:'#151c2c',borderRadius:12,border:'1px solid #1f2d45'}}>
            <div className="animate-spin" style={{width:24,height:24,border:'3px solid #1f2d45',borderTopColor:'#6366f1',borderRadius:'50%',flexShrink:0}}/>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:'#f1f5f9'}}>Analyzing {symbol}...</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:2}}>Fetching real-time data and running AI analysis</div>
            </div>
          </div>
        )}

        {/* OVERVIEW */}
        {tab==='overview' && !loading && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gap:14,gridTemplateColumns:'320px 1fr'}}>
              <PricePanel data={data} ai={ai} loading={loading}/>
              <CandleChart data={data} ai={ai} onTfChange={handleTfChange}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <AIInsights ai={ai} data={data} loading={loading}/>
              <NewsPanel symbol={symbol} instrumentKey={instKey} news={data?.latestNews}/>
            </div>
            <CompanyFundamentals symbol={data?.symbol||symbol} instrumentKey={instKey}/>
          </div>
        )}

        {/* INTRADAY */}
        {tab==='intraday' && !loading && (
          <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:14}}>
            <Intraday data={data} ai={ai}/>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <CandleChart data={data} ai={ai} onTfChange={handleTfChange}/>
              <AIInsights ai={ai} data={data} loading={loading}/>
            </div>
          </div>
        )}

        {/* DELIVERY */}
        {tab==='delivery' && !loading && (
          <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:14}}>
            <Delivery data={data} ai={ai}/>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <CandleChart data={data} ai={ai} onTfChange={handleTfChange}/>
              <NewsPanel symbol={symbol} instrumentKey={instKey} news={data?.latestNews}/>
            </div>
          </div>
        )}

        {/* F&O */}
        {tab==='fogreeks' && !loading && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <FOGreeks data={data}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <AIInsights ai={ai} data={data} loading={loading}/>
              <PricePanel data={data} ai={ai}/>
            </div>
          </div>
        )}

        {tab==='portfolio' && <Portfolio onSelectSymbol={handleSelectSymbol}/>}
        {tab==='mf' && <MutualFunds/>}
      </main>

      <AIAssistant data={data} ai={ai}/>

      <footer style={{textAlign:'center',padding:'12px',borderTop:'1px solid #1f2d45',fontSize:11,color:'#334155',background:'#0e1420'}}>
        ⚠ For personal educational use only · Not SEBI investment advice · Trade at your own risk
      </footer>
    </div>
  )
}
