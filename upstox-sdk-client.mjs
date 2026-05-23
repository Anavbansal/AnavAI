/**
 * UPSTOX SDK CLIENT — Secure wrapper for Upstox API
 * Replaced the official SDK with direct fetch() calls because the SDK 
 * relies on callbacks and has poor Promise support.
 * All credentials managed via environment variables (.env)
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  clientId: process.env.UPSTOX_CLIENT_ID,
  clientSecret: process.env.UPSTOX_CLIENT_SECRET,
  redirectUri: process.env.UPSTOX_REDIRECT_URI,
  accessToken: process.env.UPSTOX_SANDBOX_ACCESS_TOKEN,
  baseUrl: 'https://api.upstox.com',
  apiVersion: '2.0',
}

// Validate environment variables on startup
function validateConfig() {
  const required = ['UPSTOX_CLIENT_ID', 'UPSTOX_CLIENT_SECRET', 'UPSTOX_REDIRECT_URI']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`)
    console.warn('⚠️  Some features may not work without proper Upstox credentials')
  }

  if (!process.env.UPSTOX_SANDBOX_ACCESS_TOKEN) {
    console.warn('⚠️  No UPSTOX_SANDBOX_ACCESS_TOKEN provided — will use OAuth token exchange')
  }

  return {
    isValid: missing.length === 0,
    hasSandboxToken: Boolean(process.env.UPSTOX_SANDBOX_ACCESS_TOKEN),
    missingVars: missing,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API CLIENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

let currentAccessToken = null

/**
 * Initialize client with access token
 * @param {string} token - Upstox access token
 */
function initializeClients(token) {
  if (!token) {
    throw new Error('Access token is required to initialize Upstox client')
  }
  currentAccessToken = token
  console.log('✓ Upstox API client initialized successfully')
  return true
}

/**
 * Get initialized clients (kept for compatibility with local-api-server.mjs)
 * @param {string} token - Optional token override
 * @returns {object} Empty object as SDK clients are deprecated
 */
function getClients(token) {
  const tokenToUse = token || currentAccessToken || CONFIG.accessToken

  if (!tokenToUse) {
    throw new Error('No access token available. Provide token or set UPSTOX_SANDBOX_ACCESS_TOKEN in .env')
  }

  // We no longer use the SDK client objects.
  return {}
}

/**
 * Internal helper to perform fetch requests against the Upstox API
 */
