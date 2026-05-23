import React, { useState } from 'react'
import { searchMutualFunds, getMutualFundNAV } from '../services/marketData'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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

  const chartData = navData?.data?.slice(0, 180).reverse().map(d => ({
    date: d.date,
    nav: parseFloat(d.nav),
  })) ?? []

  const currentNAV = chartData[chartData.length - 1]?.nav ?? 0
  const prevNAV = chartData[chartData.length - 2]?.nav ?? currentNAV
  const navChange = currentNAV - prevNAV
  const navChangePct = prevNAV > 0 ? (navChange / prevNAV) * 100 : 0
  const bull = navChange >= 0

  // CAGR calc
  function cagr(data, years) {
    if (data.length < 2) return null
    const idx = Math.max(0, data.length - Math.round(years * 365))
    const startNAV = data[idx]?.nav ?? data[0].nav
    const endNAV = data[data.length - 1]?.nav
    if (!startNAV || !endNAV) return null
    return (Math.pow(endNAV / startNAV, 1 / years) - 1) * 100
  }

  const cagr1Y = cagr(chartData, 1)
  const cagr3Y = cagr(chartData, 3)

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
                <div className="grid grid-cols-3 gap-px" style={{ background: '#1a3050' }}>
                  {[
                    { label: 'CURRENT NAV', val: `₹${Number(currentNAV).toFixed(4)}`, color: bull ? '#00ff88' : '#ff3366' },
                    { label: '1Y CAGR', val: cagr1Y ? `${cagr1Y.toFixed(2)}%` : 'N/A', color: cagr1Y > 0 ? '#00ff88' : '#ff3366' },
                    { label: '3Y CAGR', val: cagr3Y ? `${cagr3Y.toFixed(2)}%` : 'N/A', color: cagr3Y > 0 ? '#00ff88' : '#ff3366' },
                  ].map(m => (
                    <div key={m.label} className="bg-panel p-3 text-center">
                      <div className="font-mono text-dim" style={{ fontSize: 10 }}>{m.label}</div>
                      <div className="font-display font-bold mt-1" style={{ fontSize: 13, color: m.color }}>{m.val}</div>
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
