import React, { useState } from 'react'
import { searchMutualFunds, getMutualFundNAV } from '../services/marketData'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Mutual Fund Analysis Engine ─────────────────────────────────────────────
function analyzeFund(chartData) {
  if (!chartData || chartData.length < 10) return null
  const len = chartData.length
  const navs = chartData.map(d => d.nav)
  const current = navs[len - 1]

  function cagr(years) {
    const idx = Math.max(0, len - Math.round(years * 365))
    const start = navs[idx]
    if (!start || !current) return null
    return (Math.pow(current / start, 1 / years) - 1) * 100
  }

  // Volatility (annualized std dev of daily returns)
  function volatility(days = 252) {
    const slice = navs.slice(-Math.min(days, len))
    if (slice.length < 5) return null
    const returns = slice.slice(1).map((v, i) => Math.log(v / slice[i]))
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
    return Math.sqrt(variance * 252) * 100
  }

  // Simple moving averages
  function sma(period) {
    const slice = navs.slice(-Math.min(period, len))
    return slice.reduce((a, b) => a + b, 0) / slice.length
  }

  const cagr1y  = cagr(1)
  const cagr3y  = cagr(3)
  const cagr5y  = cagr(5)
  const vol     = volatility()
  const sma50   = sma(50)
  const sma200  = sma(200)
  const trendUp = current > sma50 && sma50 > sma200

  // Drawdown from peak
  const recentPeak = Math.max(...navs.slice(-252))
  const drawdown = recentPeak > 0 ? ((current - recentPeak) / recentPeak) * 100 : 0

  // Consistency: count positive months
  const monthlyReturns = []
  for (let i = 30; i < len; i += 30) {
    const r = (navs[i] - navs[i - 30]) / navs[i - 30] * 100
    monthlyReturns.push(r)
  }
  const posMonths = monthlyReturns.filter(r => r > 0).length
  const consistency = monthlyReturns.length > 0 ? Math.round((posMonths / monthlyReturns.length) * 100) : null

  // ── Buy/Hold/Sell Suggestion ──
  let score = 50
  if (cagr1y !== null) {
    if (cagr1y > 20) score += 15
    else if (cagr1y > 12) score += 8
    else if (cagr1y < 0) score -= 15
    else if (cagr1y < 6) score -= 8
  }
  if (trendUp) score += 12
  else score -= 12
  if (drawdown < -15) score -= 10
  else if (drawdown > -5) score += 5
  if (vol !== null) {
    if (vol > 25) score -= 8
    else if (vol < 12) score += 8
  }
  if (consistency !== null) {
    if (consistency > 65) score += 8
    else if (consistency < 40) score -= 8
  }

  score = Math.max(0, Math.min(100, score))

  let suggestion, suggColor, risk
  if (score >= 65) { suggestion = 'BUY / SIP'; suggColor = '#00ff88'; risk = vol > 20 ? 'HIGH' : 'MODERATE' }
  else if (score <= 35) { suggestion = 'AVOID / EXIT'; suggColor = '#ff3366'; risk = 'HIGH' }
  else { suggestion = 'HOLD / WAIT'; suggColor = '#ffd700'; risk = vol > 20 ? 'MODERATE-HIGH' : 'MODERATE' }

  return {
    cagr1y, cagr3y, cagr5y, vol, sma50, sma200, trendUp,
    drawdown, consistency, score, suggestion, suggColor, risk,
  }
}

