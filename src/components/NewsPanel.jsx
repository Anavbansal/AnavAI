import React, { useMemo, useState, useEffect } from 'react'
import { getMarketNews } from '../lib/api'
import { searchSymbol } from '../services/marketData'

const SENTIMENT_STYLES = {
  BULLISH: { color: '#00ff88', bg: 'rgba(0,255,136,0.12)', border: 'rgba(0,255,136,0.3)' },
  BEARISH: { color: '#ff3366', bg: 'rgba(255,51,102,0.12)', border: 'rgba(255,51,102,0.3)' },
  NEUTRAL: { color: '#ffd700', bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.3)' },
}

function timeAgo(mins) {
  if (!Number.isFinite(mins)) return 'Time unavailable'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m > 0 ? `${m}m` : ''} ago`
}

export default function NewsPanel({ symbol, instrumentKey, news: backendNews = [] }) {
  const [upstoxNews, setUpstoxNews] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true;

    async function fetchNews() {
      if (!symbol && !instrumentKey) return;
      
      try {
        setLoading(true);
        let key = instrumentKey;

        // Try to obtain the exact instrument_key from Upstox via search if omitted
        if (!key && symbol) {
          const results = await searchSymbol(symbol);
          const match = results.find(r => r.symbol === symbol || r.symbol?.includes(symbol));
          if (match && (match.instrument_key || match.instrumentKey)) {
            key = match.instrument_key || match.instrumentKey;
          }
        }

        if (!key) return; // Fallback entirely to backendNews if key is still missing

        const token = localStorage.getItem('upstox_access_token') || null;
        const res = await getMarketNews(token, { category: 'instrument_keys', instrument_keys: key });
        
        if (isMounted && res.status === 'success' && res.data) {
          const articles = Array.isArray(res.data) ? res.data : (res.data[key] || Object.values(res.data)[0]);
          if (Array.isArray(articles)) {
            setUpstoxNews(articles);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Upstox news:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchNews();
    return () => { isMounted = false; }
  }, [symbol, instrumentKey]);

  const news = useMemo(() => {
    if (upstoxNews && upstoxNews.length > 0) {
      return upstoxNews.slice(0, 7).map((item, index) => {
        // Unify timestamp structures from the Upstox API
        const ts = item?.publishedAt || item?.published_timestamp || item?.timestamp || Date.now();
        const publishedMs = Number(ts) > 1e11 ? Number(ts) : new Date(ts).getTime();
        const mins = Number.isFinite(publishedMs)
          ? Math.max(0, Math.round((Date.now() - publishedMs) / 60000))
          : NaN

        return {
          id: item?.id ?? `upstox-news-${index}`,
          title: item?.headline ?? item?.title ?? 'Market update',
          source: item?.source ?? 'Upstox',
          sentiment: 'NEUTRAL', // Native Upstox API lacks sentiment tagging out-of-the-box
          mins,
          url: item?.link ?? item?.url ?? null,
        }
      })
    }

    return backendNews.slice(0, 7).map((item, index) => {
      const publishedMs = item?.publishedAt ? new Date(item.publishedAt).getTime() : NaN
      const mins = Number.isFinite(publishedMs)
        ? Math.max(0, Math.round((Date.now() - publishedMs) / 60000))
        : NaN

      return {
        id: item?.id ?? index,
        title: item?.title ?? 'Market update',
        source: item?.source ?? 'Unknown',
        sentiment: item?.sentiment ?? 'NEUTRAL',
        mins,
        url: item?.url ?? null,
      }
    })
  }, [backendNews])

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title flex items-center gap-2">
          Live News Feed
          {loading && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
        </div>
        <span className="ml-auto font-mono text-muted" style={{ fontSize: 10 }}>NSE · FII · Macro</span>
      </div>
      <div className="divide-y" style={{ borderColor: '#1a3050' }}>
        {!loading && news.length === 0 && (
          <div className="px-3 py-6 text-center">
            <div className="font-mono text-muted" style={{ fontSize: 11 }}>
              No live news returned for {symbol || 'this symbol'}.
            </div>
          </div>
        )}
        {news.map((n) => {
          const st = SENTIMENT_STYLES[n.sentiment] ?? SENTIMENT_STYLES.NEUTRAL
          const content = (
            <>
              <div className="text-gray-200 mb-1.5 leading-snug" style={{ fontSize: 13, fontWeight: 500 }}>
                {n.title}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-muted" style={{ fontSize: 10 }}>{n.source}</span>
                <span className="font-mono text-dim" style={{ fontSize: 10 }}>{timeAgo(n.mins)}</span>
                <span className="font-mono px-1.5 py-0.5 ml-auto border" style={{ fontSize: 10, color: st.color, background: st.bg, borderColor: st.border }}>
                  {n.sentiment}
                </span>
              </div>
            </>
          )

          if (n.url) {
            return (
              <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block px-3 py-2.5 hover:bg-bg3 transition-colors">
                {content}
              </a>
            )
          }

          return (
            <div key={n.id} className="px-3 py-2.5">
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
