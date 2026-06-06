import React, { useState } from 'react'

export default function AIInsights({ ai, data, loading }) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  if (loading) return (
    <div className="panel flex items-center justify-center py-10 gap-4">
      <div className="animate-spin-slow w-8 h-8 rounded-full border-2 border-border" style={{ borderTopColor: '#00d4ff' }} />
      <div className="font-mono text-accent animate-blink" style={{ fontSize: 12, letterSpacing: 2 }}>ANALYZING MARKET...</div>
    </div>
  )

  if (!ai) return (
    <div className="panel flex flex-col items-center justify-center py-10 gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>🤖</div>
      <div className="font-display text-muted text-xs tracking-widest">AI ANALYST READY</div>
      <div className="font-mono text-dim text-center" style={{ fontSize: 11, maxWidth: 260 }}>
        Rule-based analysis (always available). Add GROQ_API_KEY in .env for LLaMA-3 AI enhancement.
      </div>
    </div>
  )

  const verdictColor = ai.verdict === 'BUY' ? '#00ff88' : ai.verdict === 'SELL' ? '#ff3366' : '#ffd700'
  const conf = Math.min(100, Math.max(0, ai.confidence ?? 50))
  const confLabel = conf >= 78 ? 'HIGH CONFIDENCE' : conf >= 65 ? 'MODERATE' : conf >= 52 ? 'LOW' : 'AVOID'
  const confColor = conf >= 78 ? '#00ff88' : conf >= 65 ? '#ffd700' : conf >= 52 ? '#ff6b35' : '#ff3366'

  // Confidence ring (CSS SVG)
  const r = 22, circ = 2 * Math.PI * r
  const dash = (conf / 100) * circ

  const breakdown = ai.breakdown || []
  const bullFactors = breakdown.filter(f => f.vote === 'BULL').sort((a,b) => b.weight - a.weight)
  const bearFactors = breakdown.filter(f => f.vote === 'BEAR').sort((a,b) => b.weight - a.weight)

  // Candle patterns
  const patterns = data?.candlePatterns || []

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">🤖 AI Analysis</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="font-mono text-muted" style={{ fontSize: 10 }}>
            {ai.source === 'GROQ_LLAMA3' ? '🟢 GROQ LLaMA-3.3' : '🔵 Rule-Based'}
          </div>
          {breakdown.length > 0 && (
            <button onClick={() => setShowBreakdown(s=>!s)}
              className="font-mono border border-border text-muted px-2 py-0.5 hover:border-accent transition-colors"
              style={{fontSize:9}}>
              {showBreakdown ? 'LESS' : 'FACTORS'}
            </button>
          )}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Verdict + Confidence Meter Row */}
        <div className="flex items-center gap-4 p-3 border border-border/50"
          style={{ background: `${verdictColor}05` }}>
          {/* Circular confidence gauge */}
          <div className="flex flex-col items-center flex-shrink-0">
            <svg width={58} height={58} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={29} cy={29} r={r} fill="none" stroke="#1a3050" strokeWidth={4} />
              <circle cx={29} cy={29} r={r} fill="none" stroke={confColor} strokeWidth={4}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 3px ${confColor}66)` }} />
              <text x={29} y={29} textAnchor="middle" dominantBaseline="middle"
                fill={confColor} fontSize={11} fontFamily="'Share Tech Mono'" fontWeight="bold"
                style={{ transform: 'rotate(90deg)', transformOrigin: '29px 29px' }}>
                {conf}%
              </text>
            </svg>
            <div style={{ fontSize: 8, letterSpacing: 1, color: confColor, fontFamily: 'Share Tech Mono', marginTop: 2 }}>
              {confLabel}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="font-display font-black" style={{ fontSize: 24, color: verdictColor, letterSpacing: 3 }}>
                {ai.verdict}
              </div>
              <div>
                {ai.score != null && (
                  <div className="font-mono text-muted" style={{ fontSize: 11 }}>
                    Score: <span style={{ color: verdictColor }}>{ai.score}/100</span>
                  </div>
                )}
                {ai.bullVotes != null && (
                  <div className="font-mono text-dim" style={{ fontSize: 10 }}>
                    <span style={{ color: '#00ff88' }}>{ai.bullVotes}↑ Bull</span>
                    <span className="mx-1">/</span>
                    <span style={{ color: '#ff3366' }}>{ai.bearVotes}↓ Bear</span>
                  </div>
                )}
              </div>
            </div>
            {/* Confidence bar */}
            <div className="h-1 rounded overflow-hidden" style={{ background: '#0d1825' }}>
              <div className="h-full transition-all duration-700 rounded"
                style={{ width: `${conf}%`, background: `linear-gradient(90deg,${confColor}77,${confColor})` }} />
            </div>
            <div className="font-mono text-muted mt-1" style={{ fontSize: 11 }}>
              RR {ai.riskReward?.toFixed(1) || 'N/A'}:1 · Entry ₹{ai.entry?.toFixed(0)||'—'} · SL ₹{ai.stopLoss?.toFixed(0)||'—'}
            </div>
          </div>
        </div>

        {/* Summary */}
        <p className="text-gray-300 leading-relaxed" style={{ fontSize: 13 }}>{ai.summary}</p>

        {/* Candle Patterns */}
        {patterns.length > 0 && (
          <div className="p-2 border border-border/30"
            style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className="font-mono text-accent uppercase tracking-widest mb-1.5" style={{ fontSize: 10 }}>
              Candle Patterns
            </div>
            <div className="flex flex-wrap gap-2">
              {patterns.map((p, i) => (
                <div key={i} className="font-mono border px-2 py-1"
                  style={{ fontSize: 10,
                    color: p.type==='BULLISH'?'#00ff88':p.type==='BEARISH'?'#ff3366':'#ffd700',
                    borderColor: p.type==='BULLISH'?'#00ff8844':p.type==='BEARISH'?'#ff336644':'#ffd70044',
                    background: p.type==='BULLISH'?'rgba(0,255,136,0.04)':p.type==='BEARISH'?'rgba(255,51,102,0.04)':'rgba(255,215,0,0.04)' }}>
                  {p.type==='BULLISH'?'▲':p.type==='BEARISH'?'▼':'◆'} {p.name}
                  <span className="ml-1 text-dim">{p.confidence}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        {showBreakdown && breakdown.length > 0 && (
          <div className="border border-border/50">
            <div className="font-mono text-accent uppercase tracking-widest px-3 py-2 border-b border-border/50"
              style={{ fontSize: 10 }}>
              Score Factors ({bullFactors.length} Bull / {bearFactors.length} Bear)
            </div>
            <div className="grid grid-cols-2 gap-px" style={{ background: '#1a3050' }}>
              <div className="bg-panel p-2">
                <div className="font-mono text-muted mb-1" style={{ fontSize: 10 }}>↑ Bull Factors</div>
                {bullFactors.map((f, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className="font-mono text-dim" style={{ fontSize: 10 }}>{f.name}</span>
                    <span className="font-mono" style={{ fontSize: 10, color: '#00ff88' }}>+{f.weight}</span>
                  </div>
                ))}
              </div>
              <div className="bg-panel p-2">
                <div className="font-mono text-muted mb-1" style={{ fontSize: 10 }}>↓ Bear Factors</div>
                {bearFactors.map((f, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className="font-mono text-dim" style={{ fontSize: 10 }}>{f.name}</span>
                    <span className="font-mono" style={{ fontSize: 10, color: '#ff3366' }}>-{f.weight}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Detailed breakdown */}
            <div className="border-t border-border/50">
              {breakdown.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 last:border-0"
                  style={{ background: i%2===0?'rgba(0,0,0,0.1)':'transparent' }}>
                  <span style={{ fontSize: 12, color: f.vote==='BULL'?'#00ff88':f.vote==='BEAR'?'#ff3366':'#6a9ab8', width:16, flexShrink:0 }}>
                    {f.vote==='BULL'?'↑':f.vote==='BEAR'?'↓':'→'}
                  </span>
                  <span className="font-mono text-muted font-bold flex-shrink-0" style={{ fontSize: 10, width: 88 }}>{f.name}</span>
                  <span className="font-mono text-dim flex-1" style={{ fontSize: 10 }}>{f.reason}</span>
                  <span className="font-mono font-bold flex-shrink-0"
                    style={{ fontSize: 10, color: f.vote==='BULL'?'#00ff88':f.vote==='BEAR'?'#ff3366':'#6a9ab8' }}>
                    {f.vote==='BULL'?'+':f.vote==='BEAR'?'-':''}{ f.weight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Option Signal */}
        {ai.optionSuggestion && (
          <div className="p-2 border font-mono" style={{ fontSize: 12, color: '#00d4ff', borderColor: '#00d4ff33', background: 'rgba(0,212,255,0.05)' }}>
            <div className="text-dim mb-1" style={{ fontSize: 10, letterSpacing: 2 }}>OPTION SIGNAL</div>
            {ai.optionSuggestion}
          </div>
        )}

        {/* Reasons */}
        {ai.reasons?.length > 0 && (
          <div>
            <div className="font-mono text-accent uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Key Signals</div>
            {ai.reasons.map((r, i) => (
              <div key={i} className="flex gap-2 py-1.5 border-b border-border/30 last:border-0" style={{ fontSize: 13 }}>
                <span className="text-accent2 flex-shrink-0 mt-0.5">▶</span>
                <span className="text-gray-300" style={{lineHeight:1.5}}>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Risks */}
        {ai.risks?.length > 0 && (
          <div>
            <div className="font-mono text-danger uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Risk Factors</div>
            {ai.risks.map((r, i) => (
              <div key={i} className="flex gap-2 py-1.5 border-b border-border/30 last:border-0" style={{ fontSize: 13 }}>
                <span className="text-danger flex-shrink-0 mt-0.5">⚠</span>
                <span className="text-gray-300" style={{lineHeight:1.5}}>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Investment Guidance */}
        {data?.investmentGuidance && (
          <div className="p-2 border border-border/50"
            style={{ background: data.investmentGuidance.shouldInvest ? `${verdictColor}06` : 'rgba(255,215,0,0.04)' }}>
            <div className="font-mono text-dim uppercase tracking-widest mb-1" style={{ fontSize: 10 }}>Investment Decision</div>
            <div className="flex items-center justify-between">
              <div className="font-display font-bold" style={{ fontSize: 14, color: data.investmentGuidance.shouldInvest ? verdictColor : '#ffd700' }}>
                {data.investmentGuidance.action}
              </div>
              <div className="font-mono" style={{ fontSize: 11, color: '#c8dff0' }}>
                {data.investmentGuidance.positionSize !== 'NONE'
                  ? `${data.investmentGuidance.positionSize} position (~${data.investmentGuidance.capitalPct}% capital)`
                  : 'No position — wait for signal'}
              </div>
            </div>
            <div className="font-mono text-dim mt-1" style={{ fontSize: 11 }}>
              {data.investmentGuidance.guidance}
            </div>
          </div>
        )}

        {/* Macro Context */}
        {ai.newsImpact && (
          <div className="p-2" style={{ background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${verdictColor}` }}>
            <div className="font-mono text-dim uppercase tracking-widest mb-1" style={{ fontSize: 10 }}>Market Context</div>
            <div className="font-mono text-muted" style={{ fontSize: 11 }}>{ai.newsImpact}</div>
          </div>
        )}
      </div>
    </div>
  )
}
