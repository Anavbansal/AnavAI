import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const f   = (n,d=0) => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})
const fc  = n => `₹${f(n)}`
const pct = (a,b) => b ? ((a-b)/b*100) : 0
const r2  = n => Math.round(n*100)/100

const HOLDINGS_FALLBACK = [
  {symbol:'NTPC',       qty:1,   avg:423.62, sector:'Power',     cap:'LargeCap', instrKey:'NSE_EQ|INE733E01010'},
  {symbol:'CESC',       qty:38,  avg:132.10, sector:'Power',     cap:'LargeCap', instrKey:'NSE_EQ|INE486A01021'},
  {symbol:'IRFC',       qty:20,  avg:151.51, sector:'Finance',   cap:'LargeCap', instrKey:'NSE_EQ|INE053F01010'},
  {symbol:'RVNL',       qty:30,  avg:211.51, sector:'Infra',     cap:'LargeCap', instrKey:'NSE_EQ|INE415G01027'},
  {symbol:'TATAPOWER',  qty:15,  avg:363.82, sector:'Power',     cap:'LargeCap', instrKey:'NSE_EQ|INE245A01021'},
  {symbol:'ZOMATO',     qty:20,  avg:193.54, sector:'Tech',      cap:'LargeCap', instrKey:'NSE_EQ|INE758T01015'},
  {symbol:'TATASTEEL',  qty:101, avg:118.51, sector:'Steel',     cap:'LargeCap', instrKey:'NSE_EQ|INE081A01020'},
  {symbol:'VPRPL',      qty:31,  avg:200.68, sector:'Realty',    cap:'SmallCap', instrKey:'NSE_EQ|INE0AE001013'},
  {symbol:'NATIONALUM', qty:82,  avg:110.77, sector:'Metals',    cap:'LargeCap', instrKey:'NSE_EQ|INE139A01034'},
  {symbol:'CANBK',      qty:1,   avg:109.22, sector:'Banking',   cap:'LargeCap', instrKey:'NSE_EQ|INE476A01022'},
  {symbol:'SUZLON',     qty:47,  avg:59.71,  sector:'Renewable', cap:'LargeCap', instrKey:'NSE_EQ|INE040H01021'},
  {symbol:'HAL',        qty:1,   avg:3996.00,sector:'Defence',   cap:'LargeCap', instrKey:'NSE_EQ|INE066F01012'},
  {symbol:'HSCL',       qty:17,  avg:410.76, sector:'Chemicals', cap:'LargeCap', instrKey:'NSE_EQ|INE019C01026'},
  {symbol:'XCHANGING',  qty:40,  avg:122.69, sector:'IT',        cap:'SmallCap', instrKey:'NSE_EQ|INE692G01013'},
]

const SECTOR_COLOR = {
  Power:'#3b82f6', Finance:'#8b5cf6', Infra:'#f97316', Tech:'#6366f1',
  Steel:'#94a3b8', Realty:'#ec4899', Metals:'#14b8a6', Banking:'#22c55e',
  Renewable:'#84cc16', Defence:'#ef4444', Chemicals:'#f59e0b', IT:'#a78bfa',
}

const META = {}
HOLDINGS_FALLBACK.forEach(h => { META[h.symbol] = h })

