import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  function submit(e) {
    e.preventDefault()
    if (!user.trim() || !pass.trim()) { setErr('Please fill in both fields'); return }
    setBusy(true); setErr('')
    setTimeout(() => {
      localStorage.setItem('anav.auth', JSON.stringify({ user: user.trim(), at: Date.now() }))
      nav('/dashboard')
    }, 500)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 20% 40%, rgba(88,101,242,.08) 0%, transparent 100%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(34,197,94,.05) 0%, transparent 100%)',
    }}>
      <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #5865f2 0%, #22c55e 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, boxShadow: '0 8px 24px #5865f244',
            }}>📈</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: -0.5 }}>AnavAI</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, letterSpacing: 1 }}>STOCK TERMINAL</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            NSE · BSE · F&amp;O · Intraday · Mutual Funds
          </div>
        </div>

        {/* Card */}
        <form onSubmit={submit} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 32,
          display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 19, color: 'var(--text)', marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sign in to your personal terminal</div>
          </div>

          {[
            { label: 'User ID', key: 'user', val: user, set: setUser, type: 'text', ph: 'Enter your user ID' },
            { label: 'Password', key: 'pass', val: pass, set: setPass, type: 'password', ph: 'Enter your password' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, letterSpacing: .5 }}>
                {f.label.toUpperCase()}
              </label>
              <input className="input" type={f.type} value={f.val}
                onChange={e => f.set(e.target.value)} placeholder={f.ph}
                style={{ height: 44 }} autoFocus={f.key === 'user'}/>
            </div>
          ))}

          {err && (
            <div style={{ padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid #f43f5e33', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>
              ⚠ {err}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}
            style={{ height: 46, fontSize: 15, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
            {busy
              ? <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className="anim-spin" style={{ display:'inline-block', width:16, height:16, border:'2px solid #ffffff40', borderTopColor:'#fff', borderRadius:'50%' }}/>
                  Signing in…
                </span>
              : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
          For personal use only · Not SEBI investment advice<br/>
          Data sourced from Upstox API · Trade at your own risk
        </div>
      </div>
    </div>
  )
}
