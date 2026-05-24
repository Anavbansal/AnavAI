import React, { useState, useRef, useEffect } from 'react'

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002').replace(/\/$/, '')

export default function AIAssistant({ data, ai }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m ANAV AI — your trading assistant. Ask me anything about the current chart, trade setups, F&O strategies, or any market concept.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  // Build rich context from current analysis data
  const buildContext = () => {
    if (!data) return {}
    return {
      symbol:           data.symbol,
      price:            data.price,
      vwap:             data.vwap,
      ema20:            data.ema20,
      ema50:            data.ema50,
      ema9:             data.ema9,
      ema200:           data.ema200,
      rsi:              data.rsi,
      regime:           data.regime,
      atr:              data.atr,
      macd:             data.macd,
      bb:               data.bb,
      supertrend:       data.supertrend,
      ichimoku:         data.ichimoku,
      pcr:              data.pcr,
      volumeRatio:      data.volumeRatio,
      trendConsistency: data.trendConsistency,
      support:          data.support,
      resistance:       data.resistance,
      m1Trend:          data.m1Trend,
      m5Trend:          data.m5Trend,
      m15Trend:         data.m15Trend,
      verdict:          ai?.verdict,
      confidence:       ai?.confidence,
      entry:            ai?.entry,
      target:           ai?.target,
      stopLoss:         ai?.stopLoss,
      riskReward:       ai?.riskReward,
      score:            ai?.score,
      optionSuggestion: ai?.optionSuggestion,
    }
  }

  const send = async () => {
    const msg = input.trim()
    if (!msg || loading) return

    const userMsg = { role: 'user', content: msg }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BASE}/api/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          context: buildContext(),
          // Send last 6 messages as history (excluding the first greeting)
          history: newMessages.slice(1, -1).slice(-6),
        }),
      })
      const json = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: json.reply || 'Sorry, no response.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Could not reach AI server. Check that local-api-server.mjs is running.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const QUICK = [
    'Should I buy or sell now? Give entry, target and SL.',
    'What is the risk/reward and position sizing?',
    'Explain the current market regime in detail.',
    'Best F&O strategy for this setup? Suggest strikes.',
    'Where is the next key support and resistance?',
    'Is this a trend or reversal setup?',
    'What do RSI and MACD tell about momentum?',
  ]

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="AI Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
          border: 'none', cursor: 'pointer', boxShadow: '0 0 24px #00d4ff55',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9998,
          width: 380, height: 520,
          background: '#0d1117',
          border: '1px solid #00d4ff44',
          borderRadius: 12,
          boxShadow: '0 0 40px #00d4ff22, 0 8px 32px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'monospace',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(90deg, #0d1117, #0a1628)',
            borderBottom: '1px solid #00d4ff33',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ color: '#00d4ff', fontSize: 13, fontWeight: 'bold', letterSpacing: 2 }}>ANAV AI</div>
              <div style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>
                {data?.symbol ? `CONTEXT: ${data.symbol}` : 'TRADING ASSISTANT'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
              <span style={{ color: '#00ff88', fontSize: 10 }}>LIVE</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
            scrollbarWidth: 'thin', scrollbarColor: '#333 transparent',
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #00d4ff22, #7b2fff22)'
                    : '#161b22',
                  border: m.role === 'user'
                    ? '1px solid #00d4ff44'
                    : '1px solid #30363d',
                  color: '#e6edf3',
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '8px 16px', borderRadius: '12px 12px 12px 2px',
                  background: '#161b22', border: '1px solid #30363d',
                  color: '#00d4ff', fontSize: 12, letterSpacing: 2,
                }}>
                  <span style={{ animation: 'blink 1s infinite' }}>THINKING...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div style={{
              padding: '6px 14px',
              borderTop: '1px solid #21262d',
              display: 'flex', flexWrap: 'wrap', gap: 5,
            }}>
              {QUICK.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); inputRef.current?.focus() }}
                  style={{
                    background: '#161b22', border: '1px solid #30363d',
                    color: '#8b949e', borderRadius: 6, padding: '3px 8px',
                    fontSize: 10, cursor: 'pointer', letterSpacing: 0.5,
                  }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid #21262d',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about the market..."
              rows={2}
              style={{
                flex: 1, background: '#161b22',
                border: '1px solid #30363d', borderRadius: 8,
                color: '#e6edf3', fontSize: 12, padding: '8px 10px',
                resize: 'none', outline: 'none',
                fontFamily: 'monospace', lineHeight: 1.4,
              }}
              onFocus={e => e.target.style.borderColor = '#00d4ff66'}
              onBlur={e => e.target.style.borderColor = '#30363d'}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim()
                  ? '#21262d'
                  : 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                border: 'none', borderRadius: 8,
                color: '#fff', padding: '8px 14px',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                fontSize: 16, fontWeight: 'bold',
                transition: 'all 0.2s',
              }}
            >
              ▶
            </button>
          </div>

          {/* Footer note */}
          <div style={{
            textAlign: 'center', fontSize: 9, color: '#555',
            padding: '4px 14px 8px', letterSpacing: 1,
          }}>
            POWERED BY GROQ LLAMA-3.3-70B · NOT SEBI ADVICE
          </div>
        </div>
      )}
    </>
  )
}