function analyzeRisk(holding, ltp, analysis) {
  if (!ltp || ltp <= 0) return null
  let score = 0
  const signals = []
  const pnlPct = holding.avg > 0 ? (ltp - holding.avg) / holding.avg * 100 : 0
  if (pnlPct <= -40) { score += 35; signals.push('Massive loss') }
  else if (pnlPct <= -20) { score += 25; signals.push('Large loss') }
  else if (pnlPct <= -10) { score += 15; signals.push('Moderate loss') }
  else if (pnlPct >= 100) { score += 15; signals.push('Extreme gain — take profits') }
  else if (pnlPct >= 50)  { score += 8;  signals.push('Large gain') }
  if (analysis) {
    const rsi = analysis.rsi || analysis.indicators?.rsi
    if (rsi > 80) { score += 20; signals.push(`RSI overbought (${Math.round(rsi)})`) }
    else if (rsi > 70) { score += 12; signals.push(`RSI high (${Math.round(rsi)})`) }
    else if (rsi < 30) { score += 15; signals.push(`RSI oversold (${Math.round(rsi)})`) }
    const st = analysis.supertrend || analysis.indicators?.supertrend
    if (st === 'sell' || st === 'SELL') { score += 15; signals.push('Supertrend SELL') }
    const macd = analysis.macd || analysis.indicators?.macd
    if (macd?.histogram < 0 && macd?.crossover === 'bearish') { score += 10; signals.push('MACD bearish') }
    const adx = analysis.adx || analysis.indicators?.adx
    if (adx > 30 && pnlPct < 0) { score += 10; signals.push('Strong downtrend') }
  }
  if (holding.cap === 'SmallCap') { score += 8; signals.push('SmallCap risk') }
  score = Math.min(100, score)
  let riskLevel, riskColor, riskEmoji, action, actionColor
  if (score >= 70) {
    riskLevel='HIGH RISK'; riskColor='#ef4444'; riskEmoji='🔴'; action='EXIT / REDUCE'; actionColor='#ef4444'
  } else if (score >= 45) {
    riskLevel='MEDIUM RISK'; riskColor='#f59e0b'; riskEmoji='🟡'; action='HOLD WITH SL'; actionColor='#f59e0b'
  } else {
    riskLevel='LOW RISK'; riskColor='#22c55e'; riskEmoji='🟢'; action='HOLD / BUY MORE'; actionColor='#22c55e'
  }
  let stopLoss = 0, target = 0
  if (analysis) {
    const atr = analysis.atr || analysis.indicators?.atr || 0
    const sup  = analysis.support  || analysis.indicators?.support || 0
    const res  = analysis.resistance || analysis.indicators?.resistance || 0
    stopLoss = sup > 0 ? Math.max(sup, ltp - 1.5*atr) : (atr > 0 ? ltp - 2*atr : 0)
    target   = res > 0 ? res : (atr > 0 ? ltp + 2*atr : 0)
    stopLoss = stopLoss > 0 ? Math.round(stopLoss*100)/100 : 0
    target   = target > 0   ? Math.round(target*100)/100 : 0
  }
  return { riskScore:score, riskLevel, riskColor, riskEmoji, action, actionColor, stopLoss, target, signals }
}

function HoldingRow({ holding, idx, ltp, analysis, onSelect }) {
  const risk    = (ltp && ltp > 0) ? analyzeRisk(holding, ltp, analysis) : null
  const ltpVal  = ltp || holding.ltp || 0
  const invested = holding.avg * holding.qty
  const pnlAmt   = ltpVal > 0 ? ltpVal*holding.qty - invested : (holding.pnl || 0)
  const pnlPct   = holding.avg > 0 ? (ltpVal > 0 ? (ltpVal-holding.avg)/holding.avg*100 : holding.pnlPct||0) : 0
  const bull     = pnlAmt >= 0
  return (
    <div onClick={() => onSelect(holding, ltpVal, analysis, risk)}
      style={{ display:'grid', gridTemplateColumns:'2fr 0.7fr 1fr 1fr 1fr 1.2fr 1.5fr',
        padding:'10px 16px', cursor:'pointer', borderBottom:'1px solid var(--border)',
        background: idx%2===0 ? 'transparent' : 'rgba(255,255,255,0.015)',
        borderLeft: risk ? `3px solid ${risk.riskColor}` : '3px solid var(--border)',
        transition:'background .15s' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(99,102,241,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background=idx%2===0?'transparent':'rgba(255,255,255,0.015)'}>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:'var(--text)'}}>{holding.symbol}</span>
          {holding.sector && <span style={{fontSize:9,padding:'1px 5px',borderRadius:8,fontWeight:600,
            background:(SECTOR_COLOR[holding.sector]||'#666')+'22',color:SECTOR_COLOR[holding.sector]||'#888'}}>{holding.sector}</span>}
        </div>
        <div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>{holding.qty} shares</div>
      </div>
      <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text2)',alignSelf:'center'}}>{holding.qty}</div>
      <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--text2)',alignSelf:'center'}}>₹{r2(holding.avg)}</div>
      <div style={{textAlign:'right',alignSelf:'center'}}>
        {ltpVal > 0
          ? <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:ltpVal>=holding.avg?'#22c55e':'#ef4444'}}>₹{r2(ltpVal)}</span>
          : <span style={{fontSize:11,color:'var(--text3)'}}>—</span>}
      </div>
      <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text2)',alignSelf:'center'}}>₹{Math.round(invested).toLocaleString('en-IN')}</div>
      <div style={{textAlign:'right',alignSelf:'center'}}>
        {(pnlAmt!==0||ltpVal>0) ? (<>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:bull?'#22c55e':'#ef4444'}}>{bull?'+':''}{Math.round(pnlAmt).toLocaleString('en-IN')}</div>
          <div style={{fontSize:10,color:bull?'#22c55e':'#ef4444'}}>({bull?'+':''}{r2(pnlPct)}%)</div>
        </>) : <span style={{fontSize:11,color:'var(--text3)'}}>—</span>}
      </div>
      <div style={{textAlign:'right',alignSelf:'center'}}>
        {risk ? (<div>
          <div style={{fontSize:11,fontWeight:700,color:risk.riskColor}}>{risk.riskEmoji} {risk.riskLevel}</div>
          <div style={{fontSize:9,fontWeight:600,color:risk.actionColor,marginTop:2}}>{risk.action}</div>
          {risk.stopLoss>0 && <div style={{fontSize:9,color:'var(--text3)'}}>SL ₹{risk.stopLoss}</div>}
        </div>) : <span style={{fontSize:10,color:'var(--text3)'}}>loading...</span>}
      </div>
    </div>
  )
}

