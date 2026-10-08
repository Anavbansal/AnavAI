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

function analyzeRisk(holding, ltp, analysis, allHoldings, ltpMap) {
  if (!ltp || ltp <= 0) return null
  let score = 0
  const signals = []
  const positives = []
  const pnlPct = holding.avg > 0 ? (ltp - holding.avg) / holding.avg * 100 : 0

  // ── 1. P&L Risk (max 30 pts) ──
  if      (pnlPct <= -40) { score += 30; signals.push('Massive loss >40% — exit risk high') }
  else if (pnlPct <= -25) { score += 22; signals.push('Large loss >25% — reassess thesis') }
  else if (pnlPct <= -15) { score += 15; signals.push('Moderate loss >15% — tighten SL') }
  else if (pnlPct <= -8)  { score += 8;  signals.push('Minor loss >8% — watch closely') }
  else if (pnlPct >= 120) { score += 20; signals.push('Extreme gain >120% — book partial profits') }
  else if (pnlPct >= 60)  { score += 12; signals.push('Large gain >60% — trail stop loss') }
  else if (pnlPct >= 30)  { score += 5;  signals.push('Good gain >30% — protect with SL') }
  else if (pnlPct >= 10)  { positives.push(`Comfortable gain ${r2(pnlPct)}%`) }

  // ── 2. Technical indicators (max 50 pts) ──
  if (analysis) {
    const rsi = analysis.rsi ?? analysis.indicators?.rsi
    if (typeof rsi === 'number') {
      if      (rsi > 82)  { score += 20; signals.push(`RSI severely overbought (${Math.round(rsi)}) — reversal risk`) }
      else if (rsi > 72)  { score += 13; signals.push(`RSI overbought (${Math.round(rsi)}) — caution`) }
      else if (rsi < 22)  { score += 18; signals.push(`RSI severely oversold (${Math.round(rsi)}) — panic zone`) }
      else if (rsi < 32)  { score += 10; signals.push(`RSI oversold (${Math.round(rsi)}) — weak momentum`) }
      else if (rsi >= 45 && rsi <= 60) { score -= 6; positives.push(`RSI healthy (${Math.round(rsi)})`) }
    }

    const st = analysis.supertrend || analysis.indicators?.supertrend
    const stDir = typeof st === 'string' ? st.toLowerCase() : (st?.direction || '').toLowerCase()
    if (stDir === 'sell' || stDir === 'down') { score += 18; signals.push('Supertrend bearish — downtrend active') }
    else if (stDir === 'buy' || stDir === 'up') { score -= 8; positives.push('Supertrend bullish') }

    const macd = analysis.macd || analysis.indicators?.macd
    if (macd) {
      if (macd.histogram < 0 && macd.crossover === 'bearish') { score += 14; signals.push('MACD bearish crossover — momentum falling') }
      else if (macd.histogram < 0) { score += 7; signals.push('MACD negative — weak momentum') }
      else if (macd.histogram > 0 && macd.crossover === 'bullish') { score -= 7; positives.push('MACD bullish crossover') }
      else if (macd.histogram > 0) { score -= 4; positives.push('MACD positive') }
    }

    const adx = analysis.adx || analysis.indicators?.adx
    const adxVal = typeof adx === 'number' ? adx : adx?.adx ?? adx?.ADX
    if (adxVal > 35 && pnlPct < 0) { score += 12; signals.push(`Strong downtrend (ADX ${Math.round(adxVal)}) — avoid averaging`) }
    else if (adxVal > 25 && pnlPct < 0) { score += 6; signals.push(`Trending down (ADX ${Math.round(adxVal)})`) }
    else if (adxVal > 25 && pnlPct > 0) { score -= 4; positives.push(`Strong trend up (ADX ${Math.round(adxVal)})`) }

    const vwap = analysis.vwap || analysis.indicators?.vwap
    if (vwap && ltp < vwap * 0.97) { score += 7; signals.push('Price below VWAP — sellers in control') }
    else if (vwap && ltp > vwap * 1.03) { score -= 4; positives.push('Price above VWAP — buyers in control') }

    // Bollinger bands
    const bb = analysis.bollingerBands || analysis.bb || analysis.indicators?.bb
    if (bb) {
      if (ltp < bb.lower) { score += 8; signals.push('Below Bollinger lower band — oversold') }
      else if (ltp > bb.upper) { score += 10; signals.push('Above Bollinger upper — overbought') }
    }
  }

  // ── 3. Cap & Sector Risk (max 20 pts) ──
  const cap = holding.cap || 'Unknown'
  if      (cap === 'SmallCap')  { score += 15; signals.push('SmallCap — higher volatility & liquidity risk') }
  else if (cap === 'MidCap')    { score += 8;  signals.push('MidCap — moderate volatility') }
  else if (cap === 'Unknown')   { score += 10; signals.push('Cap unknown — assume elevated risk') }
  else if (cap === 'LargeCap')  { score -= 4;  positives.push('LargeCap — institutional support') }

  const riskySectors = ['Realty','Chemicals','Renewable','Defence','Metals']
  const safeSectors  = ['Banking','IT','Finance']
  if (riskySectors.includes(holding.sector)) { score += 6; signals.push(`${holding.sector} — cyclical sector risk`) }
  else if (safeSectors.includes(holding.sector)) { score -= 3; positives.push(`${holding.sector} — relatively stable sector`) }

  // ── 4. Concentration Risk (max 15 pts) ──
  let concentrationPct = 0
  if (allHoldings && ltpMap) {
    const totalPortValue = allHoldings.reduce((sum, h) => {
      const hLtp = ltpMap[h.symbol] || h.ltp || h.avg || 0
      return sum + hLtp * h.qty
    }, 0)
    const thisValue = ltp * holding.qty
    concentrationPct = totalPortValue > 0 ? (thisValue / totalPortValue * 100) : 0
    if      (concentrationPct > 30) { score += 15; signals.push(`High concentration: ${r2(concentrationPct)}% of portfolio`) }
    else if (concentrationPct > 20) { score += 8;  signals.push(`Elevated concentration: ${r2(concentrationPct)}% of portfolio`) }
    else if (concentrationPct > 10) { score += 3 }
    else if (concentrationPct < 5)  { score -= 2;  positives.push(`Well-diversified: ${r2(concentrationPct)}% weight`) }
  }

  // ── 5. Drawdown Severity (max 10 pts) ──
  // If price far below avg, holding is underwater — more risk
  const drawdownFromAvg = pnlPct < 0 ? Math.abs(pnlPct) : 0
  if (drawdownFromAvg > 35) { score += 10; signals.push(`${r2(drawdownFromAvg)}% below avg — deep drawdown`) }
  else if (drawdownFromAvg > 20) { score += 5 }

  score = Math.min(100, Math.max(0, score))

  let riskLevel, riskColor, riskEmoji, action, actionColor, riskBand
  if (score >= 65) {
    riskLevel='VERY HIGH'; riskColor='#dc2626'; riskEmoji='🔴'; action='EXIT / REDUCE NOW'; actionColor='#dc2626'; riskBand='A'
  } else if (score >= 45) {
    riskLevel='HIGH RISK'; riskColor='#ef4444'; riskEmoji='🟠'; action='EXIT / REDUCE'; actionColor='#ef4444'; riskBand='B'
  } else if (score >= 28) {
    riskLevel='MEDIUM'; riskColor='#f59e0b'; riskEmoji='🟡'; action='HOLD WITH SL'; actionColor='#f59e0b'; riskBand='C'
  } else if (score >= 12) {
    riskLevel='LOW-MED'; riskColor='#84cc16'; riskEmoji='🟢'; action='HOLD / WATCH'; actionColor='#84cc16'; riskBand='D'
  } else {
    riskLevel='LOW RISK'; riskColor='#22c55e'; riskEmoji='✅'; action='HOLD / BUY MORE'; actionColor='#22c55e'; riskBand='E'
  }

  let stopLoss = 0, target = 0
  if (analysis) {
    const atr = analysis.atr || analysis.indicators?.atr || 0
    const sup  = analysis.support  || analysis.indicators?.support || 0
    const res  = analysis.resistance || analysis.indicators?.resistance || 0
    stopLoss = sup > 0 ? Math.max(sup, ltp - 1.8*atr) : (atr > 0 ? ltp - 2*atr : 0)
    target   = res > 0 ? res : (atr > 0 ? ltp + 2.5*atr : 0)
    stopLoss = stopLoss > 0 ? Math.round(stopLoss*100)/100 : 0
    target   = target > 0   ? Math.round(target*100)/100 : 0
  }

  // Long-term view
  let ltView = '', ltColor = 'var(--text3)'
  if (pnlPct >= 60) { ltView = '📈 Multi-bagger potential — trail SL & hold'; ltColor='#22c55e' }
  else if (pnlPct >= 25) { ltView = '📊 Strong performer — protect gains with SL'; ltColor='#84cc16' }
  else if (pnlPct >= 0)  { ltView = '🟢 Positive — accumulate on dips'; ltColor='#22c55e' }
  else if (pnlPct >= -15){ ltView = '⏳ In drawdown — give time, review in 3 months'; ltColor='#f59e0b' }
  else if (pnlPct >= -30){ ltView = '⚠️ Significant loss — check fundamentals, set SL'; ltColor='#f97316' }
  else               { ltView = '🔴 Deep loss — cut or significantly reduce'; ltColor='#ef4444' }

  return {
    riskScore: score, riskLevel, riskColor, riskEmoji, action, actionColor, riskBand,
    stopLoss, target, signals, positives, concentrationPct, ltView, ltColor
  }
}

