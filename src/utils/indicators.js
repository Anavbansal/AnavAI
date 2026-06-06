// Accurate Technical Indicator Calculations

export function calcEMA(closes, period) {
  if (!closes || closes.length < period) return closes?.[closes.length - 1] ?? 0
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return ema
}

export function calcEMASeries(closes, period) {
  if (!closes || closes.length === 0) return []
  const k = 2 / (period + 1)
  const result = []
  let ema = closes[0]
  for (const c of closes) {
    ema = c * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

export function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return 50
  // Wilder's smoothing (matches backend)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss -= diff
  }
  avgGain /= period; avgLoss /= period
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
  }
  if (!avgLoss) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export function calcVWAP(candles) {
  if (!candles || candles.length === 0) return 0
  let num = 0, den = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    num += tp * c.volume
    den += c.volume
  }
  return den === 0 ? candles[candles.length - 1].close : num / den
}

export function calcATR(candles, period = 14) {
  if (!candles || candles.length < 2) return 0
  const slice = candles.slice(-period)
  let sum = 0
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i]
    const prev = i === 0 ? c.close : slice[i - 1].close
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev))
  }
  return sum / slice.length
}

export function calcBollingerBands(closes, period = 20, multiplier = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 }
  const slice = closes.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period
  const stdDev = Math.sqrt(variance)
  return {
    upper: mean + multiplier * stdDev,
    middle: mean,
    lower: mean - multiplier * stdDev,
    stdDev
  }
}

export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow) return { macd: 0, signal: 0, histogram: 0 }
  const fastEMA = calcEMASeries(closes, fast)
  const slowEMA = calcEMASeries(closes, slow)
  const macdLine = fastEMA.map((v, i) => v - slowEMA[i])
  const signalLine = calcEMASeries(macdLine.slice(slow - fast), signal)
  const lastMACD = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]
  return {
    macd: lastMACD,
    signal: lastSignal,
    histogram: lastMACD - lastSignal
  }
}

export function swingHigh(candles, lookback = 20) {
  return Math.max(...candles.slice(-lookback).map(c => c.high))
}

export function swingLow(candles, lookback = 20) {
  return Math.min(...candles.slice(-lookback).map(c => c.low))
}

export function classifyRegime(price, ema20, ema50, atr, volRatio) {
  const trend = ((price - ema50) / Math.max(ema50, 1)) * 100
  const vol = (atr / Math.max(price, 1)) * 100
  if (vol > 2.5) return 'HIGH_VOL_CHOP'
  if (trend > 1.5 && price > ema20) return 'TREND_UP'
  if (trend < -1.5 && price < ema20) return 'TREND_DOWN'
  return 'RANGE'
}

