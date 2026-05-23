import {
  BASE_PRICES,
  calcATR,
  calcBollingerBands,
  calcEMA,
  calcMACD,
  calcRSI,
  calcVWAP,
  classifyRegime,
  generateCandles,
  generateOptionChain,
} from './indicators'
import { getRealAiAnalysis } from '../lib/api'

const INDEX_SYMBOLS = ['NIFTY', 'NIFTY50', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']

function cleanSymbol(symbol) {
  return String(symbol || 'NIFTY')
    .trim()
    .toUpperCase()
    .replace(/^NSE:/i, '')
    .replace(/-EQ|-INDEX/gi, '')
}

function resolutionToMinutes(value) {
  const raw = String(value || '5').toUpperCase()
  if (raw === 'D' || raw === '1D') return 1440
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 5
}

function summarizeTrend(candles, size) {
  const slice = candles.slice(-size)
  if (slice.length < 2) return 'SIDEWAYS'
  const delta = slice[slice.length - 1].close - slice[0].close
  const threshold = Math.max(slice[0].close, 1) * 0.002
  if (Math.abs(delta) < threshold) return 'SIDEWAYS'
  return delta > 0 ? 'BULLISH' : 'BEARISH'
}

function computeSupport(candles, fallback) {
  const lows = candles.slice(-20).map((c) => c.low).filter((n) => Number.isFinite(n))
  return lows.length ? Math.min(...lows) : fallback
}

function computeResistance(candles, fallback) {
  const highs = candles.slice(-20).map((c) => c.high).filter((n) => Number.isFinite(n))
  return highs.length ? Math.max(...highs) : fallback
}

function buildOptionSuggestion(symbol, verdict, price, optionChain) {
  if (!optionChain.length) return null
  const strike = Math.round(price / 50) * 50
  const type = verdict === 'SELL' ? 'PE' : 'CE'
  const contract = optionChain.find((item) => item.strikePrice === strike && item.optionType === type)
  if (!contract) return null

  const stopLoss = +(contract.ltp * 0.7).toFixed(2)
  const target = +(contract.ltp * 1.55).toFixed(2)

  return {
    strike,
    type,
    entryRange: `${contract.ltp}-${+(contract.ltp * 1.03).toFixed(2)}`,
    stopLoss,
    target,
    summary: `${symbol} ${strike} ${type} - LTP ${contract.ltp} | Target ${target} | SL ${stopLoss}`,
  }
}

function buildMockNews(symbol, regime, verdict) {
  return [
    {
      id: `${symbol}-1`,
      title: `${symbol} traders are tracking ${verdict === 'BUY' ? 'bullish continuation' : verdict === 'SELL' ? 'profit-booking pressure' : 'mixed price action'} into the next session`,
      source: 'ANAV Desk',
      sentiment: verdict === 'BUY' ? 'BULLISH' : verdict === 'SELL' ? 'BEARISH' : 'NEUTRAL',
      publishedAt: Date.now() - 15 * 60 * 1000,
      url: null,
    },
    {
      id: `${symbol}-2`,
      title: `${symbol} derivatives positioning reflects ${String(regime).replace(/_/g, ' ').toLowerCase()} conditions`,
      source: 'Market Monitor',
      sentiment: regime === 'TREND_UP' ? 'BULLISH' : regime === 'TREND_DOWN' ? 'BEARISH' : 'NEUTRAL',
      publishedAt: Date.now() - 45 * 60 * 1000,
      url: null,
    },
    {
      id: `${symbol}-3`,
      title: `${symbol} desks are watching fresh support and resistance zones`,
      source: 'Terminal Wire',
      sentiment: 'NEUTRAL',
      publishedAt: Date.now() - 90 * 60 * 1000,
      url: null,
    },
  ]
}

function buildAiAnalysis(input) {
  const aboveVWAP = input.price > input.vwap
  const aboveEMA20 = input.price > input.ema20
  const aboveEMA50 = input.price > input.ema50
  const rsiOverbought = input.rsi > 68
  const rsiOversold = input.rsi < 32
  const macdBull = input.macd.histogram > 0
  const volConfirm = input.volumeRatio > 1.1
  const trendConfirmed = input.trendConsistency === 'CONFIRMED'

  let verdict = 'HOLD'
  let confidence = 52
  let reasons = []
  let risks = []

  if (aboveVWAP && aboveEMA20 && !rsiOverbought && macdBull && input.regime !== 'HIGH_VOL_CHOP') {
    verdict = 'BUY'
    confidence = 62 + (trendConfirmed ? 8 : 0) + (volConfirm ? 5 : 0) + (aboveEMA50 ? 4 : 0)
    reasons = [
      `Price is trading above VWAP at ${input.vwap.toFixed(2)}.`,
      `RSI at ${input.rsi.toFixed(1)} remains constructive without being overbought.`,
      'MACD histogram is positive, showing momentum support.',
    ]
    if (trendConfirmed) reasons.push('Short, medium, and trend frames are aligned bullish.')
    risks = [
      `Resistance near ${input.resistance.toFixed(2)} can limit upside.`,
      input.regime === 'RANGE' ? 'Breakout confirmation is still needed.' : 'Watch for abrupt macro reversals.',
    ]
  } else if (!aboveVWAP && !aboveEMA20 && !rsiOversold && !macdBull && input.regime !== 'HIGH_VOL_CHOP') {
    verdict = 'SELL'
    confidence = 60 + (trendConfirmed ? 8 : 0) + (volConfirm ? 5 : 0) + (!aboveEMA50 ? 4 : 0)
    reasons = [
      `Price is below VWAP at ${input.vwap.toFixed(2)}.`,
      `RSI at ${input.rsi.toFixed(1)} supports bearish continuation.`,
      'MACD histogram is negative, showing downside pressure.',
    ]
    if (trendConfirmed) reasons.push('Short, medium, and trend frames are aligned bearish.')
    risks = [
      `Support near ${input.support.toFixed(2)} may attract buying.`,
      'A sharp oversold bounce can appear without warning.',
    ]
  } else {
    reasons = [
      `Signals are mixed with price ${aboveVWAP ? 'above' : 'below'} VWAP.`,
      `RSI at ${input.rsi.toFixed(1)} does not offer a clean momentum edge.`,
      trendConfirmed ? 'Trend alignment is partial, so conviction stays limited.' : 'Timeframes are divergent, so confirmation is preferred.',
    ]
    risks = [
      'Choppy price action can trigger false breakouts.',
      'Waiting for stronger volume and cleaner alignment is safer.',
    ]
  }

  let entry = input.price
  let stopLoss = input.support
  let target = input.resistance
  let riskReward = 1

  if (verdict === 'BUY') {
    entry = Math.max(input.vwap, input.ema20)
    stopLoss = Math.max(input.support, entry - input.atr * 1.5)
    const risk = Math.max(entry - stopLoss, 0.01)
    target = Math.min(input.resistance, entry + risk * 2)
    riskReward = (target - entry) / risk
  } else if (verdict === 'SELL') {
    entry = Math.min(input.vwap, input.ema20)
    stopLoss = Math.min(input.resistance, entry + input.atr * 1.5)
    const risk = Math.max(stopLoss - entry, 0.01)
    target = Math.max(input.support, entry - risk * 2)
    riskReward = (entry - target) / risk
  }

  return {
    verdict,
    confidence: Math.min(92, Math.max(40, Math.round(confidence))),
    summary: `${input.symbol} shows ${verdict === 'HOLD' ? 'mixed conditions' : `${verdict} potential`} with RSI ${input.rsi.toFixed(1)} and price ${aboveVWAP ? 'above' : 'below'} VWAP. Market regime is ${String(input.regime).replace(/_/g, ' ').toLowerCase()}.`,
    entry: +entry.toFixed(2),
    target: +target.toFixed(2),
    stopLoss: +stopLoss.toFixed(2),
    riskReward: +riskReward.toFixed(2),
    optionSuggestion: null,
    reasons,
    risks,
    newsImpact: `${input.symbol} is trading in a ${String(input.regime).replace(/_/g, ' ').toLowerCase()} regime. PCR at ${input.pcr.toFixed(2)} keeps derivatives sentiment in focus.`,
    timeframeAlignment: {
      shortTerm: input.m1Trend,
      mediumTerm: input.m5Trend,
      trend: input.m15Trend,
    },
  }
}

export async function buildMockAnalyzePayload(symbol = 'NIFTY', timeframe = '5') {
  const clean = cleanSymbol(symbol)
  const tfMinutes = resolutionToMinutes(timeframe)
  const basePrice = BASE_PRICES[clean] ?? 1000
  const candles = generateCandles(basePrice, tfMinutes, 90)
  const closes = candles.map((c) => c.close)
  const latest = candles[candles.length - 1]
  const previous = candles[candles.length - 2] ?? latest
  const vwap = calcVWAP(candles)
  const ema20 = calcEMA(closes, 20)
  const ema50 = calcEMA(closes, 50)
  const atr = calcATR(candles, 14)
  const macd = calcMACD(closes)
  const rsi = calcRSI(closes, 14)
  const optionChain = INDEX_SYMBOLS.includes(clean) ? generateOptionChain(latest.close) : []
  const ceOi = optionChain.filter((item) => item.optionType === 'CE').reduce((sum, item) => sum + item.oi, 0)
  const peOi = optionChain.filter((item) => item.optionType === 'PE').reduce((sum, item) => sum + item.oi, 0)
  const pcr = ceOi > 0 ? peOi / ceOi : 1
  const avgVolume = candles.slice(-20).reduce((sum, candle) => sum + candle.volume, 0) / Math.min(candles.length, 20)
  const volumeRatio = avgVolume ? latest.volume / avgVolume : 1
  const support = computeSupport(candles, latest.low)
  const resistance = computeResistance(candles, latest.high)
  const m1Trend = summarizeTrend(candles, 3)
  const m5Trend = summarizeTrend(candles, 8)
  const m15Trend = summarizeTrend(candles, 20)
  const trendConsistency =
    m1Trend === m5Trend && m5Trend === m15Trend && m1Trend !== 'SIDEWAYS' ? 'CONFIRMED' : 'DIVERGENT'
  const regime = classifyRegime(latest.close, ema20, ema50, atr, volumeRatio)
  const bb = calcBollingerBands(closes, 20)
  const aiAnalysis = buildAiAnalysis({
    symbol: clean,
    price: latest.close,
    vwap,
    ema20,
    ema50,
    rsi,
    atr,
    support,
    resistance,
    regime,
    trendConsistency,
    volumeRatio,
    pcr,
    m1Trend,
    m5Trend,
    m15Trend,
    macd,
  })

  // Real AI Engine over the fallback logic
  try {
    const realAiRes = await getRealAiAnalysis({
      symbol: clean,
      price: latest.close,
      vwap: +vwap.toFixed(2),
      ema20: +ema20.toFixed(2),
      rsi: +rsi.toFixed(2),
      regime,
      trendConsistency,
      m1Trend, m5Trend, m15Trend
    });
    
    if (realAiRes && realAiRes.status === 'success' && realAiRes.data) {
      Object.assign(aiAnalysis, realAiRes.data); // Overwrite rules with real AI
    }
  } catch (err) {
    console.warn("Real AI Analysis unavailable. Using rule-based fallback.", err.message);
  }

  const optionSignal = buildOptionSuggestion(clean, aiAnalysis.verdict, latest.close, optionChain)
  if (optionSignal) {
    aiAnalysis.optionSuggestion = optionSignal.summary
  }

  return {
    ok: true,
    service: 'anavai-browser-fallback',
    stock: clean,
    price: latest.close,
    vwap: +vwap.toFixed(2),
    ema20: +ema20.toFixed(2),
    rsi: +rsi.toFixed(2),
    pcr: +pcr.toFixed(2),
    trendConsistency,
    timeframeAnalysis: {
      m1: m1Trend,
      m5: m5Trend,
      m15: m15Trend,
    },
    executionContext: {
      atr: +atr.toFixed(2),
      pcr: +pcr.toFixed(2),
      volumeRatio: +volumeRatio.toFixed(2),
      marketRegime: regime,
      trendStrength: +((((latest.close - ema20) / Math.max(ema20, 1)) * 100).toFixed(2)),
      vwapDistancePct: +(vwap ? (((latest.close - vwap) / vwap) * 100).toFixed(2) : 0),
    },
    foGreeks: optionChain,
    analysis: aiAnalysis.summary,
    aiAnalysis,
    latestNews: buildMockNews(clean, regime, aiAnalysis.verdict),
    optionSignal,
    candleData: candles,
    source: 'fallback',
    previousClose: previous.close,
  }
}
