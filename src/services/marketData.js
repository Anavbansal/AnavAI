/**
 * marketData.js — connects to the real Upstox-backed local API server.
 * All prices are real from Upstox. Fallback uses seeded (not random) mock only
 * when the server is completely unreachable.
 */
import {
  calcBollingerBands,
  calcEMA,
  calcEMASeries,
  calcMACD,
  calcRSI,
  calcVWAP,
  calcATR,
} from '../utils/indicators'
import { buildMockAnalyzePayload } from '../utils/mockAnalysis'

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002').replace(/\/$/,'')
  .replace(/\/$/, '')

const ANALYZE_URL = `${BASE}/analyze`
const SEARCH_URL  = `${BASE}/api/search`

const INDICES = ['NIFTY', 'NIFTY50', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']

// ─── Symbol cleaning ──────────────────────────────────────────────────────────
function cleanSym(s) {
  return String(s || '').trim().toUpperCase()
    .replace(/^NSE:/i, '').replace(/-EQ|-INDEX/gi, '')
}

// ─── Candle normalizer ────────────────────────────────────────────────────────
function normalizeCandle(c) {
  if (Array.isArray(c)) {
    const ts = Number(c[0])
    return {
      timestamp: ts > 1e12 ? ts : ts * 1000,
      open:  Number(c[1]) || 0,
      high:  Number(c[2]) || 0,
      low:   Number(c[3]) || 0,
      close: Number(c[4]) || 0,
      volume: Number(c[5]) || 0,
    }
  }
  const ts = Number(c?.timestamp ?? c?.time ?? Date.now())
  return {
    timestamp: ts > 1e12 ? ts : ts * 1000,
    open:  Number(c?.open)   || 0,
    high:  Number(c?.high)   || 0,
    low:   Number(c?.low)    || 0,
    close: Number(c?.close)  || 0,
    volume: Number(c?.volume) || 0,
  }
}

function normalizeOption(o) {
  const type = String(o?.optionType ?? o?.option_type ?? 'CE').toUpperCase() === 'PE' ? 'PE' : 'CE'
  return {
    strikePrice:  Number(o?.strikePrice ?? o?.strike_price) || 0,
    optionType:   type,
    ltp:          Number(o?.ltp ?? o?.lastPrice) || 0,
    delta:        Number(o?.delta) || 0,
    theta:        Number(o?.theta) || 0,
    vega:         Number(o?.vega)  || 0,
    gamma:        Number(o?.gamma) || 0,
    iv:           Number(o?.iv ?? o?.impliedVolatility) || 0,
    oi:           Number(o?.oi ?? o?.openInterest) || 0,
    tradeVolume:  Number(o?.tradeVolume ?? o?.volume) || 0,
  }
}

function summarizeTrend(candles, size) {
  const s = candles.slice(-size)
  if (s.length < 2) return 'SIDEWAYS'
  return s[s.length - 1].close >= s[0].close ? 'BULLISH' : 'BEARISH'
}

function mapNews(item, i) {
  const sentiment = String(item?.sentiment ?? 'NEUTRAL').toUpperCase()
  return {
    id:          item?.id ?? `news-${i}`,
    title:       item?.title ?? item?.headline ?? 'Market update',
    source:      item?.source ?? 'Unknown',
    sentiment:   ['BULLISH','BEARISH','NEUTRAL'].includes(sentiment) ? sentiment : 'NEUTRAL',
    publishedAt: item?.publishedAt ?? item?.published_at ?? null,
    url:         item?.url ?? item?.link ?? null,
  }
}

function transformPayload(payload, sym, timeframe) {
  const candles = Array.isArray(payload?.candleData)
    ? payload.candleData.map(normalizeCandle)
    : []

  if (candles.length === 0) throw new Error('No candle data returned from server.')

  const closes    = candles.map(c => c.close)
  const latest    = candles[candles.length - 1]
  const previous  = candles[candles.length - 2] ?? latest
  const exec      = payload?.executionContext ?? {}

  const price     = Number(payload?.price) || latest.close
  const prevClose = previous.close
  const vwap      = Number(payload?.vwap)  || calcVWAP(candles)
  const ema20     = Number(payload?.ema20) || calcEMA(closes, 20)
  const ema50     = Number(payload?.ema50) || calcEMA(closes, 50)
  const rsi       = Number(payload?.rsi)   || calcRSI(closes, 14)
  const atr       = Number(exec?.atr)      || calcATR(candles, 14)
  const bb        = payload?.bollingerBands || calcBollingerBands(closes, 20)
  const macd      = payload?.macd          || calcMACD(closes)
  const supertrend  = payload?.supertrend  || null
  const ichimoku    = payload?.ichimoku    || null
  const adx         = payload?.adx         || null
  const fibonacci   = payload?.fibonacci   || null
  const pivotPoints = payload?.pivotPoints || null
  const candlePatterns = Array.isArray(payload?.candlePatterns) ? payload.candlePatterns : []
  const obv         = payload?.obv         || null
  const riskProfile = payload?.riskProfile || { profile: 'MODERATE', atrPct: 0, description: '' }
  const investmentGuidance = payload?.investmentGuidance || null
  const foStrategies = Array.isArray(payload?.foStrategies) ? payload.foStrategies : []
  const maxPain     = Number(payload?.maxPain) || 0

  const ema20Series = Array.isArray(payload?.ema20Series) && payload.ema20Series.length > 0
    ? payload.ema20Series
    : calcEMASeries(closes, 20)

  const optionChain = Array.isArray(payload?.foGreeks)
    ? payload.foGreeks.map(normalizeOption)
    : []

  const ceOI = optionChain.filter(g=>g.optionType==='CE').reduce((s,g)=>s+g.oi,0)
  const peOI = optionChain.filter(g=>g.optionType==='PE').reduce((s,g)=>s+g.oi,0)
  const pcr  = ceOI > 0 ? peOI / ceOI : Number(exec?.pcr) || 0

  const support    = +Math.min(...candles.slice(-20).map(c=>c.low)).toFixed(2)
  const resistance = +Math.max(...candles.slice(-20).map(c=>c.high)).toFixed(2)
  const avgVol     = candles.slice(-20).reduce((s,c)=>s+c.volume,0) / Math.min(candles.length,20)
  const volumeRatio = avgVol ? +(latest.volume/avgVol).toFixed(2) : 1

  const cleanSymbol = cleanSym(payload?.stock || sym)
  const tf          = payload?.timeframeAnalysis ?? {}
  const ai = buildAIShape(payload?.aiAnalysis, payload?.optionSignal, cleanSymbol)

  return {
    symbol:   cleanSymbol,
    isIndex:  INDICES.includes(cleanSymbol),
    price, open: latest.open, high: latest.high, low: latest.low,
    prevClose,
    change:    price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    vwap, ema20, ema50,
    ema9:    Number(payload?.ema9)   || calcEMA(closes, 9),
    ema100:  Number(payload?.ema100) || calcEMA(closes, 100),
    ema200:  Number(payload?.ema200) || calcEMA(closes, 200),
    rsi, atr, bb, macd, supertrend, ichimoku,
    adx, fibonacci, pivotPoints, candlePatterns, obv,
    riskProfile, investmentGuidance, foStrategies, maxPain,
    support, resistance, volumeRatio, pcr,
    regime:           exec?.marketRegime ?? 'RANGE',
    trendConsistency: payload?.trendConsistency ?? 'DIVERGENT',
    vwapDistancePct:  Number(exec?.vwapDistancePct) || (vwap ? ((price-vwap)/vwap)*100 : 0),
    trendStrength:    Number(exec?.trendStrength)   || 0,
    m1Trend:  tf?.m1  ?? summarizeTrend(candles, 2),
    m5Trend:  tf?.m5  ?? summarizeTrend(candles, 5),
    m15Trend: tf?.m15 ?? summarizeTrend(candles, 15),
    candles, ema20Series, optionChain, timeframe,
    latestNews: Array.isArray(payload?.latestNews) ? payload.latestNews.map(mapNews) : [],
    ai,
    quality: payload?.quality || { source: 'UNKNOWN' },
  }
}

function buildAIShape(aiAnalysis, optionSignal, symbol) {
  if (!aiAnalysis) return {
    verdict:'HOLD', confidence:50, summary:`No AI analysis for ${symbol}.`,
    entry:0, target:0, stopLoss:0, riskReward:0,
    optionSuggestion: optionSignal?.summary ?? null,
    reasons:[], risks:[], newsImpact:'',
    timeframeAlignment:{ shortTerm:'SIDEWAYS', mediumTerm:'SIDEWAYS', trend:'SIDEWAYS' },
  }
  return {
    verdict:    aiAnalysis.verdict     ?? 'HOLD',
    confidence: Number(aiAnalysis.confidence) || 50,
    summary:    aiAnalysis.summary     ?? '',
    entry:      Number(aiAnalysis.entry)     || 0,
    target:     Number(aiAnalysis.target)    || 0,
    stopLoss:   Number(aiAnalysis.stopLoss)  || 0,
    riskReward: Number(aiAnalysis.riskReward)|| 0,
    optionSuggestion: aiAnalysis.optionSuggestion ?? optionSignal?.summary ?? null,
    reasons:    Array.isArray(aiAnalysis.reasons) ? aiAnalysis.reasons : [],
    risks:      Array.isArray(aiAnalysis.risks)   ? aiAnalysis.risks   : [],
    newsImpact: aiAnalysis.newsImpact ?? '',
    score:      aiAnalysis.score ?? null,
    breakdown:  Array.isArray(aiAnalysis.breakdown) ? aiAnalysis.breakdown : [],
    bullVotes:  aiAnalysis.bullVotes ?? 0,
    bearVotes:  aiAnalysis.bearVotes ?? 0,
    source:     aiAnalysis.source ?? 'RULE_BASED',
    timeframeAlignment: aiAnalysis.timeframeAlignment ?? {
      shortTerm:'SIDEWAYS', mediumTerm:'SIDEWAYS', trend:'SIDEWAYS'
    },
  }
}

// ─── PUBLIC: analyzeSymbol ────────────────────────────────────────────────────
export async function analyzeSymbol(input, timeframe = '5', mode = 'tech') {
  const symbol = typeof input === 'string' ? input : input?.symbol
  const instrumentKey = typeof input === 'string' ? '' : (input?.instrumentKey ?? '')
  const clean = cleanSym(symbol)
  // Always send live token if available
  const token = localStorage.getItem('upstox_access_token') || ''

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(ANALYZE_URL, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ symbol: clean, instrumentKey, resolution: timeframe, mode }),
    })

    const payload = await res.json().catch(() => null)

    if (!res.ok) {
      const msg = payload?.error || `Server error ${res.status}`
      // Surface the error clearly to the UI instead of silently mocking
      throw new Error(msg)
    }

    return transformPayload(payload, clean, timeframe)

  } catch (err) {
    console.warn('[marketData] API error, using fallback mock:', err.message)
    // Only use mock as last resort — show warning in console
    const mock = buildMockAnalyzePayload(clean, timeframe)
    mock._isMock = true
    mock._mockReason = err.message
    return transformPayload(mock, clean, timeframe)
  }
}

// ─── PUBLIC: searchSymbol ─────────────────────────────────────────────────────
export async function searchSymbol(query) {
  try {
    const token = localStorage.getItem('upstox_access_token') || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res  = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}`, { headers })
    const data = await res.json()
    return Array.isArray(data?.results) ? data.results : []
  } catch {
    return []
  }
}

// ─── Mutual Funds (mfapi.in — free) ─────────────────────────────────────────
export async function searchMutualFunds(query) {
  try {
    const res  = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    return Array.isArray(data) ? data.slice(0, 20) : []
  } catch { return [] }
}

export async function getMutualFundNAV(schemeCode) {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`)
    return res.json()
  } catch { return null }
}
