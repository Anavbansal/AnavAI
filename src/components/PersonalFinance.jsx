import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const f  = (n,d=0) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})
const fc = n => `₹${f(n)}`
const pct = (a,b) => b ? ((a-b)/b*100) : 0
const r2  = n => Math.round(n*100)/100

// ── Static personal data ──────────────────────────────────────────────────────
const HOLDINGS = [
  {symbol:'NTPC',      name:'NTPC Ltd',              qty:1,   avg:423.62, sector:'Power',     cap:'LargeCap', instrKey:'NSE_EQ|INE733E01010'},
  {symbol:'CESC',      name:'CESC Ltd',               qty:38,  avg:132.10, sector:'Power',     cap:'LargeCap', instrKey:'NSE_EQ|INE486A01021'},
  {symbol:'IRFC',      name:'IRFC',                   qty:20,  avg:151.51, sector:'Finance',   cap:'LargeCap', instrKey:'NSE_EQ|INE053F01010'},
  {symbol:'RVNL',      name:'Rail Vikas Nigam',       qty:30,  avg:211.51, sector:'Infra',     cap:'LargeCap', instrKey:'NSE_EQ|INE415G01027'},
  {symbol:'TATAPOWER', name:'Tata Power',             qty:15,  avg:363.82, sector:'Power',     cap:'LargeCap', instrKey:'NSE_EQ|INE245A01021'},
  {symbol:'ZOMATO',    name:'Zomato Ltd',             qty:20,  avg:193.54, sector:'Tech',      cap:'LargeCap', instrKey:'NSE_EQ|INE758T01015'},
  {symbol:'TATASTEEL', name:'Tata Steel',             qty:101, avg:118.51, sector:'Steel',     cap:'LargeCap', instrKey:'NSE_EQ|INE081A01020'},
  {symbol:'VPRPL',     name:'VPRPL',                  qty:31,  avg:200.68, sector:'Realty',    cap:'SmallCap', instrKey:'NSE_EQ|INE0AE001013'},
  {symbol:'NATIONALUM',name:'National Aluminium',     qty:82,  avg:110.77, sector:'Metals',    cap:'LargeCap', instrKey:'NSE_EQ|INE139A01034'},
  {symbol:'CANBK',     name:'Canara Bank',            qty:1,   avg:109.22, sector:'Banking',   cap:'LargeCap', instrKey:'NSE_EQ|INE476A01022'},
  {symbol:'SUZLON',    name:'Suzlon Energy',          qty:47,  avg:59.71,  sector:'Renewable', cap:'LargeCap', instrKey:'NSE_EQ|INE040H01021'},
  {symbol:'HAL',       name:'HAL',                    qty:1,   avg:3996.00,sector:'Defence',   cap:'LargeCap', instrKey:'NSE_EQ|INE066F01012'},
  {symbol:'HSCL',      name:'Himadri Speciality',     qty:17,  avg:410.76, sector:'Chemicals', cap:'LargeCap', instrKey:'NSE_EQ|INE019C01026'},
  {symbol:'XCHANGING',  name:'Xchanging Solutions',   qty:40,  avg:122.69, sector:'IT',        cap:'SmallCap', instrKey:'NSE_EQ|INE692G01013'},
]

const SECTOR_COLOR = {
  Power:'#3b82f6', Finance:'#8b5cf6', Infra:'#f97316', Tech:'#6366f1',
  Steel:'#94a3b8', Realty:'#ec4899', Metals:'#14b8a6', Banking:'#22c55e',
  Renewable:'#84cc16', Defence:'#ef4444', Chemicals:'#f59e0b', IT:'#a78bfa',
}

