// AI Analysis Service
// Uses rule-based analysis (free, always works) 
// + optional Groq API (free tier available at console.groq.com)
// Set VITE_GROQ_API_KEY in .env for enhanced AI analysis

export async function getAIAnalysis(data) {
  // Try Groq free API first (user can add key in .env)
  const groqKey = import.meta.env.VITE_GROQ_API_KEY
  if (groqKey) {
    try {
      const result = await callGroqAI(data, groqKey)
      if (result) return result
    } catch (e) {
      console.warn('Groq AI failed, using rule-based analysis', e)
    }
  }
  // Always available: rule-based analysis
  return ruleBasedAnalysis(data)
}

async function callGroqAI(data, apiKey) {
  const prompt = buildPrompt(data)
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.15,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const json = await res.json()
  const text = json?.choices?.[0]?.message?.content ?? ''
  return parseAIJson(text)
}

function buildPrompt(d) {
  return `You are an expert NSE/BSE stock analyst. Analyze and respond ONLY with valid JSON.

SYMBOL: ${d.symbol} | TF: ${d.timeframe}m
PRICE: ₹${d.price.toFixed(2)} | PREV CLOSE: ₹${d.prevClose.toFixed(2)}
O: ${d.open.toFixed(2)} H: ${d.high.toFixed(2)} L: ${d.low.toFixed(2)}
VWAP: ₹${d.vwap.toFixed(2)} (Price ${d.price > d.vwap ? 'ABOVE' : 'BELOW'} VWAP)
EMA20: ₹${d.ema20.toFixed(2)} | EMA50: ₹${d.ema50.toFixed(2)}
RSI(14): ${d.rsi.toFixed(1)} | ATR: ${d.atr.toFixed(2)}
SUPPORT: ₹${d.support.toFixed(2)} | RESISTANCE: ₹${d.resistance.toFixed(2)}
REGIME: ${d.regime} | TREND CONSISTENCY: ${d.trendConsistency}
VOLUME RATIO: ${d.volumeRatio.toFixed(2)}x | PCR: ${d.pcr.toFixed(2)}
VWAP DISTANCE: ${d.vwapDistancePct.toFixed(2)}%
MTF: M1=${d.m1Trend} M5=${d.m5Trend} M15=${d.m15Trend}
BB UPPER: ${d.bb.upper.toFixed(2)} | LOWER: ${d.bb.lower.toFixed(2)}
MACD: ${d.macd.macd.toFixed(2)} | Signal: ${d.macd.signal.toFixed(2)} | Hist: ${d.macd.histogram.toFixed(2)}

Rules: Issue BUY/SELL only if RSI+VWAP+EMA20 all align. Min RR 1.5:1. Otherwise HOLD.
${d.isIndex ? 'For index, include ATM option CE/PE suggestion.' : ''}

Respond ONLY JSON:
{"verdict":"BUY|SELL|HOLD","confidence":0-100,"summary":"2-3 sentences","entry":0,"target":0,"stopLoss":0,"riskReward":0,"optionSuggestion":null,"reasons":["r1","r2","r3"],"risks":["r1","r2"],"newsImpact":"one line","timeframeAlignment":{"shortTerm":"BULLISH|BEARISH|SIDEWAYS","mediumTerm":"BULLISH|BEARISH|SIDEWAYS","trend":"BULLISH|BEARISH|SIDEWAYS"}}`
}

function parseAIJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

