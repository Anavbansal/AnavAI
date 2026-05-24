import React, { useMemo, useState, useEffect } from 'react'
import { getMarketNews } from '../lib/api'
import { getInstrumentBySymbol } from '../utils/instrumentSearch'

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

        // Get the exact instrument_key from complete.json if not provided
        if (!key && symbol) {
          const instrument = getInstrumentBySymbol(symbol);
          if (instrument?.instrumentKey) {
            key = instrument.instrumentKey;
          }
        }

        if (!key) {
          console.warn('No instrumentKey found for symbol:', symbol);
          return;
        }

        const token = localStorage.getItem('upstox_access_token') || null;
        const res = await getMarketNews(token, { category: 'instrument_keys', instrument_keys: key });
        
        if (isMounted && res?.status === 'success' && res?.data) {
          // Extract articles for this instrument key
          // Response format: { data: { [instrument_key]: [...articles], ... }, ... }
          const articles = res.data[key] || Object.values(res.data)?.[0] || [];
          if (Array.isArray(articles) && articles.length > 0) {
            setUpstoxNews(articles);
          } else {
            console.warn('No articles found in response for key:', key);
            setUpstoxNews([]);
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
        // Upstox API returns published_time as Unix timestamp in milliseconds
        const publishedMs = Number(item?.published_time) || Date.now();
        const mins = Number.isFinite(publishedMs)
          ? Math.max(0, Math.round((Date.now() - publishedMs) / 60000))
          : NaN

        return {
          id: item?.id ?? `upstox-news-${index}`,
          title: item?.heading ?? item?.title ?? 'Market update',
          source: item?.source ?? 'Upstox',
          sentiment: 'NEUTRAL',
          mins,
          url: item?.article_link ?? item?.url ?? null,
          thumbnail: item?.thumbnail ?? null,
          summary: item?.summary ?? null,
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
        thumbnail: item?.thumbnail ?? null,
        summary: item?.summary ?? null,
      }
    })
  }, [upstoxNews, backendNews])

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