// ── AI Risk Engine ────────────────────────────────────────────────────────────
function analyzeRisk(holding, ltp, analysis) {
  if (!ltp || ltp <= 0) return null

  const { avg, qty, symbol } = holding
  const invested = avg * qty
  const current  = ltp * qty
  const pnlPct   = pct(ltp, avg)

  // From technical analysis if available
  const rsi       = analysis?.rsi || 50
  const ema20     = analysis?.ema20 || ltp
  const ema50     = analysis?.ema50 || ltp
  const supertrend = analysis?.supertrend
  const atr       = analysis?.atr || ltp * 0.02
  const support   = analysis?.support || ltp * 0.95
  const resistance = analysis?.resistance || ltp * 1.05
  const adx       = analysis?.adx?.adx || 20
  const macd      = analysis?.macd

  // Risk scoring (0-100, higher = more risky)
  let riskScore = 50
  let signals = []
  let positives = []
  let negatives = []

  // 1. P&L based risk
  if (pnlPct < -20) { riskScore += 20; negatives.push(`Heavy loss: ${r2(pnlPct)}%`) }
  else if (pnlPct < -10) { riskScore += 10; negatives.push(`In loss: ${r2(pnlPct)}%`) }
  else if (pnlPct > 30) { riskScore -= 10; positives.push(`Strong profit: +${r2(pnlPct)}%`) }
  else if (pnlPct > 15) { riskScore -= 5; positives.push(`Good profit: +${r2(pnlPct)}%`) }

  // 2. RSI
  if (rsi > 75) { riskScore += 15; negatives.push(`Overbought RSI: ${r2(rsi)}`) }
  else if (rsi > 65) { riskScore += 8; signals.push(`RSI elevated: ${r2(rsi)}`) }
  else if (rsi < 35) { riskScore -= 8; positives.push(`Oversold RSI: ${r2(rsi)} (recovery possible)`) }
  else if (rsi >= 45 && rsi <= 60) { riskScore -= 5; positives.push(`RSI healthy: ${r2(rsi)}`) }

  // 3. Price vs EMA (trend)
  if (ltp > ema20 && ltp > ema50) { riskScore -= 10; positives.push('Above EMA20 & EMA50 — uptrend') }
  else if (ltp < ema20 && ltp < ema50) { riskScore += 15; negatives.push('Below EMA20 & EMA50 — downtrend') }
  else if (ltp < ema20) { riskScore += 8; negatives.push('Below EMA20 — short-term weak') }

  // 4. Supertrend
  if (supertrend) {
    if (supertrend.signal === 'BUY') { riskScore -= 12; positives.push('Supertrend: BUY signal') }
    else if (supertrend.signal === 'SELL') { riskScore += 15; negatives.push('Supertrend: SELL signal') }
  }

  // 5. MACD
  if (macd) {
    if (macd.histogram > 0 && macd.macd > macd.signal) { riskScore -= 8; positives.push('MACD bullish crossover') }
    else if (macd.histogram < 0 && macd.macd < macd.signal) { riskScore += 10; negatives.push('MACD bearish') }
  }

  // 6. ADX (trend strength)
  if (adx > 30) { signals.push(`Strong trend (ADX: ${r2(adx)})`) }

  // 7. Cap based risk
  if (holding.cap === 'SmallCap') { riskScore += 8; signals.push('SmallCap — higher volatility') }

  // Clamp 0-100
  riskScore = Math.min(100, Math.max(0, riskScore))

  // Risk level
  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 45 ? 'MEDIUM' : 'LOW'
  const riskColor = riskScore >= 70 ? '#ef4444' : riskScore >= 45 ? '#f59e0b' : '#22c55e'
  const riskEmoji = riskScore >= 70 ? '🔴' : riskScore >= 45 ? '🟡' : '🟢'

  // Action recommendation
  let action = '', actionColor = '', stopLoss = 0, target = 0, exitPrice = 0

  if (riskScore >= 70) {
    action = 'EXIT / REDUCE'
    actionColor = '#ef4444'
    exitPrice = r2(ltp * 0.99) // exit near current
    stopLoss  = r2(support * 0.98)
  } else if (riskScore >= 55) {
    action = 'HOLD WITH SL'
    actionColor = '#f59e0b'
    stopLoss  = r2(Math.max(support, ltp - atr * 2))
    target    = r2(resistance)
  } else {
    action = 'HOLD / BUY MORE'
    actionColor = '#22c55e'
    stopLoss  = r2(Math.max(avg * 0.92, ltp - atr * 2))
    target    = r2(resistance * 1.02)
  }

  return {
    riskScore, riskLevel, riskColor, riskEmoji,
    action, actionColor,
    stopLoss, target, exitPrice,
    pnlPct, invested, current,
    signals, positives, negatives,
    ltp, ema20, ema50, rsi, atr, support, resistance,
  }
}

