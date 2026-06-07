import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const WS_URL = API_BASE_URL.replace(/^http/, 'ws')

export default function PriceAlerts({ data }) {
  const [alerts, setAlerts]   = useState([])
  const [fired, setFired]     = useState([])
  const [form, setForm]       = useState({ symbol:'', type:'ABOVE', value:'' })
  const [connected, setConn]  = useState(false)
  const wsRef = useRef(null)
  const token = localStorage.getItem('upstox_access_token') || ''

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConn(true)
        ws.send(JSON.stringify({ type:'AUTH', token }))
        // Subscribe to current symbol if available
        if (data?.symbol) ws.send(JSON.stringify({ type:'SUBSCRIBE', symbol: data.symbol }))
        ws.send(JSON.stringify({ type:'GET_ALERTS' }))
      }
      ws.onclose = () => { setConn(false); setTimeout(connect, 5000) }
      ws.onerror = () => setConn(false)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'ALERTS_LIST') setAlerts(msg.alerts || [])
          if (msg.type === 'ALERT_SET')   setAlerts(p => [...p, { alertId:msg.alertId, symbol:msg.symbol, alertType:msg.alertType, value:msg.value }])
          if (msg.type === 'ALERT_CANCELLED') setAlerts(p => p.filter(a => a.alertId !== msg.alertId))
          if (msg.type === 'ALERT_TRIGGERED') {
            setFired(p => [{ ...msg, at: new Date().toLocaleTimeString('en-IN') }, ...p.slice(0,9)])
            setAlerts(p => p.filter(a => a.alertId !== msg.alertId))
            // Browser notification
            if (Notification.permission === 'granted') {
              new Notification(`🔔 ANAV Alert: ${msg.symbol}`, {
                body: msg.message,
                icon: '/favicon.ico',
              })
            }
          }
        } catch {}
      }
    } catch {}
  }, [token, data?.symbol])

  useEffect(() => {
    connect()
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    return () => wsRef.current?.close()
  }, [])

  function setAlert() {
    if (!form.symbol || !form.value) return
    wsRef.current?.send(JSON.stringify({
      type: 'SET_ALERT', symbol: form.symbol.toUpperCase(),
      alertType: form.type, value: Number(form.value)
    }))
    setForm({ symbol: data?.symbol||'', type:'ABOVE', value:'' })
  }

  function cancelAlert(id) {
    wsRef.current?.send(JSON.stringify({ type:'CANCEL_ALERT', alertId:id }))
  }

  // Pre-fill symbol from dashboard
  useEffect(() => {
    if (data?.symbol) setForm(f => ({ ...f, symbol: data.symbol }))
  }, [data?.symbol])

  return (
    <div className="card anim-fade">
      <div className="card-header">
        <span style={{fontSize:16}}>🔔</span>
        <span className="card-title">Price Alerts</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:11}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:connected?'var(--green)':'var(--red)',display:'inline-block'}}/>
          <span style={{color:connected?'var(--green)':'var(--red)'}}>{connected?'Connected':'Connecting...'}</span>
        </div>
      </div>

      {/* Set alert form */}
      <div style={{padding:16,borderBottom:'1px solid var(--border)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:10,letterSpacing:.5,textTransform:'uppercase'}}>Set New Alert</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))}
            placeholder="Symbol (e.g. RELIANCE)" className="input"
            style={{flex:2,minWidth:120,height:38,fontSize:13,fontFamily:"'DM Mono',monospace"}}/>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
            style={{height:38,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,
              color:'var(--text)',padding:'0 10px',fontSize:13,cursor:'pointer'}}>
            <option value="ABOVE">Price ▲ Above</option>
            <option value="BELOW">Price ▼ Below</option>
          </select>
          <input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))}
            placeholder="₹ Price" style={{flex:1,minWidth:100,height:38,fontSize:13,fontFamily:"'DM Mono',monospace"}}
            className="input"/>
          <button onClick={setAlert} className="btn btn-primary" disabled={!connected||!form.symbol||!form.value}
            style={{height:38,padding:'0 16px',fontSize:13}}>
            Set Alert
          </button>
        </div>
        {!connected && (
          <div style={{marginTop:8,fontSize:11,color:'var(--amber)'}}>⚠ WebSocket connection required for live alerts. Refresh if needed.</div>
        )}
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',letterSpacing:.5,marginBottom:8,textTransform:'uppercase'}}>Active Alerts ({alerts.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {alerts.map(a => (
              <div key={a.alertId} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8}}>
                <span style={{fontSize:16}}>{a.alertType==='ABOVE'?'▲':'▼'}</span>
                <div style={{flex:1}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,color:'var(--accent2)',fontSize:13}}>{a.symbol}</span>
                  <span style={{fontSize:12,color:'var(--text3)',marginLeft:8}}>
                    {a.alertType==='ABOVE'?'above':'below'} ₹{Number(a.value).toLocaleString('en-IN')}
                  </span>
                </div>
                <button onClick={()=>cancelAlert(a.alertId)}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:16}}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fired alerts history */}
      {fired.length > 0 && (
        <div style={{padding:'12px 16px'}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',letterSpacing:.5,marginBottom:8,textTransform:'uppercase'}}>Recent Triggers</div>
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {fired.map((f2,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',
                background:'#22c55e10',border:'1px solid #22c55e33',borderRadius:8}}>
                <span style={{fontSize:14}}>🔔</span>
                <div style={{flex:1,fontSize:12,color:'var(--text)'}}>{f2.message}</div>
                <span style={{fontSize:10,color:'var(--text3)',fontFamily:"'DM Mono',monospace"}}>{f2.at}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && fired.length === 0 && (
        <div style={{padding:32,textAlign:'center',color:'var(--text3)',fontSize:13}}>
          <div style={{fontSize:36,marginBottom:12,opacity:.2}}>🔔</div>
          No alerts set. Add a price alert above to get notified when your target is hit.
        </div>
      )}
    </div>
  )
}
