const BASE_PRICES = {
  NIFTY: 24850,
  NIFTY50: 24850,
  BANKNIFTY: 52210,
  FINNIFTY: 23480,
  MIDCPNIFTY: 11240,
  RELIANCE: 2890,
  TCS: 3754,
  HDFCBANK: 1612,
  INFY: 1548,
  ICICIBANK: 1289,
  SBIN: 821,
  WIPRO: 468,
  ADANIENT: 2340,
  LT: 3612,
  BAJFINANCE: 7180,
  AXISBANK: 1148
};

const INDEX_SYMBOLS = new Set(["NIFTY", "NIFTY50", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]);

function cleanSymbol(symbol) {
  return String(symbol || "NIFTY")
    .trim()
    .toUpperCase()
    .replace(/^NSE:/, "")
    .replace(/-EQ|-INDEX/g, "");
}

function getBasePrice(symbol) {
  return BASE_PRICES[cleanSymbol(symbol)] ?? 1000;
}

function resolutionToMinutes(resolution) {
  const raw = String(resolution || "5").toUpperCase();
  if (raw === "D" || raw === "1D") return 1440;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : 5;
}

function calcEMA(closes, period) {
  if (!closes.length) return 0;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (const close of closes) {
    ema = close * k + ema * (1 - k);
  }
  return ema;
}

function calcEMASeries(closes, period) {
  if (!closes.length) return [];
  const k = 2 / (period + 1);
  const series = [];
  let ema = closes[0];
  for (const close of closes) {
    ema = close * k + ema * (1 - k);
    series.push(Number(ema.toFixed(2)));
  }
  return series;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  const slice = changes.slice(-period);
  const gains = slice.filter((value) => value > 0).reduce((sum, value) => sum + value, 0) / period;
  const losses = Math.abs(slice.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)) / period;
  if (!losses) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function calcVWAP(candles) {
  let numerator = 0;
  let denominator = 0;
  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    numerator += typicalPrice * candle.volume;
    denominator += candle.volume;
  }
  return denominator ? numerator / denominator : candles[candles.length - 1]?.close ?? 0;
}

function calcATR(candles, period = 14) {
  if (candles.length < 2) return 0;
  const slice = candles.slice(-period);
  let sum = 0;
  for (let index = 0; index < slice.length; index += 1) {
    const candle = slice[index];
    const previousClose = index === 0 ? candle.close : slice[index - 1].close;
    sum += Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  }
  return sum / slice.length;
}

function calcBollingerBands(closes, period = 20, multiplier = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((sum, value) => sum + value, 0) / period;
  const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: mean + multiplier * stdDev,
    middle: mean,
    lower: mean - multiplier * stdDev
  };
}

