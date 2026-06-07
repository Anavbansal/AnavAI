import React, { useState, useRef, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const QUICK_PROMPTS = [
  { label:'Buy or Sell?',    text:'Should I buy or sell right now? Give entry, target and SL with ₹ levels.' },
  { label:'Intraday Setup',  text:'Give me the best intraday trade setup for this stock right now.' },
  { label:'F&O Strategy',    text:'What is the best F&O option strategy for the current setup? Suggest specific strikes.' },
  { label:'Support & Res',   text:'Where are the key support and resistance levels? What happens at each level?' },
  { label:'Risk/Reward',     text:'What is the risk reward ratio and how much capital should I deploy?' },
  { label:'Trend Analysis',  text:'Explain the multi-timeframe trend analysis — M1, M5, M15 alignment.' },
]

const STOCK_QUICK = [
  'RELIANCE ka analysis karo', 'NIFTY 50 ka trend kya hai?',
  'HDFCBANK buy ya sell?', 'TCS intraday setup batao',
  'BANKNIFTY F&O strategy kya hogi?', 'SBIN delivery trade setup?',
]


function DraggableFAB({ open, setOpen, unread }) {
  const [pos, setPos] = React.useState({ x: null, y: null })
  const [dragging, setDragging] = React.useState(false)
  const [hasDragged, setHasDragged] = React.useState(false)
  const startRef = React.useRef(null)
  const fabRef = React.useRef(null)
  const SIZE = 56

  // Default position
  const defaultPos = () => ({
    x: window.innerWidth - SIZE - 16,
    y: window.innerHeight - SIZE - 80,
  })

  React.useEffect(() => {
    const saved = localStorage.getItem('fab-pos')
    if (saved) {
      try { setPos(JSON.parse(saved)) } catch { setPos(defaultPos()) }
    } else {
      setPos(defaultPos())
    }
  }, [])

  // Save position when drag ends
  function savePos(p) {
    localStorage.setItem('fab-pos', JSON.stringify(p))
  }

  // Touch drag
  function onTouchStart(e) {
    const t = e.touches[0]
    startRef.current = {
      touchX: t.clientX, touchY: t.clientY,
      posX: pos.x, posY: pos.y,
      time: Date.now(),
    }
    setDragging(true)
    setHasDragged(false)
  }

  function onTouchMove(e) {
    if (!startRef.current) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - startRef.current.touchX
    const dy = t.clientY - startRef.current.touchY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) setHasDragged(true)
    const newX = Math.max(0, Math.min(window.innerWidth - SIZE, startRef.current.posX + dx))
    const newY = Math.max(0, Math.min(window.innerHeight - SIZE - 70, startRef.current.posY + dy))
    setPos({ x: newX, y: newY })
  }

  function onTouchEnd() {
    setDragging(false)
    if (pos.x !== null) savePos(pos)
    // Only toggle if it was a tap, not a drag
    setTimeout(() => { if (!hasDragged) setOpen(o => !o) }, 10)
    startRef.current = null
  }

  // Mouse drag (desktop)
  function onMouseDown(e) {
    startRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      posX: pos.x, posY: pos.y,
      time: Date.now(),
    }
    setDragging(true)
    setHasDragged(false)
    e.preventDefault()
  }

  React.useEffect(() => {
    function onMouseMove(e) {
      if (!startRef.current || !dragging) return
      const dx = e.clientX - startRef.current.mouseX
      const dy = e.clientY - startRef.current.mouseY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) setHasDragged(true)
      const newX = Math.max(0, Math.min(window.innerWidth - SIZE, startRef.current.posX + dx))
      const newY = Math.max(0, Math.min(window.innerHeight - SIZE - 70, startRef.current.posY + dy))
      setPos({ x: newX, y: newY })
    }
    function onMouseUp() {
      if (!dragging) return
      setDragging(false)
      if (pos.x !== null) savePos(pos)
      if (!hasDragged) setOpen(o => !o)
      startRef.current = null
    }
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, hasDragged, pos])

  if (pos.x === null) return null

  return (
    <div
      ref={fabRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="ai-fab"
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y,
        zIndex: 9999,
        width: SIZE, height: SIZE,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#5865f2,#a78bfa)',
        border: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24,
        boxShadow: dragging ? '0 12px 40px #5865f299' : '0 4px 24px #5865f266',
        transition: dragging ? 'none' : 'box-shadow .2s',
        userSelect: 'none', touchAction: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {open ? '✕' : '🤖'}
      {!open && unread > 0 && (
        <div style={{
          position:'absolute', top:-3, right:-3, width:18, height:18,
          borderRadius:'50%', background:'var(--red)', color:'#fff',
          fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center',
          pointerEvents:'none',
        }}>{unread}</div>
      )}
      {/* Drag hint — shows briefly */}
      {!dragging && (
        <div style={{
          position:'absolute', bottom:-20, left:'50%', transform:'translateX(-50%)',
          fontSize:9, color:'#5865f299', whiteSpace:'nowrap',
          fontFamily:"'DM Mono',monospace", pointerEvents:'none',
        }}>drag</div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display:'flex', gap:4, padding:'12px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'4px 12px 12px 12px', width:'fit-content' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--text3)', animation:'pulse 1.2s ease infinite', animationDelay:`${i*0.2}s` }}/>
      ))}
    </div>
  )
}