function HoldingDetail({ holding, ltp, analysis, risk, onClose }) {
  if (!holding) return null
  const ltpVal  = ltp || holding.ltp || holding.avg
  const invested = holding.avg * holding.qty
  const current  = ltpVal * holding.qty
  const pnlAmt   = current - invested
  const pnlPct   = holding.avg > 0 ? (ltpVal-holding.avg)/holding.avg*100 : 0
  const bull      = pnlAmt >= 0
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,
        width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto',padding:24}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:'var(--text)'}}>{holding.symbol}</span>
              {holding.sector && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:600,
                background:(SECTOR_COLOR[holding.sector]||'#666')+'22',color:SECTOR_COLOR[holding.sector]||'#888'}}>{holding.sector}</span>}
              {holding.cap && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:600,
                background:'var(--bg2)',color:'var(--text3)'}}>{holding.cap}</span>}
            </div>
            <div style={{fontSize:12,color:'var(--text3)'}}>{holding.name||holding.symbol} · {holding.qty} shares</div>
          </div>
          <button onClick={onClose} style={{background:'var(--bg2)',border:'none',color:'var(--text3)',
            cursor:'pointer',fontSize:18,width:32,height:32,borderRadius:8,
            display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[
            {l:'AVG PRICE',v:fc(holding.avg),c:'var(--text)'},
            {l:'LTP',v:fc(ltpVal),c:bull?'#22c55e':'#ef4444'},
            {l:'P&L',v:`${bull?'+':''}${fc(pnlAmt)}`,c:bull?'#22c55e':'#ef4444'},
            {l:'QTY',v:holding.qty,c:'var(--text)'},
            {l:'INVESTED',v:fc(invested),c:'var(--text)'},
            {l:'RETURN',v:`${bull?'+':''}${r2(pnlPct)}%`,c:bull?'#22c55e':'#ef4444'},
          ].map(m => (
            <div key={m.l} style={{padding:'10px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10}}>
              <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.8,marginBottom:4}}>{m.l}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,color:m.c}}>{m.v}</div>
            </div>
          ))}
        </div>
        {risk && (<div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:12}}>AI Risk Analysis</div>
          <div style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:12,color:'var(--text2)'}}>Risk Score</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,color:risk.riskColor}}>{risk.riskScore}/100</span>
            </div>
            <div style={{height:8,background:'var(--border)',borderRadius:8,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${risk.riskScore}%`,background:'linear-gradient(90deg,#22c55e,#f59e0b,#ef4444)',transition:'width .5s',borderRadius:8}}/>
            </div>
          </div>
          <div style={{padding:'14px 16px',borderRadius:12,marginBottom:14,
            background:risk.actionColor+'12',border:`1px solid ${risk.actionColor}33`}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:risk.actionColor,marginBottom:8}}>{risk.riskEmoji} {risk.action}</div>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              {risk.stopLoss>0 && <div>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>🛡 STOP LOSS</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:'#ef4444'}}>{fc(risk.stopLoss)}</div>
              </div>}
              {risk.target>0 && <div>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>🎯 TARGET</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:'#22c55e'}}>{fc(risk.target)}</div>
              </div>}
            </div>
          </div>
          {risk.signals?.length>0 && <div style={{fontSize:11,color:'var(--text3)'}}>{risk.signals.map((s,i)=><div key={i}>• {s}</div>)}</div>}
        </div>)}
        <a href={`https://www.angelone.in/trade/${holding.symbol}`} target="_blank" rel="noopener noreferrer"
          style={{display:'block',padding:'12px',borderRadius:10,border:'1px solid #F07B24',
            color:'#F07B24',fontWeight:700,fontSize:13,textAlign:'center',textDecoration:'none'}}>
          🟠 Open in Angel One
        </a>
      </div>
    </div>
  )
}

