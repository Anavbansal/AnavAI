import React, { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

const SENT = {
  BULLISH: { color:'var(--green)', bg:'#22c55e11', dot:'#22c55e' },
  BEARISH: { color:'var(--red)',   bg:'#f43f5e11', dot:'#f43f5e' },
  NEUTRAL: { color:'var(--text2)', bg:'transparent', dot:'#4b6082' },
}

function timeAgo(ms) {
  if (!ms) return ''
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins/60); return `${h}h ago`
}

export default function NewsPanel({ symbol, instrumentKey }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!symbol && !instrumentKey) return
    let mounted = true
    setLoading(true); setError(null)

    const key = instrumentKey || symbol
    const token = localStorage.getItem('upstox_access_token') || ''
    const params = new URLSearchParams({ category:'instrument_keys', instrument_keys: key })

    fetch(`${API_BASE_URL}/news?${params}`, {
      headers: token ? { Authorization:`Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(json => {
        if (!mounted) return
        const data = json?.data || {}
        const list = Array.isArray(data)
          ? data
          : (data[key] || data[Object.keys(data)[0]] || [])
        setArticles(Array.isArray(list) ? list.slice(0,10) : [])
      })
      .catch(e => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [symbol, instrumentKey])

  const items = articles.map((a,i) => {
    const title = a.headline || a.title || ''
    const ms    = a.published_timestamp || (a.publishedAt ? new Date(a.publishedAt).getTime() : 0)
    const tl    = title.toLowerCase()
    const bullKw = ['surge','rally','gain','rise','profit','record','high','buy','upgrade','beat','growth','strong','positive','jump','soar','bull']
    const bearKw = ['fall','drop','crash','loss','decline','sell','downgrade','miss','weak','concern','risk','cut','slump','bear','negative','plunge']
    const sent = bullKw.some(k=>tl.includes(k)) ? 'BULLISH' : bearKw.some(k=>tl.includes(k)) ? 'BEARISH' : 'NEUTRAL'
    return { id:`n${i}`, title, url: a.link||a.url||a.article_link||null, source: a.source||'News', ms, sent }
  })

  return (
    <div className="card anim-fade">
      <div className="card-header">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16}}>📰</span>
          <span className="card-title">Live News</span>
        </div>
        <span style={{marginLeft:'auto',fontSize:11,color:'var(--text3)'}}>{symbol}</span>
        {loading && <span className="anim-spin" style={{display:'inline-block',width:12,height:12,border:'2px solid var(--border)',borderTopColor:'var(--accent2)',borderRadius:'50%'}}/>}
      </div>

      <div style={{ overflowY:'auto', maxHeight:380 }}>
        {!loading && items.length === 0 && (
          <div style={{ padding:32, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
            {error ? `⚠ ${error}` : 'No news found for this symbol'}
          </div>
        )}
        {items.map(n => {
          const st = SENT[n.sent] || SENT.NEUTRAL
          const content = (
            <div style={{ padding:'11px 16px', borderBottom:'1px solid var(--border)', transition:'background .1s' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:st.dot, marginTop:5, flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.5, marginBottom:5 }}>{n.title}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>{n.source}</span>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>{timeAgo(n.ms)}</span>
                    <span style={{ marginLeft:'auto', fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700,
                      color:st.color, background:st.bg, padding:'1px 7px', borderRadius:20 }}>
                      {n.sent}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
          return n.url
            ? <a key={n.id} href={n.url} target="_blank" rel="noreferrer" style={{display:'block',textDecoration:'none'}}>{content}</a>
            : <div key={n.id}>{content}</div>
        })}
      </div>
    </div>
  )
}
