import { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws'

// Global WS singleton — one connection for entire app
let globalWS = null
let subscribers = new Map() // symbol -> Set<callback>
let reconnectTimer = null
let isConnecting = false

function getToken() { return localStorage.getItem('upstox_access_token') || '' }

function connectGlobal() {
  if (globalWS?.readyState === WebSocket.OPEN || isConnecting) return
  isConnecting = true
  try {
    globalWS = new WebSocket(WS_URL)
    globalWS.onopen = () => {
      isConnecting = false
      globalWS.send(JSON.stringify({ type:'AUTH', token: getToken() }))
      // Re-subscribe all active symbols
      const syms = [...subscribers.keys()].filter(s => subscribers.get(s)?.size > 0)
      if (syms.length > 0) {
        globalWS.send(JSON.stringify({ type:'SUBSCRIBE', symbols: syms }))
      }
    }
    globalWS.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'PRICE' && msg.symbol) {
          const cbs = subscribers.get(msg.symbol.toUpperCase())
          if (cbs) cbs.forEach(cb => cb(msg))
        }
      } catch {}
    }
    globalWS.onclose = () => {
      isConnecting = false
      globalWS = null
      if (subscribers.size > 0) {
        reconnectTimer = setTimeout(connectGlobal, 4000)
      }
    }
    globalWS.onerror = () => { isConnecting = false }
  } catch { isConnecting = false }
}

function subscribe(symbol, callback) {
  const sym = symbol.toUpperCase()
  if (!subscribers.has(sym)) subscribers.set(sym, new Set())
  subscribers.get(sym).add(callback)
  // Connect or subscribe if already connected
  if (!globalWS || globalWS.readyState !== WebSocket.OPEN) {
    connectGlobal()
  } else {
    globalWS.send(JSON.stringify({ type:'SUBSCRIBE', symbols:[sym] }))
  }
  return () => {
    subscribers.get(sym)?.delete(callback)
    if (subscribers.get(sym)?.size === 0) {
      subscribers.delete(sym)
      if (globalWS?.readyState === WebSocket.OPEN) {
        globalWS.send(JSON.stringify({ type:'UNSUBSCRIBE', symbol:sym }))
      }
    }
    if (subscribers.size === 0 && globalWS) {
      clearTimeout(reconnectTimer)
    }
  }
}

// Hook — use in any component to get live price for a symbol
// Falls back to REST polling if WebSocket doesn't deliver within 8 seconds
export function useLivePrice(symbol) {
  const [priceData, setPriceData] = useState(null)
  const [connected, setConnected] = useState(false)
  const receivedRef = useRef(false)
  const pollRef = useRef(null)

  const fetchREST = useCallback(async (sym) => {
    try {
      const token = getToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}/api/ltp?symbol=${sym}`, { headers })
      const d = await res.json()
      if (d.ltp > 0) {
        setPriceData(prev => ({
          price: d.ltp,
          change: prev?.change ?? 0,
          changePct: prev?.changePct ?? 0,
          ts: Date.now()
        }))
        setConnected(true)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!symbol) return
    const sym = symbol.toUpperCase()
    receivedRef.current = false

    // Reset price immediately on symbol change — avoid showing stale price from prev symbol
    setPriceData(null)
    setConnected(false)

    const cb = (msg) => {
      // Double-check the message is for the correct symbol
      if (msg.symbol && msg.symbol.toUpperCase() !== sym) return
      receivedRef.current = true
      clearInterval(pollRef.current)
      setPriceData({ price: msg.price, change: msg.change, changePct: msg.changePct, ts: msg.ts })
      setConnected(true)
    }
    const unsub = subscribe(sym, cb)

    // After 5s, if no WS price yet → start REST polling every 5s
    const fallbackTimer = setTimeout(() => {
      if (!receivedRef.current) {
        fetchREST(sym)
        pollRef.current = setInterval(() => fetchREST(sym), 5000)
      }
    }, 5000)

    return () => {
      unsub()
      clearTimeout(fallbackTimer)
      clearInterval(pollRef.current)
    }
  }, [symbol, fetchREST])

  return { priceData, connected }
}

// Hook — auto-refresh price in PricePanel
export function useAutoRefresh(symbol, onRefresh, intervalMs = 5000) {
  const timerRef = useRef(null)
  const callbackRef = useRef(onRefresh)
  callbackRef.current = onRefresh

  useEffect(() => {
    if (!symbol) return
    // WebSocket for live updates
    const sym = symbol.toUpperCase()
    const cb = (msg) => {
      callbackRef.current?.({ price: msg.price, change: msg.change, changePct: msg.changePct })
    }
    const unsub = subscribe(sym, cb)
    return unsub
  }, [symbol])
}
