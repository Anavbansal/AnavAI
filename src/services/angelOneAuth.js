// Angel One SmartAPI — Browser-side Authentication
// No server IP needed — TOTP generated in browser, login via API
// Base URL: https://apiconnect.angelbroking.com

import { generateTOTP } from '../utils/totp'

const BASE = 'https://apiconnect.angelbroking.com'

// Stored in localStorage — never sent to our server
const STORAGE_KEY = 'anav_angelone_auth'

function saveAuth(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...data,
    savedAt: Date.now(),
  }))
}

function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch { return null }
}

export function getAngelAuth() { return loadAuth() }

export function isAngelConnected() {
  const auth = loadAuth()
  if (!auth?.jwtToken) return false
  // Token valid till midnight — check if same day
  const saved = new Date(auth.savedAt)
  const now   = new Date()
  return saved.toDateString() === now.toDateString()
}

export function getAngelHeaders(apiKey) {
  const auth = loadAuth()
  if (!auth?.jwtToken) return {}
  return {
    'Authorization': `Bearer ${auth.jwtToken}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'X-PrivateKey':  apiKey || auth.apiKey || '',
    'X-UserType':    'USER',
    'X-SourceID':    'WEB',
    'X-ClientLocalIP':  '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress':     'fe80::216e',
  }
}

// Main login — called from browser with user credentials
export async function angelOneLogin({ apiKey, clientId, pin, totpSecret }) {
  // Generate TOTP in browser
  const totp = await generateTOTP(totpSecret)

  const res = await fetch(`${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'X-PrivateKey': apiKey,
      'X-UserType':   'USER',
      'X-SourceID':   'WEB',
      'X-ClientLocalIP':  '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress':     'fe80::216e',
    },
    body: JSON.stringify({
      clientcode: clientId,
      password:   pin,
      totp:       totp,
    }),
  })

  const data = await res.json()

  if (!data?.data?.jwtToken) {
    throw new Error(data?.message || 'Login failed')
  }

  // Save to localStorage — browser side only
  saveAuth({
    jwtToken:     data.data.jwtToken,
    refreshToken: data.data.refreshToken,
    feedToken:    data.data.feedToken,
    apiKey,
    clientId,
  })

  return data.data
}

// Refresh token daily (no TOTP needed)
export async function angelOneRefresh() {
  const auth = loadAuth()
  if (!auth?.refreshToken) throw new Error('No refresh token')

  const res = await fetch(`${BASE}/rest/auth/angelbroking/jwt/v1/generateTokens`, {
    method: 'POST',
    headers: getAngelHeaders(auth.apiKey),
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  })
  const data = await res.json()
  if (data?.data?.jwtToken) {
    saveAuth({ ...auth, jwtToken: data.data.jwtToken, savedAt: Date.now() })
  }
}

// Get holdings from Angel One directly (browser → Angel One)
export async function getAngelHoldings() {
  const auth = loadAuth()
  if (!auth?.jwtToken) throw new Error('Not connected')

  const res = await fetch(`${BASE}/rest/secure/angelbroking/portfolio/v1/getAllHolding`, {
    headers: getAngelHeaders(auth.apiKey),
  })
  const data = await res.json()
  return data?.data || {}
}

// Get LTP from Angel One
export async function getAngelLTP(symbolToken, exchange = 'NSE') {
  const auth = loadAuth()
  if (!auth?.jwtToken) return null

  const res = await fetch(`${BASE}/rest/secure/angelbroking/market/v1/quote/`, {
    method: 'POST',
    headers: getAngelHeaders(auth.apiKey),
    body: JSON.stringify({
      mode: 'LTP',
      exchangeTokens: { [exchange]: [symbolToken] },
    }),
  })
  const data = await res.json()
  const fetched = data?.data?.fetched?.[0]
  return fetched?.ltp || null
}

// Search scrip
export async function searchAngelScrip(query) {
  const auth = loadAuth()
  if (!auth?.jwtToken) return []

  const res = await fetch(
    `${BASE}/rest/secure/angelbroking/order/v1/searchScrip?exchange=NSE&searchscrip=${encodeURIComponent(query)}`,
    { headers: getAngelHeaders(auth.apiKey) }
  )
  const data = await res.json()
  return data?.data || []
}

export function disconnectAngel() {
  localStorage.removeItem(STORAGE_KEY)
}
