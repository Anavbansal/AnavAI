// Central type definitions — all data shapes documented here
// Helps future development — know exactly what each API returns

/**
 * @typedef {Object} Candle
 * @property {number} timestamp - Unix milliseconds
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} AnalyzeResponse
 * @property {string} symbol
 * @property {number} price - Live LTP
 * @property {number} change
 * @property {number} changePct
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} volume
 * @property {number} vwap
 * @property {number} ema9
 * @property {number} ema20
 * @property {number} ema50
 * @property {number} ema200
 * @property {number} rsi
 * @property {number} atr
 * @property {number} volumeRatio
 * @property {number} high52w
 * @property {number} low52w
 * @property {number} support
 * @property {number} resistance
 * @property {number} williamsR
 * @property {number} cci
 * @property {number} roc
 * @property {string} m1Trend - BULLISH|BEARISH|NEUTRAL
 * @property {string} m5Trend
 * @property {string} m15Trend
 * @property {string} regime - RANGING|BULLISH|BEARISH
 * @property {string} trendConsistency - CONFIRMED|MIXED|BEARISH
 * @property {BollingerBands} bollingerBands
 * @property {MACDResult} macd
 * @property {SupertrendResult} supertrend
 * @property {ADXResult} adx
 * @property {FibResult} fibonacci
 * @property {PivotResult} pivotPoints
 * @property {OBVResult} obv
 * @property {StochRSIResult} stochRSI
 * @property {VWAPBands} vwapBands
 * @property {ORBResult} orb
 * @property {PDHDPL} pdhdpl
 * @property {GapAnalysis} gapAnalysis
 * @property {VolComparison} volComparison
 * @property {CircuitLimits} circuitLimits
 * @property {Candle[]} candles
 * @property {AIResult} ai
 * @property {Quality} quality
 */

/**
 * @typedef {Object} AIResult
 * @property {string} verdict - BUY|SELL|HOLD
 * @property {number} confidence - 0-100
 * @property {number} entry
 * @property {number} target
 * @property {number} stopLoss
 * @property {number} riskReward
 * @property {string} summary
 * @property {string[]} reasons
 * @property {string[]} risks
 * @property {string} optionSuggestion
 */

/**
 * @typedef {Object} BrokerConfig
 * @property {'upstox'|'angelone'} activeBroker
 * @property {{connected:boolean, token:string}} upstox
 * @property {{connected:boolean}} angelone
 */

// API Response shapes
export const SHAPES = {
  ANALYZE: 'AnalyzeResponse',
  CANDLES: 'Candle[]',
  HOLDINGS: 'Holding[]',
  OPTION_CHAIN: 'OptionStrike[]',
}

// Broker names
export const BROKERS = {
  UPSTOX: 'upstox',
  ANGELONE: 'angelone',
}

// Timeframes
export const TIMEFRAMES = {
  '1m':  { label:'1m',  resolution:'1',  display:'1 Minute' },
  '5m':  { label:'5m',  resolution:'5',  display:'5 Minutes' },
  '10m': { label:'10m', resolution:'10', display:'10 Minutes' },
  '30m': { label:'30m', resolution:'30', display:'30 Minutes' },
  '1H':  { label:'1H',  resolution:'60', display:'1 Hour' },
  '1D':  { label:'1D',  resolution:'D',  display:'Daily' },
  '1W':  { label:'1W',  resolution:'W',  display:'Weekly' },
}

// API Routes (all from backend)
export const API_ROUTES = {
  ANALYZE:          '/analyze',          // POST — main analysis
  AI_ANALYZE:       '/ai/analyze',       // POST — AI-only analysis
  SEARCH:           '/api/search',       // GET ?q=
  OPTION_CHAIN:     '/api/optionchain',  // GET ?symbol=&expiry=
  OPTION_EXPIRIES:  '/api/option/expiries', // GET ?symbol=
  HOLDINGS:         '/api/holdings',     // GET
  QUOTE:            '/api/quote',        // GET ?instrument_key=
  NEWS:             '/news',             // GET ?instrument_keys=
  FUNDAMENTALS:     '/fundamentals',     // GET ?symbol=
  SESSION:          '/session',          // GET
  HEALTH:           '/health',           // GET
  // Auth
  AUTH_URL:         '/auth/url',         // GET
  AUTH_EXCHANGE:    '/auth/exchange',    // POST
  AUTH_CALLBACK:    '/auth/callback',    // GET (Upstox redirect)
  AUTH_REFRESH:     '/auth/refresh',     // POST
  AUTH_ANGELONE:    '/auth/angelone/login', // POST (Angel One)
  // Historical
  HISTORICAL_V3:    '/historical/v3',    // GET
  INTRADAY_V3:      '/historical/intraday-v3', // GET
  // WebSocket
  WS:               '/ws',              // WS — live prices
}
