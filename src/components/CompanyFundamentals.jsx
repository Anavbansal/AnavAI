import React, { useState, useEffect } from 'react'
import { getInstrumentBySymbol } from '../utils/instrumentSearch'
import { getCompanyFundamentals } from '../lib/api'

const RATIO_LABELS = {
  pe_ratio: 'P/E Ratio',
  pb_ratio: 'P/B Ratio',
  dividend_yield: 'Div Yield %',
  roe: 'ROE %',
  roce: 'ROCE %',
  eps: 'EPS',
  debt_to_equity: 'Debt/Equity',
  book_value_per_share: 'Book Value',
  market_cap: 'Market Cap',
  sector_pe: 'Sector P/E',
  face_value: 'Face Value',
  week52High: '52W High',
  week52Low: '52W Low',
}

function formatRatioValue(key, val) {
  if (typeof val !== 'number') return String(val);
  if (key.includes('yield') || key.includes('roe') || key.includes('roce')) return `${val.toFixed(2)}%`;
  if (key.includes('eps') || key.includes('value')) return `₹${val.toFixed(2)}`;
  if (key.includes('market_cap')) return `₹${(val / 10000000).toFixed(2)}Cr`;
  return val.toFixed(2);
}

export default function CompanyFundamentals({ symbol }) {
  const [profile, setProfile] = useState(null)
  const [ratios, setRatios] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!symbol) return;
      try {
        setLoading(true);
        setError(null);
        setProfile(null);
        setRatios(null);

        const token = localStorage.getItem('upstox_access_token') || null;

        // Get instrument details for ISIN (optional)
        let isin = '';
        try {
          const instrument = getInstrumentBySymbol(symbol);
          isin = instrument?.isin || '';
        } catch { /* ok */ }

        // Fetch from our server's /fundamentals route (uses NSE free API)
        const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
        const params = new URLSearchParams({ symbol, type: 'profile' });
        if (isin) params.set('isin', isin);

        const resp = await fetch(`${BASE}/fundamentals?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (isMounted) {
          if (resp.ok) {
            const data = await resp.json();
            if (data?.status === 'success' && data?.data) {
              const d = data.data;
              setProfile(d);
              // Extract ratio fields into a structured object
              const ratioFields = {
                pe_ratio: d.pe_ratio,
                pb_ratio: d.pb_ratio,
                eps: d.eps,
                dividend_yield: d.dividend_yield,
                market_cap: d.market_cap,
                face_value: d.face_value,
                week52High: d.week52High,
                week52Low: d.week52Low,
              };
              const hasRatios = Object.values(ratioFields).some(v => v != null);
              if (hasRatios) setRatios(ratioFields);
            } else {
              setError('Fundamental data unavailable for this symbol.');
            }
          } else {
            setError('Failed to load fundamentals. Server may be offline.');
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; }
  }, [symbol]);

  if (!symbol) return (
    <div className="panel flex items-center justify-center py-10 gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>🏢</div>
      <div>
        <div className="font-display text-muted text-xs tracking-widest">FUNDAMENTALS IDLE</div>
        <div className="font-mono text-dim mt-1" style={{ fontSize: 11 }}>Analyze a stock to view fundamentals</div>
      </div>
    </div>
  );

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">🏢 Company Fundamentals</div>
        <span className="ml-auto font-mono text-accent" style={{ fontSize: 10 }}>Upstox API</span>
      </div>

      <div className="p-3 flex flex-col gap-4">
        {loading && (
          <div className="flex justify-center items-center py-6 gap-2">
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span className="font-mono text-accent animate-blink text-xs">FETCHING FUNDAMENTALS...</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-4 text-danger font-mono text-xs">{error}</div>
        )}

        {!loading && profile && (
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-display font-bold text-gray-100" style={{ fontSize: 16 }}>
                  {profile.company_name || symbol}
                </div>
                <div className="font-mono text-muted mt-1" style={{ fontSize: 11 }}>
                  {profile.sector || 'Sector Data Unavailable'} · ISIN: {profile.isin}
                </div>
              </div>
            </div>
            {profile.business_description && (
              <p className="text-gray-300 leading-relaxed font-mono mt-2" style={{ fontSize: 11 }}>
                {profile.business_description}
              </p>
            )}
          </div>
        )}

        {!loading && ratios && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Array.isArray(ratios) ? ratios : [ratios]).flatMap((ratioObj, i) => 
              Object.entries(ratioObj).map(([k, v]) => {
                if (v == null || typeof v === 'object') return null;
                const label = RATIO_LABELS[k] || k.replace(/_/g, ' ').toUpperCase();
                return (
                  <div key={`${i}-${k}`} className="p-2 border border-border/50 bg-bg3">
                    <div className="font-mono text-dim uppercase tracking-wider" style={{ fontSize: 10 }}>{label}</div>
                    <div className="font-display font-bold mt-1 text-gray-100" style={{ fontSize: 13 }}>
                      {formatRatioValue(k, v)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}