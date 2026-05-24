/**
 * ANAV PRO — Local API Server
 * Connects to real Upstox V2/V3 APIs via Upstox SDK for live market data.
 * Uses secure API client wrapper (upstox-sdk-client.mjs) for all API calls.
 * All sensitive data managed via environment variables (.env).
 */

import http from "node:http";
import { URL } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as UpstoxAPI from "./upstox-sdk-client.mjs";

// ─── Load .env ──────────────────────────────────────────────────────────────
const envPath = resolve(".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

const PORT = Number(process.env.LOCAL_API_PORT || 3002);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || process.env.FRONTEND_URL || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);


// Correct Upstox V2 base URL per official Postman collection
const UPSTOX_BASE = "https://api.upstox.com";

// ─── INSTRUMENT KEY MAP ──────────────────────────────────────────────────────
// Upstox uses instrument_key format: NSE_EQ|<ISIN> or NSE_INDEX|<name>
// This maps common symbols to their Upstox instrument keys
const SYMBOL_TO_INSTRUMENT = {
  "NIFTY":       "NSE_INDEX|Nifty 50",
  "NIFTY50":     "NSE_INDEX|Nifty 50",
  "BANKNIFTY":   "NSE_INDEX|Nifty Bank",
  "BANK NIFTY":  "NSE_INDEX|Nifty Bank",
  "FINNIFTY":    "NSE_INDEX|Nifty Fin Service",
  "MIDCPNIFTY":  "NSE_INDEX|NIFTY MIDCAP SELECT",
  "RELIANCE":    "NSE_EQ|INE002A01018",
  "TCS":         "NSE_EQ|INE467B01029",
  "HDFCBANK":    "NSE_EQ|INE040A01034",
  "INFY":        "NSE_EQ|INE009A01021",
  "ICICIBANK":   "NSE_EQ|INE090A01021",
  "SBIN":        "NSE_EQ|INE062A01020",
  "WIPRO":       "NSE_EQ|INE075A01022",
  "AXISBANK":    "NSE_EQ|INE238A01034",
  "KOTAKBANK":   "NSE_EQ|INE237A01028",
  "LT":          "NSE_EQ|INE018A01030",
  "BAJFINANCE":  "NSE_EQ|INE296A01024",
  "BAJAJFINSV":  "NSE_EQ|INE918I01026",
  "HINDUNILVR":  "NSE_EQ|INE030A01027",
  "ADANIENT":    "NSE_EQ|INE423A01024",
  "ADANIPORTS":  "NSE_EQ|INE742F01042",
  "TATAMOTORS":  "NSE_EQ|INE155A01022",
  "MARUTI":      "NSE_EQ|INE585B01010",
  "SUNPHARMA":   "NSE_EQ|INE044A01036",
  "HCLTECH":     "NSE_EQ|INE860A01027",
  "TECHM":       "NSE_EQ|INE669C01036",
  "POWERGRID":   "NSE_EQ|INE752E01010",
  "NTPC":        "NSE_EQ|INE733E01010",
  "ONGC":        "NSE_EQ|INE213A01029",
  "COALINDIA":   "NSE_EQ|INE522F01014",
  "BHARTIARTL":  "NSE_EQ|INE397D01024",
  "ASIANPAINT":  "NSE_EQ|INE021A01026",
  "TITAN":       "NSE_EQ|INE280A01028",
  "ULTRACEMCO":  "NSE_EQ|INE481G01011",
  "NESTLEIND":   "NSE_EQ|INE239A01016",
  "BRITANNIA":   "NSE_EQ|INE216A01030",
  "DIVISLAB":    "NSE_EQ|INE361B01024",
  "DRREDDY":     "NSE_EQ|INE088C01023",
  "CIPLA":       "NSE_EQ|INE059A01026",
  "HEROMOTOCO":  "NSE_EQ|INE158A01026",
  "EICHERMOT":   "NSE_EQ|INE066A01021",
  "BPCL":        "NSE_EQ|INE029A01011",
  "GRASIM":      "NSE_EQ|INE047A01021",
  "INDUSINDBK":  "NSE_EQ|INE095A01012",
  "TATACONSUM":  "NSE_EQ|INE192A01025",
};

// ─── Technical Indicators ───────────────────────────────────────────────────
function calcEMA(closes, period) {
  if (!closes.length) return 0;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, Math.min(period, closes.length)).reduce((a,b)=>a+b,0) / Math.min(period, closes.length);
  for (let i = Math.min(period, closes.length); i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcEMASeries(closes, period) {
  if (!closes.length) return [];
  const k = 2 / (period + 1);
  const series = [];
  let ema = closes[0];
  for (const c of closes) { ema = c * k + ema * (1 - k); series.push(+ema.toFixed(2)); }
  return series;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const slice = changes.slice(-period);
  const gains = slice.filter(v => v > 0).reduce((a,b)=>a+b,0) / period;
  const losses = Math.abs(slice.filter(v => v < 0).reduce((a,b)=>a+b,0)) / period;
  if (!losses) return 100;
  return +(100 - 100 / (1 + gains / losses)).toFixed(2);
}

function calcVWAP(candles) {
  let num = 0, den = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    num += tp * c.volume; den += c.volume;
  }
  return den ? +(num / den).toFixed(2) : (candles[candles.length-1]?.close ?? 0);
}

function calcATR(candles, period = 14) {
  if (candles.length < 2) return 0;
  const slice = candles.slice(-period);
  let sum = 0;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i], prev = i === 0 ? c.close : slice[i-1].close;
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  }
  return +(sum / slice.length).toFixed(2);
}

function calcBollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, stdDev: 0 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a,b)=>a+b,0) / period;
  const variance = slice.reduce((s,v)=>s+(v-mean)**2,0) / period;
  const std = Math.sqrt(variance);
  return { upper: +(mean+mult*std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean-mult*std).toFixed(2), stdDev: +std.toFixed(2) };
}

function calcMACD(closes) {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const fast = calcEMASeries(closes, 12);
  const slow = calcEMASeries(closes, 26);
  const macdLine = fast.map((v,i) => v - slow[i]);
  const signalLine = calcEMASeries(macdLine.slice(14), 9);
  const m = macdLine[macdLine.length-1];
  const s = signalLine[signalLine.length-1] ?? 0;
  return { macd: +m.toFixed(4), signal: +s.toFixed(4), histogram: +(m-s).toFixed(4) };
}

function calcSupertrend(candles, period = 7, mult = 3) {
  if (candles.length < period + 1) return { value: 0, direction: 'flat' };
  const results = [];
  for (let i = period; i < candles.length; i++) {
    const slice = candles.slice(i - period, i + 1);
    const atr = calcATR(slice, period);
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const upper = hl2 + mult * atr;
    const lower = hl2 - mult * atr;
    const prevClose = candles[i-1].close;
    const direction = prevClose > lower ? 'up' : 'down';
    results.push({ upper, lower, direction, value: direction === 'up' ? lower : upper });
  }
  const last = results[results.length-1];
  return { value: +last.value.toFixed(2), direction: last.direction };
}

function calcIchimoku(candles) {
  if (candles.length < 52) return null;
  const high9 = Math.max(...candles.slice(-9).map(c=>c.high));
  const low9  = Math.min(...candles.slice(-9).map(c=>c.low));
  const high26 = Math.max(...candles.slice(-26).map(c=>c.high));
  const low26  = Math.min(...candles.slice(-26).map(c=>c.low));
  const high52 = Math.max(...candles.slice(-52).map(c=>c.high));
  const low52  = Math.min(...candles.slice(-52).map(c=>c.low));
  return {
    tenkan:  +((high9+low9)/2).toFixed(2),
    kijun:   +((high26+low26)/2).toFixed(2),
    senkouA: +((((high9+low9)/2)+((high26+low26)/2))/2).toFixed(2),
    senkouB: +((high52+low52)/2).toFixed(2),
  };
}

