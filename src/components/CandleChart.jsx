import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { calcEMASeries } from '../utils/indicators'

const C = {
  green:'#00c076', red:'#ff3b30', blue:'#5865f2', yellow:'#f59e0b',
  purple:'#a78bfa', orange:'#f97316', teal:'#2dd4bf',
  bg:'#0b0f19', card:'#111827', border:'#1a2535', dim:'#3a5a7a',
  text:'#94a3b8', white:'#e2e8f0',
}

const TIMEFRAMES = [
  {label:'1m', res:'1',  bars:120,time:true },
  {label:'5m', res:'5',  bars:120,time:true },
  {label:'10m',res:'10', bars:100,time:true },
  {label:'30m',res:'30', bars:100,time:true },
  {label:'1H', res:'60', bars:80, time:true },
  {label:'1D', res:'D',  bars:365,time:false},
  {label:'1W', res:'W',  bars:104,time:false},
  {label:'1M', res:'M',  bars:60, time:false},
]

const OVERLAYS = [
  {key:'ema9',  label:'EMA9',  color:C.orange},
  {key:'ema20', label:'EMA20', color:C.blue  },
  {key:'ema50', label:'EMA50', color:C.purple},
  {key:'ema200',label:'EMA200',color:C.red   },
  {key:'vwap',  label:'VWAP',  color:C.yellow,dash:true},
  {key:'bb',    label:'BB',    color:'#38bdf8',dash:true},
]

const CHART_TYPES = ['Candle','Heikin-Ashi','Line','Mountain']

// ── Compute Heikin-Ashi candles ────────────────────────────────────────────────
function toHeikinAshi(candles) {
  const ha = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const haClose = (c.open + c.high + c.low + c.close) / 4
    const haOpen  = i === 0 ? (c.open + c.close) / 2
                             : (ha[i-1].open + ha[i-1].close) / 2
    const haHigh  = Math.max(c.high, haOpen, haClose)
    const haLow   = Math.min(c.low,  haOpen, haClose)
    ha.push({ ...c, open:haOpen, high:haHigh, low:haLow, close:haClose })
  }
  return ha
}

// ── Volume Profile ─────────────────────────────────────────────────────────────
function calcVolumeProfile(candles, bins=24) {
  if (!candles.length) return []
  const highs = candles.map(c=>c.high), lows = candles.map(c=>c.low)
  const hi = Math.max(...highs), lo = Math.min(...lows)
  const step = (hi - lo) / bins
  const buckets = Array.from({length:bins}, (_,i) => ({
    price: lo + step*(i+0.5), vol:0, bull:0, bear:0
  }))
  for (const c of candles) {
    const mid = (c.high + c.low) / 2
    const idx = Math.min(bins-1, Math.floor((mid - lo) / step))
    buckets[idx].vol  += c.volume
    if (c.close >= c.open) buckets[idx].bull += c.volume
    else                    buckets[idx].bear += c.volume
  }
  const maxV = Math.max(...buckets.map(b=>b.vol)) || 1
  const poc  = buckets.reduce((m,b) => b.vol>m.vol?b:m, buckets[0])
  return buckets.map(b => ({ ...b, pct: b.vol/maxV, isPOC: b===poc }))
}