// ── Holding Card ─────────────────────────────────────────────────────────────
function HoldingCard({ holding, onSelect }) {
  const [ltp,      setLtp]      = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const token = localStorage.getItem('upstox_access_token') || ''
        const headers = { 'Content-Type':'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(`${API_BASE_URL}/analyze`, {
          method:'POST',
          headers,
          body: JSON.stringify({
            symbol: holding.symbol,
            instrumentKey: holding.instrKey,
            resolution: '15',
            mode: 'tech',
          }),
        })
        const data = await res.json()
        const d = data?.data ?? data
        if (d?.price) {
          setLtp(d.price)
          setAnalysis(d)
        }
      } catch {}
      setLoading(false)
    }
    fetchData()
  }, [holding.symbol])

  const risk = ltp ? analyzeRisk(holding, ltp, analysis) : null
  const invested = holding.avg * holding.qty
  const pnlAmt = risk ? risk.current - risk.invested : 0
  const pnlP   = risk ? risk.pnlPct : 0
  const bull    = pnlP >= 0

  return (
    <div onClick={() => onSelect(holding, ltp, analysis, risk)}
      style={{
        background:'var(--surface)', border:`1px solid ${risk ? risk.riskColor+'44' : 'var(--border)'}`,
        borderRadius:12, padding:'14px 16px', cursor:'pointer',
        transition:'all .2s', position:'relative', overflow:'hidden',
      }}
      onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
    >
      {/* Risk indicator strip */}
      {risk && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3,
          background: risk.riskColor, borderRadius:'12px 12px 0 0', opacity:.8 }}/>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        {/* Left: symbol + name */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:'var(--text)' }}>
              {holding.symbol}
            </span>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700,
              background:(SECTOR_COLOR[holding.sector]||'#666')+'20',
              color:SECTOR_COLOR[holding.sector]||'#666' }}>
              {holding.sector}
            </span>
            <span style={{ fontSize:10, color:'var(--text3)' }}>{holding.cap}</span>
          </div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{holding.name} · {holding.qty} shares</div>
        </div>

        {/* Right: risk badge */}
        {loading ? (
          <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid var(--border)',
            borderTopColor:'var(--accent)', animation:'spin 1s linear infinite' }}/>
        ) : risk ? (
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, fontWeight:800, color:risk.riskColor,
              display:'flex', alignItems:'center', gap:4 }}>
              {risk.riskEmoji} {risk.riskLevel} RISK
            </div>
            <div style={{ fontSize:10, color:risk.actionColor, fontWeight:700, marginTop:2 }}>
              {risk.action}
            </div>
          </div>
        ) : (
          <div style={{ fontSize:11, color:'var(--text3)' }}>No data</div>
        )}
      </div>

      {/* Price row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <div>
          <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>AVG PRICE</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:'var(--text)' }}>
            {fc(holding.avg)}
          </div>
        </div>
        <div>
          <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>LTP</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700,
            color: ltp ? (ltp >= holding.avg ? 'var(--green)' : 'var(--red)') : 'var(--text3)' }}>
            {ltp ? fc(ltp) : '—'}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>P&L</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700,
            color: bull ? 'var(--green)' : 'var(--red)' }}>
            {risk ? `${bull?'+':''}${fc(pnlAmt)}` : '—'}
          </div>
          {risk && (
            <div style={{ fontSize:10, color: bull ? 'var(--green)' : 'var(--red)' }}>
              ({bull?'+':''}{r2(pnlP)}%)
            </div>
          )}
        </div>
      </div>

      {/* Stop loss / target hint */}
      {risk && risk.riskLevel !== 'LOW' && (
        <div style={{ marginTop:10, padding:'6px 10px', borderRadius:8,
          background:risk.riskColor+'10', border:`1px solid ${risk.riskColor}22`,
          display:'flex', gap:16, fontSize:11 }}>
          {risk.stopLoss > 0 && (
            <span>🛡 SL: <strong style={{ fontFamily:"'DM Mono',monospace", color:'#ef4444' }}>{fc(risk.stopLoss)}</strong></span>
          )}
          {risk.target > 0 && (
            <span>🎯 Target: <strong style={{ fontFamily:"'DM Mono',monospace", color:'#22c55e' }}>{fc(risk.target)}</strong></span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Holding Detail Modal ──────────────────────────────────────────────────────
function HoldingDetail({ holding, ltp, analysis, risk, onClose, onAnalyze }) {
  if (!holding) return null
  const invested = holding.avg * holding.qty
  const current  = (ltp || holding.avg) * holding.qty
  const pnlAmt   = current - invested
  const pnlP     = pct(ltp || holding.avg, holding.avg)
  const bull      = pnlP >= 0

  return (
    <div style={{
      position:'fixed', inset:0, background:'#00000088', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:16, backdropFilter:'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto',
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:16, padding:24,
        boxShadow:'0 32px 64px #00000060',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:'var(--text)' }}>
                {holding.symbol}
              </span>
              {risk && (
                <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20,
                  background:risk.riskColor+'20', color:risk.riskColor }}>
                  {risk.riskEmoji} {risk.riskLevel} RISK
                </span>
              )}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>
              {holding.name} · {holding.qty} shares · {holding.sector} · {holding.cap}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            color:'var(--text3)', fontSize:20, padding:4 }}>✕</button>
        </div>

        {/* P&L Summary */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
          {[
            { l:'Invested',     v:fc(invested),             c:'var(--text)' },
            { l:'Current Value',v:fc(current),              c: bull?'var(--green)':'var(--red)' },
            { l:'Total P&L',    v:`${bull?'+':''}${fc(pnlAmt)}`, c: bull?'var(--green)':'var(--red)' },
            { l:'Avg Buy Price',v:fc(holding.avg),          c:'var(--text)' },
            { l:'LTP',          v:ltp ? fc(ltp) : '—',     c: bull?'var(--green)':'var(--red)' },
            { l:'Return',       v:`${bull?'+':''}${r2(pnlP)}%`, c: bull?'var(--green)':'var(--red)' },
          ].map(m => (
            <div key={m.l} style={{ padding:'10px 12px', background:'var(--bg2)',
              border:'1px solid var(--border)', borderRadius:10 }}>
              <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600, letterSpacing:.8, marginBottom:4 }}>{m.l}</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:14, color:m.c }}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* AI Risk Analysis */}
        {risk && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:.8,
              textTransform:'uppercase', marginBottom:12 }}>AI Risk Analysis</div>

            {/* Risk score bar */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:12, color:'var(--text2)' }}>Risk Score</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:700,
                  fontSize:14, color:risk.riskColor }}>{risk.riskScore}/100</span>
              </div>
              <div style={{ height:8, background:'var(--border)', borderRadius:8, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${risk.riskScore}%`,
                  background:`linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)`,
                  transition:'width .5s', borderRadius:8 }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4,
                fontSize:9, color:'var(--text3)' }}>
                <span>SAFE</span><span>MODERATE</span><span>RISKY</span>
              </div>
            </div>

            {/* Action box */}
            <div style={{ padding:'14px 16px', borderRadius:12, marginBottom:14,
              background:risk.actionColor+'12', border:`1px solid ${risk.actionColor}33` }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18,
                color:risk.actionColor, marginBottom:8 }}>
                {risk.riskEmoji} {risk.action}
              </div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                {risk.stopLoss > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>🛡 STOP LOSS</div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700,
                      fontSize:16, color:'#ef4444' }}>{fc(risk.stopLoss)}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>
                      ({r2(pct(risk.stopLoss, ltp))}% from LTP)
                    </div>
                  </div>
                )}
                {risk.target > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>🎯 TARGET</div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700,
                      fontSize:16, color:'#22c55e' }}>{fc(risk.target)}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>
                      (+{r2(pct(risk.target, ltp))}% from LTP)
                    </div>
                  </div>
                )}
                {risk.exitPrice > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>🚪 EXIT NEAR</div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700,
                      fontSize:16, color:'#f97316' }}>{fc(risk.exitPrice)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Signals */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {risk.positives.map((s,i) => (
                <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:'var(--green)',
                  padding:'6px 10px', background:'#22c55e10', borderRadius:8, alignItems:'center' }}>
                  <span>✅</span><span>{s}</span>
                </div>
              ))}
              {risk.negatives.map((s,i) => (
                <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:'var(--red)',
                  padding:'6px 10px', background:'#ef444410', borderRadius:8, alignItems:'center' }}>
                  <span>❌</span><span>{s}</span>
                </div>
              ))}
              {risk.signals.map((s,i) => (
                <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:'var(--amber)',
                  padding:'6px 10px', background:'#f59e0b10', borderRadius:8, alignItems:'center' }}>
                  <span>⚠️</span><span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical indicators */}
        {analysis && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:.8,
              textTransform:'uppercase', marginBottom:10 }}>Technical Indicators</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                { l:'RSI', v:r2(analysis.rsi), c: analysis.rsi>70?'#ef4444':analysis.rsi<30?'#22c55e':'var(--text)' },
                { l:'EMA 20', v:fc(r2(analysis.ema20)), c:'var(--text)' },
                { l:'EMA 50', v:fc(r2(analysis.ema50)), c:'var(--text)' },
                { l:'VWAP', v:fc(r2(analysis.vwap)), c:'var(--accent2)' },
                { l:'Support', v:fc(r2(analysis.support)), c:'#22c55e' },
                { l:'Resistance', v:fc(r2(analysis.resistance)), c:'#ef4444' },
                { l:'ATR', v:r2(analysis.atr), c:'var(--amber)' },
                { l:'Supertrend', v:analysis.supertrend?.signal||'—', c:analysis.supertrend?.signal==='BUY'?'#22c55e':'#ef4444' },
                { l:'ADX', v:r2(analysis.adx?.adx||0), c:'var(--text)' },
              ].map(m => (
                <div key={m.l} style={{ padding:'8px 10px', background:'var(--bg2)',
                  border:'1px solid var(--border)', borderRadius:8 }}>
                  <div style={{ fontSize:9, color:'var(--text3)', marginBottom:2 }}>{m.l}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:12, color:m.c }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => { onClose(); onAnalyze(holding.symbol, holding.instrKey) }}
            style={{ flex:1, padding:'12px', borderRadius:10, border:'none', cursor:'pointer',
              background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:13,
              fontFamily:"'Syne',sans-serif" }}>
            📊 Full Analysis
          </button>
          <a href={`https://www.angelone.in/trade/${holding.symbol}`}
            target="_blank" rel="noopener noreferrer"
            style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid #F07B24',
              color:'#F07B24', fontWeight:700, fontSize:13, textAlign:'center',
              textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:"'Syne',sans-serif" }}>
            🟠 Open in Angel One
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PersonalFinance({ onAnalyze }) {
  const [selected,   setSelected]   = useState(null)
  const [selData,    setSelData]    = useState({ltp:null, analysis:null, risk:null})
  const [sortBy,     setSortBy]     = useState('risk') // risk|pnl|name
  const [filterRisk, setFilterRisk] = useState('all')
  const [holdings,   setHoldings]   = useState(HOLDINGS)
  const [summary,    setSummary]    = useState(null)

  // Fetch live holdings from Angel One if connected
  useEffect(() => {
    async function fetchAngelHoldings() {
      const connected = localStorage.getItem('anav_angelone_connected')
      if (!connected) return
      try {
        const res = await fetch(`${API_BASE_URL}/api/holdings`, {
          headers: { 'X-Broker': 'angelone' }
        })
        const data = await res.json()
        if (data.status === 'success' && data.holdings?.length > 0) {
          // Merge live data with our static data (to get instrKey)
          const merged = data.holdings.map(h => {
            const local = HOLDINGS.find(l => l.symbol === h.symbol)
            return {
              symbol: h.symbol,
              name: h.name || local?.name || h.symbol,
              qty: h.quantity,
              avg: h.avgBuyPrice,
              sector: local?.sector || 'Other',
              cap: local?.cap || 'Unknown',
              instrKey: local?.instrKey || `NSE_EQ|${h.symbol}`,
              ltp: h.ltp,
              pnl: h.pnl,
            }
          })
          setHoldings(merged)
          // Summary from Angel One
          if (data.totalholding) {
            setSummary({
              invested: data.totalholding.totalholdingvalue - data.totalholding.totalprofitandloss,
              current: data.totalholding.totalholdingvalue,
              pnl: data.totalholding.totalprofitandloss,
            })
          }
        }
      } catch {}
    }
    fetchAngelHoldings()
  }, [])

  function handleSelect(holding, ltp, analysis, risk) {
    setSelected(holding)
    setSelData({ ltp, analysis, risk })
  }

  const totalInvested = holdings.reduce((s,h) => s + h.avg * h.qty, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Header */}
      <div style={{ padding:'12px 16px', background:'var(--bg2)',
        border:'1px solid var(--border)', borderRadius:12,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:'var(--text)',
            display:'flex', alignItems:'center', gap:8 }}>
            💼 My Holdings
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
              background:'#F07B2420', color:'#F07B24', fontWeight:700 }}>Angel One</span>
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
            {holdings.length} stocks · AI risk analysis on every holding
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Total Invested</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:18, color:'var(--text)' }}>
            {fc(summary?.invested || totalInvested)}
          </div>
          {summary && (
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700,
              color: summary.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {summary.pnl >= 0 ? '+' : ''}{fc(summary.pnl)} P&L
            </div>
          )}
        </div>
      </div>

      {/* Risk filter tabs */}
      <div style={{ display:'flex', gap:6 }}>
        {[
          { id:'all',    label:'All' },
          { id:'HIGH',   label:'🔴 High Risk' },
          { id:'MEDIUM', label:'🟡 Medium' },
          { id:'LOW',    label:'🟢 Safe' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilterRisk(f.id)} style={{
            padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)',
            background: filterRisk===f.id ? 'var(--accent)' : 'var(--bg2)',
            color: filterRisk===f.id ? '#fff' : 'var(--text3)',
            fontSize:11, fontWeight:600, cursor:'pointer',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Holdings grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
        {holdings.map(h => (
          <HoldingCard key={h.symbol} holding={h} onSelect={handleSelect}/>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <HoldingDetail
          holding={selected}
          ltp={selData.ltp}
          analysis={selData.analysis}
          risk={selData.risk}
          onClose={() => setSelected(null)}
          onAnalyze={(sym, key) => onAnalyze && onAnalyze({ symbol:sym, instrumentKey:key }, '15')}
        />
      )}
    </div>
  )
}