function classifyRegime(price, ema20, ema50, atr, volumeRatio) {
  const trend = ((price - Math.max(ema50,1)) / Math.max(ema50,1)) * 100;
  const vol = (atr / Math.max(price,1)) * 100;
  if (vol > 2.5 || volumeRatio > 1.8) return "HIGH_VOL_CHOP";
  if (trend > 1.5 && price > ema20) return "TREND_UP";
  if (trend < -1.5 && price < ema20) return "TREND_DOWN";
  return "RANGE";
}

function summarizeTrend(candles, size) {
  const s = candles.slice(-size);
  if (s.length < 2) return "SIDEWAYS";
  const delta = s[s.length-1].close - s[0].close;
  if (Math.abs(delta) < Math.max(s[0].close,1)*0.002) return "SIDEWAYS";
  return delta > 0 ? "BULLISH" : "BEARISH";
}

// Black-Scholes Greeks
function normCDF(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x<0?-1:1; x=Math.abs(x);
  const t=1/(1+p*x);
  const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}
function normPDF(x) { return Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI); }

function calcOptionGreeks(spot, strike, iv, dte=7, r=0.065) {
  const T=dte/365, sigma=iv/100;
  if(T<=0||sigma<=0) return {ceDelta:0.5,peDelta:-0.5,gamma:0.01,vega:5,ceTheta:-1,peTheta:-1};
  const sqrtT=Math.sqrt(T);
  const d1=(Math.log(spot/strike)+(r+0.5*sigma**2)*T)/(sigma*sqrtT);
  const d2=d1-sigma*sqrtT;
  const pdf=normPDF(d1);
  return {
    ceDelta: +normCDF(d1).toFixed(4),
    peDelta: +(normCDF(d1)-1).toFixed(4),
    gamma:   +(pdf/(spot*sigma*sqrtT)).toFixed(6),
    vega:    +((spot*pdf*sqrtT)/100).toFixed(4),
    ceTheta: +(( -(spot*pdf*sigma)/(2*sqrtT) - r*strike*Math.exp(-r*T)*normCDF(d2))/365).toFixed(4),
    peTheta: +(( -(spot*pdf*sigma)/(2*sqrtT) + r*strike*Math.exp(-r*T)*normCDF(-d2))/365).toFixed(4),
  };
}

