import React from 'react'

export default function AIInsights({ ai, loading }) {
  if (loading) return (
    <div className="panel flex items-center justify-center py-10 gap-4">
      <div className="animate-spin-slow w-8 h-8 rounded-full border-2 border-border" style={{ borderTopColor: '#00d4ff' }} />
      <div className="font-mono text-accent animate-blink" style={{ fontSize: 12, letterSpacing: 2 }}>CLAUDE ANALYZING...</div>
    </div>
  )

  if (!ai) return (
    <div className="panel flex flex-col items-center justify-center py-10 gap-3">
      <div style={{ fontSize: 32, opacity: 0.3 }}>🤖</div>
      <div className="font-display text-muted text-xs tracking-widest">AI ANALYST READY</div>
      <div className="font-mono text-dim text-center" style={{ fontSize: 11, maxWidth: 260 }}>
        Rule-based analysis (free, always works). Add VITE_GROQ_API_KEY in .env for AI enhancement.
      </div>
    </div>
  )

  const verdictColor = ai.verdict === 'BUY' ? '#00ff88' : ai.verdict === 'SELL' ? '#ff3366' : '#ffd700'

  return (
    <div className="panel animate-fadein">
      <div className="panel-header">
        <div className="panel-title">⚡ AI Analysis</div>
        <div className="ml-auto font-mono text-muted" style={{ fontSize: 10 }}>
          {ai.source === 'GROQ_LLAMA3' ? '🟢 GROQ LLaMA-3' : '🔵 Rule-Based'}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-3">
        {/* Summary */}
        <p className="text-gray-300 leading-relaxed" style={{ fontSize: 13 }}>{ai.summary}</p>

        {/* Option signal */}
        {ai.optionSuggestion && (
          <div className="p-2 border font-mono" style={{ fontSize: 12, color: '#00d4ff', borderColor: '#00d4ff33', background: 'rgba(0,212,255,0.05)' }}>
            <div className="text-dim mb-1" style={{ fontSize: 10, letterSpacing: 2 }}>OPTION SIGNAL</div>
            {ai.optionSuggestion}
          </div>
        )}

        {/* Reasons */}
        {ai.reasons?.length > 0 && (
          <div>
            <div className="font-mono text-accent uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Signals</div>
            {ai.reasons.map((r, i) => (
              <div key={i} className="flex gap-2 py-1.5 border-b border-border/30 last:border-0" style={{ fontSize: 13 }}>
                <span className="text-accent2 flex-shrink-0">▶</span>
                <span className="text-gray-300">{r}</span>
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
                <span className="text-danger flex-shrink-0">⚠</span>
                <span className="text-gray-300">{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* News impact */}
        {ai.newsImpact && (
          <div className="p-2" style={{ background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${verdictColor}` }}>
            <div className="font-mono text-dim uppercase tracking-widest mb-1" style={{ fontSize: 10 }}>Macro Context</div>
            <div className="font-mono text-muted" style={{ fontSize: 11 }}>{ai.newsImpact}</div>
          </div>
        )}
      </div>
    </div>
  )
}
