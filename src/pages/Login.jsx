import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr]   = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  function login(e) {
    e.preventDefault()
    if (!user.trim() || !pass.trim()) { setErr('Enter credentials'); return }
    setLoading(true); setErr('')
    setTimeout(() => {
      localStorage.setItem('anav.auth', JSON.stringify({ user: user.trim(), at: Date.now() }))
      nav('/dashboard')
    }, 600)
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#0b0f19',
      backgroundImage:'radial-gradient(ellipse at 20% 50%, #6366f108 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #10b98108 0%, transparent 50%)',
    }}>
      <div style={{ width: 400, display:'flex', flexDirection:'column', gap:32 }}>
        {/* Logo */}
        <div style={{ textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:8 }}>
            <div style={{
              width:40, height:40, borderRadius:10,
              background:'linear-gradient(135deg, #6366f1, #10b981)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20,
            }}>📈</div>
            <div>
              <div style={{ fontSize:24, fontWeight:800, color:'#f1f5f9', letterSpacing:-0.5 }}>AnavAI</div>
              <div style={{ fontSize:11, color:'#475569', fontWeight:500 }}>Stock Terminal</div>
            </div>
          </div>
          <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
            NSE · BSE · F&O · Intraday · Delivery
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:'#151c2c', border:'1px solid #1f2d45', borderRadius:16,
          padding:32, display:'flex', flexDirection:'column', gap:20,
        }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:4 }}>Welcome back</div>
            <div style={{ fontSize:13, color:'#64748b' }}>Sign in to your terminal</div>
          </div>

          <form onSubmit={login} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>
                USER ID
              </label>
              <input className="input" value={user} onChange={e=>setUser(e.target.value)}
                placeholder="Enter your user ID" autoFocus/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>
                PASSWORD
              </label>
              <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)}
                placeholder="Enter your password"/>
            </div>
            {err && <div style={{ fontSize:12, color:'#ef4444', background:'#7f1d1d20', padding:'8px 12px', borderRadius:6 }}>⚠ {err}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width:'100%', justifyContent:'center', height:44, fontSize:15 }}>
              {loading ? (
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:16, height:16, border:'2px solid #ffffff40', borderTopColor:'#fff', borderRadius:'50%' }} className="animate-spin"/>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', fontSize:11, color:'#334155' }}>
          ⚠ For personal educational use only · Not SEBI investment advice
        </div>
      </div>
    </div>
  )
}
