import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!user.trim() || !pass.trim()) { setError('Enter credentials'); return }
    setLoading(true)
    setTimeout(() => {
      localStorage.setItem('anav.auth', JSON.stringify({ user: user.trim(), at: Date.now() }))
      navigate('/dashboard')
    }, 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ position: 'relative', zIndex: 1 }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-display text-4xl font-black text-accent glow-accent mb-2" style={{ letterSpacing: '4px' }}>
            ANAV<span className="text-accent2">PRO</span>
          </div>
          <div className="font-mono text-muted text-xs tracking-widest uppercase">
            Indian Equity · F&amp;O · Intraday · Delivery
          </div>
        </div>

        {/* Card */}
        <div className="panel" style={{ borderTop: '2px solid #00d4ff' }}>
          {/* Scanline */}
          <div className="absolute top-0 left-0 right-0 h-0.5 animate-scanline"
            style={{ background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)' }} />

          <div className="panel-header">
            <div className="panel-title">Terminal Access</div>
          </div>

          <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
            <div>
              <label className="font-mono text-muted text-xs tracking-widest uppercase block mb-2">
                User ID
              </label>
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Enter your user ID"
                className="w-full bg-bg3 border border-border text-gray-200 font-mono text-sm px-3 py-2 outline-none focus:border-accent transition-colors"
                style={{ letterSpacing: '1px' }}
              />
            </div>

            <div>
              <label className="font-mono text-muted text-xs tracking-widest uppercase block mb-2">
                Password
              </label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg3 border border-border text-gray-200 font-mono text-sm px-3 py-2 outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <div className="font-mono text-xs text-danger border border-danger px-3 py-2"
                style={{ background: 'rgba(255,51,102,0.05)' }}>
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-accent py-3 px-6 mt-2 font-display font-bold tracking-widest text-sm"
            >
              {loading ? '⟳ AUTHENTICATING...' : '▶ ENTER TERMINAL'}
            </button>

            <p className="font-mono text-dim text-xs text-center mt-1">
              Demo: any username + password works
            </p>
          </form>
        </div>

        <div className="text-center mt-6 font-mono text-dim text-xs">
          ⚠ FOR EDUCATIONAL USE ONLY · NOT SEBI INVESTMENT ADVICE
        </div>
      </div>
    </div>
  )
}