async function upstoxFetch(path, token, method = 'GET', body = null) {
  const tokenToUse = token || currentAccessToken || CONFIG.accessToken

  if (!tokenToUse) {
    throw new Error('No access token available. Provide token or set UPSTOX_SANDBOX_ACCESS_TOKEN in .env')
  }

  const url = `${CONFIG.baseUrl}${path}`
  const options = {
    method,
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${tokenToUse}`
    }
  }

  if (body) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMsg = data?.errors?.[0]?.message || data?.message || response.statusText || 'Unknown Error'
    throw new Error(`Upstox API error (${response.status}): ${errorMsg}`)
  }

  return data
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch intraday candles
 * @param {string} instrumentKey - Upstox instrument key (e.g., NSE_EQ|INE848E01016)
 * @param {string} interval - '1minute' or '30minute'
 * @param {string} token - Optional token override
 * @returns {array} Array of candles [timestamp, open, high, low, close, volume]
 */
/**
 * V3 Intraday Candle API
 * URL: GET /v3/historical-candle/intraday/{instrument_key}/{unit}/{interval}
 * unit: 'minutes' | 'hours' | 'days'
 * interval: 1-300 for minutes, 1-5 for hours, 1 for days
 */
export async function getIntradayCandles(instrumentKey, interval = '5', token) {
  if (!instrumentKey) throw new Error('instrumentKey is required')

  try {
    const { unit, ivl } = resolveIntradayInterval(interval)
    const encodedKey = encodeURIComponent(instrumentKey)
    const path = `/v3/historical-candle/intraday/${encodedKey}/${unit}/${ivl}`
    console.log(`[SDK] V3 Intraday: GET ${path}`)
    const response = await upstoxFetch(path, token)

    const candles = response?.data?.candles || []
    console.log(`\u2713 V3 Intraday: ${candles.length} candles for ${instrumentKey} (${unit}/${ivl})`)
    return candles
  } catch (err) {
    console.error(`\u2717 V3 Intraday candles failed for ${instrumentKey}:`, err.message)
    throw err
  }
}

/**
 * Resolve a resolution string into V3 intraday unit + interval
 * Supports: '1','3','5','15','30','60','1H','2H','D','day','1D'
 */
function resolveIntradayInterval(resolution) {
  const r = String(resolution).toUpperCase().trim()
  if (r === '60' || r === '1H')  return { unit: 'hours',   ivl: '1' }
  if (r === '120' || r === '2H') return { unit: 'hours',   ivl: '2' }
  if (r === '180' || r === '3H') return { unit: 'hours',   ivl: '3' }
  if (r === '240' || r === '4H') return { unit: 'hours',   ivl: '4' }
  if (r === 'D' || r === '1D' || r === 'DAY') return { unit: 'days', ivl: '1' }
  const num = parseInt(r, 10)
  if (!isNaN(num) && num >= 1 && num <= 300) return { unit: 'minutes', ivl: String(num) }
  return { unit: 'minutes', ivl: '5' }
}

/**
 * Fetch historical candles
 * @param {string} instrumentKey - Upstox instrument key
 * @param {string} interval - '1minute', '30minute', 'day', 'week', 'month'
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {string} fromDate - Start date (YYYY-MM-DD), optional
 * @param {string} token - Optional token override
 * @returns {array} Array of candles
 */
/**
 * V3 Historical Candle API
 * URL: GET /v3/historical-candle/{instrument_key}/{unit}/{interval}/{to_date}/{from_date}
 * unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
 */
export async function getHistoricalCandles(instrumentKey, interval = 'day', toDate, fromDate, token) {
  if (!instrumentKey || !toDate) {
    throw new Error('instrumentKey and toDate are required')
  }

  try {
    const { unit, ivl } = resolveHistoricalInterval(interval)
    const encodedKey = encodeURIComponent(instrumentKey)
    let path = `/v3/historical-candle/${encodedKey}/${unit}/${ivl}/${encodeURIComponent(toDate)}`
    if (fromDate) path += `/${encodeURIComponent(fromDate)}`

    console.log(`[SDK] V3 Historical: GET ${path}`)
    const response = await upstoxFetch(path, token)

    const candles = response?.data?.candles || []
    console.log(`\u2713 V3 Historical: ${candles.length} candles for ${instrumentKey} (${unit}/${ivl})`)
    return candles
  } catch (err) {
    console.error(`\u2717 V3 Historical candles failed:`, err.message)
    throw err
  }
}

/**
 * Resolve a resolution string into V3 historical unit + interval
 */
function resolveHistoricalInterval(resolution) {
  const r = String(resolution).toUpperCase().trim()
  if (r === 'D' || r === 'DAY' || r === '1D') return { unit: 'days',   ivl: '1' }
  if (r === 'W' || r === 'WEEK')              return { unit: 'weeks',  ivl: '1' }
  if (r === 'M' || r === 'MONTH')             return { unit: 'months', ivl: '1' }
  if (r === '60' || r === '1H')               return { unit: 'hours',  ivl: '1' }
  if (r === '120' || r === '2H')              return { unit: 'hours',  ivl: '2' }
  const num = parseInt(r, 10)
  if (!isNaN(num) && num >= 1 && num <= 300)  return { unit: 'minutes', ivl: String(num) }
  return { unit: 'days', ivl: '1' }
}

/**
 * Get last traded price (LTP)
 * @param {string|array} symbol - Instrument key(s), e.g., 'NSE_EQ|INE848E01016'
 * @param {string} token - Optional token override
 * @returns {object} LTP data
 */
export async function getLTP(symbol, token) {
  if (!symbol) throw new Error('symbol is required')

  try {
    const symbolStr = Array.isArray(symbol) ? symbol.join(',') : symbol
    const path = `/v2/market-quote/ltp?instrument_key=${encodeURIComponent(symbolStr)}`
    const response = await upstoxFetch(path, token)
    
    console.log(`✓ Fetched LTP for ${symbol}`)
    return response?.data
  } catch (err) {
    console.error(`✗ LTP fetch failed for ${symbol}:`, err.message)
    throw err
  }
}

/**
 * Get full market quote (LTP + OHLC + Greeks)
 * @param {string|array} symbol - Instrument key(s)
 * @param {string} token - Optional token override
 * @returns {object} Quote data
 */
export async function getQuote(symbol, token) {
  if (!symbol) throw new Error('symbol is required')

  try {
    const symbolStr = Array.isArray(symbol) ? symbol.join(',') : symbol
    const path = `/v2/market-quote/quotes?instrument_key=${encodeURIComponent(symbolStr)}`
    const response = await upstoxFetch(path, token)
    
    console.log(`✓ Fetched full quote for ${symbol}`)
    return response?.data
  } catch (err) {
    console.error(`✗ Quote fetch failed:`, err.message)
    throw err
  }
}

/**
 * Get Option chain (Greeks, IV, OI, etc.)
 * @param {string} symbol - Stock symbol/index name
 * @param {string} expiryDate - Option expiry (YYYY-MM-DD), optional
 * @param {string} token - Optional token override
 * @returns {array} Option chain data
 */
export async function getOptionChain(symbol, expiryDate, token) {
  if (!symbol) throw new Error('symbol is required')

  try {
    let path = `/v2/option/chain?instrument_key=${encodeURIComponent(symbol)}`
    if (expiryDate) {
      path += `&expiry_date=${encodeURIComponent(expiryDate)}`
    }
    
    const response = await upstoxFetch(path, token)
    console.log(`✓ Fetched option chain for ${symbol}`)
    return response?.data || []
  } catch (err) {
    console.error(`✗ Option chain fetch failed:`, err.message)
    throw err
  }
}

/**
 * Search instruments
 * @param {string} query - Search query
 * @param {object} options - { exchanges, segments, pageNumber, records, instrumentTypes, expiry, atmOffset }
 * @param {string} token - Optional token override
 * @returns {array} Matching instruments
 */
export async function searchInstruments(query, options = {}, token) {
  if (!query) throw new Error('query is required')

  try {
    const params = new URLSearchParams()
    params.append('search_string', query)
    
    if (options.exchanges) params.append('exchange', options.exchanges)
    if (options.segments) params.append('segment', options.segments)
    if (options.instrumentTypes) params.append('instrument_type', options.instrumentTypes)
    if (options.pageNumber) params.append('page_number', options.pageNumber)
    if (options.records) params.append('records', options.records)

    const path = `/v2/instruments/search?${params.toString()}`
    const response = await upstoxFetch(path, token)
    
    const results = response?.data || []
    console.log(`✓ Search found ${results.length} instruments matching "${query}"`)
    return results
  } catch (err) {
    console.error(`✗ Instrument search failed:`, err.message)
    throw err
  }
}

/**
 * Get user profile & holdings
 * @param {string} token - Optional token override
 * @returns {object} Profile data
 */
export async function getProfile(token) {
  try {
    const response = await upstoxFetch('/v2/user/profile', token)
    console.log(`✓ Fetched user profile`)
    return response?.data
  } catch (err) {
    console.error(`✗ Profile fetch failed:`, err.message)
    throw err
  }
}

/**
 * Exchange OAuth code for access token
 * @param {string} code - Authorization code from OAuth callback
 * @param {string} redirectUri - Redirect URI (must match registered)
 * @returns {object} { access_token, expires_in, token_type, refresh_token }
 */
export async function exchangeAuthCode(code, redirectUri) {
  if (!code) throw new Error('Authorization code is required')

  try {
    const formData = new URLSearchParams({
      code,
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      redirect_uri: redirectUri || CONFIG.redirectUri,
      grant_type: 'authorization_code',
    })

    const response = await fetch(`${CONFIG.baseUrl}/v2/login/authorization/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message || data.message || 'Token exchange failed')
    }

    console.log('✓ OAuth token exchange successful')
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      refreshToken: data.refresh_token,
    }
  } catch (err) {
    console.error('✗ OAuth code exchange failed:', err.message)
    throw err
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token from previous OAuth exchange
 * @returns {object} { access_token, expires_in, token_type }
 */
export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new Error('Refresh token is required')

  try {
    const formData = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      grant_type: 'refresh_token',
    })

    const response = await fetch(`${CONFIG.baseUrl}/v2/login/authorization/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message || 'Token refresh failed')
    }

    console.log('✓ Access token refreshed')
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    }
  } catch (err) {
    console.error('✗ Token refresh failed:', err.message)
    throw err
  }
}

/**
 * Get OAuth authorization URL
 * @param {string} redirectUri - Redirect URI (must be registered with Upstox)
 * @param {string} state - Optional state parameter for CSRF protection
 * @returns {string} Authorization URL
 */
export function getAuthorizationUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CONFIG.clientId,
    redirect_uri: redirectUri || CONFIG.redirectUri,
    state: state || `anavai-${Date.now()}`,
  })

  return `${CONFIG.baseUrl}/v2/login/authorization/dialog?${params.toString()}`
}

/**
 * Get SDK configuration status
 * @returns {object} Configuration and validation info
 */
export function getConfigStatus() {
  const validation = validateConfig()
  return {
    ...validation,
    config: {
      baseUrl: CONFIG.baseUrl,
      apiVersion: CONFIG.apiVersion,
      clientIdSet: Boolean(CONFIG.clientId),
      clientSecretSet: Boolean(CONFIG.clientSecret),
      redirectUriSet: Boolean(CONFIG.redirectUri),
      sandboxTokenSet: Boolean(CONFIG.accessToken),
    },
    currentToken: currentAccessToken ? '***' : null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

// Validate config on module load
const validation = validateConfig()
console.log(`\n📡 Upstox API Client initialized`)
console.log(`   Status: ${validation.isValid ? '✓ VALID' : '⚠ INCOMPLETE'}`)
console.log(`   Sandbox Token: ${validation.hasSandboxToken ? '✓ READY' : '✗ NOT SET'}`)
if (validation.missingVars.length > 0) {
  console.log(`   Missing: ${validation.missingVars.join(', ')}\n`)
}

export { CONFIG, validateConfig, getClients, initializeClients }