function Msg({ msg }) {
  const isBot = msg.role === 'assistant'
  return (
    <div style={{ display:'flex', gap:8, padding:'8px 0', alignItems:'flex-start', justifyContent: isBot ? 'flex-start' : 'flex-end' }}>
      {isBot && (
        <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#5865f2,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, marginTop:2 }}>🤖</div>
      )}
      <div style={{ maxWidth:'80%', display:'flex', flexDirection:'column', gap:4, alignItems: isBot ? 'flex-start' : 'flex-end' }}>
        {/* Live fetch badge */}
        {isBot && msg.isLiveData && (
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--green)', fontFamily:"'DM Mono',monospace" }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--green)', display:'inline-block' }}/>
            Live data fetched: {msg.fetchedSymbol}
          </div>
        )}
        <div style={{
          padding:'10px 14px', borderRadius: isBot ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
          background: isBot ? 'var(--surface2)' : 'var(--accent)',
          color: isBot ? 'var(--text)' : '#fff',
          fontSize:13, lineHeight:1.65,
          border: isBot ? '1px solid var(--border)' : 'none',
          whiteSpace:'pre-wrap', wordBreak:'break-word',
        }}>
          {/* Render **bold** markdown */}
          {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i} style={{ color: isBot ? 'var(--text)' : '#fff', fontWeight:700 }}>{part.slice(2,-2)}</strong>
              : part
          )}
        </div>
        <div style={{ fontSize:10, color:'var(--text3)', padding:'0 4px' }}>
          {msg.time}
        </div>
      </div>
      {!isBot && (
        <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#5865f2,#22c55e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', fontFamily:"'Syne',sans-serif", marginTop:2 }}>A</div>
      )}
    </div>
  )
}

function now() {
  return new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
}

