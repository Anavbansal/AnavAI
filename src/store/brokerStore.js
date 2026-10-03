// Broker Store — manages which broker is active
// Persists to localStorage
// Used across all components that fetch market data

const STORAGE_KEY = 'anav_broker_config'

const defaultConfig = {
  activeBroker: 'upstox',   // 'upstox' | 'angelone'
  upstox: {
    connected: false,
    token: null,
    connectedAt: null,
  },
  angelone: {
    connected: false,
    // Angel One auth is handled server-side (TOTP auto-generated)
    // No token stored in browser — server manages it
    connectedAt: null,
  },
}

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...defaultConfig, ...JSON.parse(saved) }
  } catch {}
  return defaultConfig
}

function save(config) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)) } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getActiveBroker() {
  return load().activeBroker
}

export function setActiveBroker(broker) {
  const config = load()
  config.activeBroker = broker
  save(config)
  window.dispatchEvent(new CustomEvent('brokerChanged', { detail: { broker } }))
}

export function getBrokerConfig(broker) {
  return load()[broker] || {}
}

export function setUpstoxToken(token) {
  const config = load()
  config.upstox.connected = true
  config.upstox.token = token
  config.upstox.connectedAt = new Date().toISOString()
  config.activeBroker = 'upstox'
  save(config)
  // Also set in localStorage for backward compatibility
  localStorage.setItem('upstox_access_token', token)
}

export function setAngelOneConnected(connected) {
  const config = load()
  config.angelone.connected = connected
  if (connected) {
    config.angelone.connectedAt = new Date().toISOString()
    config.activeBroker = 'angelone'
  }
  save(config)
}

export function getUpstoxToken() {
  return load().upstox?.token || localStorage.getItem('upstox_access_token') || ''
}

export function isConnected(broker) {
  const config = load()
  if (broker === 'upstox') return !!config.upstox?.token
  if (broker === 'angelone') return !!config.angelone?.connected
  return false
}

export function isAnyConnected() {
  return isConnected('upstox') || isConnected('angelone')
}

export function disconnect(broker) {
  const config = load()
  if (broker === 'upstox') {
    config.upstox = { connected: false, token: null, connectedAt: null }
    localStorage.removeItem('upstox_access_token')
  }
  if (broker === 'angelone') {
    config.angelone = { connected: false, connectedAt: null }
  }
  // Switch to other broker if available
  if (broker === config.activeBroker) {
    const other = broker === 'upstox' ? 'angelone' : 'upstox'
    if (isConnected(other)) config.activeBroker = other
  }
  save(config)
}

export function getAuthHeader() {
  const config = load()
  const broker = config.activeBroker
  if (broker === 'upstox' && config.upstox?.token) {
    return {
      'Authorization': `Bearer ${config.upstox.token}`,
      'X-Broker': 'upstox',
    }
  }
  if (broker === 'angelone') {
    return {
      'X-Broker': 'angelone',
      // No token from browser — Angel One auth is server-side
    }
  }
  return {}
}