// ─── Rule-Based AI Analysis (with full math) ────────────────────────────────
function ruleBasedAnalysis(input) {
  const { price, vwap, ema20, ema50, rsi, atr, support, resistance,
          regime, trendConsistency, volumeRatio, pcr, m1Trend, m5Trend, m15Trend, macd,
          bb, supertrend, ichimoku, symbol } = input;

  const aboveVWAP  = price > vwap;
  const aboveEMA20 = price > ema20;
  const aboveEMA50 = price > ema50;
  const rsiOB = rsi > 68, rsiOS = rsi < 32;
  const macdBull = macd.histogram > 0;
  const volConfirm = volumeRatio > 1.1;
  const trendOK = trendConsistency === "CONFIRMED";
  const stBull = supertrend?.direction === "up";
  const bbSqueeze = bb ? (bb.upper - bb.lower) / Math.max(bb.middle,1) < 0.04 : false;
  const priceNearUpper = bb ? price > bb.upper * 0.98 : false;
  const priceNearLower = bb ? price < bb.lower * 1.02 : false;
  const ichiBull = ichimoku ? price > ichimoku.kijun && ichimoku.tenkan > ichimoku.kijun : null;

  // Score-based system (0–100)
  let score = 50;
  if (aboveVWAP) score += 10; else score -= 10;
  if (aboveEMA20) score += 8; else score -= 8;
  if (aboveEMA50) score += 6; else score -= 6;
  if (!rsiOB && rsi > 50) score += 5;
  if (!rsiOS && rsi < 50) score -= 5;
  if (rsiOB) score -= 8;
  if (rsiOS) score += 8;
  if (macdBull) score += 8; else score -= 8;
  if (volConfirm) score += 5;
  if (trendOK) score += 7;
  if (stBull) score += 6; else score -= 6;
  if (ichiBull === true) score += 5;
  if (ichiBull === false) score -= 5;
  if (priceNearUpper) score -= 5;
  if (priceNearLower) score += 5;
  if (pcr > 1.2) score += 3;
  if (pcr < 0.8) score -= 3;
  if (regime === "HIGH_VOL_CHOP") score = Math.min(score, 55);

  score = Math.max(0, Math.min(100, score));

  let verdict = "HOLD";
  let confidence = 52;

  if (score >= 65 && regime !== "HIGH_VOL_CHOP") {
    verdict = "BUY";
    confidence = Math.min(92, 55 + Math.round((score - 65) * 1.8));
  } else if (score <= 35 && regime !== "HIGH_VOL_CHOP") {
    verdict = "SELL";
    confidence = Math.min(92, 55 + Math.round((35 - score) * 1.8));
  } else {
    confidence = 40 + Math.round(Math.abs(50 - score) * 0.6);
  }

  // ATR-based levels
  let entry = price, stopLoss = support, target = resistance, riskReward = 1;

  if (verdict === "BUY") {
    entry    = +Math.max(vwap, ema20).toFixed(2);
    stopLoss = +Math.max(support, entry - atr * 1.5).toFixed(2);
    const risk = Math.max(entry - stopLoss, 0.01);
    target = +Math.min(resistance, entry + risk * 2.2).toFixed(2);
    riskReward = +((target - entry) / risk).toFixed(2);
  } else if (verdict === "SELL") {
    entry    = +Math.min(vwap, ema20).toFixed(2);
    stopLoss = +Math.min(resistance, entry + atr * 1.5).toFixed(2);
    const risk = Math.max(stopLoss - entry, 0.01);
    target = +Math.max(support, entry - risk * 2.2).toFixed(2);
    riskReward = +((entry - target) / risk).toFixed(2);
  }

  const reasons = [];
  const risks = [];

  if (verdict === "BUY") {
    if (aboveVWAP)  reasons.push(`Price ₹${price.toFixed(2)} above VWAP ₹${vwap.toFixed(2)} (+${((price-vwap)/vwap*100).toFixed(2)}%) — intraday bullish bias`);
    if (aboveEMA20) reasons.push(`Above EMA20 ₹${ema20.toFixed(2)} — short-term trend positive`);
    if (macdBull)   reasons.push(`MACD histogram +${macd.histogram.toFixed(4)} — upside momentum`);
    if (stBull)     reasons.push(`Supertrend bullish at ₹${supertrend.value} — trend-following signal`);
    if (!rsiOB)     reasons.push(`RSI ${rsi} — not overbought, upside room available`);
    if (trendOK)    reasons.push("M1/M5/M15 timeframes all aligned bullish — high conviction");
    if (bbSqueeze)  reasons.push("Bollinger Band squeeze — potential breakout imminent");
    risks.push(`Hard resistance at ₹${resistance.toFixed(2)} — exit zone`);
    risks.push(regime === "RANGE" ? "Range market: breakout confirmation still needed" : "Watch for sudden reversal near resistance");
  } else if (verdict === "SELL") {
    if (!aboveVWAP) reasons.push(`Price ₹${price.toFixed(2)} below VWAP ₹${vwap.toFixed(2)} (${((price-vwap)/vwap*100).toFixed(2)}%) — intraday bearish bias`);
    if (!aboveEMA20)reasons.push(`Below EMA20 ₹${ema20.toFixed(2)} — short-term trend negative`);
    if (!macdBull)  reasons.push(`MACD histogram ${macd.histogram.toFixed(4)} — downside momentum`);
    if (!stBull)    reasons.push(`Supertrend bearish at ₹${supertrend.value} — trend-following signal`);
    if (!rsiOS)     reasons.push(`RSI ${rsi} — not oversold, downside continuation possible`);
    if (trendOK)    reasons.push("M1/M5/M15 all aligned bearish — distribution confirmed");
    risks.push(`Strong support at ₹${support.toFixed(2)} — bounce risk`);
    risks.push("Oversold bounce possible if selling accelerates near support");
  } else {
    reasons.push(`Mixed signals: price ${aboveVWAP?"above":"below"} VWAP, RSI ${rsi}`);
    reasons.push(`MACD histogram ${macd.histogram.toFixed(4)} — ${macdBull?"positive but weak":"negative but fading"}`);
    reasons.push(trendOK ? "Partial trend alignment — wait for confirmation candle" : "Timeframes divergent — avoid directional trade");
    risks.push("Choppy regime — whipsaw risk high");
    risks.push("Wait for volume surge + VWAP reclaim/rejection");
  }

  return {
    score,
    verdict,
    confidence: Math.max(40, confidence),
    summary: `${symbol} at ₹${price.toFixed(2)} — Score ${score}/100. ${verdict === "HOLD" ? "Mixed signals, wait for clarity." : `${verdict} setup with RSI ${rsi}, price ${aboveVWAP?"above":"below"} VWAP, MACD ${macdBull?"bullish":"bearish"}. Regime: ${regime.replace(/_/g," ")}.`}`,
    entry, target, stopLoss, riskReward,
    optionSuggestion: null,
    reasons, risks,
    newsImpact: `${symbol} PCR ${pcr.toFixed(2)} ${pcr>1.2?"(bullish OI bias)":pcr<0.8?"(bearish OI bias)":"(neutral)"}. Volume ratio ${volumeRatio.toFixed(2)}x avg. ATR ₹${atr.toFixed(2)} (${((atr/price)*100).toFixed(2)}% of price).`,
    timeframeAlignment: { shortTerm: m1Trend, mediumTerm: m5Trend, trend: m15Trend },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesOrigin(origin, allowedOrigin) {
  if (allowedOrigin === "*") return true;
  if (!allowedOrigin.includes("*")) return origin === allowedOrigin;
  const pattern = `^${escapeRegex(allowedOrigin).replace(/\\\*/g, ".*")}$`;
  return new RegExp(pattern).test(origin);
}

function getCorsOrigin(req) {
  const requestOrigin = req.headers.origin;
  // Always reflect origin back — covers localhost + devtunnels
  return requestOrigin || "*";
}

function writeJson(req, res, statusCode, body) {
  const corsOrigin = getCorsOrigin(req);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-tunnel-authorization, x-forwarded-for, x-real-ip",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  });
  res.end(JSON.stringify(body));
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return process.env.UPSTOX_SANDBOX_ACCESS_TOKEN || "";
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function upstoxGet(path, token) {
  // DEPRECATED: Use UpstoxAPI methods instead
  // This function kept for backwards compatibility
  // Direct HTTP calls replaced with API client calls below
  throw new Error("Direct upstoxGet() deprecated. Use UpstoxAPI module instead.");
}

// Resolve symbol → Upstox instrument_key
function normalizeSymbolInput(symbol) {
  return String(symbol || "").trim().toUpperCase()
    .replace(/^NSE:/i, "")
    .replace(/-EQ|-INDEX/gi, "")
    .replace(/\s+/g, "");
}

function buildSearchQuery(symbol) {
  const clean = normalizeSymbolInput(symbol);
  if (clean === "BANKNIFTY") return "NIFTY BANK";
  if (clean === "NIFTY50") return "NIFTY";
  if (clean === "MIDCPNIFTY") return "MIDCAP NIFTY";
  return String(symbol || "").trim() || clean;
}

async function searchUpstoxInstruments(token, query, options = {}) {
  try {
    const results = await UpstoxAPI.searchInstruments(query, {
      exchanges: options.exchanges || "NSE",
      segments: options.segments || "", // Removed EQ,INDEX since INDEX is not a segment!
      pageNumber: options.pageNumber || 1,
      records: options.records || 20,
      instrumentTypes: options.instrumentTypes,
      expiry: options.expiry,
      atmOffset: options.atmOffset,
    }, token);
    return results;
  } catch (err) {
    console.warn("[searchUpstoxInstruments] API error:", err.message);
    return [];
  }
}

function scoreInstrumentMatch(item, cleanSymbol) {
  const tradingSymbol = normalizeSymbolInput(item?.trading_symbol);
  const shortName = normalizeSymbolInput(item?.short_name);
  const itemName = normalizeSymbolInput(item?.name);
  let score = 0;

  if (tradingSymbol === cleanSymbol) score += 100;
  else if (shortName === cleanSymbol) score += 90;
  else if (itemName === cleanSymbol) score += 80;
  else if (tradingSymbol.startsWith(cleanSymbol)) score += 70;
  else if (shortName.startsWith(cleanSymbol)) score += 60;

  if (item?.segment === "NSE_EQ") score += 40;
  else if (item?.segment === "NSE_INDEX") score += 35;
  else if (item?.segment === "BSE_EQ") score += 30;

  if (item?.instrument_type === "EQ" || item?.instrument_type === "INDEX" || item?.instrument_type === "A") score += 10;

  return score;
}

function formatSearchResult(item) {
  return {
    symbol: item?.trading_symbol || item?.short_name || item?.name || "",
    name: item?.name || item?.short_name || item?.trading_symbol || "",
    shortName: item?.short_name || item?.trading_symbol || "",
    tradingSymbol: item?.trading_symbol || "",
    instrumentKey: item?.instrument_key || "",
    exchange: item?.exchange || "",
    segment: item?.segment || "",
    instrumentType: item?.instrument_type || "",
  };
}

async function resolveInstrument(symbol, token) {
  if (String(symbol).includes("|")) {
    return { instrumentKey: symbol, displaySymbol: symbol };
  }

  const clean = normalizeSymbolInput(symbol);
  const localMatch = SYMBOL_TO_INSTRUMENT[clean];
  if (localMatch) {
    return { instrumentKey: localMatch, displaySymbol: clean };
  }

  const matches = await searchUpstoxInstruments(token, buildSearchQuery(symbol), { records: 10 });
  if (!matches.length) return null;

  const best = matches
    .map((item) => ({ item, score: scoreInstrumentMatch(item, clean) }))
    .sort((a, b) => b.score - a.score)[0]?.item;

  if (!best?.instrument_key) return null;
  return {
    instrumentKey: best.instrument_key,
    displaySymbol: best.trading_symbol || best.short_name || clean,
  };
}

// ─── MOCK FALLBACK ──────────────────────────────────────────────────────────
// Generates realistic mock candles if Upstox APIs are completely down or market is closed
function generateMockCandles(symbol, resolution, count = 150, ltpOverride = null) {
  const BASE_PRICES = {
    "NIFTY": 24850, "NIFTY50": 24850, "BANKNIFTY": 52210, "FINNIFTY": 23480, "MIDCPNIFTY": 11240,
    "RELIANCE": 2890, "TCS": 3754, "HDFCBANK": 1612, "INFY": 1548, "ICICIBANK": 1289
  };
  const clean = String(symbol).trim().toUpperCase().replace(/^NSE:/i, "").replace(/-EQ|-INDEX/gi, "");
  const basePrice = ltpOverride || BASE_PRICES[clean] || 1000;
  
  const map = { "1": 1, "3": 3, "5": 5, "15": 15, "30": 30, "60": 60, "1H": 60, "D": 1440, "1D": 1440, "DAY": 1440 };
  const tfMins = map[String(resolution).toUpperCase()] || 5;

  const candles = [];
  const now = Date.now();
  let price = basePrice;
  const volatility = basePrice * 0.0018;

  for (let i = count; i >= 0; i--) {
    const ts = now - i * tfMins * 60 * 1000;
    const open = price;
    const drift = (Math.random() - 0.485) * volatility * (0.4 + Math.random() * 1.2);
    const close = Math.max(open * 0.97, open + drift);
    const wickMult = Math.random() * 0.7;
    const high = Math.max(open, close) + volatility * wickMult;
    const low = Math.min(open, close) - volatility * wickMult * 0.6;
    const volume = Math.round(40000 + Math.random() * 180000);
    candles.push({ timestamp: ts, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume });
    price = close;
  }
  return candles;
}

// ─── REAL CANDLE FETCH from Upstox API ──────────────────────────────
async function fetchRealCandles(token, instrumentKey, resolution, mode = "tech") {
  try {
    const r = String(resolution).toUpperCase().trim();
    const isDaily    = ["D", "1D", "DAY", "W", "WEEK", "M", "MONTH"].includes(r);
    const isDelivery = mode === "delivery";
    const mapCandles = candles => candles.map(c => ({
      timestamp: new Date(c[0]).getTime(),
      open: Number(c[1]), high: Number(c[2]),
      low: Number(c[3]), close: Number(c[4]),
      volume: Number(c[5]) || 0,
    })).sort((a, b) => a.timestamp - b.timestamp);

    if (isDaily || isDelivery) {
      // DELIVERY / Daily — V3 Historical API
      // Fetch max 2 years of daily data so frontend period selectors (10D/30D/11W/1Y/2Y) all work
      const today = new Date().toISOString().slice(0, 10);
      const from  = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10); // 2 years
      const histRes = isDelivery ? "D" : r;
      try {
        const candles = await UpstoxAPI.getHistoricalCandles(instrumentKey, histRes, today, from, token);
        if (candles && candles.length > 0) {
          console.log(`[V3 Historical] ${candles.length} candles (${histRes}) for ${instrumentKey} mode=${mode}`);
          return mapCandles(candles);
        }
      } catch (e) {
        console.warn("[V3 Historical] failed:", e.message);
      }
      return null;
    }

    // INTRADAY — V3 Intraday API (primary)
    const intradayInterval = mapResolutionToIntradayInterval(r);
    try {
      const candles = await UpstoxAPI.getIntradayCandles(instrumentKey, intradayInterval, token);
      if (candles && candles.length > 0) {
        console.log(`[V3 Intraday] ${candles.length} candles (${intradayInterval}) for ${instrumentKey} mode=${mode}`);
        return mapCandles(candles);
      }
    } catch (e) {
      console.warn(`[V3 Intraday] failed for ${instrumentKey}:`, e.message);
    }

    // FALLBACK — V3 Historical with 30-day window (Upstox limit for minute candles)
    // FALLBACK — V3 Historical with 7-day window (1 week)
    try {
      const today = new Date().toISOString().slice(0, 10);
      const from  = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const candles = await UpstoxAPI.getHistoricalCandles(instrumentKey, r, today, from, token);
      if (candles && candles.length > 0) {
        console.log(`[V3 Hist-fallback] ${candles.length} candles for ${instrumentKey}`);
        return mapCandles(candles);
      }
    } catch (e) {
      console.warn("[V3 Hist-fallback] failed:", e.message);
    }

    return null;
  } catch (err) {
    console.error("[fetchRealCandles] Error:", err.message);
    throw err;
  }
}

// Map UI resolution to a minute-count string for V3 intraday (API resolves unit internally)
function mapResolutionToIntradayInterval(r) {
  const map = { "1": "1", "3": "3", "5": "5", "15": "15", "30": "30",
                "60": "60", "1H": "60", "120": "120", "2H": "120",
                "D": "D", "1D": "D", "DAY": "D" };
  if (map[r]) return map[r];
  const num = parseInt(r, 10);
  if (!isNaN(num) && num >= 1 && num <= 300) return String(num);
  return "5";
}

// ─── Candle Pattern Detection ────────────────────────────────────────────────
function detectCandlePatterns(candles) {
  if (!candles || candles.length < 3) return [];
  const patterns = [];
  const c = candles[candles.length - 1];
  const p = candles[candles.length - 2];
  const pp= candles[candles.length - 3];
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;

  // Doji
  if (range > 0 && body / range < 0.1) patterns.push('DOJI');
  // Hammer
  if (lowerWick > body * 2 && upperWick < body * 0.5 && c.close > c.open) patterns.push('HAMMER');
  // Shooting Star
  if (upperWick > body * 2 && lowerWick < body * 0.5 && c.close < c.open) patterns.push('SHOOTING_STAR');
  // Bullish Engulfing
  if (p.close < p.open && c.close > c.open && c.close > p.open && c.open < p.close) patterns.push('BULLISH_ENGULFING');
  // Bearish Engulfing
  if (p.close > p.open && c.close < c.open && c.open > p.close && c.close < p.open) patterns.push('BEARISH_ENGULFING');
  // Morning Star
  if (pp.close < pp.open && Math.abs(p.close-p.open) < (p.high-p.low)*0.3 && c.close > c.open && c.close > (pp.open+pp.close)/2) patterns.push('MORNING_STAR');
  // Evening Star
  if (pp.close > pp.open && Math.abs(p.close-p.open) < (p.high-p.low)*0.3 && c.close < c.open && c.close < (pp.open+pp.close)/2) patterns.push('EVENING_STAR');
  // Marubozu Bull
  if (c.close > c.open && upperWick < body*0.05 && lowerWick < body*0.05) patterns.push('BULLISH_MARUBOZU');
  // Marubozu Bear
  if (c.close < c.open && upperWick < body*0.05 && lowerWick < body*0.05) patterns.push('BEARISH_MARUBOZU');
  return patterns;
}

// REAL LTP from Market Quotes API
async function fetchLTP(token, instrumentKey) {
  try {
    const data = await UpstoxAPI.getLTP(instrumentKey, token);
    const key = Object.keys(data || {})[0];
    if (key) return Number(data[key]?.last_price) || null;
  } catch (e) {
    console.warn("[UpstoxAPI] LTP fetch failed:", e.message);
  }
  return null;
}

// Build analyze payload from REAL candles
async function buildRealAnalyzePayload(symbol, candles, ltpOverride, mode = "tech", instrumentKey = "", token = null) {
  const closes = candles.map(c => c.close);
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2] ?? latest;

  // Use real LTP if available, otherwise last close
  const price = ltpOverride ?? latest.close;

  const vwap       = calcVWAP(candles);
  const ema20      = calcEMA(closes, 20);
  const ema50      = calcEMA(closes, 50);
  const ema9       = calcEMA(closes, 9);
  const ema200     = calcEMA(closes, 200);
  const ema20Ser   = calcEMASeries(closes, 20);
  const atr        = calcATR(candles, 14);
  const rsi        = calcRSI(closes, 14);
  const bb         = calcBollingerBands(closes, 20);
  const macd       = calcMACD(closes);
  const supertrend = calcSupertrend(candles);
  const ichimoku   = calcIchimoku(candles);

  // Dynamic lookback: delivery/fo gets wider view
  const lookback = mode === 'delivery' ? 60 : mode === 'fo' ? 40 : 20;
  const volLookback = Math.min(candles.length, 20);

  // Pivot-based support/resistance (more accurate than simple min/max)
  function calcPivotLevels(cands, lb) {
    const slice = cands.slice(-lb);
    const lows = slice.map(c => c.low);
    const highs = slice.map(c => c.high);
    // Find swing lows/highs using local minima/maxima (3-bar pivot)
    const swingLows = [], swingHighs = [];
    for (let i = 1; i < slice.length - 1; i++) {
      if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) swingLows.push(lows[i]);
      if (highs[i] > highs[i-1] && highs[i] > highs[i+1]) swingHighs.push(highs[i]);
    }
    const support    = swingLows.length  > 0 ? +Math.min(...swingLows).toFixed(2)  : +Math.min(...lows).toFixed(2);
    const resistance = swingHighs.length > 0 ? +Math.max(...swingHighs).toFixed(2) : +Math.max(...highs).toFixed(2);
    return { support, resistance };
  }
  const { support, resistance } = calcPivotLevels(candles, lookback);

  // 52-week high/low for delivery
  const yearSlice = candles.slice(-365);
  const high52w = +Math.max(...yearSlice.map(c => c.high)).toFixed(2);
  const low52w  = +Math.min(...yearSlice.map(c => c.low)).toFixed(2);

  const avgVolume  = candles.slice(-volLookback).reduce((s,c)=>s+c.volume,0)/volLookback;
  const volumeRatio= avgVolume ? +(latest.volume / avgVolume).toFixed(2) : 1;

  // Trend using EMA slopes (more accurate than close comparison)
  function emaTrend(closes, period, lookbackBars = 3) {
    const series = calcEMASeries(closes, period);
    const last = series[series.length - 1];
    const prev = series[series.length - 1 - lookbackBars];
    if (!prev) return 'SIDEWAYS';
    const slope = (last - prev) / Math.max(prev, 1) * 100;
    if (slope > 0.08) return 'BULLISH';
    if (slope < -0.08) return 'BEARISH';
    return 'SIDEWAYS';
  }
  const m1Trend  = emaTrend(closes, 9, 2);
  const m5Trend  = emaTrend(closes, 20, 5);
  const m15Trend = emaTrend(closes, 50, 10);
  const trendConsistency = m1Trend===m5Trend && m5Trend===m15Trend && m1Trend!=="SIDEWAYS" ? "CONFIRMED" : "DIVERGENT";
  const regime   = classifyRegime(price, ema20, ema50, atr, volumeRatio);

  // Stochastic RSI for better overbought/oversold accuracy
  function calcStochRSI(closes, rsiPeriod=14, stochPeriod=14) {
    const rsiSeries = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= rsiPeriod; i++) {
      const diff = closes[i] - closes[i-1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains/rsiPeriod, avgLoss = losses/rsiPeriod;
    rsiSeries.push(100 - 100/(1 + (avgLoss === 0 ? 999 : avgGain/avgLoss)));
    for (let i = rsiPeriod+1; i < closes.length; i++) {
      const diff = closes[i] - closes[i-1];
      avgGain = (avgGain*(rsiPeriod-1) + Math.max(diff,0))/rsiPeriod;
      avgLoss = (avgLoss*(rsiPeriod-1) + Math.max(-diff,0))/rsiPeriod;
      rsiSeries.push(100 - 100/(1 + (avgLoss === 0 ? 999 : avgGain/avgLoss)));
    }
    if (rsiSeries.length < stochPeriod) return 50;
    const slice = rsiSeries.slice(-stochPeriod);
    const rsiMax = Math.max(...slice), rsiMin = Math.min(...slice);
    return rsiMax === rsiMin ? 50 : ((rsiSeries[rsiSeries.length-1] - rsiMin)/(rsiMax-rsiMin))*100;
  }
  const stochRSI = +calcStochRSI(closes).toFixed(2);

  // ADX (Average Directional Index) for trend strength
  function calcADX(cands, period=14) {
    if (cands.length < period+1) return { adx: 25, plusDI: 15, minusDI: 15 };
    const slice = cands.slice(-(period*2));
    const trArr=[], plusDMArr=[], minusDMArr=[];
    for (let i=1;i<slice.length;i++) {
      const c=slice[i], p=slice[i-1];
      trArr.push(Math.max(c.high-c.low, Math.abs(c.high-p.close), Math.abs(c.low-p.close)));
      plusDMArr.push(c.high-p.high > p.low-c.low && c.high-p.high > 0 ? c.high-p.high : 0);
      minusDMArr.push(p.low-c.low > c.high-p.high && p.low-c.low > 0 ? p.low-c.low : 0);
    }
    const atr14 = trArr.slice(-period).reduce((a,b)=>a+b,0)/period;
    const plusDI = atr14 > 0 ? (plusDMArr.slice(-period).reduce((a,b)=>a+b,0)/period)/atr14*100 : 0;
    const minusDI = atr14 > 0 ? (minusDMArr.slice(-period).reduce((a,b)=>a+b,0)/period)/atr14*100 : 0;
    const dx = Math.abs(plusDI-minusDI)/((plusDI+minusDI)||1)*100;
    return { adx: +dx.toFixed(2), plusDI: +plusDI.toFixed(2), minusDI: +minusDI.toFixed(2) };
  }
  const adx = calcADX(candles, 14);

  // OBV (On Balance Volume) trend
  function calcOBV(cands) {
    let obv = 0;
    const series = [0];
    for (let i=1;i<cands.length;i++) {
      if (cands[i].close > cands[i-1].close) obv += cands[i].volume;
      else if (cands[i].close < cands[i-1].close) obv -= cands[i].volume;
      series.push(obv);
    }
    const last5 = series.slice(-5);
    return { obv, trend: last5[4] > last5[0] ? 'RISING' : last5[4] < last5[0] ? 'FALLING' : 'FLAT' };
  }
  const obvData = calcOBV(candles);

  const clean = String(symbol).trim().toUpperCase().replace(/^NSE:/i,"").replace(/-EQ|-INDEX/gi,"");
  const isIndex = ["NIFTY","NIFTY50","BANKNIFTY","FINNIFTY","MIDCPNIFTY"].includes(clean);

  // Option chain — try real Upstox option chain API for 'fo' mode, else Black-Scholes
  let foGreeks = [];
  if (isIndex || mode === "fo") {
    // Try real option chain from Upstox API first
    if (token && instrumentKey && (mode === "fo" || isIndex)) {
      try {
        const chainData = await UpstoxAPI.getOptionChain(instrumentKey, null, token);
        if (Array.isArray(chainData) && chainData.length > 0) {
          foGreeks = chainData.flatMap(item => {
            const results = [];
            if (item?.call_options) {
              const ce = item.call_options;
              const g = calcOptionGreeks(price, item.strike_price, ce?.market_data?.iv || 15);
              results.push({
                strikePrice:  Number(item.strike_price) || 0,
                optionType:   "CE",
                delta:        Number(ce?.option_greeks?.delta)  || g.ceDelta,
                theta:        Number(ce?.option_greeks?.theta)  || g.ceTheta,
                vega:         Number(ce?.option_greeks?.vega)   || g.vega,
                gamma:        Number(ce?.option_greeks?.gamma)  || g.gamma,
                iv:           Number(ce?.market_data?.iv)       || 15,
                ltp:          Number(ce?.market_data?.ltp)      || 0,
                oi:           Number(ce?.market_data?.oi)       || 0,
                tradeVolume:  Number(ce?.market_data?.volume)   || 0,
              });
            }
            if (item?.put_options) {
              const pe = item.put_options;
              const g = calcOptionGreeks(price, item.strike_price, pe?.market_data?.iv || 15);
              results.push({
                strikePrice:  Number(item.strike_price) || 0,
                optionType:   "PE",
                delta:        Number(pe?.option_greeks?.delta)  || g.peDelta,
                theta:        Number(pe?.option_greeks?.theta)  || g.peTheta,
                vega:         Number(pe?.option_greeks?.vega)   || g.vega,
                gamma:        Number(pe?.option_greeks?.gamma)  || g.gamma,
                iv:           Number(pe?.market_data?.iv)       || 15,
                ltp:          Number(pe?.market_data?.ltp)      || 0,
                oi:           Number(pe?.market_data?.oi)       || 0,
                tradeVolume:  Number(pe?.market_data?.volume)   || 0,
              });
            }
            return results;
          });
          console.log(`[Option Chain] ${foGreeks.length} strikes from Upstox real API`);
        }
      } catch (e) {
        console.warn("[Option Chain] Real API failed, using Black-Scholes fallback:", e.message);
        foGreeks = [];
      }
    }

    // Fallback: Black-Scholes synthetic option chain
    if (foGreeks.length === 0) {
      const base = Math.round(price / 50) * 50;
      const offsets = [-200,-150,-100,-50,0,50,100,150,200];
      foGreeks = offsets.flatMap(off => {
        const strike = base + off;
        const moneyness = Math.abs(price - strike) / Math.max(price,1);
        const iv = 14 + moneyness * 55 + Math.random() * 3;
        const g = calcOptionGreeks(price, strike, iv);
        const ceLTP = Math.max(2, (price-strike)*0.55+45);
        const peLTP = Math.max(2, (strike-price)*0.55+45);
        const ceOI  = Math.round(40000 + Math.random()*150000);
        const peOI  = Math.round(40000 + Math.random()*150000);
        return [
          { strikePrice:strike, optionType:"CE", delta:g.ceDelta, theta:g.ceTheta, vega:g.vega, gamma:g.gamma, iv:+iv.toFixed(2), ltp:+ceLTP.toFixed(2), oi:ceOI, tradeVolume:Math.round(ceOI*0.3) },
          { strikePrice:strike, optionType:"PE", delta:g.peDelta, theta:g.peTheta, vega:g.vega, gamma:g.gamma, iv:+iv.toFixed(2), ltp:+peLTP.toFixed(2), oi:peOI, tradeVolume:Math.round(peOI*0.3) },
        ];
      });
    }
  }

  const ceOI = foGreeks.filter(g=>g.optionType==="CE").reduce((s,g)=>s+g.oi,0);
  const peOI = foGreeks.filter(g=>g.optionType==="PE").reduce((s,g)=>s+g.oi,0);
  const pcr  = ceOI ? +(peOI/ceOI).toFixed(2) : 1;

  const aiInput = {
    symbol:clean, price, vwap, ema20, ema50, rsi, atr,
    support, resistance, regime, trendConsistency, volumeRatio, pcr,
    m1Trend, m5Trend, m15Trend, macd, bb, supertrend, ichimoku,
  };

  // Try Groq AI first (same model as reference code: llama-3.3-70b-versatile)
  let aiAnalysis = ruleBasedAnalysis(aiInput);
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      // Rich indicator context for AI
      const candlePatterns = detectCandlePatterns(candles);
      const ema9val   = +calcEMA(closes, 9).toFixed(2);
      const ema200val = +calcEMA(closes, 200).toFixed(2);
      const priceVsEMA200 = ema200val ? (((price-ema200val)/ema200val)*100).toFixed(2) : '0';
      const priceVsVWAP   = vwap ? (((price-vwap)/vwap)*100).toFixed(2) : '0';
      const bbWidth = bb ? ((bb.upper-bb.lower)/Math.max(bb.middle,1)*100).toFixed(2) : '0';
      const highestHigh = +Math.max(...candles.slice(-20).map(c=>c.high)).toFixed(2);
      const lowestLow   = +Math.min(...candles.slice(-20).map(c=>c.low)).toFixed(2);

      const groqPrompt = `You are an expert SEBI-registered research analyst for Indian equity markets (NSE/BSE).
Analyze the real-time data below and return ONLY valid JSON (no markdown, no extra text).

MARKET DATA: ${clean}
Price: ₹${price.toFixed(2)} | VWAP: ₹${vwap.toFixed(2)} | vs VWAP: ${priceVsVWAP}%
EMA9: ₹${ema9val} | EMA20: ₹${ema20.toFixed(2)} | EMA50: ₹${ema50.toFixed(2)} | EMA200: ₹${ema200val} (vs: ${priceVsEMA200}%)
RSI: ${rsi} | MACD: ${macd.macd.toFixed(3)} | Signal: ${macd.signal.toFixed(3)} | Histogram: ${macd.histogram.toFixed(4)}
BB: Upper ₹${bb?.upper||0} / Mid ₹${bb?.middle||0} / Lower ₹${bb?.lower||0} | Width: ${bbWidth}%
Supertrend: ${supertrend?.direction?.toUpperCase()||'N/A'} @ ₹${supertrend?.value||0}
Ichimoku: Tenkan ${ichimoku?.tenkan||'N/A'} | Kijun ${ichimoku?.kijun||'N/A'}
Support: ₹${support} | Resistance: ₹${resistance} | ATR: ₹${atr.toFixed(2)}
Volume Ratio: ${volumeRatio.toFixed(2)}x | PCR: ${pcr} | Regime: ${regime}
Timeframes: M1=${m1Trend} M5=${m5Trend} M15=${m15Trend} | Consistency: ${trendConsistency}
Candle Patterns: ${candlePatterns.length > 0 ? candlePatterns.join(', ') : 'None'}
StochRSI: ${stochRSI} | ADX: ${adx.adx} (+DI:${adx.plusDI} -DI:${adx.minusDI}) | OBV Trend: ${obvData.trend}
52W High: ₹${high52w} | 52W Low: ₹${low52w} | From 52W High: ${((price-high52w)/high52w*100).toFixed(2)}%

DECISION RULES:
- BUY: price>VWAP + price>EMA20 + MACD histogram>0 + RSI 40-70 + Supertrend UP + ADX>20 + M5+M15 BULLISH + OBV RISING
- SELL: price<VWAP + price<EMA20 + MACD histogram<0 + RSI 30-60 + Supertrend DOWN + ADX>20 + M5+M15 BEARISH + OBV FALLING
- HOLD: ADX<20 (no trend), trendConsistency=DIVERGENT, StochRSI extreme (>90 or <10) without candle reversal, HIGH_VOL_CHOP
- STRONG BUY: All BUY conditions + ADX>30 + StochRSI<20 (oversold bounce) + bullish candle pattern
- STRONG SELL: All SELL conditions + ADX>30 + StochRSI>80 (overbought) + bearish candle pattern
- Entry: optimal level (not always current price)
- SL: below nearest support or supertrend value
- Target: nearest resistance or R:R > 1.5x
- Confidence: 40-92 range only. Cap at 55 for HIGH_VOL_CHOP.
- Reasons must include specific numbers/price levels (max 4)
- Risks must include specific price levels (max 3)

Return this exact JSON:
{"verdict":"BUY|SELL|HOLD","confidence":number,"summary":"2-3 sentence technical summary with ₹ levels","entry":number,"target":number,"stopLoss":number,"riskReward":number,"reasons":["with numbers"],"risks":["with ₹ levels"],"newsImpact":"PCR/OI/volume sentence","optionSuggestion":null,"timeframeAlignment":{"shortTerm":"BULLISH|BEARISH|SIDEWAYS","mediumTerm":"BULLISH|BEARISH|SIDEWAYS","trend":"BULLISH|BEARISH|SIDEWAYS"}}`;

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.15,
          max_tokens: 1200,
          messages: [{ role: "user", content: groqPrompt }]
        })
      });
      const groqData = await groqRes.json();
      const content = groqData?.choices?.[0]?.message?.content || "";
      const start = content.indexOf("{"), end = content.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(content.slice(start, end + 1));
        if (parsed?.verdict) {
          // Merge Groq result over rule-based (same as reference code pattern)
          aiAnalysis = {
            ...aiAnalysis,
            verdict:    ["BUY","SELL","HOLD"].includes(String(parsed.verdict).toUpperCase()) ? String(parsed.verdict).toUpperCase() : aiAnalysis.verdict,
            confidence: Math.max(0, Math.min(100, Number(parsed.confidence ?? aiAnalysis.confidence))),
            summary:    String(parsed.summary || aiAnalysis.summary),
            entry:      Number(parsed.entry)     || aiAnalysis.entry,
            target:     Number(parsed.target)    || aiAnalysis.target,
            stopLoss:   Number(parsed.stopLoss)  || aiAnalysis.stopLoss,
            riskReward: Number(parsed.riskReward)|| aiAnalysis.riskReward,
            reasons:    Array.isArray(parsed.reasons) ? parsed.reasons.slice(0,4).map(String) : aiAnalysis.reasons,
            risks:      Array.isArray(parsed.risks)   ? parsed.risks.slice(0,4).map(String)   : aiAnalysis.risks,
            newsImpact: String(parsed.newsImpact || aiAnalysis.newsImpact),
            timeframeAlignment: parsed.timeframeAlignment || aiAnalysis.timeframeAlignment,
            source: "GROQ_LLAMA3",
          };
          console.log(`✅ Groq AI verdict for ${clean}: ${aiAnalysis.verdict} (${aiAnalysis.confidence}%)`);
        }
      }
    } catch(e) {
      console.warn("Groq AI failed, using rule-based fallback:", e.message);
    }
  }

  // Option signal
  let optionSignal = null;
  if (isIndex && foGreeks.length > 0) {
    const strike = Math.round(price/50)*50;
    const type = aiAnalysis.verdict === "SELL" ? "PE" : "CE";
    const contract = foGreeks.find(g=>g.strikePrice===strike && g.optionType===type);
    if (contract) {
      const sl  = +(contract.ltp*0.70).toFixed(2);
      const tgt = +(contract.ltp*1.55).toFixed(2);
      optionSignal = {
        strike, type,
        entryRange: `${contract.ltp}–${+(contract.ltp*1.03).toFixed(2)}`,
        stopLoss: sl, target: tgt,
        summary: `${clean} ${strike} ${type} | LTP ₹${contract.ltp} | Target ₹${tgt} | SL ₹${sl} | IV ${contract.iv}%`,
      };
      aiAnalysis.optionSuggestion = optionSignal.summary;
    }
  }

  return {
    ok: true,
    service: "anavai-upstox-live",
    stock: clean,
    price,
    vwap: +vwap.toFixed(2),
    ema20: +ema20.toFixed(2),
    ema50: +ema50.toFixed(2),
    ema9:  +ema9.toFixed(2),
    ema200:+ema200.toFixed(2),
    rsi:   +rsi,
    pcr,
    trendConsistency,
    timeframeAnalysis: { m1:m1Trend, m5:m5Trend, m15:m15Trend },
    executionContext: {
      atr, pcr, volumeRatio,
      marketRegime: regime,
      trendStrength: +(((price-ema20)/Math.max(ema20,1))*100).toFixed(2),
      vwapDistancePct: +(vwap?((price-vwap)/vwap*100):0).toFixed(2),
      supertrend: supertrend,
      bbSqueeze: bb ? +((bb.upper-bb.lower)/Math.max(bb.middle,1)).toFixed(4) : 0,
    },
    bollingerBands: bb,
    macd,
    supertrend,
    ichimoku,
    foGreeks,
    adx,
    stochRSI,
    obvTrend: obvData.trend,
    high52w,
    low52w,
    analysis: aiAnalysis.summary,
    aiAnalysis,
    latestNews: [],
    optionSignal,
    candleData: candles,
    ema20Series: ema20Ser,
    quality: { source: "UPSTOX_LIVE", candleCount: candles.length },
  };
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { writeJson(req, res, 200, { ok: true }); return; }
  const url   = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const token = getToken(req);

  try {
    // ── /session ────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/session") {
      writeJson(req, res, 200, { status:"success", data:{
        sandboxConfigured: Boolean(process.env.UPSTOX_SANDBOX_ACCESS_TOKEN),
        frontendUrl: process.env.FRONTEND_URL||"",
        redirectUri: process.env.UPSTOX_REDIRECT_URI||"",
      }});
      return;
    }

    // ── /api/analyze or /analyze ─────────────────────────────────────────────
    if (req.method === "POST" && (url.pathname === "/api/analyze" || url.pathname === "/analyze")) {
      const body = await readBody(req);
      const sym  = body.symbol || body.symbolName || "NIFTY";
      const res_ = body.resolution || body.timeframe || "5";
      const mode = body.mode || "tech";  // 'intraday' | 'delivery' | 'fo' | 'tech'
      const requestedInstrumentKey = body.instrumentKey || body.instrument_key || "";

      // Step 1: Resolve to Upstox instrument_key
      const resolved = requestedInstrumentKey
        ? { instrumentKey: requestedInstrumentKey, displaySymbol: sym }
        : await resolveInstrument(sym, token);

      if (!resolved?.instrumentKey) {
        // Symbol not in our map — return error with helpful message
        writeJson(req, res, 400, {
          error: `Symbol "${sym}" was not found in Upstox instruments. Try the exact trading symbol, or provide instrument_key directly like NSE_EQ|INE002A01018.`,
        });
        return;
      }

      // Step 2: Fetch real candles from Upstox
      let candles = await fetchRealCandles(token, resolved.instrumentKey, res_, mode);

      // Step 3: Fetch real LTP (best-effort)
      const ltp = await fetchLTP(token, resolved.instrumentKey);

      let usedMock = false;
      if (!candles || candles.length === 0) {
        console.warn(`[Mock Fallback] Generating mock candles for ${resolved.displaySymbol} because Upstox returned 0 data.`);
        candles = generateMockCandles(resolved.displaySymbol, res_, 150, ltp);
        usedMock = true;
      }

      // Step 4: Build accurate analysis on real data
      const payload = await buildRealAnalyzePayload(resolved.displaySymbol || sym, candles, ltp, mode, resolved.instrumentKey, token);
      
      if (usedMock) {
        payload.quality.source = "MOCK_FALLBACK";
        payload.service = "anavai-browser-fallback";
      }
      
      writeJson(req, res, 200, payload);
      return;
    }

    // ── /api/search ──────────────────────────────────────────────────────────
    if (req.method === "GET" && (url.pathname === "/api/search" || url.pathname === "/search")) {
      const q = (url.searchParams.get("q") || "").trim().toUpperCase();
      if (!q) {
        writeJson(req, res, 200, { results: [] });
        return;
      }
      const matches = await searchUpstoxInstruments(token, q, {
        exchanges: url.searchParams.get("exchanges") || "NSE",
        segments: url.searchParams.get("segments") || "",
        instrumentTypes: url.searchParams.get("instrumentTypes") || "",
        records: Math.min(Number(url.searchParams.get("records") || 20), 50),
      });
      writeJson(req, res, 200, { results: matches.map(formatSearchResult) });
      return;
    }

    // ── OAuth ────────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/auth/url") {
      const redirectUri = url.searchParams.get("redirect_uri") || process.env.UPSTOX_REDIRECT_URI || "";
      const state = `anavai-${Date.now()}`;
      try {
        const authUrl = UpstoxAPI.getAuthorizationUrl(redirectUri, state);
        writeJson(req, res, 200, { status:"success", data:{ authorizationUrl:authUrl, state }});
      } catch (err) {
        writeJson(req, res, 400, { status:"error", message: err.message });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/auth/exchange") {
      const body = await readBody(req);
      try {
        const tokenData = await UpstoxAPI.exchangeAuthCode(body.code, body.redirectUri);
        writeJson(req, res, 200, { status:"success", data: tokenData });
      } catch (err) {
        writeJson(req, res, 400, { status:"error", message: err.message });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/auth/refresh") {
      const body = await readBody(req);
      try {
        const tokenData = await UpstoxAPI.refreshAccessToken(body.refreshToken);
        writeJson(req, res, 200, { status:"success", data: tokenData });
      } catch (err) {
        writeJson(req, res, 400, { status:"error", message: err.message });
      }
      return;
    }

    // ── Intraday V3 (direct) ─────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/historical/intraday-v3") {
      const instrKey = url.searchParams.get("instrumentKey");
      const unit = url.searchParams.get("unit") || "minutes";
      const interval = url.searchParams.get("interval") || "1";
      if (!instrKey) { writeJson(req, res, 400, { status:"error", message:"instrumentKey is required" }); return; }
      
      const ivl = interval === "1" ? "1minute" : "30minute";
      const candles = await UpstoxAPI.getIntradayCandles(instrKey, ivl, token);
      writeJson(req, res, 200, { status:"success", data:{ usingSandboxToken:true, candles }});
      return;
    }

    // ── Historical V3 (direct) ───────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/historical/v3") {
      const instrKey = url.searchParams.get("instrumentKey");
      const unit = url.searchParams.get("unit")||"minutes";
      const interval = url.searchParams.get("interval")||"1";
      const toDate = url.searchParams.get("toDate");
      const fromDate = url.searchParams.get("fromDate");
      if (!instrKey||!toDate) { writeJson(req, res, 400, {status:"error",message:"instrumentKey and toDate required"}); return; }
      
      const candles = await UpstoxAPI.getHistoricalCandles(instrKey, interval, toDate, fromDate, token);
      writeJson(req, res, 200, { status:"success", data:{ candles }});
      return;
    }

    // ── /news — Market News for Instruments ──────────────────────────────────
    if (req.method === "GET" && url.pathname === "/news") {
      const newsToken = getToken(req);
      const category = url.searchParams.get("category") || "instrument_keys";
      const instrumentKeys = url.searchParams.get("instrument_keys");
      const pageNumber = url.searchParams.get("page_number") || 1;
      const pageSize = url.searchParams.get("page_size") || 20;

      console.log(`[News] Token length: ${newsToken?.length || 0}, Category: ${category}, Keys: ${instrumentKeys}`);

      if (!newsToken) {
        console.warn(`[News] No token available - check Authorization header or UPSTOX_SANDBOX_ACCESS_TOKEN`);
      }

      try {
        const newsData = await UpstoxAPI.getNews({
          category,
          instrument_keys: instrumentKeys,
          page_number: pageNumber,
          page_size: pageSize,
        }, newsToken);
        writeJson(req, res, 200, newsData);
      } catch (upstoxErr) {
        console.warn(`[News] Upstox failed (${upstoxErr.message}), using free fallback...`);
        // Fallback: Google News RSS for the symbol
        try {
          const symForSearch = (instrumentKeys || "").split("|").pop()?.replace(/\+/g," ") || "Indian stock market";
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(symForSearch + " NSE stock")}&hl=en-IN&gl=IN&ceid=IN:en`;
          const rssRes = await fetch(rssUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; AnavAI/1.0)" }
          });
          const rssText = await rssRes.text();
          // Parse RSS items
          const items = [];
          const itemRegex = /<item>([\s\S]*?)<\/item>/g;
          let match;
          while ((match = itemRegex.exec(rssText)) !== null && items.length < 10) {
            const item = match[1];
            const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(item) || /<title>(.*?)<\/title>/.exec(item))?.[1] || "";
            const link  = (/<link>(.*?)<\/link>/.exec(item))?.[1]?.replace(/&amp;/g,"&") || "";
            const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(item))?.[1] || "";
            const source = (/<source[^>]*>(.*?)<\/source>/.exec(item))?.[1] || "Google News";
            if (title) items.push({
              id: `rss-${items.length}`,
              heading: title,
              article_link: link,
              published_time: pubDate ? new Date(pubDate).getTime() : Date.now(),
              source,
              thumbnail: null,
            });
          }
          const key = instrumentKeys || "market";
          writeJson(req, res, 200, {
            status: "success",
            data: { [key]: items },
            _source: "google_news_rss_fallback"
          });
        } catch (rssErr) {
          console.error(`[News RSS Fallback Error] ${rssErr.message}`);
          writeJson(req, res, 200, { status: "success", data: {}, _source: "empty_fallback" });
        }
      }
      return;
    }

    // ── /fundamentals — Company Fundamentals via open APIs ─────────────────
    if (req.method === "GET" && url.pathname === "/fundamentals") {
      const isin = url.searchParams.get("isin") || "";
      const symbol = url.searchParams.get("symbol") || "";
      const type = url.searchParams.get("type") || "profile";

      if (!isin && !symbol) {
        writeJson(req, res, 400, { status: "error", message: "isin or symbol required" });
        return;
      }

      try {
        // Try NSE India API for fundamentals (free, no auth)
        const nseSymbol = symbol.replace(/^NSE:/i, "").replace(/-EQ/gi, "").toUpperCase();
        let fundamentalData = null;

        // Fetch from NSE
        try {
          const nseRes = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(nseSymbol)}`, {
            headers: {
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Referer": "https://www.nseindia.com",
            }
          });
          if (nseRes.ok) {
            const nseData = await nseRes.json();
            const info = nseData?.info || {};
            const metadata = nseData?.metadata || {};
            const priceInfo = nseData?.priceInfo || {};
            fundamentalData = {
              company_name: info?.companyName || symbol,
              sector: info?.sector || info?.industry || "",
              isin: info?.isin || isin,
              business_description: info?.companyProfile || `${info?.companyName || symbol} is listed on NSE under ${info?.sector || "Indian"} sector.`,
              pe_ratio: Number(metadata?.pdSectorPe) || null,
              pb_ratio: Number(priceInfo?.pbRatio) || null,
              eps: Number(metadata?.eps) || null,
              market_cap: Number(metadata?.totalTradedValue) || null,
              week52High: Number(priceInfo?.weekHighLow?.max) || null,
              week52Low: Number(priceInfo?.weekHighLow?.min) || null,
              dividend_yield: Number(priceInfo?.dividendYield) || null,
              face_value: Number(metadata?.pdFaceValue) || null,
            };
            console.log(`[Fundamentals] NSE data fetched for ${nseSymbol}`);
          }
        } catch (nseErr) {
          console.warn("[Fundamentals] NSE fetch failed:", nseErr.message);
        }

        if (fundamentalData) {
          writeJson(req, res, 200, { status: "success", data: fundamentalData });
        } else {
          writeJson(req, res, 200, {
            status: "success",
            data: {
              company_name: symbol || isin,
              sector: "Data unavailable",
              isin,
              business_description: "Fundamental data not available. Please check symbol or try again.",
            }
          });
        }
      } catch (err) {
        writeJson(req, res, 500, { status: "error", message: err.message });
      }
      return;
    }

    // ── /api/assistant — AI Trading Assistant Chat ───────────────────────────
    if (req.method === "POST" && url.pathname === "/api/assistant") {
      const body = await readBody(req);
      const userMessage = String(body.message || "").trim();
      const context = body.context || {}; // current symbol data from frontend
      const history = Array.isArray(body.history) ? body.history.slice(-8) : []; // last 8 messages

      if (!userMessage) {
        writeJson(req, res, 400, { error: "message is required" });
        return;
      }

      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        writeJson(req, res, 200, {
          reply: "AI Assistant needs a GROQ_API_KEY in your .env file. Get one free at console.groq.com, then add GROQ_API_KEY=your_key to .env and restart the server."
        });
        return;
      }

      const systemPrompt = `You are ANAV AI — a professional Indian stock market assistant with expertise in Technical Analysis, F&O, Fundamentals, and Risk Management.

LIVE MARKET CONTEXT:
${context.symbol ? `Symbol: ${context.symbol} | LTP: ₹${context.price} | VWAP: ₹${context.vwap||'N/A'} | EMA20: ₹${context.ema20||'N/A'}` : "No symbol selected"}
${context.rsi ? `RSI: ${context.rsi} | Regime: ${context.regime||'N/A'} | Trend Consistency: ${context.trendConsistency||'N/A'}` : ""}
${context.verdict ? `AI Signal: ${context.verdict} @ ${context.confidence}% confidence` : ""}
${context.entry ? `Setup: Entry ₹${context.entry} → Target ₹${context.target} | SL ₹${context.stopLoss} | R:R ${context.riskReward}` : ""}
${context.support ? `Support: ₹${context.support} | Resistance: ₹${context.resistance}` : ""}
${context.macd ? `MACD: ${JSON.stringify(context.macd)}` : ""}
${context.supertrend ? `Supertrend: ${context.supertrend?.direction} @ ₹${context.supertrend?.value}` : ""}
${context.pcr ? `PCR: ${context.pcr} | Volume Ratio: ${context.volumeRatio||'N/A'}x` : ""}

RULES:
- Use ₹ for all prices. Cite exact price levels from context.
- For trade questions: give Entry, Target, SL with exact levels. Include R:R.
- For F&O questions: mention Delta, IV, OI. Suggest CE/PE strikes with strikes.
- Give clear directional views — don't say "it depends" without explanation.
- Always mention SL and position sizing (max 1-2% capital risk per trade).
- Never guarantee profits. Use "as per current technicals" / "indicator suggests".
- Format: **bold** key numbers. Bullets for lists. Max 150 words. Be precise.`;

      const messages = [
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: "user", content: userMessage }
      ];

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.35,
          max_tokens: 800,
          messages: [{ role: "system", content: systemPrompt }, ...messages]
        })
      });

      if (!groqRes.ok) {
        writeJson(req, res, 502, { error: "AI service unavailable. Check GROQ_API_KEY." });
        return;
      }

      const groqData = await groqRes.json();
      const reply = groqData?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response. Please try again.";
      writeJson(req, res, 200, { reply });
      return;
    }



  } catch (err) {
    console.error("Server error:", err.message);
    writeJson(req, res, 500, { status:"error", message: err.message || "Unexpected server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const apiStatus = UpstoxAPI.getConfigStatus();
  
  console.log(`\n🚀 ANAV PRO Local API Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Upstox API: ${apiStatus.isValid ? '✓ CONFIGURED' : '⚠ INCOMPLETE'}`);
  console.log(`   Sandbox Token: ${apiStatus.hasSandboxToken ? '✓ LOADED' : '✗ NOT SET'}`);
  console.log(`   Symbols: ${Object.keys(SYMBOL_TO_INSTRUMENT).length} mapped`);
  console.log(`   CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  
  if (!apiStatus.isValid) {
    console.log(`\n⚠️  WARNING: Missing configuration. Set these in .env:`);
    apiStatus.missingVars.forEach(v => console.log(`   - ${v}`));
    console.log(`\n   See .env.example for setup instructions\n`);
  } else {
    console.log(`\n✓ All systems ready!\n`);
  }
});