function HoldingRow({ holding, idx, ltp, analysis, onSelect, allHoldings, ltpMap }) {
  const risk    = (ltp && ltp > 0) ? analyzeRisk(holding, ltp, analysis, allHoldings, ltpMap) : null
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
          <div style={{display:'inline-block',padding:'2px 7px',borderRadius:8,
            background:risk.riskColor+'20',border:`1px solid ${risk.riskColor}44`,marginBottom:3}}>
            <span style={{fontSize:10,fontWeight:700,color:risk.riskColor}}>{risk.riskEmoji} {risk.riskLevel}</span>
          </div>
          <div style={{fontSize:9,fontWeight:600,color:risk.actionColor}}>{risk.action}</div>
          {risk.stopLoss>0 && <div style={{fontSize:8,color:'var(--text3)',marginTop:1}}>SL ₹{risk.stopLoss}</div>}
        </div>) : <span style={{fontSize:10,color:'var(--text3)'}}>analyzing...</span>}
      </div>
    </div>
  )
}

function HoldingDetail({ holding, ltp, analysis, risk, onClose }) {
  if (!holding) return null
  const ltpVal   = ltp || holding.ltp || holding.avg
  const invested  = holding.avg * holding.qty
  const current   = ltpVal * holding.qty
  const pnlAmt    = current - invested
  const pnlPct    = holding.avg > 0 ? (ltpVal - holding.avg) / holding.avg * 100 : 0
  const bull       = pnlAmt >= 0

  // Extra metrics
  const breakeven  = holding.avg // break-even = avg cost (ignoring brokerage)
  const dayChange  = analysis?.change  || analysis?.dayChange  || 0
  const dayChangePct = analysis?.changePct || analysis?.dayChangePct || 0
  const highW52    = analysis?.high52w || analysis?.high_52w || 0
  const lowW52     = analysis?.low52w  || analysis?.low_52w  || 0
  const drawdownFromHigh = highW52 > 0 ? ((highW52 - ltpVal) / highW52 * 100) : 0
  const upFromLow  = lowW52 > 0 ? ((ltpVal - lowW52) / lowW52 * 100) : 0
  const rsi        = analysis?.rsi ?? analysis?.indicators?.rsi

  // P&L breakdown
  const perSharePnl = ltpVal - holding.avg
  const dayPnlAmt  = dayChange * holding.qty

  const sectionTitle = (t) => (
    <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:1,
      textTransform:'uppercase',marginBottom:10,marginTop:20,paddingBottom:6,
      borderBottom:'1px solid var(--border)'}}>{t}</div>
  )

  const StatCard = ({label, value, color, sub, big}) => (
    <div style={{padding:'10px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10}}>
      <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.8,marginBottom:4}}>{label}</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:big?16:13,color:color||'var(--text)'}}>{value}</div>
      {sub && <div style={{fontSize:9,color:'var(--text3)',marginTop:2}}>{sub}</div>}
    </div>
  )

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.80)',zIndex:9999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,
        width:'100%',maxWidth:520,maxHeight:'92vh',overflowY:'auto',padding:24}} onClick={e=>e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:'var(--text)'}}>{holding.symbol}</span>
              {holding.sector && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:600,
                background:(SECTOR_COLOR[holding.sector]||'#666')+'22',color:SECTOR_COLOR[holding.sector]||'#888'}}>{holding.sector}</span>}
              {holding.cap && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:600,
                background:'var(--bg2)',color:'var(--text3)'}}>{holding.cap}</span>}
              {risk && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,
                background:risk.riskColor+'20',color:risk.riskColor}}>{risk.riskEmoji} {risk.riskLevel}</span>}
            </div>
            <div style={{fontSize:12,color:'var(--text3)'}}>{holding.name||holding.symbol} · {holding.qty} shares</div>
          </div>
          <button onClick={onClose} style={{background:'var(--bg2)',border:'none',color:'var(--text3)',
            cursor:'pointer',fontSize:18,width:32,height:32,borderRadius:8,flexShrink:0,
            display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>

        {/* ── LTP Hero ── */}
        <div style={{padding:'14px 18px',background:'var(--bg2)',borderRadius:14,marginBottom:4,
          border:`1px solid ${bull?'#22c55e33':'#ef444433'}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:10,color:'var(--text3)',marginBottom:3}}>CURRENT PRICE</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:28,
                color:bull?'#22c55e':'#ef4444'}}>₹{r2(ltpVal)}</div>
              {dayChange !== 0 && (
                <div style={{fontSize:11,color:dayChange>=0?'#22c55e':'#ef4444',marginTop:2}}>
                  {dayChange>=0?'▲':'▼'} ₹{Math.abs(r2(dayChange))} ({dayChange>=0?'+':''}{r2(dayChangePct)}%) today
                </div>
              )}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10,color:'var(--text3)',marginBottom:3}}>TOTAL P&L</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:24,
                color:bull?'#22c55e':'#ef4444'}}>{bull?'+':''}{fc(pnlAmt)}</div>
              <div style={{fontSize:13,color:bull?'#22c55e':'#ef4444',fontWeight:700}}>
                {bull?'+':''}{r2(pnlPct)}%
              </div>
            </div>
          </div>
        </div>

        {/* ── Core Stats Grid ── */}
        {sectionTitle('Position Details')}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          <StatCard label="AVG COST" value={`₹${r2(holding.avg)}`} />
          <StatCard label="QUANTITY" value={holding.qty} sub={`${holding.qty} shares`} />
          <StatCard label="INVESTED" value={fc(invested)} />
          <StatCard label="CURRENT VALUE" value={fc(current)} color={bull?'#22c55e':'#ef4444'} />
          <StatCard label="PER SHARE P&L" value={`${perSharePnl>=0?'+':''}₹${r2(perSharePnl)}`} color={bull?'#22c55e':'#ef4444'} />
          <StatCard label="BREAK-EVEN" value={`₹${r2(breakeven)}`} sub="cost price" color='var(--text2)' />
        </div>

        {/* ── Day's P&L ── */}
        {dayChange !== 0 && (
          <>
            {sectionTitle("Today's Impact")}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              <StatCard label="DAY CHANGE/SHARE" value={`${dayChange>=0?'+':''}₹${r2(dayChange)}`} color={dayChange>=0?'#22c55e':'#ef4444'} />
              <StatCard label="DAY P&L (YOUR QTY)" value={`${dayPnlAmt>=0?'+':''}₹${Math.round(dayPnlAmt).toLocaleString('en-IN')}`} color={dayPnlAmt>=0?'#22c55e':'#ef4444'} />
            </div>
          </>
        )}

        {/* ── 52W Range ── */}
        {(highW52 > 0 || lowW52 > 0) && (
          <>
            {sectionTitle('52-Week Range')}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
              {lowW52  > 0 && <StatCard label="52W LOW"  value={`₹${r2(lowW52)}`}  color='#ef4444' sub={`+${r2(upFromLow)}% from low`} />}
              {highW52 > 0 && <StatCard label="52W HIGH" value={`₹${r2(highW52)}`} color='#22c55e' sub={`${r2(drawdownFromHigh)}% from high`} />}
              {highW52 > 0 && <StatCard label="FROM 52W HIGH" value={`-${r2(drawdownFromHigh)}%`} color={drawdownFromHigh>30?'#ef4444':drawdownFromHigh>15?'#f59e0b':'#22c55e'} />}
            </div>
            {highW52 > 0 && lowW52 > 0 && (
              <div style={{marginBottom:4}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--text3)',marginBottom:4}}>
                  <span>₹{r2(lowW52)}</span>
                  <span style={{color:'var(--text2)',fontWeight:600}}>Current ₹{r2(ltpVal)}</span>
                  <span>₹{r2(highW52)}</span>
                </div>
                <div style={{height:6,background:'var(--border)',borderRadius:6,position:'relative'}}>
                  <div style={{
                    position:'absolute',left:0,top:0,height:'100%',borderRadius:6,
                    width:`${Math.min(100,Math.max(0,((ltpVal-lowW52)/(highW52-lowW52))*100))}%`,
                    background:'linear-gradient(90deg,#ef4444,#f59e0b,#22c55e)'
                  }}/>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Technical Snapshot ── */}
        {analysis && (
          <>
            {sectionTitle('Technical Snapshot')}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {typeof rsi === 'number' && (
                <StatCard label="RSI (14)" value={Math.round(rsi)}
                  color={rsi>70?'#ef4444':rsi<30?'#f59e0b':'#22c55e'}
                  sub={rsi>70?'Overbought':rsi<30?'Oversold':'Neutral'} />
              )}
              {analysis.atr || analysis.indicators?.atr ? (
                <StatCard label="ATR (Volatility)"
                  value={`₹${r2(analysis.atr||analysis.indicators?.atr)}`}
                  sub="avg true range" color='var(--text2)' />
              ) : null}
              {(analysis.vwap||analysis.indicators?.vwap) ? (
                <StatCard label="VWAP"
                  value={`₹${r2(analysis.vwap||analysis.indicators?.vwap)}`}
                  color={ltpVal>(analysis.vwap||analysis.indicators?.vwap)?'#22c55e':'#ef4444'}
                  sub={ltpVal>(analysis.vwap||analysis.indicators?.vwap)?'Above VWAP':'Below VWAP'} />
              ) : null}
              {(analysis.support||analysis.indicators?.support) ? (
                <StatCard label="SUPPORT" value={`₹${r2(analysis.support||analysis.indicators?.support)}`} color='#22c55e' />
              ) : null}
              {(analysis.resistance||analysis.indicators?.resistance) ? (
                <StatCard label="RESISTANCE" value={`₹${r2(analysis.resistance||analysis.indicators?.resistance)}`} color='#ef4444' />
              ) : null}
            </div>
          </>
        )}

        {/* ── Risk Analysis ── */}
        {risk && (
          <>
            {sectionTitle('Risk Analysis')}
            <div style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:12,color:'var(--text2)'}}>Risk Score</span>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {risk.concentrationPct > 0 && (
                    <span style={{fontSize:10,color:'var(--text3)'}}>
                      {r2(risk.concentrationPct)}% of portfolio
                    </span>
                  )}
                  <span style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:16,color:risk.riskColor}}>
                    {risk.riskScore}/100
                  </span>
                </div>
              </div>
              <div style={{height:10,background:'var(--border)',borderRadius:10,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${risk.riskScore}%`,
                  background:`linear-gradient(90deg,#22c55e 0%,#f59e0b 50%,#ef4444 80%,#dc2626 100%)`,
                  transition:'width .6s',borderRadius:10}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--text3)',marginTop:3}}>
                <span>LOW</span><span>MEDIUM</span><span>HIGH</span><span>VERY HIGH</span>
              </div>
            </div>

            {/* Action Box */}
            <div style={{padding:'14px 16px',borderRadius:12,marginBottom:12,
              background:risk.actionColor+'15',border:`1.5px solid ${risk.actionColor}44`}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:risk.actionColor,marginBottom:10}}>
                {risk.riskEmoji} {risk.action}
              </div>
              <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                {risk.stopLoss>0 && <div>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>🛡 STOP LOSS</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:'#ef4444'}}>{fc(risk.stopLoss)}</div>
                  <div style={{fontSize:9,color:'var(--text3)'}}>({r2((risk.stopLoss-ltpVal)/ltpVal*100)}% from LTP)</div>
                </div>}
                {risk.target>0 && <div>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>🎯 TARGET</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:16,color:'#22c55e'}}>{fc(risk.target)}</div>
                  <div style={{fontSize:9,color:'var(--text3)'}}>({r2((risk.target-ltpVal)/ltpVal*100)}% upside)</div>
                </div>}
                {risk.stopLoss>0 && risk.target>0 && (
                  <div>
                    <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>⚖️ RISK:REWARD</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,color:'var(--text)'}}>
                      1:{r2((risk.target-ltpVal)/Math.max(1,ltpVal-risk.stopLoss))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Risk signals */}
            {risk.signals?.length > 0 && (
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,color:'#ef4444',letterSpacing:.8,marginBottom:6}}>⚠️ RISK SIGNALS</div>
                {risk.signals.map((s,i) => (
                  <div key={i} style={{fontSize:11,color:'var(--text3)',padding:'3px 0',
                    borderBottom:'1px solid var(--border)50',display:'flex',alignItems:'flex-start',gap:6}}>
                    <span style={{color:'#ef4444',flexShrink:0}}>•</span>{s}
                  </div>
                ))}
              </div>
            )}

            {/* Positives */}
            {risk.positives?.length > 0 && (
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,color:'#22c55e',letterSpacing:.8,marginBottom:6}}>✅ POSITIVES</div>
                {risk.positives.map((s,i) => (
                  <div key={i} style={{fontSize:11,color:'var(--text3)',padding:'3px 0',
                    borderBottom:'1px solid var(--border)50',display:'flex',alignItems:'flex-start',gap:6}}>
                    <span style={{color:'#22c55e',flexShrink:0}}>•</span>{s}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Long-Term View ── */}
        {risk?.ltView && (
          <>
            {sectionTitle('Long-Term View')}
            <div style={{padding:'12px 16px',borderRadius:12,marginBottom:16,
              background:'var(--bg2)',border:'1px solid var(--border)'}}>
              <div style={{fontSize:13,fontWeight:600,color:risk.ltColor,marginBottom:8}}>{risk.ltView}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:11,color:'var(--text3)'}}>
                <div>📌 Avg Cost: <b style={{color:'var(--text2)'}}>₹{r2(holding.avg)}</b></div>
                <div>📦 Qty held: <b style={{color:'var(--text2)'}}>{holding.qty} shares</b></div>
                <div>💰 Invested: <b style={{color:'var(--text2)'}}>{fc(invested)}</b></div>
                <div>📊 Current: <b style={{color:bull?'#22c55e':'#ef4444'}}>{fc(current)}</b></div>
                {holding.sector && <div>🏭 Sector: <b style={{color:'var(--text2)'}}>{holding.sector}</b></div>}
                {holding.cap && <div>🏦 Cap: <b style={{color:'var(--text2)'}}>{holding.cap}</b></div>}
              </div>
              {/* Profit projection */}
              <div style={{marginTop:12,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',letterSpacing:.8,marginBottom:6}}>IF STOCK MOVES TO...</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[10, 20, 50, 100].map(pct => {
                    const targetPrice = holding.avg * (1 + pct/100)
                    const projPnl = (targetPrice - holding.avg) * holding.qty
                    return (
                      <div key={pct} style={{padding:'5px 8px',borderRadius:8,background:'#22c55e11',border:'1px solid #22c55e33',
                        textAlign:'center',minWidth:68}}>
                        <div style={{fontSize:9,color:'var(--text3)'}}>+{pct}%</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:'#22c55e'}}>₹{r2(targetPrice)}</div>
                        <div style={{fontSize:9,color:'#84cc16'}}>+{fc(projPnl)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Actions ── */}
        <div style={{display:'flex',gap:8}}>
          <a href={`https://www.angelone.in/trade/${holding.symbol}`} target="_blank" rel="noopener noreferrer"
            style={{flex:1,display:'block',padding:'11px',borderRadius:10,border:'1px solid #F07B24',
              color:'#F07B24',fontWeight:700,fontSize:13,textAlign:'center',textDecoration:'none'}}>
            🟠 Angel One
          </a>
          <a href={`https://finance.yahoo.com/quote/${holding.symbol}.NS`} target="_blank" rel="noopener noreferrer"
            style={{flex:1,display:'block',padding:'11px',borderRadius:10,border:'1px solid var(--border)',
              color:'var(--text2)',fontWeight:600,fontSize:13,textAlign:'center',textDecoration:'none'}}>
            📈 Yahoo Finance
          </a>
          <a href={`https://www.screener.in/company/${holding.symbol}/`} target="_blank" rel="noopener noreferrer"
            style={{flex:1,display:'block',padding:'11px',borderRadius:10,border:'1px solid var(--border)',
              color:'var(--text2)',fontWeight:600,fontSize:13,textAlign:'center',textDecoration:'none'}}>
            🔍 Screener.in
          </a>
        </div>
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

  function handleSelect(holding, ltp, analysis) {
    const risk = (ltp && ltp > 0) ? analyzeRisk(holding, ltp, analysis, holdings, ltpMap) : null
    setSelected({holding,ltp,analysis,risk})
  }

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
              onSelect={handleSelect}
              allHoldings={holdings}
              ltpMap={ltpMap}/>
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