// ── Canvas renderer ────────────────────────────────────────────────────────────
function useChart({ candles, overlays, width, height, ai, chartType, showVP,
                    zoom, pan, crosshair, setCrosshair }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    if (!canvasRef.current || !candles?.length) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const dpr    = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Apply zoom + pan
    const totalBars = candles.length
    const visibleCount = Math.max(10, Math.floor(totalBars / zoom))
    const panOffset    = Math.max(0, Math.min(totalBars - visibleCount, pan))
    const visible      = candles.slice(panOffset, panOffset + visibleCount)
    if (!visible.length) return

    const source = chartType === 'Heikin-Ashi' ? toHeikinAshi(visible) : visible

    const pad  = { top:10, right:showVP?90:64, bottom:26, left:4 }
    const W    = width  - pad.left - pad.right
    const H    = height - pad.top  - pad.bottom

    const allH = source.map(c=>c.high), allL = source.map(c=>c.low)
    const minP = Math.min(...allL) * 0.9982
    const maxP = Math.max(...allH) * 1.0018
    const rng  = maxP - minP || 1

    const px = i  => pad.left + (i + 0.5) * (W / source.length)
    const py = p  => pad.top  + H - ((p - minP) / rng) * H
    const bw = Math.max(1.5, Math.min(14, W / source.length * 0.65))

    // ── Grid ──
    ctx.setLineDash([])
    const gridN = 5
    for (let i = 0; i <= gridN; i++) {
      const p = minP + (rng * i / gridN)
      const y = py(p)
      ctx.strokeStyle = '#1a2535'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke()
      ctx.fillStyle = '#3a5a7a'; ctx.font = '9px JetBrains Mono,monospace'
      ctx.textAlign = 'left'
      ctx.fillText('₹' + Math.round(p).toLocaleString('en-IN'), width - pad.right + 4, y + 3)
    }

    // ── Overlay lines ──
    const drawLine = (key, color, dash=false, width2=1.2) => {
      if (!overlays[key]) return
      const vals = source.map(c => c[key])
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width2
      ctx.setLineDash(dash ? [4,3] : [])
      let started = false
      for (let i = 0; i < source.length; i++) {
        if (vals[i] == null) continue
        const x = px(i), y = py(vals[i])
        if (!started) { ctx.moveTo(x,y); started=true } else ctx.lineTo(x,y)
      }
      ctx.stroke(); ctx.setLineDash([])
    }

    drawLine('bb_upper','#38bdf8',true,1); drawLine('bb_lower','#38bdf8',true,1)
    drawLine('vwap',C.yellow,true,1.4); drawLine('ema200',C.red)
    drawLine('ema50',C.purple); drawLine('ema20',C.blue,false,1.6); drawLine('ema9',C.orange)

    // ── Volume Profile ──
    if (showVP) {
      const vp = calcVolumeProfile(source)
      const vpW = 44
      const vpX = width - pad.right + 2
      for (const b of vp) {
        const y  = py(b.price + (maxP-minP)/vp.length/2)
        const bH = Math.max(1, H / vp.length - 1)
        const bWpx = b.pct * vpW
        ctx.fillStyle = b.isPOC ? '#f59e0b44' : '#5865f222'
        ctx.fillRect(vpX, y - bH/2, bWpx, bH)
        if (b.isPOC) {
          ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1
          ctx.strokeRect(vpX, y - bH/2, bWpx, bH)
          ctx.fillStyle = '#f59e0b'; ctx.font = '8px JetBrains Mono,monospace'
          ctx.textAlign = 'left'
          ctx.fillText('POC', vpX + bWpx + 2, y + 3)
        }
      }
    }

    // ── Chart types ──
    if (chartType === 'Line' || chartType === 'Mountain') {
      ctx.beginPath()
      for (let i = 0; i < source.length; i++) {
        const x = px(i), y = py(source[i].close)
        if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
      }
      if (chartType === 'Mountain') {
        ctx.lineTo(px(source.length-1), py(minP))
        ctx.lineTo(px(0), py(minP))
        ctx.closePath()
        const grad = ctx.createLinearGradient(0, pad.top, 0, height-pad.bottom)
        grad.addColorStop(0, '#5865f244'); grad.addColorStop(1, '#5865f200')
        ctx.fillStyle = grad; ctx.fill()
      }
      ctx.strokeStyle = C.blue; ctx.lineWidth = 1.8; ctx.setLineDash([])
      ctx.beginPath()
      for (let i = 0; i < source.length; i++) {
        const x = px(i), y = py(source[i].close)
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
      }
      ctx.stroke()
    } else {
      // Candle / Heikin-Ashi
      for (let i = 0; i < source.length; i++) {
        const c    = source[i]
        const bull = c.close >= c.open
        const clr  = bull ? C.green : C.red
        const x    = px(i)
        const oY   = py(c.open), cY = py(c.close)
        const hY   = py(c.high), lY = py(c.low)
        // Wick
        ctx.strokeStyle = clr; ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, hY); ctx.lineTo(x, Math.min(oY,cY))
        ctx.moveTo(x, Math.max(oY,cY)); ctx.lineTo(x, lY)
        ctx.stroke()
        // Body
        const bodyH = Math.max(1, Math.abs(cY-oY))
        ctx.fillStyle = clr; ctx.globalAlpha = bull ? 0.95 : 0.85
        ctx.fillRect(x-bw/2, Math.min(oY,cY), bw, bodyH)
        ctx.globalAlpha = 1
      }
    }

    // ── AI levels ──
    const drawRef = (price, color, label) => {
      if (!price || price<=0) return
      const y = py(price)
      if (y<pad.top || y>height-pad.bottom) return
      ctx.setLineDash([5,3]); ctx.strokeStyle=color; ctx.lineWidth=1.3
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(width-pad.right-50,y); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle=color; ctx.font='bold 9px JetBrains Mono,monospace'; ctx.textAlign='left'
      ctx.fillText(`${label} ₹${Math.round(price).toLocaleString('en-IN')}`, width-pad.right-48, y-2)
    }
    if (ai) { drawRef(ai.entry,C.blue,'E'); drawRef(ai.target,C.green,'T'); drawRef(ai.stopLoss,C.red,'SL') }

    // ── Crosshair ──
    if (crosshair && crosshair.x >= 0) {
      const {x, y} = crosshair
      // Find nearest candle
      const idx = Math.round((x - pad.left) / (W / source.length) - 0.5)
      const c   = source[Math.max(0, Math.min(source.length-1, idx))]
      if (c) {
        ctx.setLineDash([3,3]); ctx.strokeStyle='#4a6a8a'; ctx.lineWidth=1
        ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,height-pad.bottom); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(width-pad.right,y); ctx.stroke()
        ctx.setLineDash([])
        // Price label on Y axis
        const price = minP + (1-(y-pad.top)/H) * rng
        ctx.fillStyle='#1e2d42'; ctx.fillRect(width-pad.right+1, y-9, 60, 17)
        ctx.fillStyle='#00c076'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='left'
        ctx.fillText('₹'+Math.round(price).toLocaleString('en-IN'), width-pad.right+4, y+3)
        // OHLC tooltip box
        const bull = c.close >= c.open
        const tW=170, tH=78, tX=Math.min(x+10, width-tW-10), tY=pad.top+4
        ctx.fillStyle='#0b1120ee'
        ctx.roundRect?.(tX,tY,tW,tH,6) || ctx.rect(tX,tY,tW,tH)
        ctx.fill()
        ctx.strokeStyle='#1e2d42'; ctx.lineWidth=1; ctx.stroke()
        ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='left'
        const rows=[['O',c.open],[' H',c.high],['L',c.low],[' C',c.close],['V',c.volume]]
        rows.forEach(([k,v],ri)=>{
          ctx.fillStyle='#4a6a8a'; ctx.fillText(k, tX+8, tY+16+ri*12)
          const vStr = k===' V'
            ? (v>1e6?(v/1e6).toFixed(2)+'M':(v/1e3).toFixed(0)+'K')
            : '₹'+Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})
          ctx.fillStyle = k===' C'?(bull?C.green:C.red):C.white
          ctx.fillText(vStr, tX+28, tY+16+ri*12)
        })
      }
    }

    // ── X-axis labels ──
    ctx.fillStyle='#3a5a7a'; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center'
    const step = Math.max(1, Math.floor(source.length/7))
    for (let i=0; i<source.length; i+=step) {
      if (source[i]) ctx.fillText(source[i].label||'', px(i), height-pad.bottom+14)
    }

  }, [candles, overlays, width, height, ai, chartType, showVP, zoom, pan, crosshair])

  useEffect(() => { draw() }, [draw])

  return canvasRef
}

