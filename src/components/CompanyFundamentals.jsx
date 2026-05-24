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

        // Get instrument details from complete.json which includes ISIN
        const instrument = getInstrumentBySymbol(symbol);
        const isin = instrument?.isin;

        if (!isin) {
          throw new Error(`ISIN not found for ${symbol}. Fundamentals require an ISIN.`);
        }

        const token = localStorage.getItem('upstox_access_token') || null;

        // We fetch profile outline and financial ratios concurrently
        const [profRes, ratRes] = await Promise.allSettled([
          getCompanyFundamentals(token, { isin, type: 'profile' }),
          getCompanyFundamentals(token, { isin, type: 'key-ratios' })
        ]);

        if (isMounted) {
          let loadedAny = false;
          if (profRes.status === 'fulfilled' && profRes.value?.status === 'success') {
            setProfile(profRes.value.data);
            loadedAny = true;
          }
          if (ratRes.status === 'fulfilled' && ratRes.value?.status === 'success') {
            setRatios(ratRes.value.data);
            loadedAny = true;
          }
          if (!loadedAny) {
             setError('Fundamental data unavailable for this instrument.');
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