export default function PersonalFinance({ onAnalyze }) {
  const [holdings,        setHoldings]        = useState(HOLDINGS_FALLBACK)
  const [ltpMap,          setLtpMap]          = useState({})
  const [analysisMap,     setAnalysisMap]     = useState({})
  const [summary,         setSummary]         = useState(null)
  const [selected,        setSelected]        = useState(null)
  const [loadingHoldings, setLoadingHoldings] = useState(true)
  const [loadingLtps,     setLoadingLtps]     = useState(false)
  const [liveSource,      setLiveSource]      = useState('static')

  useEffect(() => {
    async function fetchHoldings() {
      setLoadingHoldings(true)
      try {
        const token = localStorage.getItem('upstox_access_token') || ''
        const headers = { 'Content-Type':'application/json', 'X-Broker':'angelone' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res  = await fetch(`${API_BASE_URL}/api/holdings`, { headers })
        const data = await res.json()
        console.log('[PF] Holdings response:', data.status, data.holdings?.length)
        if (data.status === 'success' && Array.isArray(data.holdings) && data.holdings.length > 0) {
          const mapped = data.holdings
            .filter(h => (parseInt(h.quantity||h.qty)||0) > 0)
            .map(h => {
              const sym  = h.symbol || h.tradingsymbol || ''
              const meta = META[sym] || {}
              return {
                symbol:   sym,
                name:     h.name || sym,
                qty:      parseInt(h.quantity||h.qty) || 0,
                avg:      parseFloat(h.avgBuyPrice||h.averageprice||h.avg) || 0,
                ltp:      parseFloat(h.ltp) || 0,
                pnl:      parseFloat(h.pnl||h.profitandloss) || 0,
                pnlPct:   parseFloat(h.pnlPct||h.pnlpercentage) || 0,
                sector:   meta.sector || 'Other',
                cap:      meta.cap    || 'Unknown',
                instrKey: meta.instrKey || `NSE_EQ|${sym}`,
                isin:     h.isin || '',
              }
            })
          if (mapped.length > 0) {
            setHoldings(mapped)
            setLiveSource('angelone')
            const lm = {}
            mapped.forEach(h => { if (h.ltp > 0) lm[h.symbol] = h.ltp })
            setLtpMap(lm)
          }
          if (data.totalholding) {
            const t = data.totalholding
            setSummary({
              invested: parseFloat(t.totalinvvalue||t.totalholdingvalue) || 0,
              current:  parseFloat(t.totalholdingvalue) || 0,
              pnl:      parseFloat(t.totalprofitandloss) || 0,
              pnlPct:   parseFloat(t.totalpnlpercentage) || 0,
            })
          }
        }
      } catch(e) { console.warn('[PF] Holdings fetch error:', e.message) }
      setLoadingHoldings(false)
    }
    fetchHoldings()
  }, [])

  useEffect(() => {
    if (loadingHoldings || holdings.length === 0) return
    let cancelled = false
    async function fetchAll() {
      setLoadingLtps(true)
      for (let i = 0; i < holdings.length; i++) {
        if (cancelled) break
        const h = holdings[i]
        try {
          const token = localStorage.getItem('upstox_access_token') || ''
          const headers = { 'Content-Type':'application/json' }
          if (token) headers['Authorization'] = `Bearer ${token}`
          const res = await fetch(`${API_BASE_URL}/analyze`, {
            method:'POST', headers,
            body: JSON.stringify({ symbol:h.symbol, instrumentKey:h.instrKey, resolution:'15', mode:'tech' }),
          })
          const data = await res.json()
          const d = data?.data ?? data
          if (cancelled) break
          if (d?.price > 0) setLtpMap(prev => ({...prev, [h.symbol]: d.price}))
          else if (d?.ltp > 0) setLtpMap(prev => ({...prev, [h.symbol]: d.ltp}))
          if (d) setAnalysisMap(prev => ({...prev, [h.symbol]: d}))
        } catch(e) {}
        if (i < holdings.length-1) await new Promise(r => setTimeout(r, 500))
      }
      if (!cancelled) setLoadingLtps(false)
    }
    fetchAll()
    return () => { cancelled = true }
  }, [holdings, loadingHoldings])

  const cs = (() => {
    if (summary) return summary
    let invested=0, current=0
    holdings.forEach(h => {
      const ltp = ltpMap[h.symbol]||h.ltp||0
      invested += h.avg*h.qty
      if (ltp>0) current += ltp*h.qty
    })
    return { invested, current, pnl:current-invested, pnlPct:invested>0?(current-invested)/invested*100:0 }
  })()

  function handleSelect(holding, ltp, analysis, risk) { setSelected({holding,ltp,analysis,risk}) }

  return (
    <div style={{padding:'0 16px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <div>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:'var(--text)',margin:0}}>My Holdings</h2>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
            {loadingHoldings ? 'Fetching from Angel One...' :
              `${holdings.length} stocks · ${liveSource==='angelone'?'🟠 Angel One Live':'📋 Fallback'} · ${Object.keys(ltpMap).length}/${holdings.length} LTP loaded`}
          </div>
        </div>
        {cs.invested > 0 && (
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              {l:'Invested', v:fc(cs.invested), c:'var(--text)'},
              {l:'P&L', v:`${cs.pnl>=0?'+':''}${fc(cs.pnl)}`, c:cs.pnl>=0?'#22c55e':'#ef4444'},
              {l:'Return', v:`${cs.pnlPct>=0?'+':''}${r2(cs.pnlPct)}%`, c:cs.pnlPct>=0?'#22c55e':'#ef4444'},
            ].map(m => (
              <div key={m.l} style={{padding:'6px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8}}>
                <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.8}}>{m.l}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:13,color:m.c}}>{m.v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loadingHoldings && (
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>
          <div style={{marginBottom:8}}>🔄 Fetching your Angel One holdings...</div>
        </div>
      )}

      {!loadingHoldings && (
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'2fr 0.7fr 1fr 1fr 1fr 1.2fr 1.5fr',
            padding:'10px 16px',borderBottom:'1px solid var(--border)',
            fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',background:'var(--bg2)'}}>
            <span>Stock</span>
            <span style={{textAlign:'right'}}>Qty</span>
            <span style={{textAlign:'right'}}>Avg</span>
            <span style={{textAlign:'right'}}>LTP</span>
            <span style={{textAlign:'right'}}>Invested</span>
            <span style={{textAlign:'right'}}>P&amp;L</span>
            <span style={{textAlign:'right'}}>Risk / Action</span>
          </div>
          {holdings.map((h,idx) => (
            <HoldingRow key={h.symbol+idx} holding={h} idx={idx}
              ltp={ltpMap[h.symbol]||h.ltp||0}
              analysis={analysisMap[h.symbol]||null}
              onSelect={handleSelect}/>
          ))}
          <div style={{display:'grid',gridTemplateColumns:'2fr 0.7fr 1fr 1fr 1fr 1.2fr 1.5fr',
            padding:'12px 16px',background:'var(--bg2)',borderTop:'2px solid var(--border)',fontSize:13,fontWeight:700}}>
            <span style={{color:'var(--text)'}}>TOTAL ({holdings.length} stocks)</span>
            <span/><span/><span/>
            <span style={{textAlign:'right',fontFamily:"'DM Mono',monospace",color:'var(--text)'}}>{fc(cs.invested)}</span>
            <span style={{textAlign:'right',fontFamily:"'DM Mono',monospace",color:cs.pnl>=0?'#22c55e':'#ef4444'}}>
              {cs.pnl!==0?`${cs.pnl>=0?'+':''}${fc(cs.pnl)}`:'—'}
            </span>
            <span style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:12,color:cs.pnlPct>=0?'#22c55e':'#ef4444'}}>
              {cs.pnlPct!==0?`${cs.pnlPct>=0?'+':''}${r2(cs.pnlPct)}%`:'—'}
            </span>
          </div>
        </div>
      )}

      {selected && (
        <HoldingDetail holding={selected.holding} ltp={selected.ltp}
          analysis={selected.analysis} risk={selected.risk} onClose={()=>setSelected(null)}/>
      )}
    </div>
  )
}
