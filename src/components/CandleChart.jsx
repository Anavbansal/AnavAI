import React, { useMemo, useState, useRef, useEffect } from 'react'
import { calcEMASeries } from '../utils/indicators'

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green:'#00c076', red:'#ff3b30', blue:'#5865f2',
  yellow:'#f59e0b', purple:'#a78bfa', orange:'#f97316',
  bg:'#0b0f19', card:'#111827', border:'#1a2535', dim:'#3a5a7a',
  text:'#94a3b8', white:'#e2e8f0',
}

const TIMEFRAMES = [
  { label:'1m',  res:'1',  bars:120, time:true  },
  { label:'5m',  res:'5',  bars:120, time:true  },
  { label:'10m', res:'10', bars:100, time:true  },
  { label:'30m', res:'30', bars:100, time:true  },
  { label:'1H',  res:'60', bars:80,  time:true  },
  { label:'1D',  res:'D',  bars:365, time:false },
  { label:'1W',  res:'W',  bars:104, time:false },
  { label:'1M',  res:'M',  bars:60,  time:false },
]

const OVERLAYS = [
  { key:'ema9',  label:'EMA9',  color:C.orange },
  { key:'ema20', label:'EMA20', color:C.blue   },
  { key:'ema50', label:'EMA50', color:C.purple },
  { key:'ema200',label:'EMA200',color:C.red    },
  { key:'vwap',  label:'VWAP',  color:C.yellow, dash:true },
  { key:'bb',    label:'BB',    color:'#38bdf8', dash:true },
]

// ─── Canvas Candle Chart ───────────────────────────────────────────────────────
function CandleCanvas({ candles, overlays, width, height, ai }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !candles?.length) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const pad = { top:8, right:62, bottom:24, left:8 }
    const W = width  - pad.left - pad.right
    const H = height - pad.top  - pad.bottom

    // Price range
    const highs  = candles.map(c => c.high)
    const lows   = candles.map(c => c.low)
    const minP   = Math.min(...lows)  * 0.9985
    const maxP   = Math.max(...highs) * 1.0015
    const range  = maxP - minP || 1

    const px = (i)  => pad.left + (i + 0.5) * (W / candles.length)
    const py = (p)  => pad.top  + H - ((p - minP) / range) * H
    const bw = Math.max(1.5, Math.min(12, W / candles.length * 0.65))

    // Grid lines
    ctx.strokeStyle = '#1a2535'
    ctx.lineWidth   = 0.5
    const gridCount = 5
    for (let i = 0; i <= gridCount; i++) {
      const p   = minP + (range * i / gridCount)
      const y   = py(p)
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke()
      // Price labels
      ctx.fillStyle  = '#3a5a7a'
      ctx.font       = '9px JetBrains Mono, monospace'
      ctx.textAlign  = 'left'
      ctx.fillText('₹' + Math.round(p).toLocaleString('en-IN'), width - pad.right + 4, y + 3)
    }

    // Overlay lines (behind candles)
    function drawLine(key, color, dash = false) {
      if (!overlays[key]) return
      const vals = candles.map(c => c[key])
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth   = key === 'ema20' ? 1.6 : 1.2
      ctx.setLineDash(dash ? [4,3] : [])
      let started = false
      for (let i = 0; i < candles.length; i++) {
        if (vals[i] == null) continue
        const x = px(i), y = py(vals[i])
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    drawLine('bb_upper', '#38bdf8', true)
    drawLine('bb_lower', '#38bdf8', true)
    drawLine('vwap',  C.yellow, true)
    drawLine('ema200',C.red)
    drawLine('ema50', C.purple)
    drawLine('ema20', C.blue)
    drawLine('ema9',  C.orange)

    // Candles
    for (let i = 0; i < candles.length; i++) {
      const c    = candles[i]
      const bull = c.close >= c.open
      const clr  = bull ? C.green : C.red
      const x    = px(i)
      const openY  = py(c.open)
      const closeY = py(c.close)
      const highY  = py(c.high)
      const lowY   = py(c.low)

      // Wick
      ctx.strokeStyle = clr
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, Math.min(openY, closeY))
      ctx.moveTo(x, Math.max(openY, closeY))
      ctx.lineTo(x, lowY)
      ctx.stroke()

      // Body
      const bodyTop = Math.min(openY, closeY)
      const bodyH   = Math.max(Math.abs(closeY - openY), 1)
      ctx.fillStyle = clr
      ctx.globalAlpha = bull ? 0.95 : 0.85
      ctx.fillRect(x - bw/2, bodyTop, bw, bodyH)
      ctx.globalAlpha = 1
    }

    // AI reference lines
    function drawRefLine(price, color, label) {
      if (!price || price <= 0) return
      const y = py(price)
      if (y < pad.top || y > height - pad.bottom) return
      ctx.setLineDash([4,3])
      ctx.strokeStyle = color
      ctx.lineWidth   = 1.2
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.font      = '9px JetBrains Mono, monospace'
      ctx.textAlign = 'left'
      ctx.fillText(label + ' ₹' + Math.round(price).toLocaleString('en-IN'), width - pad.right + 4, y - 2)
    }

    if (ai) {
      drawRefLine(ai.entry,    C.blue,  'E')
      drawRefLine(ai.target,   C.green, 'T')
      drawRefLine(ai.stopLoss, C.red,   'SL')
    }

    // X-axis labels
    ctx.fillStyle = '#3a5a7a'
    ctx.font = '9px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    const labelStep = Math.max(1, Math.floor(candles.length / 7))
    for (let i = 0; i < candles.length; i += labelStep) {
      const c = candles[i]
      if (!c) continue
      ctx.fillText(c.label || '', px(i), height - pad.bottom + 14)
    }

  }, [candles, overlays, width, height, ai])

  return <canvas ref={canvasRef} style={{ width, height, display:'block' }}/>
}