// ── Volume canvas ──────────────────────────────────────────────────────────────
function VolumeCanvas({ candles, width, height, zoom, pan }) {
  const ref = useRef(null)
  useEffect(()=>{
    if (!ref.current||!candles?.length) return
    const canvas=ref.current, ctx=canvas.getContext('2d'), dpr=window.devicePixelRatio||1
    canvas.width=width*dpr; canvas.height=height*dpr; ctx.scale(dpr,dpr)
    ctx.clearRect(0,0,width,height)
    const visibleCount=Math.max(10,Math.floor(candles.length/zoom))
    const panOffset=Math.max(0,Math.min(candles.length-visibleCount,pan))
    const visible=candles.slice(panOffset,panOffset+visibleCount)
    if (!visible.length) return
    const pad={right:64,left:4,top:2,bottom:2}
    const W=width-pad.left-pad.right, H=height-pad.top-pad.bottom
    const bw=Math.max(1,Math.min(12,W/visible.length*0.65))
    const maxV=Math.max(...visible.map(c=>c.volume))||1
    for (let i=0;i<visible.length;i++){
      const c=visible[i], bull=c.close>=c.open
      const x=pad.left+(i+0.5)*(W/visible.length)
      const bH=(c.volume/maxV)*H
      ctx.fillStyle=bull?C.green:C.red; ctx.globalAlpha=0.35
      ctx.fillRect(x-bw/2,H-bH+pad.top,bw,bH); ctx.globalAlpha=1
    }
  },[candles,width,height,zoom,pan])
  return <canvas ref={ref} style={{width,height,display:'block'}}/>
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CandleChart({ data, ai, onTfChange, activeTfi }) {
  const [tfi,       setTfi]      = useState(1)
  const [active,    setActive]   = useState({ema20:true, vwap:true})
  const [chartType, setChart]    = useState('Candle')
  const [showVP,    setShowVP]   = useState(false)
  const [zoom,      setZoom]     = useState(1)
  const [pan,       setPan]      = useState(0)
  const [crosshair, setCrosshair]= useState({x:-1,y:-1})
  const [size,      setSize]     = useState({w:800,h:300})
  const containerRef = useRef(null)
  const effectiveTfi = activeTfi !== undefined ? activeTfi : tfi
  const tf = TIMEFRAMES[effectiveTfi]

  // Responsive
  useEffect(()=>{
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries=>{
      const w = entries[0].contentRect.width
      if (w>0) setSize({w, h: window.innerWidth<=768?240:300})
    })
    ro.observe(containerRef.current)
    return ()=>ro.disconnect()
  },[])

  const candles = useMemo(()=>{
    if (!data?.candles?.length) return []
    const all    = data.candles
    const slice  = all.slice(-tf.bars)
    const closes = all.map(c=>c.close)
    const e9=calcEMASeries(closes,9),e20=calcEMASeries(closes,20)
    const e50=calcEMASeries(closes,50),e200=calcEMASeries(closes,200)
    const bbu=[],bbl=[]
    for(let i=0;i<closes.length;i++){
      if(i<19){bbu.push(null);bbl.push(null);continue}
      const sl=closes.slice(i-19,i+1),m=sl.reduce((a,b)=>a+b,0)/20
      const sd=Math.sqrt(sl.reduce((s,v)=>s+(v-m)**2,0)/20)
      bbu.push(+(m+2*sd).toFixed(2));bbl.push(+(m-2*sd).toFixed(2))
    }
    const si=all.length-slice.length
    return slice.map((c,i)=>{
      const gi=si+i,ts=new Date(c.timestamp)
      return {
        ...c,
        label:tf.time
          ?ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
          :ts.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),
        ema9:e9[gi]??null,ema20:e20[gi]??null,ema50:e50[gi]??null,ema200:e200[gi]??null,
        vwap:data.vwap, bb_upper:bbu[gi]??null, bb_lower:bbl[gi]??null,
      }
    })
  },[data, effectiveTfi])

  const overlayMap = {ema9:active.ema9,ema20:active.ema20,ema50:active.ema50,ema200:active.ema200,vwap:active.vwap,bb:active.bb}
  const canvasRef  = useChart({candles,overlays:overlayMap,width:size.w,height:size.h,ai,chartType,showVP,zoom,pan,crosshair,setCrosshair})

  // Mouse events for crosshair
  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    setCrosshair({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  function handleMouseLeave() { setCrosshair({x:-1,y:-1}) }

  // Zoom with mouse wheel
  function handleWheel(e) {
    e.preventDefault()
    setZoom(z => Math.max(1, Math.min(10, z + (e.deltaY > 0 ? -0.2 : 0.2))))
  }

  // Pan with drag
  const dragRef = useRef(null)
  function handleMouseDown(e) { dragRef.current = {x:e.clientX, pan} }
  function handleMouseMoveForPan(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const barW = size.w / Math.max(10, Math.floor(candles.length/zoom))
    setPan(p => Math.max(0, Math.min(candles.length-1, dragRef.current.pan - Math.round(dx/barW))))
  }
  function handleMouseUp() { dragRef.current = null }

  if (!data) return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,height:360,
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
      <div style={{fontSize:52,opacity:.08}}>📊</div>
      <div style={{color:C.dim,fontSize:13}}>Search and analyze a symbol to view chart</div>
    </div>
  )

  const last=candles[candles.length-1], prev=candles[candles.length-2]
  const pclr=(last?.close??0)>=(prev?.close??0)?C.green:C.red
  const price=data.price||last?.close||0
  const fmtP=n=>n?.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})||'–'

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',padding:'9px 12px',borderBottom:`1px solid ${C.border}`,gap:8,flexWrap:'wrap',background:'#0d1420'}}>
        {/* Symbol + price */}
        <div style={{display:'flex',alignItems:'baseline',gap:8}}>
          <span style={{fontWeight:700,fontSize:15,color:C.white}}>{data.symbol}</span>
          <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:16,fontWeight:700,color:pclr}}>₹{fmtP(price)}</span>
          {data.changePct!=null&&<span style={{fontSize:11,color:pclr}}>{data.changePct>=0?'+':''}{Number(data.changePct).toFixed(2)}%</span>}
        </div>

        {/* Chart type */}
        <div style={{display:'flex',gap:2,background:'#0b0f19',borderRadius:6,padding:2,border:`1px solid ${C.border}`}}>
          {CHART_TYPES.map(ct=>(
            <button key={ct} onClick={()=>setChart(ct)} style={{
              padding:'2px 8px',borderRadius:4,border:'none',cursor:'pointer',
              fontSize:10,fontFamily:'JetBrains Mono,monospace',fontWeight:600,
              background:chartType===ct?'#1e2a3d':'transparent',
              color:chartType===ct?C.white:C.dim,
              outline:chartType===ct?`1px solid #2a3f5f`:'none',
            }}>{ct}</button>
          ))}
        </div>

        {/* Timeframe */}
        <div style={{display:'flex',gap:2,background:'#0b0f19',borderRadius:6,padding:2,border:`1px solid ${C.border}`,marginLeft:'auto'}}>
          {TIMEFRAMES.map((t,i)=>(
            <button key={t.label} onClick={()=>{setTfi(i);setZoom(1);setPan(0);onTfChange?.(t.res,i)}} style={{
              padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',
              fontFamily:'JetBrains Mono,monospace',fontSize:10,fontWeight:600,
              background:effectiveTfi===i?'#1e2a3d':'transparent',
              color:effectiveTfi===i?C.white:C.dim,
              outline:effectiveTfi===i?`1px solid #2a3f5f`:'none',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Overlays + VP */}
        <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
          {OVERLAYS.map(o=>(
            <button key={o.key} onClick={()=>setActive(a=>({...a,[o.key]:!a[o.key]}))} style={{
              fontSize:9,padding:'2px 7px',borderRadius:4,cursor:'pointer',
              background:active[o.key]?`${o.color}22`:'transparent',
              border:`1px solid ${active[o.key]?o.color:C.border}`,
              color:active[o.key]?o.color:C.dim,transition:'all .15s',
            }}>{o.label}</button>
          ))}
          <button onClick={()=>setShowVP(v=>!v)} style={{
            fontSize:9,padding:'2px 7px',borderRadius:4,cursor:'pointer',
            background:showVP?'#f59e0b22':'transparent',
            border:`1px solid ${showVP?'#f59e0b':C.border}`,
            color:showVP?'#f59e0b':C.dim,transition:'all .15s',
          }}>VP</button>
        </div>

        {/* Zoom controls */}
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <button onClick={()=>setZoom(z=>Math.min(10,z+0.5))} style={{background:'#1e2a3d',border:`1px solid ${C.border}`,color:C.text,width:22,height:22,borderRadius:4,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
          <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:C.dim,minWidth:24,textAlign:'center'}}>{zoom.toFixed(1)}x</span>
          <button onClick={()=>{setZoom(1);setPan(0)}} style={{background:'#1e2a3d',border:`1px solid ${C.border}`,color:C.text,width:22,height:22,borderRadius:4,cursor:'pointer',fontSize:9,fontFamily:'JetBrains Mono,monospace'}}>⊡</button>
          <button onClick={()=>setZoom(z=>Math.max(1,z-0.5))} style={{background:'#1e2a3d',border:`1px solid ${C.border}`,color:C.text,width:22,height:22,borderRadius:4,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
        </div>
      </div>

      {/* ── Chart canvas ── */}
      <div ref={containerRef} style={{position:'relative',cursor:'crosshair'}}
        onMouseMove={e=>{handleMouseMove(e);handleMouseMoveForPan(e)}}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}>
        {candles.length>0
          ? <canvas ref={canvasRef} style={{width:size.w,height:size.h,display:'block'}}/>
          : <div style={{height:size.h,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <div className="anim-spin" style={{width:22,height:22,border:`3px solid ${C.border}`,borderTopColor:C.blue,borderRadius:'50%'}}/>
              <div style={{color:C.dim,fontSize:12}}>Loading candles…</div>
            </div>
        }
      </div>

      {/* ── Volume ── */}
      {candles.length>0&&(
        <div style={{borderTop:`1px solid ${C.border}22`}}>
          <VolumeCanvas candles={candles} width={size.w} height={44} zoom={zoom} pan={pan}/>
        </div>
      )}

      {/* ── Indicator strip ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',borderTop:`1px solid ${C.border}`,background:'#0d1420'}}>
        {[
          {n:'RSI',   v:(data.rsi||50).toFixed(1),            c:data.rsi>70?C.red:data.rsi<30?C.green:C.yellow},
          {n:'VWAP',  v:`₹${Math.round(data.vwap||0).toLocaleString('en-IN')}`, c:C.yellow},
          {n:'EMA20', v:`₹${Math.round(data.ema20||0).toLocaleString('en-IN')}`,c:C.blue},
          {n:'MACD',  v:data.macd?.histogram>0?'▲ BULL':'▼ BEAR',c:data.macd?.histogram>0?C.green:C.red},
          {n:'ATR',   v:(data.atr||0).toFixed(2),              c:C.text},
          {n:'ADX',   v:(data.adx?.adx||0).toFixed(0),         c:(data.adx?.adx||0)>25?C.green:C.dim},
        ].map(x=>(
          <div key={x.n} style={{padding:'6px 4px',textAlign:'center',borderRight:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.dim,fontWeight:600,letterSpacing:.8,textTransform:'uppercase'}}>{x.n}</div>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontWeight:700,color:x.c,fontSize:11,marginTop:1}}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* ── Legend + candle count ── */}
      <div style={{display:'flex',gap:12,padding:'5px 12px',borderTop:`1px solid ${C.border}`,flexWrap:'wrap',background:'#0d1420',alignItems:'center'}}>
        {OVERLAYS.filter(o=>active[o.key]).map(o=>(
          <div key={o.key} style={{display:'flex',alignItems:'center',gap:4}}>
            <svg width="14" height="5"><line x1="0" y1="2.5" x2="14" y2="2.5" stroke={o.color} strokeWidth="1.5" strokeDasharray={o.dash?'3 2':'none'}/></svg>
            <span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>{o.label}</span>
          </div>
        ))}
        {ai?.entry>0&&<div style={{display:'flex',alignItems:'center',gap:4}}><svg width="14" height="5"><line x1="0" y1="2.5" x2="14" y2="2.5" stroke={C.blue} strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>Entry</span></div>}
        {ai?.target>0&&<div style={{display:'flex',alignItems:'center',gap:4}}><svg width="14" height="5"><line x1="0" y1="2.5" x2="14" y2="2.5" stroke={C.green} strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>Target</span></div>}
        {ai?.stopLoss>0&&<div style={{display:'flex',alignItems:'center',gap:4}}><svg width="14" height="5"><line x1="0" y1="2.5" x2="14" y2="2.5" stroke={C.red} strokeWidth="1.5" strokeDasharray="4 3"/></svg><span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>SL</span></div>}
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>{candles.length} bars · {tf.label}</span>
          <span style={{fontFamily:'JetBrains Mono,monospace',color:C.dim,fontSize:9}}>Scroll=zoom · Drag=pan</span>
        </div>
      </div>
    </div>
  )
}