export default function AIAssistant({ data, ai }) {
  const [open, setOpen]     = useState(false)
  const [tab, setTab]       = useState('chat') // 'chat' | 'stocks'
  const [msgs, setMsgs]     = useState([{
    role:'assistant',
    content:`👋 **Namaste! Main ANAV AI hun.**\n\nMain kisi bhi Indian stock ka live data fetch karke analysis de sakta hun. Bas stock ka naam likhein — jaise "RELIANCE ka analysis karo" ya "SBIN buy ya sell?"\n\nYa neeche ke quick prompts use karein! 🚀`,
    time: now(),
  }])
  const [input, setInput]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef()
  const inputRef  = useRef()
  const msgsEndRef = useRef()

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [msgs, busy])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const ctx = () => !data ? {} : {
    symbol: data.symbol, price: data.price, vwap: data.vwap,
    ema9: data.ema9, ema20: data.ema20, ema50: data.ema50, ema200: data.ema200,
    rsi: data.rsi, macd: data.macd, supertrend: data.supertrend,
    adx: data.adx, stochRSI: data.stochRSI, williamsR: data.williamsR,
    cci: data.cci, roc: data.roc, obvTrend: data.obv?.trend,
    regime: data.regime, trendConsistency: data.trendConsistency,
    support: data.support, resistance: data.resistance,
    high52w: data.high52w, low52w: data.low52w,
    m1Trend: data.m1Trend, m5Trend: data.m5Trend, m15Trend: data.m15Trend,
    pcr: data.pcr, volumeRatio: data.volumeRatio,
    verdict: ai?.verdict, confidence: ai?.confidence,
    entry: ai?.entry, target: ai?.target, stopLoss: ai?.stopLoss, riskReward: ai?.riskReward,
    patterns: data.patterns,
  }

  async function send(msg = input.trim()) {
    if (!msg || busy) return
    const userMsg = { role:'user', content:msg, time:now() }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs); setInput(''); setBusy(true)
    try {
      const r = await fetch(`${API_BASE_URL}/api/assistant`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          message: msg,
          context: ctx(),
          history: newMsgs.slice(1,-1).slice(-10).map(m=>({ role:m.role, content:m.content }))
        })
      })
      const j = await r.json()
      const botMsg = {
        role:'assistant',
        content: j.reply || 'Sorry, response unavailable.',
        time: now(),
        isLiveData: j.isLiveData || false,
        fetchedSymbol: j.fetchedSymbol || null,
      }
      setMsgs(p => [...p, botMsg])
      if (!open) setUnread(u => u+1)
    } catch {
      setMsgs(p => [...p, { role:'assistant', content:'⚠ Could not reach AI server. Check server is running.', time:now() }])
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setMsgs([{
      role:'assistant',
      content:'Chat cleared. Koi bhi stock ka naam likhein — main live data fetch karke analysis dunga! 📈',
      time: now(),
    }])
  }

  return (
    <>
      {/* Draggable FAB */}
      <DraggableFAB open={open} setOpen={setOpen} unread={unread}/>

      {/* Chat panel */}
      {open && (
        <div className="anim-slide ai-chat-panel" style={{
          position:'fixed', bottom:92, right:24, zIndex:9998,
          width:400, maxHeight:'80vh',
          background:'var(--surface)', border:'1px solid var(--bd2)',
          borderRadius:16, display:'flex', flexDirection:'column',
          boxShadow:'0 16px 64px rgba(0,0,0,.7)',
          overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#5865f2,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🤖</div>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:'var(--text)' }}>ANAV AI</div>
              <div style={{ fontSize:11, display:'flex', alignItems:'center', gap:4, color:'var(--green)' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--green)', display:'inline-block', animation:'pulse 2s infinite' }}/>
                Live Data · {data?.symbol || 'Ready'}
              </div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button onClick={clear} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:12, padding:'4px 8px', borderRadius:6 }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>Clear</button>
              <button onClick={()=>setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:18, padding:'0 4px', lineHeight:1 }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>✕</button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
            {[{id:'chat',label:'💬 Chat'},{id:'stocks',label:'📊 Quick Stocks'}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                flex:1, padding:'8px', border:'none', cursor:'pointer', fontSize:12,
                fontWeight: tab===t.id ? 600 : 400,
                background: tab===t.id ? 'var(--surface)' : 'transparent',
                color: tab===t.id ? 'var(--accent2)' : 'var(--text3)',
                borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition:'all .15s', fontFamily:"'DM Sans',sans-serif",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Chat area */}
          {tab==='chat' && (
            <>
              <div style={{ flex:1, overflowY:'auto', padding:'6px 14px', minHeight:200, maxHeight:400 }}>
                {msgs.map((m,i) => <Msg key={i} msg={m}/>)}
                {busy && (
                  <div style={{ display:'flex', gap:8, padding:'8px 0', alignItems:'center' }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#5865f2,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>🤖</div>
                    <TypingDots/>
                  </div>
                )}
                <div ref={msgsEndRef}/>
              </div>

              {/* Quick prompts */}
              <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:5, flexWrap:'wrap' }}>
                {QUICK_PROMPTS.slice(0,3).map((q,i) => (
                  <button key={i} onClick={()=>send(q.text)} style={{
                    fontSize:10, padding:'4px 10px', borderRadius:20, cursor:'pointer',
                    background:'var(--bg2)', border:'1px solid var(--border)',
                    color:'var(--text2)', transition:'all .15s',
                    fontFamily:"'DM Sans',sans-serif",
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent2)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text2)'}}>
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:8, background:'var(--bg2)' }}>
                <textarea ref={inputRef} value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
                  placeholder='Any stock ka naam likhein... e.g. "RELIANCE ka analysis karo"'
                  rows={2} style={{
                    flex:1, background:'var(--surface)', border:'1px solid var(--border)',
                    borderRadius:8, color:'var(--text)', padding:'8px 12px',
                    fontSize:13, outline:'none', resize:'none',
                    fontFamily:"'DM Sans',sans-serif", lineHeight:1.5,
                    transition:'border-color .15s',
                  }}
                  onFocus={e=>e.target.style.borderColor='var(--accent)'}
                  onBlur={e=>e.target.style.borderColor='var(--border)'}
                />
                <button onClick={()=>send()} disabled={busy||!input.trim()} style={{
                  width:42, borderRadius:10, border:'none', cursor:'pointer',
                  background: busy||!input.trim() ? 'var(--bg3)' : 'var(--accent)',
                  color:'#fff', fontSize:18, display:'flex', alignItems:'center',
                  justifyContent:'center', transition:'background .15s', flexShrink:0,
                  alignSelf:'flex-end', height:42,
                }}>
                  {busy ? <span className="anim-spin" style={{display:'inline-block',width:16,height:16,border:'2px solid #fff4',borderTopColor:'#fff',borderRadius:'50%'}}/> : '→'}
                </button>
              </div>
            </>
          )}

          {/* Quick Stocks tab */}
          {tab==='stocks' && (
            <div style={{ padding:14, display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4 }}>
                Click karo — main live data fetch karke analysis dunga:
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {STOCK_QUICK.map((q,i) => (
                  <button key={i} onClick={()=>{ setTab('chat'); send(q) }} style={{
                    padding:'10px 12px', borderRadius:8, cursor:'pointer', textAlign:'left',
                    background:'var(--bg2)', border:'1px solid var(--border)',
                    color:'var(--text2)', fontSize:12, transition:'all .15s',
                    fontFamily:"'DM Sans',sans-serif", lineHeight:1.4,
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--surface2)';e.currentTarget.style.color='var(--text)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text2)'}}>
                    {q}
                  </button>
                ))}
              </div>
              <div style={{ marginTop:8, fontSize:11, color:'var(--text3)', lineHeight:1.6 }}>
                💡 <strong style={{color:'var(--text2)'}}>Tip:</strong> Chat me koi bhi stock ka naam likhein, main automatically live data fetch karunga — even if vo dashboard pe nahi hai!
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