export function ruleBasedAnalysis(d) {
  const aboveVWAP = d.price > d.vwap
  const aboveEMA20 = d.price > d.ema20
  const aboveEMA50 = d.price > d.ema50
  const rsiOB = d.rsi > 68
  const rsiOS = d.rsi < 32
  const macdBull = d.macd.histogram > 0
  const volConfirm = d.volumeRatio > 1.1
  const trendConfirmed = d.trendConsistency === 'CONFIRMED'

  let verdict = 'HOLD'
  let confidence = 55
  let reasons = []
  let risks = []

  // BUY conditions
  if (aboveVWAP && aboveEMA20 && !rsiOB && macdBull && d.regime !== 'HIGH_VOL_CHOP') {
    verdict = 'BUY'
    confidence = 62 + (trendConfirmed ? 8 : 0) + (volConfirm ? 5 : 0) + (aboveEMA50 ? 4 : 0)
    reasons = [
      `Price ₹${d.price.toFixed(2)} trading above VWAP ₹${d.vwap.toFixed(2)} — bullish momentum`,
      `RSI ${d.rsi.toFixed(1)} in healthy zone — room for upside`,
      `MACD histogram positive — momentum building`,
    ]
    if (trendConfirmed) reasons.push('M1/M5/M15 all aligned bullish — high conviction setup')
    risks = [
      `Resistance at ₹${d.resistance.toFixed(2)} — potential reversal zone`,
      `${d.regime === 'RANGE' ? 'Range-bound market — breakout confirmation needed' : 'Watch for macro triggers'}`,
    ]
  }
  // SELL conditions
  else if (!aboveVWAP && !aboveEMA20 && !rsiOS && !macdBull && d.regime !== 'HIGH_VOL_CHOP') {
    verdict = 'SELL'
    confidence = 60 + (trendConfirmed ? 8 : 0) + (volConfirm ? 5 : 0) + (!aboveEMA50 ? 4 : 0)
    reasons = [
      `Price ₹${d.price.toFixed(2)} below VWAP ₹${d.vwap.toFixed(2)} — bearish pressure`,
      `RSI ${d.rsi.toFixed(1)} showing bearish momentum`,
      `MACD histogram negative — downside momentum`,
    ]
    if (trendConfirmed) reasons.push('M1/M5/M15 all aligned bearish — trend confirmed')
    risks = [
      `Support at ₹${d.support.toFixed(2)} — potential bounce zone`,
      `Oversold bounce risk if RSI approaches 30`,
    ]
  }
  // HOLD
  else {
    reasons = [
      `Price vs VWAP: ${aboveVWAP ? 'Above' : 'Below'} — mixed signals`,
      `RSI ${d.rsi.toFixed(1)} — ${rsiOB ? 'overbought, avoid fresh buys' : rsiOS ? 'oversold, avoid fresh sells' : 'neutral zone'}`,
      `${d.trendConsistency === 'DIVERGENT' ? 'Timeframe divergence — wait for confirmation' : 'Await volume confirmation'}`,
    ]
    risks = ['Choppy market — false breakout risk high', 'Wait for clear directional move with volume']
    confidence = 52
  }

  // Calculate levels
  const atr = d.atr
  let entry = d.ema20
  let target, stopLoss, riskReward

  if (verdict === 'BUY') {
    entry = Math.max(d.vwap, d.ema20)
    stopLoss = Math.max(d.support, entry - atr * 1.5)
    const risk = entry - stopLoss
    target = Math.min(d.resistance, entry + risk * 2.0)
    riskReward = risk > 0 ? (target - entry) / risk : 1.5
  } else if (verdict === 'SELL') {
    entry = Math.min(d.vwap, d.ema20)
    stopLoss = Math.min(d.resistance, entry + atr * 1.5)
    const risk = stopLoss - entry
    target = Math.max(d.support, entry - risk * 2.0)
    riskReward = risk > 0 ? (entry - target) / risk : 1.5
  } else {
    entry = d.price
    stopLoss = d.support
    target = d.resistance
    riskReward = 1.0
  }

  // Option suggestion for indices
  let optionSuggestion = null
  const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTY50']
  if (d.isIndex || indices.includes(d.symbol)) {
    const atmStrike = Math.round(d.price / 50) * 50
    const optType = verdict === 'BUY' || aboveVWAP ? 'CE' : 'PE'
    const atmOpt = d.optionChain.find(o => o.strikePrice === atmStrike && o.optionType === optType)
    if (atmOpt) {
      const optSL = +(atmOpt.ltp * 0.70).toFixed(2)
      const optTarget = +(atmOpt.ltp * 1.55).toFixed(2)
      optionSuggestion = `${d.symbol} ${atmStrike} ${optType} — LTP ₹${atmOpt.ltp} | Target ₹${optTarget} | SL ₹${optSL} | IV ${atmOpt.iv}%`
    }
  }

  confidence = Math.min(92, Math.max(40, Math.round(confidence)))
  riskReward = +riskReward.toFixed(2)

  return {
    verdict,
    confidence,
    summary: `${d.symbol} shows ${verdict === 'HOLD' ? 'mixed signals — sideways bias' : verdict + ' setup'} with RSI ${d.rsi.toFixed(1)} and price ${aboveVWAP ? 'above' : 'below'} VWAP. Market regime: ${d.regime.replace('_', ' ')}. ${trendConfirmed ? 'Multi-timeframe alignment confirmed.' : 'Timeframe divergence detected — trade with caution.'}`,
    entry: +entry.toFixed(2),
    target: +target.toFixed(2),
    stopLoss: +stopLoss.toFixed(2),
    riskReward,
    optionSuggestion,
    reasons,
    risks,
    newsImpact: `${d.regime === 'TREND_UP' ? 'Macro tailwinds supporting upside' : d.regime === 'TREND_DOWN' ? 'Macro headwinds — cautious stance' : 'Mixed macro environment — follow price action'}. PCR: ${d.pcr.toFixed(2)} ${d.pcr > 1.2 ? '(bullish options sentiment)' : d.pcr < 0.8 ? '(bearish options sentiment)' : '(neutral options sentiment)'}.`,
    timeframeAlignment: {
      shortTerm: d.m1Trend,
      mediumTerm: d.m5Trend,
      trend: d.m15Trend,
    }
  }
}