function calcMACD(closes) {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const fast = calcEMASeries(closes, 12);
  const slow = calcEMASeries(closes, 26);
  const macdLine = fast.map((value, index) => value - slow[index]);
  const signalSeries = calcEMASeries(macdLine.slice(14), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalSeries[signalSeries.length - 1] ?? 0;
  return { macd, signal, histogram: macd - signal };
}

function classifyRegime(price, ema20, ema50, atr, volumeRatio) {
  const trendDelta = ((price - Math.max(ema50, 1)) / Math.max(ema50, 1)) * 100;
  const volatility = (atr / Math.max(price, 1)) * 100;
  if (volatility > 2.5 || volumeRatio > 1.8) return "HIGH_VOL_CHOP";
  if (trendDelta > 1.5 && price > ema20) return "TREND_UP";
  if (trendDelta < -1.5 && price < ema20) return "TREND_DOWN";
  return "RANGE";
}

function summarizeTrend(candles, size) {
  const slice = candles.slice(-size);
  if (slice.length < 2) return "SIDEWAYS";
  const delta = slice[slice.length - 1].close - slice[0].close;
  if (Math.abs(delta) < Math.max(slice[0].close, 1) * 0.002) return "SIDEWAYS";
  return delta > 0 ? "BULLISH" : "BEARISH";
}

function createRng(seedText) {
  let seed = 0;
  for (const char of seedText) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function generateCandles(symbol, resolution, count = 90) {
  const clean = cleanSymbol(symbol);
  const minutes = resolutionToMinutes(resolution);
  const basePrice = getBasePrice(clean);
  const rng = createRng(`${clean}:${resolution}`);
  const candles = [];
  const now = Date.now();
  let price = basePrice;
  const volatility = basePrice * (INDEX_SYMBOLS.has(clean) ? 0.0018 : 0.0024);

  for (let index = count; index >= 0; index -= 1) {
    const drift = (rng() - 0.47) * volatility * (0.6 + rng());
    const open = price;
    const close = Math.max(open * 0.94, open + drift);
    const wick = volatility * (0.25 + rng() * 0.9);
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick * 0.75;
    const volume = Math.round(35000 + rng() * 180000);
    candles.push({
      timestamp: now - index * minutes * 60 * 1000,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    });
    price = close;
  }

  return candles;
}

function normCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function calcOptionGreeks(price, strike, iv, dte = 7, riskFreeRate = 0.065) {
  const years = dte / 365;
  const sigma = iv / 100;
  if (years <= 0 || sigma <= 0) {
    return { ceDelta: 0.5, peDelta: -0.5, gamma: 0.01, vega: 5, ceTheta: -1, peTheta: -1 };
  }

  const sqrtYears = Math.sqrt(years);
  const d1 =
    (Math.log(price / strike) + (riskFreeRate + 0.5 * sigma ** 2) * years) /
    (sigma * sqrtYears);
  const d2 = d1 - sigma * sqrtYears;
  const pdf = normPDF(d1);

  return {
    ceDelta: Number(normCDF(d1).toFixed(4)),
    peDelta: Number((normCDF(d1) - 1).toFixed(4)),
    gamma: Number((pdf / (price * sigma * sqrtYears)).toFixed(6)),
    vega: Number(((price * pdf * sqrtYears) / 100).toFixed(4)),
    ceTheta: Number(
      ((-(price * pdf * sigma) / (2 * sqrtYears) - riskFreeRate * strike * Math.exp(-riskFreeRate * years) * normCDF(d2)) / 365).toFixed(4)
    ),
    peTheta: Number(
      ((-(price * pdf * sigma) / (2 * sqrtYears) + riskFreeRate * strike * Math.exp(-riskFreeRate * years) * normCDF(-d2)) / 365).toFixed(4)
    )
  };
}

function generateOptionChain(symbol, spotPrice) {
  const clean = cleanSymbol(symbol);
  if (!INDEX_SYMBOLS.has(clean)) return [];

  const rng = createRng(`chain:${clean}:${spotPrice}`);
  const base = Math.round(spotPrice / 50) * 50;
  const offsets = [-200, -150, -100, -50, 0, 50, 100, 150, 200];

  return offsets.flatMap((offset) => {
    const strike = base + offset;
    const iv = 14 + Math.abs(spotPrice - strike) / Math.max(spotPrice, 1) * 55 + rng() * 4;
    const greeks = calcOptionGreeks(spotPrice, strike, iv);
    const ceLtp = Math.max(2, (spotPrice - strike) * 0.55 + 45 + rng() * 12);
    const peLtp = Math.max(2, (strike - spotPrice) * 0.55 + 45 + rng() * 12);
    const ceOi = Math.round(40000 + rng() * 150000);
    const peOi = Math.round(40000 + rng() * 150000);

    return [
      {
        strikePrice: strike,
        optionType: "CE",
        delta: greeks.ceDelta,
        theta: greeks.ceTheta,
        vega: greeks.vega,
        gamma: greeks.gamma,
        iv: Number(iv.toFixed(2)),
        ltp: Number(ceLtp.toFixed(2)),
        tradeVolume: Math.round(ceOi * 0.32),
        oi: ceOi
      },
      {
        strikePrice: strike,
        optionType: "PE",
        delta: greeks.peDelta,
        theta: greeks.peTheta,
        vega: greeks.vega,
        gamma: greeks.gamma,
        iv: Number(iv.toFixed(2)),
        ltp: Number(peLtp.toFixed(2)),
        tradeVolume: Math.round(peOi * 0.32),
        oi: peOi
      }
    ];
  });
}

function buildOptionSuggestion(symbol, verdict, price, optionChain) {
  if (!optionChain.length) return null;
  const strike = Math.round(price / 50) * 50;
  const type = verdict === "SELL" ? "PE" : "CE";
  const contract = optionChain.find((item) => item.strikePrice === strike && item.optionType === type);
  if (!contract) return null;
  const stopLoss = Number((contract.ltp * 0.7).toFixed(2));
  const target = Number((contract.ltp * 1.55).toFixed(2));
  return {
    strike,
    type,
    entryRange: `${contract.ltp}-${Number((contract.ltp * 1.03).toFixed(2))}`,
    stopLoss,
    target,
    summary: `${cleanSymbol(symbol)} ${strike} ${type} | LTP ${contract.ltp} | Target ${target} | SL ${stopLoss}`
  };
}

function buildMockNews(symbol, regime, verdict) {
  const clean = cleanSymbol(symbol);
  const flavor = verdict === "BUY" ? "accumulation" : verdict === "SELL" ? "profit booking" : "wait-and-watch";
  return [
    {
      id: `${clean}-1`,
      title: `${clean} traders track ${flavor} signals ahead of the next session`,
      source: "ANAV Desk",
      sentiment: verdict === "BUY" ? "BULLISH" : verdict === "SELL" ? "BEARISH" : "NEUTRAL",
      publishedAt: Date.now() - 15 * 60 * 1000,
      url: null
    },
    {
      id: `${clean}-2`,
      title: `${clean} derivatives positioning reflects ${regime.replace(/_/g, " ").toLowerCase()} conditions`,
      source: "Market Monitor",
      sentiment: regime === "TREND_UP" ? "BULLISH" : regime === "TREND_DOWN" ? "BEARISH" : "NEUTRAL",
      publishedAt: Date.now() - 45 * 60 * 1000,
      url: null
    },
    {
      id: `${clean}-3`,
      title: `${clean} intraday desk highlights key support and resistance levels`,
      source: "Terminal Wire",
      sentiment: "NEUTRAL",
      publishedAt: Date.now() - 90 * 60 * 1000,
      url: null
    }
  ];
}

function ruleBasedAnalysis(input) {
  const aboveVwap = input.price > input.vwap;
  const aboveEma20 = input.price > input.ema20;
  const aboveEma50 = input.price > input.ema50;
  const rsiOverbought = input.rsi > 68;
  const rsiOversold = input.rsi < 32;
  const macdBull = input.macd.histogram > 0;
  const volumeConfirmed = input.volumeRatio > 1.1;
  const trendConfirmed = input.trendConsistency === "CONFIRMED";

  let verdict = "HOLD";
  let confidence = 52;
  let reasons = [];
  let risks = [];

  if (aboveVwap && aboveEma20 && !rsiOverbought && macdBull && input.regime !== "HIGH_VOL_CHOP") {
    verdict = "BUY";
    confidence = 62 + (trendConfirmed ? 8 : 0) + (volumeConfirmed ? 5 : 0) + (aboveEma50 ? 4 : 0);
    reasons = [
      `Price is trading above VWAP at ${input.vwap.toFixed(2)}.`,
      `RSI at ${input.rsi.toFixed(1)} is supportive without being overbought.`,
      "MACD histogram remains positive, showing momentum support."
    ];
    if (trendConfirmed) reasons.push("Short, medium, and trend frames are aligned bullish.");
    risks = [
      `Resistance near ${input.resistance.toFixed(2)} can cap upside.`,
      input.regime === "RANGE" ? "Breakout confirmation is still needed." : "Watch for sudden macro-led reversals."
    ];
  } else if (!aboveVwap && !aboveEma20 && !rsiOversold && !macdBull && input.regime !== "HIGH_VOL_CHOP") {
    verdict = "SELL";
    confidence = 60 + (trendConfirmed ? 8 : 0) + (volumeConfirmed ? 5 : 0) + (!aboveEma50 ? 4 : 0);
    reasons = [
      `Price is below VWAP at ${input.vwap.toFixed(2)}.`,
      `RSI at ${input.rsi.toFixed(1)} supports bearish continuation.`,
      "MACD histogram is negative, showing downside pressure."
    ];
    if (trendConfirmed) reasons.push("Short, medium, and trend frames are aligned bearish.");
    risks = [
      `Support near ${input.support.toFixed(2)} may attract buyers.`,
      "A sharp oversold bounce can appear without warning."
    ];
  } else {
    reasons = [
      `Signals are mixed with price ${aboveVwap ? "above" : "below"} VWAP.`,
      `RSI is ${input.rsi.toFixed(1)}, which does not offer a clean momentum edge.`,
      trendConfirmed ? "Trend alignment is partial, so conviction stays limited." : "Timeframes are divergent, so confirmation is preferred."
    ];
    risks = [
      "Choppy price action can trigger false breakouts.",
      "Waiting for stronger volume and cleaner trend alignment is safer."
    ];
  }

  let entry = input.price;
  let stopLoss = input.support;
  let target = input.resistance;
  let riskReward = 1;

  if (verdict === "BUY") {
    entry = Math.max(input.vwap, input.ema20);
    stopLoss = Math.max(input.support, entry - input.atr * 1.5);
    const risk = Math.max(entry - stopLoss, 0.01);
    target = Math.min(input.resistance, entry + risk * 2);
    riskReward = (target - entry) / risk;
  } else if (verdict === "SELL") {
    entry = Math.min(input.vwap, input.ema20);
    stopLoss = Math.min(input.resistance, entry + input.atr * 1.5);
    const risk = Math.max(stopLoss - entry, 0.01);
    target = Math.max(input.support, entry - risk * 2);
    riskReward = (entry - target) / risk;
  }

  return {
    verdict,
    confidence: Math.min(92, Math.max(40, Math.round(confidence))),
    summary: `${cleanSymbol(input.symbol)} shows ${verdict === "HOLD" ? "mixed conditions" : `${verdict} potential`} with RSI ${input.rsi.toFixed(1)} and price ${aboveVwap ? "above" : "below"} VWAP. Market regime is ${input.regime.replace(/_/g, " ").toLowerCase()}.`,
    entry: Number(entry.toFixed(2)),
    target: Number(target.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    riskReward: Number(riskReward.toFixed(2)),
    optionSuggestion: null,
    reasons,
    risks,
    newsImpact: `${cleanSymbol(input.symbol)} is trading in a ${input.regime.replace(/_/g, " ").toLowerCase()} regime. PCR at ${input.pcr.toFixed(2)} keeps derivatives sentiment in focus.`,
    timeframeAlignment: {
      shortTerm: input.m1Trend,
      mediumTerm: input.m5Trend,
      trend: input.m15Trend
    }
  };
}

export function buildAnalyzePayload({ symbol = "NIFTY", resolution = "5" } = {}) {
  const clean = cleanSymbol(symbol);
  const candles = generateCandles(clean, resolution);
  const closes = candles.map((candle) => candle.close);
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2] ?? latest;
  const vwap = calcVWAP(candles);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const atr = calcATR(candles, 14);
  const bb = calcBollingerBands(closes, 20);
  const macd = calcMACD(closes);
  const optionChain = generateOptionChain(clean, latest.close);
  const ceOi = optionChain.filter((item) => item.optionType === "CE").reduce((sum, item) => sum + item.oi, 0);
  const peOi = optionChain.filter((item) => item.optionType === "PE").reduce((sum, item) => sum + item.oi, 0);
  const pcr = ceOi ? peOi / ceOi : 1;
  const avgVolume = candles.slice(-20).reduce((sum, candle) => sum + candle.volume, 0) / Math.min(candles.length, 20);
  const volumeRatio = avgVolume ? latest.volume / avgVolume : 1;
  const support = Math.min(...candles.slice(-20).map((candle) => candle.low));
  const resistance = Math.max(...candles.slice(-20).map((candle) => candle.high));
  const m1Trend = summarizeTrend(candles, 3);
  const m5Trend = summarizeTrend(candles, 8);
  const m15Trend = summarizeTrend(candles, 20);
  const trendConsistency =
    m1Trend === m5Trend && m5Trend === m15Trend && m1Trend !== "SIDEWAYS" ? "CONFIRMED" : "DIVERGENT";
  const regime = classifyRegime(latest.close, ema20, ema50, atr, volumeRatio);
  const aiInput = {
    symbol: clean,
    timeframe: String(resolution),
    price: latest.close,
    prevClose: previous.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    vwap,
    ema20,
    ema50,
    rsi: calcRSI(closes, 14),
    atr,
    support,
    resistance,
    regime,
    trendConsistency,
    volumeRatio,
    pcr,
    vwapDistancePct: vwap ? ((latest.close - vwap) / vwap) * 100 : 0,
    m1Trend,
    m5Trend,
    m15Trend,
    bb,
    macd,
    isIndex: INDEX_SYMBOLS.has(clean),
    optionChain
  };

  const aiAnalysis = ruleBasedAnalysis(aiInput);
  const optionSignal = buildOptionSuggestion(clean, aiAnalysis.verdict, latest.close, optionChain);
  if (optionSignal) {
    aiAnalysis.optionSuggestion = optionSignal.summary;
  }

  return {
    ok: true,
    service: "anavai-local-analyze",
    stock: clean,
    price: latest.close,
    vwap: Number(vwap.toFixed(2)),
    ema20: Number(ema20.toFixed(2)),
    rsi: Number(aiInput.rsi.toFixed(2)),
    pcr: Number(pcr.toFixed(2)),
    trendConsistency,
    timeframeAnalysis: {
      m1: m1Trend,
      m5: m5Trend,
      m15: m15Trend
    },
    executionContext: {
      atr: Number(atr.toFixed(2)),
      pcr: Number(pcr.toFixed(2)),
      volumeRatio: Number(volumeRatio.toFixed(2)),
      marketRegime: regime,
      trendStrength: Number((((latest.close - ema20) / Math.max(ema20, 1)) * 100).toFixed(2)),
      vwapDistancePct: Number(aiInput.vwapDistancePct.toFixed(2))
    },
    foGreeks: optionChain,
    analysis: aiAnalysis.summary,
    aiAnalysis,
    latestNews: buildMockNews(clean, regime, aiAnalysis.verdict),
    optionSignal,
    candleData: candles
  };
}
