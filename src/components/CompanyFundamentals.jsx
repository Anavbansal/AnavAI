import React, { useState, useEffect } from 'react'
import { getCompanyFundamentals } from '../lib/api'
import { API_BASE_URL } from '../config'

const RATIO_LABELS = {
  pe_ratio:            'P/E Ratio',
  pb_ratio:            'P/B Ratio',
  dividend_yield:      'Div Yield %',
  roe:                 'ROE %',
  roce:                'ROCE %',
  eps:                 'EPS (₹)',
  debt_to_equity:      'Debt/Equity',
  book_value_per_share:'Book Value',
  market_cap:          'Mkt Cap',
  sector_pe:           'Sector P/E',
  face_value:          'Face Value',
  week52High:          '52W High',
  week52Low:           '52W Low',
}

function fmt(key, val) {
  if (val == null || val === '') return '—'
  if (typeof val !== 'number') return String(val)
  if (key === 'market_cap') return `₹${(val / 1e7).toFixed(2)} Cr`
  if (key.includes('yield') || key.includes('roe') || key.includes('roce')) return `${val.toFixed(2)}%`
  if (key.includes('eps') || key.includes('value') || key.includes('High') || key.includes('Low')) return `₹${val.toFixed(2)}`
  return val.toFixed(2)
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      padding: '8px 10px', border: '1px solid #162030',
      background: '#060d14', borderRadius: 4,
    }}>
      <div style={{ fontFamily: 'Share Tech Mono, monospace', color: '#2a4a6a', fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, color: accent || '#cce0f5' }}>
        {value}
      </div>
    </div>
  )
}

export default function CompanyFundamentals({ symbol, instrumentKey }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!symbol && !instrumentKey) return
    let isMounted = true
    setLoading(true); setError(null); setData(null)

    async function load() {
      try {
        const token = localStorage.getItem('upstox_access_token') || ''
        // Extract clean symbol from instrument key if needed
        const sym = symbol || (instrumentKey || '').split('|').pop()?.replace(/\+/g,' ').trim() || ''

        const params = new URLSearchParams({ symbol: sym })
        if (instrumentKey) params.set('isin', instrumentKey)

        const res = await fetch(`${API_BASE_URL}/fundamentals?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        const json = await res.json()

        if (isMounted) {
          if (json?.status === 'success' && json?.data) setData(json.data)
          else setError(json?.message || 'Data unavailable')
        }
      } catch (e) {
        if (isMounted) setError(e.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [symbol, instrumentKey])

  if (!symbol && !instrumentKey) return (
    <div className="panel" style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, flexDirection:'column', gap:10 }}>
      <div style={{ fontSize: 36, opacity: 0.15 }}>🏢</div>
      <div className="font-mono" style={{ color:'#2a4a6a', fontSize:11, letterSpacing:3 }}>FUNDAMENTALS IDLE</div>
      <div className="font-mono" style={{ color:'#2a4a6a', fontSize:10 }}>Search and analyze a stock first</div>
    </div>
  )

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">🏢 Company Fundamentals</div>
        <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono', color:'#00cfff', fontSize:10 }}>
          {data?.sector || 'NSE · BSE'}
        </span>
      </div>

      <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:14 }}>

        {loading && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, padding:24 }}>
            <div className="spinner" style={{ width:16, height:16, borderWidth:2 }} />
            <span className="font-mono" style={{ color:'#00cfff', fontSize:11 }}>FETCHING FUNDAMENTALS...</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign:'center', padding:16, color:'#ff3366', fontFamily:'Share Tech Mono', fontSize:11 }}>
            ⚠ {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Company header */}
            <div style={{ borderBottom:'1px solid #162030', paddingBottom:12 }}>
              <div style={{ fontFamily:'Rajdhani, sans-serif', fontWeight:900, fontSize:18, color:'#cce0f5', letterSpacing:1 }}>
                {data.company_name || symbol}
              </div>
              <div style={{ fontFamily:'Share Tech Mono', color:'#7aa8c8', fontSize:11, marginTop:4 }}>
                {[data.sector, data.industry].filter(Boolean).join(' · ')}
                {data.isin && <span style={{ color:'#2a4a6a', marginLeft:8 }}>ISIN: {data.isin}</span>}
              </div>
              {data.listingDate && (
                <div style={{ fontFamily:'Share Tech Mono', color:'#2a4a6a', fontSize:10, marginTop:3 }}>
                  Listed: {data.listingDate}
                  {data.series && <span style={{ marginLeft:8 }}>Series: {data.series}</span>}
                </div>
              )}
              {data.business_description && (
                <div style={{ fontFamily:'Share Tech Mono', color:'#7aa8c8', fontSize:10, marginTop:8, lineHeight:1.6 }}>
                  {data.business_description}
                </div>
              )}
            </div>

            {/* Key ratios grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
              {Object.entries(RATIO_LABELS).map(([key, label]) => {
                const val = data[key]
                if (val == null) return null
                const accent = key === 'pe_ratio' && val > 50 ? '#ff3366'
                  : key === 'pe_ratio' && val < 15 ? '#00e87a'
                  : key === 'dividend_yield' && val > 2 ? '#00e87a'
                  : key === 'week52High' ? '#00e87a'
                  : key === 'week52Low' ? '#ff3366'
                  : '#cce0f5'
                return <StatCard key={key} label={label} value={fmt(key, val)} accent={accent}/>
              })}
            </div>

            {/* 52W range bar */}
            {data.week52High && data.week52Low && (
              <div>
                <div style={{ fontFamily:'Share Tech Mono', color:'#2a4a6a', fontSize:9, letterSpacing:2, marginBottom:6 }}>
                  52-WEEK RANGE
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:'Share Tech Mono', color:'#ff3366', fontSize:10 }}>₹{data.week52Low?.toFixed(0)}</span>
                  <div style={{ flex:1, height:6, background:'#0d1825', borderRadius:3, overflow:'hidden', position:'relative' }}>
                    <div style={{
                      position:'absolute', height:'100%',
                      background:'linear-gradient(90deg, #ff3366, #ffd700, #00e87a)',
                      width:'100%', opacity:0.4, borderRadius:3,
                    }}/>
                    {data.pe_ratio && (
                      <div style={{
                        position:'absolute', top:'50%', transform:'translateY(-50%)',
                        width:10, height:10, borderRadius:'50%', background:'#00cfff',
                        boxShadow:'0 0 8px #00cfff',
                        left: `calc(${Math.max(0,Math.min(100, ((data.week52High - data.week52Low) > 0
                          ? 50
                          : 50)))}% - 5px)`,
                      }}/>
                    )}
                  </div>
                  <span style={{ fontFamily:'Share Tech Mono', color:'#00e87a', fontSize:10 }}>₹{data.week52High?.toFixed(0)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
