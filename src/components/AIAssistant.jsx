import React, { useState, useRef, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const QUICK = [
  'Should I buy or sell now? Give entry, target & SL.',
  'Explain the current market regime.',
  'What does RSI + MACD say about momentum?',
  'Best F&O strategy for this setup?',
  'Where is the next key support & resistance?',
  'Is this a breakout or a fakeout?',
]

function Msg({ msg }) {
  const isBot = msg.role === 'assistant'
  return (
    <div style={{ display:'flex', gap:10, padding:'10px 0', alignItems:'flex-start',
      justifyContent: isBot ? 'flex-start' : 'flex-end' }}>
      {isBot && (
        <div style={{
          width:28, height:28, borderRadius:'50%', flexShrink:0,
          background:'linear-gradient(135deg,#5865f2,#a78bfa)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
        }}>🤖</div>
      )}
      <div style={{
        maxWidth:'78%', padding:'10px 14px', borderRadius: isBot ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
        background: isBot ? 'var(--surface2)' : 'var(--accent)',
        color: isBot ? 'var(--text)' : '#fff',
        fontSize:13, lineHeight:1.6,
        border: isBot ? '1px solid var(--border)' : 'none',
        whiteSpace:'pre-wrap',
      }}>
        {msg.content}
      </div>
      {!isBot && (
        <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0,
          background:'linear-gradient(135deg,#5865f2,#22c55e)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700, color:'#fff', fontFamily:"'Syne',sans-serif" }}>A</div>
      )}
    </div>
  )
}

export default function AIAssistant({ data, ai }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([{
    role:'assistant',
    content:"👋 Hi! I'm ANAV AI — your trading assistant. I have full context of the current analysis. Ask me anything about trade setups, F&O, or market concepts."
  }])
  const [input, setInput] = useState('')
  const [busy, setBusy]   = useState(false)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    if (open) { bottomRef.current?.scrollIntoView({behavior:'smooth'}); inputRef.current?.focus() }
  }, [open, msgs])

  const ctx = () => !data ? {} : {
    symbol: data.symbol, price: data.price, vwap: data.vwap,
    ema20: data.ema20, ema50: data.ema50, rsi: data.rsi,
    macd: data.macd, supertrend: data.supertrend,
    adx: data.adx, stochRSI: data.stochRSI, obvTrend: data.obvTrend,
    regime: data.regime, support: data.support, resistance: data.resistance,
    trendConsistency: data.trendConsistency,
    m1Trend: data.m1Trend, m5Trend: data.m5Trend, m15Trend: data.m15Trend,
    pcr: data.pcr, volumeRatio: data.volumeRatio,
    verdict: ai?.verdict, confidence: ai?.confidence,
    entry: ai?.entry, target: ai?.target, stopLoss: ai?.stopLoss, riskReward: ai?.riskReward,
  }

  async function send(msg = input.trim()) {
    if (!msg || busy) return
    const userMsg = { role:'user', content: msg }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs); setInput(''); setBusy(true)
    try {
      const r = await fetch(`${API_BASE_URL}/api/assistant`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:msg, context:ctx(), history:newMsgs.slice(1,-1).slice(-6) })
      })
      const j = await r.json()
      setMsgs(p => [...p, { role:'assistant', content: j.reply || 'Sorry, no response.' }])
    } catch {
      setMsgs(p => [...p, { role:'assistant', content:'⚠ Could not reach AI server.' }])
    } finally { setBusy(false) }
  }

  return (
    <>
      {/* FAB */}
      <button onClick={() => setOpen(o=>!o)} style={{
        position:'fixed', bottom:24, right:24, zIndex:9999,
        width:54, height:54, borderRadius:'50%',
        background:'linear-gradient(135deg,#5865f2,#a78bfa)',
        border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:22, boxShadow:'0 4px 24px #5865f255',
        transition:'transform .2s, box-shadow .2s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.08)';e.currentTarget.style.boxShadow='0 8px 32px #5865f266'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='0 4px 24px #5865f255'}}>
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="anim-slide" style={{
          position:'fixed', bottom:88, right:24, zIndex:9998,
          width:380, height:520,
          background:'var(--surface)', border:'1px solid var(--bd2)',
          borderRadius:16, display:'flex', flexDirection:'column',
          boxShadow:'var(--shadow-lg)',
        }}>
          {/* Header */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)',
            display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%',
              background:'linear-gradient(135deg,#5865f2,#a78bfa)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🤖</div>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:'var(--text)' }}>ANAV AI</div>
              <div style={{ fontSize:11, color:'var(--green)', display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--green)', display:'inline-block' }}/>
                Online{data ? ` · ${data.symbol}` : ''}
              </div>
            </div>
            <button onClick={()=>setMsgs([{role:'assistant',content:"Chat cleared. How can I help?"}])}
              style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:12 }}>
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'4px 14px' }}>
            {msgs.map((m,i) => <Msg key={i} msg={m}/>)}
            {busy && (
              <div style={{ display:'flex', gap:10, padding:'10px 0', alignItems:'center' }}>
                <div style={{ width:28, height:28, borderRadius:'50%',
                  background:'linear-gradient(135deg,#5865f2,#a78bfa)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>🤖</div>
                <div style={{ display:'flex', gap:4, padding:'10px 14px', background:'var(--surface2)',
                  border:'1px solid var(--border)', borderRadius:'4px 12px 12px 12px' }}>
                  {[0,1,2].map(i=>(
                    <div key={i} className="anim-pulse" style={{width:6,height:6,borderRadius:'50%',background:'var(--text3)',animationDelay:`${i*.2}s`}}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Quick prompts */}
          <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:5, flexWrap:'wrap' }}>
            {QUICK.slice(0,3).map((q,i) => (
              <button key={i} onClick={()=>send(q)} style={{
                fontSize:10, padding:'3px 9px', borderRadius:20, cursor:'pointer',
                background:'var(--bg2)', border:'1px solid var(--border)',
                color:'var(--text2)', transition:'all .15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent2)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text2)'}}>
                {q.split('?')[0]}?
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
            <textarea ref={inputRef} value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
              placeholder="Ask about trade setup, F&O, analysis…"
              rows={2} style={{
                flex:1, background:'var(--bg2)', border:'1px solid var(--border)',
                borderRadius:8, color:'var(--text)', padding:'8px 12px',
                fontSize:13, outline:'none', resize:'none',
                fontFamily:"'DM Sans',sans-serif", lineHeight:1.5,
              }}
              onFocus={e=>e.target.style.borderColor='var(--accent)'}
              onBlur={e=>e.target.style.borderColor='var(--border)'}
            />
            <button onClick={()=>send()} disabled={busy||!input.trim()}
              style={{
                width:40, height:40, borderRadius:10, border:'none', cursor:'pointer',
                background: busy||!input.trim() ? 'var(--bg3)' : 'var(--accent)',
                color:'#fff', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center',
                transition:'background .15s', flexShrink:0,
              }}>→</button>
          </div>
        </div>
      )}
    </>
  )
}
