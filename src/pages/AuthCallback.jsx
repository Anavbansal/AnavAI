import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, UPSTOX_REDIRECT_URI } from '../config'

export default function AuthCallback() {
  const [status, setStatus] = useState('loading')
  const [msg, setMsg] = useState('Exchanging token with Upstox...')
  const nav = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const error = params.get('error')

    if (error) {
      setStatus('error')
      setMsg(`Upstox OAuth error: ${error}`)
      setTimeout(() => nav('/dashboard'), 3000)
      return
    }

    if (!code) {
      setStatus('error')
      setMsg('No auth code received from Upstox.')
      setTimeout(() => nav('/dashboard'), 3000)
      return
    }

    // Exchange code for token
    fetch(`${API_BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: UPSTOX_REDIRECT_URI }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.status === 'success' && data?.data?.access_token) {
          // Store token in localStorage
          localStorage.setItem('upstox_access_token', data.data.access_token)
          if (data.data.refresh_token) {
            localStorage.setItem('upstox_refresh_token', data.data.refresh_token)
          }
          localStorage.setItem('upstox_token_ts', Date.now().toString())
          setStatus('success')
          setMsg('✓ Upstox connected! Live data is now active.')
          setTimeout(() => nav('/dashboard'), 1500)
        } else {
          throw new Error(data?.message || 'Token exchange failed')
        }
      })
      .catch(e => {
        setStatus('error')
        setMsg(`Failed: ${e.message}`)
        setTimeout(() => nav('/dashboard'), 3000)
      })
  }, [])

  const color = status === 'success' ? '#22c55e' : status === 'error' ? '#f43f5e' : '#5865f2'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--surface)', border: `1px solid ${color}33`,
        borderRadius: 16, padding: 40, maxWidth: 400, width: '90%',
        textAlign: 'center', boxShadow: `0 8px 40px ${color}22`,
      }}>
        {status === 'loading' && (
          <div className="anim-spin" style={{
            width: 48, height: 48, border: `4px solid var(--border)`,
            borderTopColor: color, borderRadius: '50%', margin: '0 auto 20px',
          }}/>
        )}
        {status === 'success' && <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>}
        {status === 'error'   && <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>}

        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 10 }}>
          {status === 'loading' ? 'Connecting Upstox...' : status === 'success' ? 'Connected!' : 'Connection Failed'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>{msg}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>Redirecting to dashboard...</div>
      </div>
    </div>
  )
}