// ─── Volume bars (canvas) ─────────────────────────────────────────────────────
function VolumeCanvas({ candles, width, height }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !candles?.length) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const pad = { right:62, left:8, top:2, bottom:2 }
    const W   = width - pad.left - pad.right
    const H   = height - pad.top - pad.bottom
    const bw  = Math.max(1, Math.min(10, W / candles.length * 0.65))
    const maxV = Math.max(...candles.map(c => c.volume)) || 1

    for (let i = 0; i < candles.length; i++) {
      const c    = candles[i]
      const bull = c.close >= c.open
      const x    = pad.left + (i + 0.5) * (W / candles.length)
      const barH = (c.volume / maxV) * H
      ctx.fillStyle   = bull ? C.green : C.red
      ctx.globalAlpha = 0.35
      ctx.fillRect(x - bw/2, H - barH + pad.top, bw, barH)
      ctx.globalAlpha = 1
    }
  }, [candles, width, height])

  return <canvas ref={canvasRef} style={{ width, height, display:'block' }}/>
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function CandleChart({ data, ai, onTfChange, activeTfi }) {
  const [tfi,    setTfi]    = useState(1)
  // Sync with parent-controlled TF if provided
  const effectiveTfi = activeTfi !== undefined ? activeTfi : tfi
  const [active, setActive] = useState({ ema20:true, vwap:true })
  const [size,   setSize]   = useState({ w:800, h:320 })
  const containerRef = useRef(null)
  const tf = TIMEFRAMES[effectiveTfi]

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) setSize({ w, h:320 })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const candles = useMemo(() => {
    if (!data?.candles?.length) return []
    const all    = data.candles
    const slice  = all.slice(-tf.bars)
    const closes = all.map(c => c.close)
    const e9   = calcEMASeries(closes, 9)
    const e20  = calcEMASeries(closes, 20)
    const e50  = calcEMASeries(closes, 50)
    const e200 = calcEMASeries(closes, 200)

    // BB
    const bbu = [], bbl = []
    for (let i = 0; i < closes.length; i++) {
      if (i < 19) { bbu.push(null); bbl.push(null); continue }
      const sl = closes.slice(i-19, i+1)
      const m  = sl.reduce((a,b) => a+b,0) / 20
      const sd = Math.sqrt(sl.reduce((s,v) => s+(v-m)**2,0) / 20)
      bbu.push(+(m+2*sd).toFixed(2)); bbl.push(+(m-2*sd).toFixed(2))
    }

    const si = all.length - slice.length
    return slice.map((c, i) => {
      const gi = si + i
      const ts = new Date(c.timestamp)
      return {
        ...c,
        label: tf.time
          ? ts.toLocaleTimeString('en-IN',  { hour:'2-digit', minute:'2-digit' })
          : ts.toLocaleDateString('en-IN',  { day:'2-digit',  month:'short' }),
        ema9:  e9[gi]  ?? null,
        ema20: e20[gi] ?? null,
        ema50: e50[gi] ?? null,
        ema200:e200[gi]?? null,
        vwap:  data.vwap,
        bb_upper: bbu[gi] ?? null,
        bb_lower: bbl[gi] ?? null,
      }
    })
  }, [data, effectiveTfi])

  if (!data) return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
      height:420, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
      <div style={{ fontSize:52, opacity:.1 }}>📊</div>
      <div style={{ color:C.dim, fontSize:13 }}>Search and analyze a symbol to view chart</div>
    </div>
  )

  const last  = candles[candles.length-1]
  const prev  = candles[candles.length-2]
  const pclr  = (last?.close ?? 0) >= (prev?.close ?? 0) ? C.green : C.red
  const price = data.price || last?.close || 0
  const fmtP  = n => n?.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) ?? '–'

  // Overlay map for canvas
  const overlayMap = {
    ema9:  active.ema9,
    ema20: active.ema20,
    ema50: active.ema50,
    ema200:active.ema200,
    vwap:  active.vwap,
    bb:    active.bb,
  }

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 14px', borderBottom:`1px solid ${C.border}`, gap:10, flexWrap:'wrap', background:'#0d1420' }}>
        <div>
          <span style={{ fontWeight:700, fontSize:15, color:C.white }}>{data.symbol || data.stock}</span>
          <span style={{ marginLeft:10, fontFamily:'JetBrains Mono,monospace', fontSize:16, fontWeight:700, color:pclr }}>
            ₹{fmtP(price)}
          </span>
          {data.changePct != null && (
            <span style={{ marginLeft:6, fontSize:12, color:pclr }}>
              {data.changePct>=0?'+':''}{Number(data.changePct).toFixed(2)}%
            </span>
          )}
        </div>

        {/* Timeframe */}
        <div style={{ display:'flex', gap:2, marginLeft:'auto', background:'#0b0f19', borderRadius:7, padding:3, border:`1px solid ${C.border}` }}>
          {TIMEFRAMES.map((t,i) => (
            <button key={t.label} onClick={() => { setTfi(i); if(onTfChange) onTfChange(t.res, i); }}
              style={{
                padding:'3px 9px', borderRadius:5, cursor:'pointer', border:'none',
                fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:600,
                background: effectiveTfi===i ? '#1e2a3d' : 'transparent',
                color:      effectiveTfi===i ? C.white    : C.dim,
                outline:    effectiveTfi===i ? `1px solid #2a3f5f` : 'none',
                transition:'all .15s',
              }}>{t.label}</button>
          ))}
        </div>

        {/* Overlays */}
        <div style={{ display:'flex', gap:3 }}>
          {OVERLAYS.map(o => (
            <button key={o.key} onClick={() => setActive(a=>({...a,[o.key]:!a[o.key]}))}
              style={{
                fontSize:9, padding:'2px 8px', borderRadius:4, cursor:'pointer',
                background: active[o.key] ? `${o.color}22` : 'transparent',
                border: `1px solid ${active[o.key] ? o.color : C.border}`,
                color:  active[o.key] ? o.color : C.dim,
                transition:'all .15s',
              }}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* Canvas chart */}
      <div ref={containerRef} style={{ flex:1, position:'relative', minHeight:320 }}>
        {candles.length > 0
          ? <CandleCanvas candles={candles} overlays={overlayMap} width={size.w} height={size.h} ai={ai}/>
          : (
            <div style={{ height:320, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
              <div className="anim-spin" style={{ width:24, height:24, border:`3px solid ${C.border}`, borderTopColor:C.blue, borderRadius:'50%' }}/>
              <div style={{ color:C.dim, fontSize:12 }}>Loading candles...</div>
            </div>
          )
        }
      </div>

      {/* Volume */}
      {candles.length > 0 && (
        <div style={{ borderTop:`1px solid ${C.border}22` }}>
          <VolumeCanvas candles={candles} width={size.w} height={52}/>
        </div>
      )}

      {/* Indicator strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', borderTop:`1px solid ${C.border}`, background:'#0d1420' }}>
        {[
          { n:'RSI',   v:(data.rsi||50).toFixed(1),  c: data.rsi>70?C.red:data.rsi<30?C.green:C.yellow },
          { n:'VWAP',  v:`₹${Math.round(data.vwap||0).toLocaleString('en-IN')}`, c:C.yellow },
          { n:'EMA20', v:`₹${Math.round(data.ema20||0).toLocaleString('en-IN')}`,c:C.blue },
          { n:'MACD',  v:data.macd?.histogram>0?'▲ BULL':'▼ BEAR', c:data.macd?.histogram>0?C.green:C.red },
          { n:'ATR',   v:(data.atr||0).toFixed(2),    c:C.text },
          { n:'ADX',   v:(data.adx?.adx||0).toFixed(0), c:(data.adx?.adx||0)>25?C.green:C.dim },
        ].map(x => (
          <div key={x.n} style={{ padding:'7px 4px', textAlign:'center', borderRight:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.dim, fontWeight:600, letterSpacing:.8, textTransform:'uppercase' }}>{x.n}</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:x.c, fontSize:12, marginTop:2 }}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:14, padding:'6px 14px', borderTop:`1px solid ${C.border}`, flexWrap:'wrap', background:'#0d1420' }}>
        {OVERLAYS.filter(o => active[o.key]).map(o => (
          <div key={o.key} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <svg width="16" height="5">
              <line x1="0" y1="2.5" x2="16" y2="2.5" stroke={o.color} strokeWidth="1.5" strokeDasharray={o.dash?'4 3':'none'}/>
            </svg>
            <span style={{ fontFamily:'JetBrains Mono,monospace', color:C.dim, fontSize:9 }}>{o.label}</span>
          </div>
        ))}
        {ai?.entry    > 0 && <div style={{display:'flex',alignItems:'center',gap:5}}><svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke={C.blue}  strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>Entry</span></div>}
        {ai?.target   > 0 && <div style={{display:'flex',alignItems:'center',gap:5}}><svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke={C.green} strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>Target</span></div>}
        {ai?.stopLoss > 0 && <div style={{display:'flex',alignItems:'center',gap:5}}><svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke={C.red}   strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>SL</span></div>}
        <span style={{ marginLeft:'auto', fontFamily:'JetBrains Mono,monospace', color:C.dim, fontSize:9 }}>
          {candles.length} candles · {tf.label}
        </span>
      </div>
    </div>
  )
}
