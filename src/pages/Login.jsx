import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import { angelOneLogin, isAngelConnected } from '../services/angelOneAuth'

const VALID_USER = 'anav'
const VALID_PASS = '2210'

export default function Login() {
  const [step,   setStep]   = useState('login')  // 'login' | 'broker'
  const [user,   setUser]   = useState('')
  const [pass,   setPass]   = useState('')
  const [show,   setShow]   = useState(false)
  const [err,    setErr]    = useState('')
  const [busy,   setBusy]   = useState(false)
  const [broker, setBroker] = useState(null)      // 'upstox' | 'angelone' | 'both'
  const [angelStatus, setAngelStatus] = useState('idle') // idle|connecting|done|error
  const [angelCreds, setAngelCreds]   = useState({
    apiKey: localStorage.getItem('anav_ao_apikey') || '',
    clientId: 'SJES1209',
    pin: '',
    totpSecret: '',
  })
  const [angelErr,   setAngelErr]     = useState('')
  const nav = useNavigate()

  // ── Step 1: Login ──────────────────────────────────────────────────────────
  function handleLogin(e) {
    e.preventDefault()
    if (!user.trim() || !pass.trim()) { setErr('Please fill in both fields'); return }
    setBusy(true); setErr('')
    setTimeout(() => {
      if (user.trim().toLowerCase() === VALID_USER && pass === VALID_PASS) {
        localStorage.setItem('anav.auth', JSON.stringify({
          user: user.trim(), at: Date.now(),
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
        setStep('broker')
        setBusy(false)
      } else {
        setErr('Invalid credentials')
        setBusy(false)
      }
    }, 600)
  }

  // ── Step 2: Broker selection ───────────────────────────────────────────────
  async function selectBroker(choice) {
    setBroker(choice)
    localStorage.setItem('anav_preferred_broker', choice === 'both' ? 'upstox' : choice)

    if (choice === 'upstox') {
      nav('/dashboard')
      return
    }

    if (choice === 'angelone' || choice === 'both') {
      // Show Angel One credential form
      setStep('angelone')
      return
    }

    nav('/dashboard')
  }

  function connectUpstoxOAuth() {
    // Store that user wants Upstox too, then redirect
    localStorage.setItem('anav_wants_upstox', '1')
    fetch(`${API_BASE_URL}/auth/url`)
      .then(r => r.json())
      .then(d => { if (d.data?.authorizationUrl) window.location.href = d.data.authorizationUrl })
  }

  async function handleAngelLogin(e) {
    e.preventDefault()
    if (!angelCreds.apiKey || !angelCreds.pin || !angelCreds.totpSecret) {
      setAngelErr('Please fill all fields'); return
    }
    setAngelStatus('connecting'); setAngelErr('')
    try {
      // Try browser-side first (no server IP needed for market data)
      const { angelOneLogin } = await import('../services/angelOneAuth')
      await angelOneLogin(angelCreds)
      localStorage.setItem('anav_ao_apikey',   angelCreds.apiKey)
      localStorage.setItem('anav_ao_clientid',  angelCreds.clientId)
      localStorage.setItem('anav_angelone_connected', '1')
      setAngelStatus('done')
      setTimeout(() => nav('/dashboard'), 800)
    } catch(err) {
      // Try server-side as fallback
      try {
        const res = await fetch(`${API_BASE_URL}/auth/angelone/login`, { method: 'POST' })
        const data = await res.json()
        if (data.status === 'success') {
          localStorage.setItem('anav_angelone_connected', '1')
          setAngelStatus('done')
          setTimeout(() => nav('/dashboard'), 800)
        } else {
          setAngelErr(data.message || 'Login failed — check credentials')
          setAngelStatus('error')
        }
      } catch {
        setAngelErr(err.message || 'Login failed — check API key, MPIN and TOTP secret')
        setAngelStatus('error')
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)',
      backgroundImage:'radial-gradient(ellipse 60% 50% at 20% 40%, rgba(88,101,242,.09) 0%, transparent 100%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(34,197,94,.06) 0%, transparent 100%)',
    }}>
      <div style={{ width:420, display:'flex', flexDirection:'column', gap:24, padding:'0 16px' }}>

        {/* Brand */}
        <div style={{ textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:10 }}>
            <div style={{ width:52, height:52, borderRadius:14,
              background:'linear-gradient(135deg,#5865f2,#22c55e)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:26, boxShadow:'0 8px 32px #5865f244' }}>📈</div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28,
                color:'var(--text)', letterSpacing:-0.5 }}>AnavAI</div>
              <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:2 }}>
                STOCK TERMINAL
              </div>
            </div>
          </div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>
            NSE · BSE · F&O · Intraday · IPO · Mutual Funds
          </div>
        </div>

        {/* ── STEP 1: Login Card ── */}
        {step === 'login' && (
          <form onSubmit={handleLogin} style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:16, padding:'28px',
            display:'flex', flexDirection:'column', gap:18,
            boxShadow:'0 20px 60px #00000030',
          }}>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:'var(--text)', marginBottom:4 }}>
                Welcome back, Anav 👋
              </div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>Sign in to your personal terminal</div>
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                marginBottom:6, letterSpacing:.8, textTransform:'uppercase' }}>User ID</label>
              <input className="input" type="text" value={user}
                onChange={e => setUser(e.target.value)} placeholder="Enter your user ID"
                style={{ height:44, fontSize:14 }} autoFocus autoComplete="username"/>
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                marginBottom:6, letterSpacing:.8, textTransform:'uppercase' }}>Password</label>
              <div style={{ position:'relative' }}>
                <input className="input" type={show?'text':'password'} value={pass}
                  onChange={e => setPass(e.target.value)} placeholder="Enter your password"
                  style={{ height:44, fontSize:14, paddingRight:44 }} autoComplete="current-password"/>
                <button type="button" onClick={() => setShow(s=>!s)} style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16 }}>
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {err && (
              <div style={{ padding:'10px 14px', background:'#ef444410',
                border:'1px solid #ef444433', borderRadius:8, color:'var(--red)', fontSize:12 }}>
                ⚠️ {err}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={busy}
              style={{ height:46, fontSize:15, fontFamily:"'Syne',sans-serif", fontWeight:700 }}>
              {busy
                ? <span style={{ display:'flex',alignItems:'center',gap:8,justifyContent:'center' }}>
                    <span className="anim-spin" style={{ display:'inline-block',width:16,height:16,
                      border:'2px solid #ffffff40',borderTopColor:'#fff',borderRadius:'50%' }}/>
                    Signing in…
                  </span>
                : '→ Sign In'}
            </button>
          </form>
        )}

        {/* ── STEP 2: Broker Selection ── */}
        {step === 'broker' && (
          <div style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:16, padding:'28px',
            display:'flex', flexDirection:'column', gap:20,
            boxShadow:'0 20px 60px #00000030',
          }}>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18,
                color:'var(--text)', marginBottom:4 }}>
                Choose Your Broker 🔌
              </div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>
                Select which broker to use for live market data
              </div>
            </div>

            {/* Broker cards */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

              {/* Upstox */}
              <button onClick={() => selectBroker('upstox')} style={{
                padding:'16px', borderRadius:12, cursor:'pointer', textAlign:'left',
                border: broker==='upstox' ? '2px solid #5367FF' : '1px solid var(--border)',
                background: broker==='upstox' ? '#5367FF10' : 'var(--bg2)',
                transition:'all .2s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'#5367FF20',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🔵</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:2 }}>
                      Upstox
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      OAuth login · V3 WebSocket · Real-time feed
                    </div>
                  </div>
                  <div style={{ fontSize:11, padding:'3px 10px', borderRadius:20,
                    background:'#5367FF15', color:'#5367FF', fontWeight:600 }}>
                    Connect →
                  </div>
                </div>
              </button>

              {/* Angel One */}
              <button onClick={() => selectBroker('angelone')} style={{
                padding:'16px', borderRadius:12, cursor:'pointer', textAlign:'left',
                border: broker==='angelone' ? '2px solid #F07B24' : '1px solid var(--border)',
                background: broker==='angelone' ? '#F07B2410' : 'var(--bg2)',
                transition:'all .2s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'#F07B2420',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🟠</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:2 }}>
                      Angel One
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      Auto-login via TOTP · Your 14 stocks · Real P&L
                    </div>
                  </div>
                  <div style={{ fontSize:11, padding:'3px 10px', borderRadius:20,
                    background:'#F07B2415', color:'#F07B24', fontWeight:600 }}>
                    {angelStatus === 'connecting' ? '⟳ Connecting...' :
                     angelStatus === 'done' ? '✓ Connected' :
                     angelStatus === 'error' ? '⚠ Retry' : 'Connect →'}
                  </div>
                </div>
              </button>

              {/* Both */}
              <button onClick={() => selectBroker('both')} style={{
                padding:'16px', borderRadius:12, cursor:'pointer', textAlign:'left',
                border: broker==='both' ? '2px solid var(--green)' : '1px solid var(--border)',
                background: broker==='both' ? '#22c55e10' : 'var(--bg2)',
                transition:'all .2s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'#22c55e20',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🔵🟠</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:2 }}>
                      Both Brokers
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      Use Upstox as primary · Angel One as backup
                    </div>
                  </div>
                  <div style={{ fontSize:11, padding:'3px 10px', borderRadius:20,
                    background:'#22c55e15', color:'var(--green)', fontWeight:600 }}>
                    Best →
                  </div>
                </div>
              </button>

            </div>

            {/* Skip */}
            <button onClick={() => nav('/dashboard')} style={{
              background:'none', border:'none', cursor:'pointer',
              color:'var(--text3)', fontSize:12, textAlign:'center', padding:4,
            }}>
              Skip for now — connect later from dashboard
            </button>
          </div>
        )}

        {/* ── STEP 3: Angel One Credentials ── */}
        {step === 'angelone' && (
          <form onSubmit={handleAngelLogin} style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:16, padding:'28px',
            display:'flex', flexDirection:'column', gap:16,
            boxShadow:'0 20px 60px #00000030',
          }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <span style={{ fontSize:24 }}>🟠</span>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:'var(--text)' }}>
                  Angel One Login
                </div>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>
                Credentials stored only in your browser — never sent to our server
              </div>
            </div>

            {[
              { label:'API Key', key:'apiKey', placeholder:'From smartapi.angelbroking.com', type:'text' },
              { label:'Client ID', key:'clientId', placeholder:'e.g. SJES1209', type:'text' },
              { label:'MPIN (4-digit)', key:'pin', placeholder:'Your Angel One MPIN', type:'password' },
              { label:'TOTP Secret', key:'totpSecret', placeholder:'Base32 secret from Angel One app', type:'password' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                  marginBottom:6, letterSpacing:.8, textTransform:'uppercase' }}>{field.label}</label>
                <input className="input" type={field.type}
                  value={angelCreds[field.key]}
                  onChange={e => setAngelCreds(p => ({...p, [field.key]: e.target.value}))}
                  placeholder={field.placeholder}
                  style={{ height:44, fontSize:13 }}/>
              </div>
            ))}

            {angelErr && (
              <div style={{ padding:'10px 14px', background:'#ef444410',
                border:'1px solid #ef444433', borderRadius:8, color:'var(--red)', fontSize:12 }}>
                ⚠️ {angelErr}
              </div>
            )}

            {angelStatus === 'done' && (
              <div style={{ padding:'10px 14px', background:'#22c55e10',
                border:'1px solid #22c55e33', borderRadius:8, color:'var(--green)', fontSize:12 }}>
                ✅ Connected! Redirecting...
              </div>
            )}

            <button type="submit" disabled={angelStatus === 'connecting'}
              style={{ height:46, borderRadius:10, border:'none', cursor:'pointer',
                background:'#F07B24', color:'#fff', fontWeight:700, fontSize:15,
                fontFamily:"'Syne',sans-serif", opacity: angelStatus==='connecting'?.7:1 }}>
              {angelStatus === 'connecting'
                ? <span style={{ display:'flex',alignItems:'center',gap:8,justifyContent:'center' }}>
                    <span className="anim-spin" style={{ display:'inline-block',width:16,height:16,
                      border:'2px solid #ffffff40',borderTopColor:'#fff',borderRadius:'50%' }}/>
                    Connecting to Angel One...
                  </span>
                : '🟠 Connect Angel One'}
            </button>

            <button type="button" onClick={() => setStep('broker')}
              style={{ background:'none', border:'none', cursor:'pointer',
                color:'var(--text3)', fontSize:12, textAlign:'center' }}>
              ← Back to broker selection
            </button>

            <div style={{ fontSize:10, color:'var(--text3)', lineHeight:1.7,
              padding:'8px 12px', background:'var(--bg2)', borderRadius:8 }}>
              🔐 TOTP Secret: Angel One app → Profile → Settings → Enable TOTP → Copy base32 secret<br/>
              🔑 API Key: smartapi.angelbroking.com → My Apps → Create App → Copy key<br/>
              🔒 These are saved only in your browser's localStorage
            </div>
          </form>
        )}

        <div style={{ textAlign:'center', fontSize:11, color:'var(--text3)', lineHeight:1.8 }}>
          🔒 Personal use only · Not SEBI investment advice<br/>
          Data: Upstox + Angel One APIs
        </div>
      </div>
    </div>
  )
}