export default function MutualFunds() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [navData, setNavData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingNAV, setLoadingNAV] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    const res = await searchMutualFunds(query)
    setResults(res)
    setLoading(false)
  }

  async function selectFund(fund) {
    setSelected(fund)
    setLoadingNAV(true)
    const d = await getMutualFundNAV(fund.schemeCode)
    setNavData(d)
    setLoadingNAV(false)
  }

  const chartData = navData?.data?.slice(0, 365 * 5).reverse().map(d => ({
    date: d.date,
    nav: parseFloat(d.nav),
  })) ?? []

  const currentNAV = chartData[chartData.length - 1]?.nav ?? 0
  const prevNAV = chartData[chartData.length - 2]?.nav ?? currentNAV
  const navChange = currentNAV - prevNAV
  const navChangePct = prevNAV > 0 ? (navChange / prevNAV) * 100 : 0
  const bull = navChange >= 0

  const analysis = analyzeFund(chartData)
  const cagr1Y = analysis?.cagr1y
  const cagr3Y = analysis?.cagr3y

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">🏦 Mutual Funds</div>
        <span className="ml-auto font-mono text-accent" style={{ fontSize: 10 }}>Powered by mfapi.in (Free)</span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Search */}
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search fund name e.g. HDFC Mid Cap, SBI Bluechip..."
            className="flex-1 bg-bg3 border border-border text-gray-200 font-mono text-sm px-3 py-2 outline-none focus:border-accent"
          />
          <button onClick={search} disabled={loading}
            className="btn-accent px-4 py-2 font-display font-bold tracking-widest text-xs">
            {loading ? '⟳' : '🔍 SEARCH'}
          </button>
        </div>

        {/* Search results */}
        {results.length > 0 && !selected && (
          <div className="border border-border overflow-y-auto" style={{ maxHeight: 240 }}>
            {results.map(r => (
              <div key={r.schemeCode} onClick={() => selectFund(r)}
                className="px-3 py-2 border-b border-border/30 last:border-0 cursor-pointer hover:bg-bg3 transition-colors">
                <div className="text-gray-200" style={{ fontSize: 13 }}>{r.schemeName}</div>
                <div className="font-mono text-muted" style={{ fontSize: 10 }}>Code: {r.schemeCode}</div>
              </div>
            ))}
          </div>
        )}

        {/* Fund detail */}
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="text-gray-100 font-semibold leading-snug" style={{ fontSize: 14 }}>
                  {navData?.meta?.scheme_name ?? selected.schemeName}
                </div>
                <div className="font-mono text-muted mt-1" style={{ fontSize: 11 }}>
                  {navData?.meta?.fund_house} · {navData?.meta?.scheme_category}
                </div>
              </div>
              <button onClick={() => { setSelected(null); setNavData(null) }}
                className="font-mono text-dim border border-border px-2 py-0.5 hover:text-danger hover:border-danger transition-colors text-xs">
                ✕ CLOSE
              </button>
            </div>

            {loadingNAV && (
              <div className="flex items-center gap-3 py-6 justify-center">
                <div className="animate-spin-slow w-6 h-6 rounded-full border-2 border-border" style={{ borderTopColor: '#00d4ff' }} />
                <span className="font-mono text-accent animate-blink" style={{ fontSize: 12 }}>FETCHING LIVE NAV...</span>
              </div>
            )}

            {!loadingNAV && chartData.length > 0 && (
              <>
                {/* AI Suggestion Banner */}
                {analysis && (
                  <div style={{
                    background: `${analysis.suggColor}18`,
                    border: `1px solid ${analysis.suggColor}55`,
                    borderRadius: 8, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div className="font-mono" style={{ fontSize: 9, color: '#888', letterSpacing: 2 }}>AI SUGGESTION</div>
                      <div className="font-display font-bold" style={{ fontSize: 18, color: analysis.suggColor, letterSpacing: 2 }}>
                        {analysis.suggestion}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-mono" style={{ fontSize: 9, color: '#888' }}>SCORE</div>
                      <div className="font-display font-bold" style={{ fontSize: 22, color: analysis.suggColor }}>{analysis.score}</div>
                      <div className="font-mono" style={{ fontSize: 9, color: '#888' }}>/100</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-px" style={{ background: '#1a3050' }}>
                  {[
                    { label: 'CURRENT NAV', val: `₹${Number(currentNAV).toFixed(4)}`, color: bull ? '#00ff88' : '#ff3366' },
                    { label: '1Y CAGR', val: cagr1Y != null ? `${cagr1Y.toFixed(2)}%` : 'N/A', color: cagr1Y > 0 ? '#00ff88' : '#ff3366' },
                    { label: '3Y CAGR', val: cagr3Y != null ? `${cagr3Y.toFixed(2)}%` : 'N/A', color: cagr3Y > 0 ? '#00ff88' : '#ff3366' },
                    { label: '5Y CAGR', val: analysis?.cagr5y != null ? `${analysis.cagr5y.toFixed(2)}%` : 'N/A', color: (analysis?.cagr5y ?? 0) > 0 ? '#00ff88' : '#ff3366' },
                    { label: 'VOLATILITY', val: analysis?.vol != null ? `${analysis.vol.toFixed(1)}%` : 'N/A', color: (analysis?.vol ?? 0) < 15 ? '#00ff88' : (analysis?.vol ?? 0) < 25 ? '#ffd700' : '#ff3366' },
                    { label: 'MAX DRAWDOWN', val: analysis?.drawdown != null ? `${analysis.drawdown.toFixed(1)}%` : 'N/A', color: (analysis?.drawdown ?? 0) > -10 ? '#00ff88' : '#ff3366' },
                    { label: 'CONSISTENCY', val: analysis?.consistency != null ? `${analysis.consistency}%` : 'N/A', color: (analysis?.consistency ?? 0) > 60 ? '#00ff88' : '#ffd700' },
                    { label: 'TREND', val: analysis?.trendUp ? 'ABOVE MA' : 'BELOW MA', color: analysis?.trendUp ? '#00ff88' : '#ff3366' },
                    { label: 'RISK LEVEL', val: analysis?.risk || 'N/A', color: analysis?.risk === 'HIGH' ? '#ff3366' : analysis?.risk === 'MODERATE' ? '#ffd700' : '#00ff88' },
                  ].map(m => (
                    <div key={m.label} className="bg-panel p-3 text-center">
                      <div className="font-mono text-dim" style={{ fontSize: 9 }}>{m.label}</div>
                      <div className="font-display font-bold mt-1" style={{ fontSize: 12, color: m.color }}>{m.val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: '#3a5a7a', fontSize: 9 }} tickLine={false} axisLine={false} interval={30} />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip formatter={v => `₹${Number(v).toFixed(4)}`}
                        contentStyle={{ background: '#0a1520', border: '1px solid #1a3050', fontFamily: 'Share Tech Mono', fontSize: 11 }} />
                      <Area type="monotone" dataKey="nav" stroke="#00d4ff" fill="url(#navGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {!selected && results.length === 0 && (
          <div className="text-center py-8 opacity-40">
            <div style={{ fontSize: 32 }}>🏦</div>
            <div className="font-display text-muted text-xs tracking-widest mt-2">SEARCH ANY MUTUAL FUND</div>
            <div className="font-mono text-dim mt-1" style={{ fontSize: 11 }}>Live NAV from mfapi.in (completely free)</div>
          </div>
        )}
      </div>
    </div>
  )
}