export function calcOptionGreeks(price, strike, iv, dte = 7, r = 0.065) {
  // Black-Scholes approximation
  const T = dte / 365
  const sqrtT = Math.sqrt(T)
  const sigma = iv / 100
  if (T <= 0 || sigma <= 0) return { delta: 0.5, theta: -1, vega: 5, gamma: 0.01 }

  const d1 = (Math.log(price / strike) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT

  const nd1 = normCDF(d1)
  const pdfD1 = normPDF(d1)

  const ceDelta = nd1
  const peDelta = nd1 - 1
  const gamma = pdfD1 / (price * sigma * sqrtT)
  const vega = (price * pdfD1 * sqrtT) / 100
  const ceTheta = (-(price * pdfD1 * sigma) / (2 * sqrtT) - r * strike * Math.exp(-r * T) * normCDF(d2)) / 365
  const peTheta = (-(price * pdfD1 * sigma) / (2 * sqrtT) + r * strike * Math.exp(-r * T) * normCDF(-d2)) / 365

  return {
    ceDelta: +ceDelta.toFixed(4),
    peDelta: +peDelta.toFixed(4),
    gamma: +gamma.toFixed(6),
    vega: +vega.toFixed(4),
    ceTheta: +ceTheta.toFixed(4),
    peTheta: +peTheta.toFixed(4),
  }
}

function normCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export function generateCandles(basePrice, tfMins, count) {
  const candles = []
  const now = Date.now()
  let price = basePrice
  const volatility = basePrice * 0.0018

  for (let i = count; i >= 0; i--) {
    const ts = now - i * tfMins * 60 * 1000
    const open = price
    const drift = (Math.random() - 0.485) * volatility * (0.4 + Math.random() * 1.2)
    const close = Math.max(open * 0.97, open + drift)
    const wickMult = Math.random() * 0.7
    const high = Math.max(open, close) + volatility * wickMult
    const low = Math.min(open, close) - volatility * wickMult * 0.6
    const volume = Math.round(40000 + Math.random() * 180000)
    candles.push({ timestamp: ts, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume })
    price = close
  }
  return candles
}

export function generateOptionChain(spotPrice) {
  const base = Math.round(spotPrice / 50) * 50
  const offsets = [-200, -150, -100, -50, 0, 50, 100, 150, 200]
  return offsets.flatMap(offset => {
    const strike = base + offset
    const moneyness = Math.abs(spotPrice - strike) / Math.max(spotPrice, 1)
    const iv = 15 + moneyness * 60 + Math.random() * 3
    const { ceDelta, peDelta, gamma, vega, ceTheta, peTheta } = calcOptionGreeks(spotPrice, strike, iv)
    const ceLTP = Math.max(2, (spotPrice - strike) * 0.55 + 45 + Math.random() * 10)
    const peLTP = Math.max(2, (strike - spotPrice) * 0.55 + 45 + Math.random() * 10)
    const ceOI = Math.round(40000 + Math.random() * 180000)
    const peOI = Math.round(40000 + Math.random() * 180000)
    return [
      { strikePrice: strike, optionType: 'CE', delta: ceDelta, theta: ceTheta, vega, gamma, iv: +iv.toFixed(2), ltp: +ceLTP.toFixed(2), tradeVolume: Math.round(ceOI * 0.3), oi: ceOI },
      { strikePrice: strike, optionType: 'PE', delta: peDelta, theta: peTheta, vega, gamma, iv: +iv.toFixed(2), ltp: +peLTP.toFixed(2), tradeVolume: Math.round(peOI * 0.3), oi: peOI }
    ]
  })
}

export const BASE_PRICES = {
  NIFTY: 24850, NIFTY50: 24850, BANKNIFTY: 52210, FINNIFTY: 23480, MIDCPNIFTY: 11240,
  RELIANCE: 2890, TCS: 3754, HDFCBANK: 1612, INFY: 1548, ICICIBANK: 1289, SBIN: 821,
  WIPRO: 468, ADANIENT: 2340, LT: 3612, BAJFINANCE: 7180, AXISBANK: 1148,
  TATAMOTORS: 924, KOTAKBANK: 1975, HINDUNILVR: 2680, BHARTIARTL: 1890,
  MARUTI: 12400, ASIANPAINT: 2890, NESTLEIND: 2380, POWERGRID: 348,
  NTPC: 378, ONGC: 284, COALINDIA: 494, TITAN: 3490, ULTRACEMCO: 11200,
  BAJAJFINSV: 1840, TECHM: 1580, SUNPHARMA: 1780, HCLTECH: 1890, GRASIM: 2640,
  INDUSINDBK: 1040, CIPLA: 1580, DRREDDY: 6100, EICHERMOT: 4980, BPCL: 342,
  HEROMOTOCO: 5280, TATACONSUM: 1058, DIVISLAB: 5650, BRITANNIA: 5120,
}

export function getBasePrice(sym) {
  const clean = sym.toUpperCase()
    .replace(/^NSE:/i, '').replace(/-EQ|-INDEX/gi, '')
  return BASE_PRICES[clean] ?? 1000
}

export const fmt = (n, d = 2) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fmtPct = (n) => `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`
