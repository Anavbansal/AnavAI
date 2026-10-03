// BrokerSelector — shown in Header
// Allows switching between Upstox and Angel One
// Angel One: server handles auth (TOTP auto) — just one click
// Upstox: OAuth flow

import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config'
import {
  getActiveBroker, setActiveBroker,
  isConnected, setUpstoxToken, setAngelOneConnected,
  disconnect, getUpstoxToken,
} from '../../store/brokerStore'

export default function BrokerSelector() {
  const [active,        setActive]        = useState(getActiveBroker())
  const [upstoxConn,    setUpstoxConn]    = useState(isConnected('upstox'))
  const [angelConn,     setAngelConn]     = useState(isConnected('angelone'))
  const [angelLoading,  setAngelLoading]  = useState(false)
  const [open,          setOpen]          = useState(false)

  useEffect(() => {
    const handler = (e) => {
      setActive(e.detail.broker)
      setUpstoxConn(isConnected('upstox'))
      setAngelConn(isConnected('angelone'))
    }
    window.addEventListener('brokerChanged', handler)
    return () => window.removeEventListener('brokerChanged', handler)
  }, [])

  // Handle Upstox OAuth callback token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('upstox_token')
    if (token) {
      setUpstoxToken(token)
      setUpstoxConn(true)
      setActive('upstox')
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function connectUpstox() {
    const res = await fetch(`${API_BASE_URL}/auth/url`, {
      headers: { 'X-Broker': 'upstox' }
    })
    const data = await res.json()
    if (data.data?.authorizationUrl) {
      window.location.href = data.data.authorizationUrl
    }
  }

  async function connectAngelOne() {
    // Angel One auth is server-side — just ping to check credentials
    setAngelLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/angelone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.status === 'success') {
        setAngelOneConnected(true)
        setAngelConn(true)
        setActive('angelone')
      } else {
        alert('Angel One login failed. Check ANGELONE_* env vars in Render.')
      }
    } catch (e) {
      alert('Angel One connection error: ' + e.message)
    }
    setAngelLoading(false)
  }

  const brokers = [
    {
      id: 'upstox',
      name: 'Upstox',
      logo: '🔵',
      connected: upstoxConn,
      color: '#5367FF',
      connect: connectUpstox,
      desc: 'OAuth login — browser redirect',
    },
    {
      id: 'angelone',
      name: 'Angel One',
      logo: '🟠',
      connected: angelConn,
      color: '#F07B24',
      connect: connectAngelOne,
      desc: 'Auto-login via TOTP',
      loading: angelLoading,
    },
  ]

  const activeBroker = brokers.find(b => b.id === active)

  return (
    <div style={{position:'relative'}}>
      {/* Active broker button */}
      <button onClick={() => setOpen(o => !o)} style={{
        display:'flex',alignItems:'center',gap:6,padding:'5px 12px',
        borderRadius:20,border:`1px solid ${activeBroker?.connected ? activeBroker.color+'44' : 'var(--border)'}`,
        background: activeBroker?.connected ? activeBroker.color+'15' : 'var(--bg2)',
        cursor:'pointer',color:'var(--text)',fontSize:12,fontWeight:600,
      }}>
        {activeBroker?.connected ? (
          <>
            <span style={{width:7,height:7,borderRadius:'50%',background:activeBroker.color,
              animation:'pulse 2s infinite',boxShadow:`0 0 5px ${activeBroker.color}`}}/>
            <span style={{color:activeBroker.color}}>{activeBroker.logo} {activeBroker.name} Live</span>
          </>
        ) : (
          <>
            <span style={{width:7,height:7,borderRadius:'50%',background:'var(--text3)'}}/>
            <span style={{color:'var(--text3)'}}>Connect Broker</span>
          </>
        )}
        <span style={{color:'var(--text3)',fontSize:10}}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute',top:'calc(100% + 6px)',right:0,
          background:'var(--surface)',border:'1px solid var(--border)',
          borderRadius:10,padding:8,minWidth:240,
          boxShadow:'0 8px 32px #00000044',zIndex:1000,
        }} onMouseLeave={() => setOpen(false)}>

          <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,letterSpacing:.8,
            padding:'4px 8px',marginBottom:4}}>SELECT BROKER</div>

          {brokers.map(b => (
            <div key={b.id} style={{
              padding:'10px 12px',borderRadius:8,marginBottom:4,
              border:`1px solid ${active===b.id ? b.color+'33' : 'transparent'}`,
              background: active===b.id ? b.color+'10' : 'transparent',
            }}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span>{b.logo}</span>
                  <span style={{fontWeight:700,fontSize:13,color:'var(--text)'}}>{b.name}</span>
                  {b.connected && (
                    <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,
                      background:b.color+'20',color:b.color,fontWeight:700}}>LIVE</span>
                  )}
                </div>
                {active===b.id && b.connected && (
                  <button onClick={() => { disconnect(b.id); setOpen(false);
                    b.id==='upstox' ? setUpstoxConn(false) : setAngelConn(false) }}
                    style={{fontSize:10,color:'var(--text3)',background:'transparent',
                      border:'1px solid var(--border)',borderRadius:5,padding:'2px 8px',cursor:'pointer'}}>
                    Disconnect
                  </button>
                )}
              </div>
              <div style={{fontSize:10,color:'var(--text3)',marginBottom:6}}>{b.desc}</div>
              <div style={{display:'flex',gap:6}}>
                {!b.connected ? (
                  <button onClick={() => { b.connect(); setOpen(false) }} disabled={b.loading}
                    style={{flex:1,padding:'6px 0',borderRadius:7,border:'none',cursor:'pointer',
                      background:b.color,color:'#fff',fontSize:11,fontWeight:700,opacity:b.loading?.7:1}}>
                    {b.loading ? 'Connecting...' : `Connect ${b.name}`}
                  </button>
                ) : (
                  <button onClick={() => { setActiveBroker(b.id); setActive(b.id); setOpen(false) }}
                    disabled={active===b.id}
                    style={{flex:1,padding:'6px 0',borderRadius:7,border:`1px solid ${b.color}`,
                      cursor:active===b.id?'default':'pointer',
                      background:active===b.id?b.color:'transparent',
                      color:active===b.id?'#fff':b.color,fontSize:11,fontWeight:700}}>
                    {active===b.id ? '✓ Active' : 'Use This'}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{fontSize:10,color:'var(--text3)',padding:'6px 8px 2px',borderTop:'1px solid var(--border)',marginTop:4}}>
            Both brokers can be connected. Switch anytime.
          </div>
        </div>
      )}
    </div>
  )
}
