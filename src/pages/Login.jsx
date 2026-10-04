import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Credentials — Personal Use Only ─────────────────────────────────────────
// Change these to your own username + password
// Password is checked client-side (personal app — not public)
const VALID_USER = 'anav'
const VALID_PASS = '2210'   // Change this!

export default function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const nav = useNavigate()

  function submit(e) {
    e.preventDefault()
    if (!user.trim() || !pass.trim()) { setErr('Please fill in both fields'); return }
    setBusy(true); setErr('')
    setTimeout(() => {
      if (user.trim().toLowerCase() === VALID_USER && pass === VALID_PASS) {
        localStorage.setItem('anav.auth', JSON.stringify({
          user: user.trim(),
          at: Date.now(),
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        }))
        nav('/dashboard')
      } else {
        setErr('Invalid credentials')
        setBusy(false)
      }
    }, 600)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 20% 40%, rgba(88,101,242,.08) 0%, transparent 100%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(34,197,94,.05) 0%, transparent 100%)',
    }}>
      <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 28, padding: '0 16px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #5865f2 0%, #22c55e 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, boxShadow: '0 8px 32px #5865f244',
            }}>📈</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: 'var(--text)', letterSpacing: -0.5 }}>AnavAI</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: 2 }}>STOCK TERMINAL</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            NSE · BSE · F&O · Intraday · IPO · Mutual Funds
          </div>
        </div>

        {/* Card */}
        <form onSubmit={submit} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '28px 28px',
          display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 20px 60px #00000030',
        }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>
              Welcome back, Anav 👋
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sign in to your personal terminal</div>
          </div>

          {/* Username */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6, letterSpacing:.8, textTransform:'uppercase' }}>
              User ID
            </label>
            <input className="input" type="text" value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="Enter your user ID"
              style={{ height:44, fontSize:14 }}
              autoFocus autoComplete="username"/>
          </div>

          {/* Password */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6, letterSpacing:.8, textTransform:'uppercase' }}>
              Password
            </label>
            <div style={{ position:'relative' }}>
              <input className="input" type={show?'text':'password'} value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Enter your password"
                style={{ height:44, fontSize:14, paddingRight:44 }}
                autoComplete="current-password"/>
              <button type="button" onClick={() => setShow(s=>!s)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16 }}>
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {err && (
            <div style={{ padding:'10px 14px', background:'#ef444410', border:'1px solid #ef444433',
              borderRadius:8, color:'var(--red)', fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
              ⚠️ {err}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}
            style={{ height:46, fontSize:15, fontFamily:"'Syne', sans-serif", fontWeight:700, marginTop:4 }}>
            {busy
              ? <span style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
                  <span className="anim-spin" style={{ display:'inline-block', width:16, height:16,
                    border:'2px solid #ffffff40', borderTopColor:'#fff', borderRadius:'50%' }}/>
                  Signing in…
                </span>
              : '→ Sign In'}
          </button>
        </form>

        <div style={{ textAlign:'center', fontSize:11, color:'var(--text3)', lineHeight:1.8 }}>
          🔒 Personal use only · Not SEBI investment advice<br/>
          Data: Upstox API · Trade at your own risk
        </div>
      </div>
    </div>
  )
}
