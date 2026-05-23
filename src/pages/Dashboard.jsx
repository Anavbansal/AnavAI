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
  { id: 'overview', label: 'Overview' },
  { id: 'intraday', label: '⚡ Intraday' },
  { id: 'delivery', label: '📦 Delivery' },
  { id: 'fogreeks', label: '⚙ F&O Greeks' },
  { id: 'portfolio', label: '💼 Portfolio' },
  { id: 'mf', label: '🏦 Mutual Funds' },
]

// Map tab id to API mode
const TAB_MODE = {
  overview: 'tech',
  intraday: 'intraday',
  delivery: 'delivery',
  fogreeks: 'fo',
  portfolio: 'tech',
  mf: 'tech',
}

export default function Dashboard() {
  const [tab, setTab] = useState('overview')
  const { data, ai, loading, error, analyze } = useAnalysis()
  const [symbol, setSymbol] = useState('NIFTY')
  const [currentTf, setCurrentTf] = useState('5')
  const [currentSym, setCurrentSym] = useState('NIFTY')

  useEffect(() => {
    analyze('NIFTY', '5', 'tech')
  }, [])

  // Re-fetch with correct mode when tab changes (if we already have a symbol)
  function handleTabChange(newTab) {
    setTab(newTab)
    const mode = TAB_MODE[newTab] || 'tech'
    // Don't re-fetch for portfolio/mf tabs
    if (['portfolio', 'mf'].includes(newTab)) return
    const tf = newTab === 'delivery' ? 'D' : currentTf
    analyze(currentSym, tf, mode)
  }

  function handleAnalyze(sym, tf) {
    const displaySymbol = typeof sym === 'string' ? sym : (sym?.symbol || 'NIFTY')
    setSymbol(displaySymbol)
    setCurrentSym(sym)
    setCurrentTf(tf)
    const mode = TAB_MODE[tab] || 'tech'
    const resolvedTf = tab === 'delivery' ? 'D' : tf
    analyze(sym, resolvedTf, mode)
  }

  function handleSelectSymbol(sym) {
    setSymbol(sym)
    setCurrentSym(sym)
    analyze(sym, '5', 'tech')
    setTab('overview')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ position: 'relative', zIndex: 1 }}>
      <Header />

      <main className="flex-1 p-3 flex flex-col gap-3">
        {/* Search */}
        <SearchBar onAnalyze={handleAnalyze} loading={loading} />

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`font-mono border px-3 py-1.5 transition-all text-xs ${tab === t.id ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted hover:border-accent/50 hover:text-accent/70'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="font-mono text-danger border border-danger px-3 py-2" style={{ background: 'rgba(255,51,102,0.05)', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="panel flex items-center justify-center py-6 gap-4">
            <div className="animate-spin-slow w-8 h-8 rounded-full border-2 border-border" style={{ borderTopColor: '#00d4ff' }} />
            <div className="font-mono text-accent animate-blink" style={{ fontSize: 12, letterSpacing: 2 }}>
              ANALYZING {symbol}...
            </div>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {tab === 'overview' && !loading && (
          <div className="flex flex-col gap-3">
            {/* Top row: price panel + chart */}
            <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(280px,320px) 1fr' }}>
              <PricePanel data={data} ai={ai} />
              <CandleChart data={data} ai={ai} />
            </div>
            {/* Middle row: AI insights + News */}
            <div className="grid grid-cols-2 gap-3">
              <AIInsights ai={ai} loading={loading} />
              <NewsPanel symbol={symbol} news={data?.latestNews} />
            </div>
            {/* Bottom row: Company Fundamentals */}
            <div className="grid grid-cols-1 gap-3">
              <CompanyFundamentals symbol={data?.symbol || symbol} />
            </div>
          </div>
        )}

        {/* INTRADAY TAB */}
        {tab === 'intraday' && !loading && (
          <div className="grid grid-cols-2 gap-3">
            <Intraday data={data} ai={ai} />
            <div className="flex flex-col gap-3">
              <CandleChart data={data} ai={ai} />
              <AIInsights ai={ai} loading={loading} />
            </div>
          </div>
        )}

        {/* DELIVERY TAB */}
        {tab === 'delivery' && !loading && (
          <div className="grid grid-cols-2 gap-3">
            <Delivery data={data} ai={ai} />
            <div className="flex flex-col gap-3">
              <PricePanel data={data} ai={ai} />
              <NewsPanel symbol={symbol} news={data?.latestNews} />
            </div>
          </div>
        )}

        {/* F&O GREEKS TAB */}
        {tab === 'fogreeks' && !loading && (
          <div className="flex flex-col gap-3">
            <FOGreeks data={data} />
            <div className="grid grid-cols-2 gap-3">
              <AIInsights ai={ai} loading={loading} />
              <PricePanel data={data} ai={ai} />
            </div>
          </div>
        )}

        {/* PORTFOLIO TAB */}
        {tab === 'portfolio' && (
          <Portfolio onSelectSymbol={handleSelectSymbol} />
        )}

        {/* MUTUAL FUNDS TAB */}
        {tab === 'mf' && (
          <MutualFunds />
        )}
      </main>

      {/* AI Assistant floating chat */}
      <AIAssistant data={data} ai={ai} />

      {/* Footer */}
      <footer className="text-center font-mono text-dim py-3 border-t border-border" style={{ fontSize: 10, letterSpacing: 1 }}>
        ⚠ FOR EDUCATIONAL USE ONLY · NOT SEBI INVESTMENT ADVICE · PAST PERFORMANCE ≠ FUTURE RESULTS · TRADE AT YOUR OWN RISK
      </footer>
    </div>
  )
}
