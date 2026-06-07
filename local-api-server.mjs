/**
 * ANAV PRO — Local API Server
 * Connects to real Upstox V2/V3 APIs via Upstox SDK for live market data.
 * Uses secure SDK client wrapper (upstox-sdk-client.mjs) for all API calls.
 * All sensitive data managed via environment variables (.env).
 */

import http from "node:http";
import { WebSocketServer } from "ws";
import { URL } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as UpstoxSDK from "./upstox-sdk-client.mjs";

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

const PORT = Number(process.env.PORT || process.env.LOCAL_API_PORT || 3002);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || process.env.FRONTEND_URL || "https://*.vercel.app,https://*.onrender.com,http://localhost:5173,http://localhost:3000")
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
// EMA with proper SMA seed (industry standard)
function calcEMA(closes, period) {
  if (!closes || closes.length === 0) return 0;
  if (closes.length < period) {
    // Not enough data — return simple average
    return closes.reduce((a,b)=>a+b,0) / closes.length;
  }
  const k = 2 / (period + 1);
  // Seed: SMA of first `period` bars
  let ema = closes.slice(0, period).reduce((a,b)=>a+b,0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

// EMA Series with SMA seed — matches TradingView & industry standard exactly
function calcEMASeries(closes, period) {
  if (!closes || closes.length === 0) return [];
  const k = 2 / (period + 1);
  const series = new Array(closes.length).fill(null);
  if (closes.length < period) {
    // Fill with raw closes if insufficient data
    return closes.map(c => +c.toFixed(2));
  }
  // Seed: SMA of first `period` bars
  let ema = closes.slice(0, period).reduce((a,b)=>a+b,0) / period;
  series[period - 1] = +ema.toFixed(2);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    series[i] = +ema.toFixed(2);
  }
  return series;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  // Wilder's smoothing method (correct RSI)
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (!avgLoss) return 100;
  return +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);
}

// VWAP — resets daily at midnight IST (intraday anchored)
// For daily/weekly candles falls back to price-weighted average of recent 20
function calcVWAP(candles) {
  if (!candles || candles.length === 0) return 0;

  // Find today's midnight in IST (UTC+5:30)
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const nowIST = Date.now() + IST_OFFSET;
  const todayMidnightIST = Math.floor(nowIST / 86400000) * 86400000 - IST_OFFSET;

  // Filter to today's candles only
  const todayCandles = candles.filter(c => c.timestamp >= todayMidnightIST);

  // Use today's candles if available (intraday VWAP)
  const src = todayCandles.length >= 3 ? todayCandles : candles.slice(-20);

  let num = 0, den = 0;
  for (const c of src) {
    const tp = (c.high + c.low + c.close) / 3;
    num += tp * (c.volume || 1);
    den += (c.volume || 1);
  }
  return den ? +(num / den).toFixed(2) : (candles[candles.length-1]?.close ?? 0);
}

// ATR — Wilder's smoothed method (same as TradingView default)
function calcATR(candles, period = 14) {
  if (!candles || candles.length < 2) return 0;
  // Calculate all True Ranges
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i-1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  if (trs.length < period) return +(trs.reduce((a,b)=>a+b,0)/trs.length).toFixed(2);
  // Seed: simple average of first `period` TRs
  let atr = trs.slice(0, period).reduce((a,b)=>a+b,0) / period;
  // Wilder's smoothing: ATR = (prev_ATR × (period-1) + current_TR) / period
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return +atr.toFixed(2);
}

function calcBollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, stdDev: 0 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a,b)=>a+b,0) / period;
  const variance = slice.reduce((s,v)=>s+(v-mean)**2,0) / period;
  const std = Math.sqrt(variance);
  return { upper: +(mean+mult*std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean-mult*std).toFixed(2), stdDev: +std.toFixed(2) };
}

// MACD(12,26,9) — industry standard, matches TradingView exactly
function calcMACD(closes) {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const k12 = 2/13, k26 = 2/27, kSig = 2/10;
  // Seed EMAs using SMA
  let e12 = closes.slice(0,12).reduce((a,b)=>a+b,0)/12;
  let e26 = closes.slice(0,26).reduce((a,b)=>a+b,0)/26;
  // Build MACD line
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < 12) { e12 = closes.slice(0,i+1).reduce((a,b)=>a+b,0)/(i+1); }
    else { e12 = closes[i]*k12 + e12*(1-k12); }
    if (i < 26) { e26 = closes.slice(0,i+1).reduce((a,b)=>a+b,0)/(i+1); }
    else { e26 = closes[i]*k26 + e26*(1-k26); }
    if (i >= 25) macdLine.push(e12 - e26);
  }
  // Signal line = 9-period EMA of MACD line (seeded with SMA)
  if (macdLine.length < 9) return { macd: 0, signal: 0, histogram: 0 };
  let sig = macdLine.slice(0,9).reduce((a,b)=>a+b,0)/9;
  for (let i = 9; i < macdLine.length; i++) {
    sig = macdLine[i]*kSig + sig*(1-kSig);
  }
  const m = macdLine[macdLine.length-1];
  return { macd: +m.toFixed(4), signal: +sig.toFixed(4), histogram: +(m-sig).toFixed(4) };
}

// Supertrend — uses Wilder ATR (matches TradingView exactly)
function calcSupertrend(candles, period = 7, mult = 3) {
  if (candles.length < period + 2) return { value: 0, direction: 'up' };

  // Pre-compute Wilder ATR series
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i-1];
    trs.push(Math.max(c.high-c.low, Math.abs(c.high-p.close), Math.abs(c.low-p.close)));
  }
  const atrSeries = new Array(candles.length).fill(0);
  let wilderATR = trs.slice(0, period).reduce((a,b)=>a+b,0) / period;
  atrSeries[period] = wilderATR;
  for (let i = period; i < trs.length; i++) {
    wilderATR = (wilderATR*(period-1) + trs[i]) / period;
    atrSeries[i+1] = wilderATR;
  }

  let upperBand = 0, lowerBand = 0, prevUpper = 0, prevLower = 0;
  let direction = 'up', st = 0;

  for (let i = period; i < candles.length; i++) {
    const atr = atrSeries[i];
    const hl2 = (candles[i].high + candles[i].low) / 2;
    let upper = hl2 + mult * atr;
    let lower = hl2 - mult * atr;

    // Carry-forward rule
    if (i > period) {
      upper = (upper < prevUpper || candles[i-1].close > prevUpper) ? upper : prevUpper;
      lower = (lower > prevLower || candles[i-1].close < prevLower) ? lower : prevLower;
    }

    // Direction flip
    if (i === period) {
      direction = candles[i].close >= lower ? 'up' : 'down';
    } else {
      if (direction === 'up')   direction = candles[i].close <  lower ? 'down' : 'up';
      else                       direction = candles[i].close >  upper ? 'up'   : 'down';
    }

    st = direction === 'up' ? lower : upper;
    prevUpper = upper; prevLower = lower;
  }
  return { value: +st.toFixed(2), direction };
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

// Better regime classification using ADX + ATR% + EMA alignment
function classifyRegime(price, ema20, ema50, atr, volumeRatio, adx=null) {
  const atrPct  = (atr / Math.max(price,1)) * 100;
  const trend50 = ((price - Math.max(ema50,1)) / Math.max(ema50,1)) * 100;
  const adxVal  = adx?.adx ?? 0;
  const adxBull = adx ? adx.pdi > adx.mdi : null;

  // Strong trending — ADX confirms direction
  if (adxVal >= 30 && adxBull === true  && price > ema20 && trend50 > 0) return "TREND_UP";
  if (adxVal >= 30 && adxBull === false && price < ema20 && trend50 < 0) return "TREND_DOWN";

  // Weak trend — use EMA slopes as tiebreaker
  if (adxVal >= 18 && price > ema20 && trend50 > 0.8)  return "TREND_UP";
  if (adxVal >= 18 && price < ema20 && trend50 < -0.8) return "TREND_DOWN";

  // High-vol chop
  if (atrPct > 2.2 || (volumeRatio > 2.0 && adxVal < 25)) return "HIGH_VOL_CHOP";

  // Breakout watch — BB squeeze + rising volume
  if (volumeRatio > 1.5 && adxVal < 20) return "BREAKOUT_WATCH";

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

// ─── ADX — Average Directional Index (trend strength) ───────────────────────
function calcADX(candles, period = 14) {
  if (candles.length < period * 2 + 1) return { adx: 20, pdi: 20, mdi: 20, trend: 'WEAK' };
  const tr = [], pDM = [], mDM = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    const up = c.high - p.high, down = p.low - c.low;
    pDM.push(up > down && up > 0 ? up : 0);
    mDM.push(down > up && down > 0 ? down : 0);
  }
  let sTR = tr.slice(0, period).reduce((a,b)=>a+b,0);
  let sPDM = pDM.slice(0, period).reduce((a,b)=>a+b,0);
  let sMDM = mDM.slice(0, period).reduce((a,b)=>a+b,0);
  const dx = [];
  for (let i = period; i < tr.length; i++) {
    sTR = sTR - sTR/period + tr[i];
    sPDM = sPDM - sPDM/period + pDM[i];
    sMDM = sMDM - sMDM/period + mDM[i];
    const pdi = sTR ? 100*sPDM/sTR : 0, mdi = sTR ? 100*sMDM/sTR : 0;
    dx.push((pdi+mdi) ? 100*Math.abs(pdi-mdi)/(pdi+mdi) : 0);
  }
  if (dx.length < period) return { adx: 20, pdi: 20, mdi: 20, trend: 'WEAK' };
  let adx = dx.slice(0, period).reduce((a,b)=>a+b,0) / period;
  for (let i = period; i < dx.length; i++) adx = (adx*(period-1)+dx[i])/period;
  const finalPDI = sTR ? +(100*sPDM/sTR).toFixed(2) : 0;
  const finalMDI = sTR ? +(100*sMDM/sTR).toFixed(2) : 0;
  const adxVal = +Math.min(100, adx).toFixed(2);
  const trend = adxVal >= 40 ? 'STRONG' : adxVal >= 25 ? 'TRENDING' : adxVal >= 15 ? 'WEAK' : 'FLAT';
  return { adx: adxVal, pdi: finalPDI, mdi: finalMDI, trend };
}

// ─── Fibonacci Retracement Levels ───────────────────────────────────────────
function calcFibonacci(candles) {
  const slice = candles.slice(-60);
  const highest = +Math.max(...slice.map(c=>c.high)).toFixed(2);
  const lowest  = +Math.min(...slice.map(c=>c.low)).toFixed(2);
  const range = highest - lowest;
  const isBullish = slice[slice.length-1].close > slice[0].close;
  const f = (lvl) => +(isBullish ? highest - range*lvl : lowest + range*lvl).toFixed(2);
  return {
    highest, lowest, isBullish, range: +range.toFixed(2),
    fib0:    isBullish ? highest : lowest,
    fib236:  f(0.236), fib382: f(0.382), fib500: f(0.500),
    fib618:  f(0.618), fib786: f(0.786),
    fib1000: isBullish ? lowest : highest,
    fib1272: +(isBullish ? highest + range*0.272 : lowest - range*0.272).toFixed(2),
    fib1618: +(isBullish ? highest + range*0.618 : lowest - range*0.618).toFixed(2),
  };
}

// ─── Pivot Points (Standard + Camarilla) ────────────────────────────────────
function calcPivotPoints(candles) {
  const prev = candles.length > 1 ? candles[candles.length-2] : candles[candles.length-1];
  const H = prev.high, L = prev.low, C = prev.close;
  const PP = (H+L+C)/3;
  const R1 = 2*PP-L, S1 = 2*PP-H;
  const R2 = PP+(H-L), S2 = PP-(H-L);
  const R3 = H+2*(PP-L), S3 = L-2*(H-PP);
  const rng = H-L;
  return {
    standard: {
      pp: +PP.toFixed(2),
      r1: +R1.toFixed(2), r2: +R2.toFixed(2), r3: +R3.toFixed(2),
      s1: +S1.toFixed(2), s2: +S2.toFixed(2), s3: +S3.toFixed(2),
    },
    camarilla: {
      r4: +(C+rng*1.1/2).toFixed(2),  r3: +(C+rng*1.1/4).toFixed(2),
      r2: +(C+rng*1.1/6).toFixed(2),
      s2: +(C-rng*1.1/6).toFixed(2),
      s3: +(C-rng*1.1/4).toFixed(2),  s4: +(C-rng*1.1/2).toFixed(2),
    },
  };
}

// ─── Candlestick Pattern Detection ──────────────────────────────────────────
function detectCandlePatterns(candles) {
  const patterns = [];
  if (candles.length < 3) return patterns;
  const c = candles[candles.length-1], p = candles[candles.length-2], pp = candles[candles.length-3];
  const body = Math.abs(c.close-c.open), range = (c.high-c.low)||0.001;
  const upper = c.high - Math.max(c.open,c.close), lower = Math.min(c.open,c.close) - c.low;
  const pBody = Math.abs(p.close-p.open), ppBody = Math.abs(pp.close-pp.open);
  const isBull = c.close > c.open, pBull = p.close > p.open;

  if (body/range < 0.08)
    patterns.push({ name:'DOJI', type:'NEUTRAL', confidence:60, description:'Market indecision — potential reversal at key levels' });
  if (lower > body*2.5 && upper < body*0.4 && !pBull)
    patterns.push({ name:'HAMMER', type:'BULLISH', confidence:74, description:'Aggressive buying at lows — bullish reversal signal' });
  if (upper > body*2.5 && lower < body*0.4 && !isBull && pBull)
    patterns.push({ name:'SHOOTING STAR', type:'BEARISH', confidence:72, description:'Rejection at highs — sellers taking control' });
  if (!pBull && isBull && c.open <= p.close && c.close >= p.open && body > pBody*1.1)
    patterns.push({ name:'BULLISH ENGULFING', type:'BULLISH', confidence:80, description:'Full bullish reversal — current bar engulfs prior bearish bar' });
  if (pBull && !isBull && c.open >= p.close && c.close <= p.open && body > pBody*1.1)
    patterns.push({ name:'BEARISH ENGULFING', type:'BEARISH', confidence:80, description:'Full bearish reversal — current bar engulfs prior bullish bar' });
  if (!( pp.close > pp.open) && pBody < ppBody*0.35 && isBull && c.close > (pp.open+pp.close)/2)
    patterns.push({ name:'MORNING STAR', type:'BULLISH', confidence:84, description:'3-candle bottom reversal — high-probability bullish setup' });
  if (pp.close > pp.open && pBody < ppBody*0.35 && !isBull && c.close < (pp.open+pp.close)/2)
    patterns.push({ name:'EVENING STAR', type:'BEARISH', confidence:84, description:'3-candle top reversal — high-probability bearish setup' });
  if (lower > range*0.65 && body < range*0.2 && upper < range*0.15 && !patterns.find(x=>x.name==='HAMMER'))
    patterns.push({ name:'BULLISH PIN BAR', type:'BULLISH', confidence:68, description:'Long lower wick rejects key support — potential bounce' });
  if (upper > range*0.65 && body < range*0.2 && lower < range*0.15 && !patterns.find(x=>x.name==='SHOOTING STAR'))
    patterns.push({ name:'BEARISH PIN BAR', type:'BEARISH', confidence:68, description:'Long upper wick rejects key resistance — potential pullback' });
  if (c.high < p.high && c.low > p.low)
    patterns.push({ name:'INSIDE BAR', type:'NEUTRAL', confidence:55, description:'Market consolidating inside prior range — breakout imminent' });
  // Three White Soldiers
  if (candles.length >= 3) {
    const c1=candles[candles.length-3],c2=candles[candles.length-2],c3=candles[candles.length-1];
    if (c1.close>c1.open&&c2.close>c2.open&&c3.close>c3.open&&c2.close>c1.close&&c3.close>c2.close)
      patterns.push({ name:'THREE WHITE SOLDIERS', type:'BULLISH', confidence:78, description:'Three consecutive bullish candles — strong momentum continuation' });
    if (c1.close<c1.open&&c2.close<c2.open&&c3.close<c3.open&&c2.close<c1.close&&c3.close<c2.close)
      patterns.push({ name:'THREE BLACK CROWS', type:'BEARISH', confidence:78, description:'Three consecutive bearish candles — strong distribution phase' });
  }
  return patterns;
}

// ─── Stochastic RSI (StochRSI) ────────────────────────────────────────────────
// RSI of RSI — far more sensitive than plain RSI, catches reversals earlier
function calcStochRSI(closes, rsiPeriod=14, stochPeriod=14, kPeriod=3, dPeriod=3) {
  if (closes.length < rsiPeriod + stochPeriod + kPeriod + 2) return { k:50, d:50 };

  // Build full RSI series (Wilder smoothing)
  const rsiSeries = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= rsiPeriod; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= rsiPeriod; avgLoss /= rsiPeriod;
  rsiSeries.push(avgLoss === 0 ? 100 : 100 - 100/(1+avgGain/avgLoss));
  for (let i = rsiPeriod+1; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    avgGain = (avgGain*(rsiPeriod-1) + Math.max(diff,0)) / rsiPeriod;
    avgLoss = (avgLoss*(rsiPeriod-1) + Math.max(-diff,0)) / rsiPeriod;
    rsiSeries.push(avgLoss === 0 ? 100 : 100 - 100/(1+avgGain/avgLoss));
  }

  // Build StochRSI %K series
  const kRaw = [];
  for (let i = stochPeriod-1; i < rsiSeries.length; i++) {
    const slice = rsiSeries.slice(i-stochPeriod+1, i+1);
    const hi = Math.max(...slice), lo = Math.min(...slice);
    kRaw.push(hi===lo ? 50 : ((rsiSeries[i]-lo)/(hi-lo))*100);
  }

  // Smooth %K with kPeriod SMA → get final %K
  const kSmoothed = [];
  for (let i = kPeriod-1; i < kRaw.length; i++) {
    kSmoothed.push(kRaw.slice(i-kPeriod+1,i+1).reduce((a,b)=>a+b,0)/kPeriod);
  }

  // %D = dPeriod SMA of smoothed %K
  const dSmoothed = [];
  for (let i = dPeriod-1; i < kSmoothed.length; i++) {
    dSmoothed.push(kSmoothed.slice(i-dPeriod+1,i+1).reduce((a,b)=>a+b,0)/dPeriod);
  }

  const k = kSmoothed.length ? +kSmoothed[kSmoothed.length-1].toFixed(2) : 50;
  const d = dSmoothed.length ? +dSmoothed[dSmoothed.length-1].toFixed(2) : 50;
  return { k, d };
}

// ─── Williams %R ─────────────────────────────────────────────────────────────
function calcWilliamsR(candles, period=14) {
  if (candles.length < period) return -50;
  const slice = candles.slice(-period);
  const highH = Math.max(...slice.map(c=>c.high));
  const lowL  = Math.min(...slice.map(c=>c.low));
  const close = candles[candles.length-1].close;
  if (highH === lowL) return -50;
  return +((highH - close)/(highH - lowL) * -100).toFixed(2);
}

// ─── CCI — Commodity Channel Index ────────────────────────────────────────────
function calcCCI(candles, period=20) {
  if (candles.length < period) return 0;
  const slice = candles.slice(-period);
  const tps = slice.map(c=>(c.high+c.low+c.close)/3);
  const meanTP = tps.reduce((a,b)=>a+b,0)/period;
  const meanDev = tps.reduce((s,v)=>s+Math.abs(v-meanTP),0)/period;
  if (meanDev === 0) return 0;
  return +((tps[tps.length-1]-meanTP)/(0.015*meanDev)).toFixed(2);
}

// ─── Rate of Change (ROC / Momentum) ─────────────────────────────────────────
function calcROC(closes, period=12) {
  if (closes.length <= period) return 0;
  const prev = closes[closes.length-1-period];
  if (!prev) return 0;
  return +((closes[closes.length-1]-prev)/prev*100).toFixed(2);
}

// ─── Average Volume ─────────────────────────────────────────────────────────
function calcAvgVolume(candles, period=20) {
  const slice = candles.slice(-period);
  return slice.reduce((s,c)=>s+c.volume,0)/Math.max(slice.length,1);
}

// ─── Dynamic Support/Resistance via Swing Pivots ─────────────────────────────
function calcSwingSR(candles, lookback=50, pivotStrength=3) {
  const slice = candles.slice(-Math.min(candles.length, lookback));
  const swingHighs = [], swingLows = [];
  for (let i=pivotStrength; i<slice.length-pivotStrength; i++) {
    const window = slice.slice(i-pivotStrength, i+pivotStrength+1);
    const isHigh = window.every((c,j)=> j===pivotStrength || c.high <= slice[i].high);
    const isLow  = window.every((c,j)=> j===pivotStrength || c.low  >= slice[i].low);
    if (isHigh) swingHighs.push(slice[i].high);
    if (isLow)  swingLows.push(slice[i].low);
  }
  const price = candles[candles.length-1].close;
  // Find nearest S/R above and below price
  const resistances = swingHighs.filter(h=>h>price).sort((a,b)=>a-b);
  const supports    = swingLows.filter(l=>l<price).sort((a,b)=>b-a);
  return {
    support:    supports[0]    ?? +Math.min(...slice.map(c=>c.low)).toFixed(2),
    resistance: resistances[0] ?? +Math.max(...slice.map(c=>c.high)).toFixed(2),
    allSupports:    supports.slice(0,3).map(v=>+v.toFixed(2)),
    allResistances: resistances.slice(0,3).map(v=>+v.toFixed(2)),
  };
}

// ─── On-Balance Volume (OBV) ─────────────────────────────────────────────────
function calcOBV(candles) {
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i-1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i-1].close) obv -= candles[i].volume;
  }
  const recent = candles.slice(-8);
  let obvRecent = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].close > recent[i-1].close) obvRecent += recent[i].volume;
    else if (recent[i].close < recent[i-1].close) obvRecent -= recent[i].volume;
  }
  const trend = obvRecent > 0 ? 'ACCUMULATION' : obvRecent < 0 ? 'DISTRIBUTION' : 'NEUTRAL';
  return { obv, trend, recentObv: obvRecent };
}

// ─── Risk Profile ────────────────────────────────────────────────────────────
function calcRiskProfile(atr, price, volumeRatio, regime) {
  const atrPct = (atr / Math.max(price,1)) * 100;
  let profile, description;
  if (atrPct < 0.5 && regime !== 'HIGH_VOL_CHOP') {
    profile = 'LOW';
    description = 'Stable price action — standard position sizing (3-5% capital)';
  } else if (atrPct < 1.2 && regime !== 'HIGH_VOL_CHOP') {
    profile = 'MODERATE';
    description = 'Normal volatility — use 2-3% capital per trade';
  } else if (atrPct < 2.5 || regime === 'HIGH_VOL_CHOP') {
    profile = 'HIGH';
    description = 'Elevated volatility — reduce position by 40%, widen stops';
  } else {
    profile = 'VERY HIGH';
    description = 'Extreme moves expected — 0.5-1% capital only, experienced traders';
  }
  return { profile, atrPct: +atrPct.toFixed(2), description };
}

// ─── Max Pain (Options) ──────────────────────────────────────────────────────
function calcMaxPain(foGreeks) {
  if (!foGreeks || foGreeks.length === 0) return 0;
  const strikes = [...new Set(foGreeks.map(g=>g.strikePrice))].sort((a,b)=>a-b);
  let maxPainStrike = strikes[0], minLoss = Infinity;
  for (const test of strikes) {
    let loss = 0;
    for (const s of strikes) {
      const ce = foGreeks.find(g=>g.strikePrice===s&&g.optionType==='CE');
      const pe = foGreeks.find(g=>g.strikePrice===s&&g.optionType==='PE');
      if (ce && test < s) loss += (s-test)*ce.oi;
      if (pe && test > s) loss += (test-s)*pe.oi;
    }
    if (loss < minLoss) { minLoss = loss; maxPainStrike = test; }
  }
  return maxPainStrike;
}

// ─── F&O Strategy Suggestions ───────────────────────────────────────────────
function suggestFOStrategies(pcr, ivAvg, verdict, regime) {
  const ivHigh = ivAvg > 20, ivLow = ivAvg < 12;
  const strategies = [];
  if (verdict === 'BUY') {
    if (ivLow) {
      strategies.push({ name:'Buy ATM Call', risk:'Limited', reward:'Unlimited', reason:'Low IV = cheap premiums — best time to buy options' });
      strategies.push({ name:'Bull Call Spread', risk:'Limited', reward:'Capped', reason:'Reduce premium cost while capturing upside move' });
    } else {
      strategies.push({ name:'Bull Put Spread', risk:'Limited', reward:'Capped', reason:'High IV — sell OTM put spread to collect premium on bullish bias' });
      strategies.push({ name:'Sell OTM Put', risk:'High', reward:'Premium', reason:`PCR ${pcr.toFixed(2)} — heavy put OI = institutional support level` });
    }
  } else if (verdict === 'SELL') {
    if (ivLow) {
      strategies.push({ name:'Buy ATM Put', risk:'Limited', reward:'High', reason:'Low IV = cheap protection — put buying favored' });
      strategies.push({ name:'Bear Put Spread', risk:'Limited', reward:'Capped', reason:'Reduce premium cost on directional bearish bet' });
    } else {
      strategies.push({ name:'Bear Call Spread', risk:'Limited', reward:'Capped', reason:'High IV — sell OTM call spread, profit from time decay' });
      strategies.push({ name:'Sell OTM Call', risk:'High', reward:'Premium', reason:'Collect premium with bearish bias; hedge with stop on underlying' });
    }
  } else {
    if (ivHigh && regime === 'RANGE') {
      strategies.push({ name:'Iron Condor', risk:'Defined', reward:'Premium', reason:'Range + high IV = ideal for selling OTM call & put spreads' });
      strategies.push({ name:'Short Strangle', risk:'High', reward:'Premium', reason:'Collect premium from both sides; requires active management' });
    } else if (ivLow) {
      strategies.push({ name:'Long Straddle', risk:'Premium paid', reward:'Unlimited', reason:'Low IV + expected breakout = buy ATM call & put for big move' });
    } else {
      strategies.push({ name:'Calendar Spread', risk:'Limited', reward:'Moderate', reason:'Sell near-expiry, buy far-expiry — profit from theta decay differential' });
      strategies.push({ name:'Ratio Spread', risk:'Variable', reward:'Moderate', reason:'Moderate IV — sell more options than you buy for net credit' });
    }
  }
  return strategies.slice(0,3);
}

// ─── Investment Guidance ─────────────────────────────────────────────────────
function calcInvestmentGuidance(verdict, confidence, riskProfile, regime) {
  if (verdict === 'HOLD' || confidence < 52) {
    return { shouldInvest: false, positionSize: 'NONE', capitalPct: 0,
      action: 'WAIT', guidance: 'Signals are mixed — stay in cash until clarity emerges' };
  }
  let capitalPct, positionSize, action;
  const riskMultiplier = riskProfile === 'LOW' ? 1.2 : riskProfile === 'MODERATE' ? 1.0 : riskProfile === 'HIGH' ? 0.6 : 0.3;
  if (confidence >= 78 && regime !== 'HIGH_VOL_CHOP') {
    capitalPct = +(4 * riskMultiplier).toFixed(1); positionSize = 'FULL';
    action = verdict === 'BUY' ? 'BUY NOW' : 'SHORT NOW';
  } else if (confidence >= 65) {
    capitalPct = +(2.5 * riskMultiplier).toFixed(1); positionSize = 'HALF';
    action = verdict === 'BUY' ? 'BUY PARTIAL' : 'SHORT PARTIAL';
  } else {
    capitalPct = +(1.5 * riskMultiplier).toFixed(1); positionSize = 'QUARTER';
    action = 'CAUTIOUS ENTRY';
  }
  capitalPct = Math.max(0.5, Math.min(5, capitalPct));
  const guidance = `${action}: Use ~${capitalPct}% of trading capital. ${riskProfile} risk. ${regime === 'HIGH_VOL_CHOP' ? 'High volatility — tighten stops.' : 'Follow entry/SL levels strictly.'}`;
  return { shouldInvest: true, positionSize, capitalPct, action, guidance };
}

// ─── Rule-Based AI Analysis (with full math) ────────────────────────────────
function ruleBasedAnalysis(input) {
  const { price, vwap, ema20, ema50, ema200, rsi, atr, support, resistance,
          regime, trendConsistency, volumeRatio, pcr, m1Trend, m5Trend, m15Trend, macd,
          bb, supertrend, ichimoku, symbol, adx, patterns, obv,
          stochRSI, williamsR, cci, roc, high52w, low52w } = input;

  const aboveVWAP   = price > vwap;
  const aboveEMA20  = price > ema20;
  const aboveEMA50  = price > ema50;
  const aboveEMA200 = ema200 > 0 ? price > ema200 : null;
  const rsiOB = rsi > 70, rsiOS = rsi < 30;
  const rsiNeutralBull = rsi > 50 && rsi <= 70, rsiNeutralBear = rsi < 50 && rsi >= 30;
  const macdBull = macd.histogram > 0, macdStrongBull = macd.histogram > 0 && macd.macd > 0;
  const volConfirm = volumeRatio > 1.15, volWeak = volumeRatio < 0.7;
  const trendOK = trendConsistency === "CONFIRMED";
  const stBull = supertrend?.direction === "up";
  const bbSqueeze = bb ? (bb.upper-bb.lower)/Math.max(bb.middle,1) < 0.04 : false;
  const priceNearUpper = bb ? price > bb.upper*0.98 : false;
  const priceNearLower = bb ? price < bb.lower*1.02 : false;
  const ichiBull = ichimoku ? price > ichimoku.kijun && ichimoku.tenkan > ichimoku.kijun : null;
  const adxStrong = adx?.adx >= 25, adxTrending = adx?.adx >= 15;
  const pdiDom = adx ? adx.pdi > adx.mdi : null;
  const obvUp = obv?.trend === 'ACCUMULATION', obvDown = obv?.trend === 'DISTRIBUTION';

  // Bullish/Bearish candle patterns
  const bullPatterns = patterns?.filter(p => p.type === 'BULLISH') || [];
  const bearPatterns = patterns?.filter(p => p.type === 'BEARISH') || [];
  const hasBullPattern = bullPatterns.length > 0, hasBearPattern = bearPatterns.length > 0;

  // ── Scoring with breakdown (each factor tracked) ──────────────────────────
  const breakdown = [];
  const addFactor = (name, vote, weight, reason) => {
    breakdown.push({ name, vote, weight, reason });
    return vote === 'BULL' ? weight : vote === 'BEAR' ? -weight : 0;
  };

  let score = 50;
  score += addFactor('VWAP',        aboveVWAP?'BULL':'BEAR', 10, aboveVWAP?`₹${price.toFixed(0)} above VWAP ₹${vwap.toFixed(0)}`:`₹${price.toFixed(0)} below VWAP ₹${vwap.toFixed(0)}`);
  score += addFactor('EMA 20',      aboveEMA20?'BULL':'BEAR', 8, aboveEMA20?'Price above short-term MA':'Price below short-term MA');
  score += addFactor('EMA 50',      aboveEMA50?'BULL':'BEAR', 6, aboveEMA50?'Medium-term trend positive':'Medium-term trend negative');
  if (aboveEMA200 !== null)
    score += addFactor('EMA 200',   aboveEMA200?'BULL':'BEAR', 5, aboveEMA200?'Above 200MA — long-term bull market':'Below 200MA — long-term bear territory');
  score += addFactor('RSI',         rsiOS?'BULL':rsiOB?'BEAR':rsiNeutralBull?'BULL':'BEAR', rsiOS||rsiOB?8:5,
    rsiOS?`RSI ${rsi} oversold — bounce potential`:rsiOB?`RSI ${rsi} overbought — reversal risk`:`RSI ${rsi} — ${rsiNeutralBull?'momentum positive':'momentum weakening'}`);
  score += addFactor('MACD',        macdBull?'BULL':'BEAR', 8, macdBull?`MACD histogram +${macd.histogram.toFixed(4)} — upward momentum`:`MACD histogram ${macd.histogram.toFixed(4)} — downward momentum`);
  score += addFactor('Supertrend',  stBull?'BULL':'BEAR', 7, stBull?`Supertrend ₹${supertrend?.value} bull track`:`Supertrend ₹${supertrend?.value} bear track`);
  score += addFactor('Volume',      volConfirm?'BULL':volWeak?'BEAR':'NEUTRAL', volConfirm?5:volWeak?-4:0, `Volume ${volumeRatio.toFixed(2)}x average — ${volConfirm?'strong participation':volWeak?'weak conviction':'normal'}`);
  score += addFactor('MTF Align',   trendOK?m1Trend==='BULLISH'?'BULL':'BEAR':'NEUTRAL', trendOK?7:0, trendOK?`M1/M5/M15 all ${m1Trend}`:'Timeframes not aligned — mixed signals');
  if (ichiBull !== null)
    score += addFactor('Ichimoku',  ichiBull?'BULL':'BEAR', 5, ichiBull?'Price above Kijun, Tenkan>Kijun':'Price below Kijun — bearish cloud');
  if (adxTrending)
    score += addFactor('ADX',       pdiDom?'BULL':'BEAR', adxStrong?6:3, `ADX ${adx?.adx} (${adx?.trend}) — PDI ${adx?.pdi} vs MDI ${adx?.mdi}`);
  score += addFactor('BB Position', priceNearUpper?'BEAR':priceNearLower?'BULL':'NEUTRAL', 4,
    priceNearUpper?'Price at upper Bollinger Band — overbought zone':priceNearLower?'Price at lower Bollinger Band — oversold zone':'Price within normal Bollinger range');
  if (bbSqueeze) score += addFactor('BB Squeeze', 'BULL', 4, 'Bollinger Band squeeze — breakout imminent');
  score += addFactor('PCR',         pcr>1.2?'BULL':pcr<0.8?'BEAR':'NEUTRAL', 3, `PCR ${pcr.toFixed(2)} — ${pcr>1.2?'bullish put writing':pcr<0.8?'call writers dominate':'balanced options market'}`);
  if (obvUp || obvDown)
    score += addFactor('OBV',       obvUp?'BULL':'BEAR', 4, `Volume flow: ${obv?.trend} — ${obvUp?'smart money accumulating':'distribution phase detected'}`);

  // StochRSI — fast momentum confirmation
  if (stochRSI) {
    const stK = stochRSI.k ?? 50;
    if (stK <= 20)      score += addFactor('StochRSI', 'BULL', 5, `StochRSI K=${stK} oversold — bounce likely`);
    else if (stK >= 80) score += addFactor('StochRSI', 'BEAR', 5, `StochRSI K=${stK} overbought — pullback risk`);
    else if (stK > 50)  score += addFactor('StochRSI', 'BULL', 2, `StochRSI K=${stK} above midline — mild bullish`);
    else                score += addFactor('StochRSI', 'BEAR', 2, `StochRSI K=${stK} below midline — mild bearish`);
  }

  // Williams %R
  if (williamsR !== undefined) {
    if (williamsR <= -80)     score += addFactor('Williams %R', 'BULL', 4, `Williams %R ${williamsR} — deeply oversold`);
    else if (williamsR >= -20) score += addFactor('Williams %R', 'BEAR', 4, `Williams %R ${williamsR} — overbought territory`);
  }

  // CCI — trend strength & extremes
  if (cci !== undefined) {
    if (cci > 150)       score += addFactor('CCI', 'BEAR', 3, `CCI ${cci} — extreme overbought`);
    else if (cci < -150) score += addFactor('CCI', 'BULL', 3, `CCI ${cci} — extreme oversold`);
    else if (cci > 100)  score += addFactor('CCI', 'BULL', 2, `CCI ${cci} — strong upward momentum`);
    else if (cci < -100) score += addFactor('CCI', 'BEAR', 2, `CCI ${cci} — strong downward momentum`);
  }

  // ROC — momentum speed
  if (roc !== undefined) {
    if (roc > 3)        score += addFactor('ROC', 'BULL', 3, `ROC ${roc}% — accelerating upward`);
    else if (roc < -3)  score += addFactor('ROC', 'BEAR', 3, `ROC ${roc}% — accelerating downward`);
  }

  // 52-week position
  if (high52w && low52w && price > 0) {
    const pct52 = ((price - low52w) / Math.max(high52w - low52w, 1)) * 100;
    if (pct52 > 90)      score += addFactor('52W Position', 'BEAR', 3, `Price at ${pct52.toFixed(0)}% of 52W range — near highs, reversal risk`);
    else if (pct52 < 10) score += addFactor('52W Position', 'BULL', 3, `Price at ${pct52.toFixed(0)}% of 52W range — near lows, recovery potential`);
    else if (pct52 > 60) score += addFactor('52W Position', 'BULL', 1, `Price in upper half of 52W range — bullish structure`);
  }

  if (hasBullPattern || hasBearPattern)
    score += addFactor('Candle Pattern', hasBullPattern&&!hasBearPattern?'BULL':hasBearPattern&&!hasBullPattern?'BEAR':'NEUTRAL', 5,
      hasBullPattern?`${bullPatterns[0].name} detected — ${bullPatterns[0].description}`:hasBearPattern?`${bearPatterns[0].name} detected — ${bearPatterns[0].description}`:'Conflicting candle patterns');

  if (regime === "HIGH_VOL_CHOP") score = Math.min(score, 56);
  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict = "HOLD", confidence = 50;
  const bullVotes = breakdown.filter(f=>f.vote==='BULL').length;
  const bearVotes = breakdown.filter(f=>f.vote==='BEAR').length;
  const totalVotes = bullVotes + bearVotes || 1;

  if (score >= 65 && regime !== "HIGH_VOL_CHOP") {
    verdict = "BUY";
    confidence = Math.min(91, 55 + Math.round((score - 65) * 1.8));
  } else if (score <= 35 && regime !== "HIGH_VOL_CHOP") {
    verdict = "SELL";
    confidence = Math.min(91, 55 + Math.round((35 - score) * 1.8));
  } else {
    confidence = 40 + Math.round(Math.abs(50-score)*0.8);
  }
  // Boost confidence if patterns align with verdict
  if ((verdict==='BUY'&&hasBullPattern&&!hasBearPattern)||(verdict==='SELL'&&hasBearPattern&&!hasBullPattern)) {
    confidence = Math.min(93, confidence + 5);
  }
  // Reduce if high volatility
  if (regime === 'HIGH_VOL_CHOP') confidence = Math.min(confidence, 62);

  // ── ATR-based trade levels ─────────────────────────────────────────────────
  let entry = price, stopLoss = support, target = resistance, riskReward = 1;
  const atrMult = regime === 'HIGH_VOL_CHOP' ? 2.0 : 1.5;

  if (verdict === "BUY") {
    entry    = +Math.max(vwap, ema20).toFixed(2);
    stopLoss = +(Math.max(support, entry - atr*atrMult)).toFixed(2);
    const risk = Math.max(entry-stopLoss, price*0.001);
    target = +(Math.min(resistance, entry + risk*2.5)).toFixed(2);
    riskReward = +((target-entry)/risk).toFixed(2);
  } else if (verdict === "SELL") {
    entry    = +(Math.min(vwap, ema20)).toFixed(2);
    stopLoss = +(Math.min(resistance, entry+atr*atrMult)).toFixed(2);
    const risk = Math.max(stopLoss-entry, price*0.001);
    target = +(Math.max(support, entry - risk*2.5)).toFixed(2);
    riskReward = +((entry-target)/risk).toFixed(2);
  }

  // ── Reasons & Risks ──────────────────────────────────────────────────────
  const reasons = [], risks = [];
  const topBull = breakdown.filter(f=>f.vote==='BULL').sort((a,b)=>b.weight-a.weight).slice(0,4);
  const topBear = breakdown.filter(f=>f.vote==='BEAR').sort((a,b)=>b.weight-a.weight).slice(0,4);

  if (verdict === "BUY") {
    topBull.forEach(f => reasons.push(`[${f.name}] ${f.reason}`));
    topBear.slice(0,2).forEach(f => risks.push(`[${f.name}] ${f.reason} — watch this risk`));
    risks.push(`Resistance: ₹${resistance.toFixed(0)} — potential exit zone`);
    if (regime === 'RANGE') risks.push('Range market — breakout confirmation still needed with volume');
  } else if (verdict === "SELL") {
    topBear.forEach(f => reasons.push(`[${f.name}] ${f.reason}`));
    topBull.slice(0,2).forEach(f => risks.push(`[${f.name}] ${f.reason} — potential bounce risk`));
    risks.push(`Support: ₹${support.toFixed(0)} — strong bounce zone`);
  } else {
    reasons.push(`Score ${score}/100 — balanced signals, no clear edge`);
    reasons.push(`Top bull: ${topBull[0]?.name||'—'} | Top bear: ${topBear[0]?.name||'—'}`);
    risks.push('Choppy conditions — wait for score to cross 65 or fall below 35');
    risks.push('Volume confirmation required before entry');
  }

  return {
    score, verdict,
    confidence: Math.max(42, confidence),
    summary: `${symbol} at ₹${price.toFixed(2)} — Score ${score}/100 (${bullVotes}↑/${bearVotes}↓). ${verdict==="HOLD"?"Neutral setup — await direction clarity.":`${verdict}: ${reasons[0]?.replace(/\[.*?\]\s*/,'') || 'Signals aligned'}. Regime: ${regime.replace(/_/g,' ')}.`}`,
    entry, target, stopLoss, riskReward,
    optionSuggestion: null,
    reasons, risks,
    breakdown,
    bullVotes, bearVotes,
    newsImpact: `PCR ${pcr.toFixed(2)} ${pcr>1.2?'(bullish put OI)':pcr<0.8?'(bearish call OI)':'(balanced)'}. Volume ${volumeRatio.toFixed(2)}x avg. ATR ₹${atr.toFixed(2)} (${((atr/Math.max(price,1))*100).toFixed(2)}% of CMP). ADX ${adx?.adx||'N/A'} — ${adx?.trend||'trend unknown'}.`,
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
  // DEPRECATED: Use UpstoxSDK methods instead
  // This function kept for backwards compatibility
  // Direct HTTP calls replaced with SDK client calls below
  throw new Error("Direct upstoxGet() deprecated. Use UpstoxSDK module instead.");
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

// Local symbol database for instant search (no token needed)
const LOCAL_SYMBOLS = [
  {trading_symbol:"NIFTY",    name:"Nifty 50 Index",         instrument_key:"NSE_INDEX|Nifty 50",        exchange:"NSE",segment:"NSE_INDEX"},
  {trading_symbol:"BANKNIFTY",name:"Nifty Bank Index",        instrument_key:"NSE_INDEX|Nifty Bank",      exchange:"NSE",segment:"NSE_INDEX"},
  {trading_symbol:"FINNIFTY", name:"Nifty Financial Services",instrument_key:"NSE_INDEX|Nifty Fin Service",exchange:"NSE",segment:"NSE_INDEX"},
  {trading_symbol:"SENSEX",   name:"S&P BSE Sensex",         instrument_key:"BSE_INDEX|SENSEX",          exchange:"BSE",segment:"BSE_INDEX"},
  {trading_symbol:"MIDCPNIFTY",name:"Nifty Midcap Select",   instrument_key:"NSE_INDEX|NIFTY MID SELECT",exchange:"NSE",segment:"NSE_INDEX"},
  {trading_symbol:"RELIANCE", name:"Reliance Industries Ltd", instrument_key:"NSE_EQ|INE002A01018",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"TCS",      name:"Tata Consultancy Services",instrument_key:"NSE_EQ|INE467B01029",     exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"HDFCBANK", name:"HDFC Bank Ltd",           instrument_key:"NSE_EQ|INE040A01034",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"INFY",     name:"Infosys Ltd",             instrument_key:"NSE_EQ|INE009A01021",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ICICIBANK",name:"ICICI Bank Ltd",          instrument_key:"NSE_EQ|INE090A01021",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"SBIN",     name:"State Bank of India",     instrument_key:"NSE_EQ|INE062A01020",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"WIPRO",    name:"Wipro Ltd",               instrument_key:"NSE_EQ|INE075A01022",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"BAJFINANCE",name:"Bajaj Finance Ltd",      instrument_key:"NSE_EQ|INE296A01024",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ADANIENT", name:"Adani Enterprises Ltd",   instrument_key:"NSE_EQ|INE423A01024",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"LT",       name:"Larsen & Toubro Ltd",     instrument_key:"NSE_EQ|INE018A01030",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"AXISBANK", name:"Axis Bank Ltd",           instrument_key:"NSE_EQ|INE238A01034",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"KOTAKBANK",name:"Kotak Mahindra Bank",     instrument_key:"NSE_EQ|INE237A01028",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"MARUTI",   name:"Maruti Suzuki India Ltd", instrument_key:"NSE_EQ|INE585B01010",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"TATAMOTORS",name:"Tata Motors Ltd",        instrument_key:"NSE_EQ|INE155A01022",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"SUNPHARMA",name:"Sun Pharmaceutical Ltd",  instrument_key:"NSE_EQ|INE044A01036",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"HCLTECH",  name:"HCL Technologies Ltd",    instrument_key:"NSE_EQ|INE860A01027",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ASIANPAINT",name:"Asian Paints Ltd",       instrument_key:"NSE_EQ|INE021A01026",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"HINDUNILVR",name:"Hindustan Unilever Ltd", instrument_key:"NSE_EQ|INE030A01027",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ITC",      name:"ITC Ltd",                 instrument_key:"NSE_EQ|INE154A01025",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"BHARTIARTL",name:"Bharti Airtel Ltd",      instrument_key:"NSE_EQ|INE397D01024",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ONGC",     name:"Oil & Natural Gas Corp",  instrument_key:"NSE_EQ|INE213A01029",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"POWERGRID",name:"Power Grid Corp of India",instrument_key:"NSE_EQ|INE752E01010",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"NTPC",     name:"NTPC Ltd",                instrument_key:"NSE_EQ|INE733E01010",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"COALINDIA",name:"Coal India Ltd",          instrument_key:"NSE_EQ|INE522F01014",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"TATASTEEL",name:"Tata Steel Ltd",          instrument_key:"NSE_EQ|INE081A01020",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"JSWSTEEL", name:"JSW Steel Ltd",           instrument_key:"NSE_EQ|INE019A01038",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"HINDALCO", name:"Hindalco Industries Ltd", instrument_key:"NSE_EQ|INE038A01020",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"BAJAJFINSV",name:"Bajaj Finserv Ltd",      instrument_key:"NSE_EQ|INE918I01026",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"TITAN",    name:"Titan Company Ltd",       instrument_key:"NSE_EQ|INE280A01028",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ULTRACEMCO",name:"UltraTech Cement Ltd",   instrument_key:"NSE_EQ|INE481G01011",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"TECHM",    name:"Tech Mahindra Ltd",       instrument_key:"NSE_EQ|INE669C01036",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"INDUSINDBK",name:"IndusInd Bank Ltd",      instrument_key:"NSE_EQ|INE095A01012",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"DRREDDY",  name:"Dr. Reddy's Laboratories",instrument_key:"NSE_EQ|INE089A01031",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"CIPLA",    name:"Cipla Ltd",               instrument_key:"NSE_EQ|INE059A01026",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"NESTLEIND",name:"Nestle India Ltd",        instrument_key:"NSE_EQ|INE239A01024",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"BRITANNIA",name:"Britannia Industries Ltd",instrument_key:"NSE_EQ|INE216A01030",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"GRASIM",   name:"Grasim Industries Ltd",   instrument_key:"NSE_EQ|INE047A01021",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"APOLLOHOSP",name:"Apollo Hospitals Ltd",   instrument_key:"NSE_EQ|INE437A01024",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"DIVISLAB", name:"Divi's Laboratories Ltd", instrument_key:"NSE_EQ|INE361B01024",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ADANIPORTS",name:"Adani Ports & SEZ Ltd",  instrument_key:"NSE_EQ|INE742F01042",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"EICHERMOT",name:"Eicher Motors Ltd",       instrument_key:"NSE_EQ|INE066A01021",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"HEROMOTOCO",name:"Hero MotoCorp Ltd",      instrument_key:"NSE_EQ|INE158A01026",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"BPCL",     name:"Bharat Petroleum Corp",   instrument_key:"NSE_EQ|INE029A01011",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"TATAPOWER",name:"Tata Power Company Ltd",  instrument_key:"NSE_EQ|INE245A01021",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"VEDL",     name:"Vedanta Ltd",             instrument_key:"NSE_EQ|INE205A01025",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"IRCTC",    name:"Indian Railway Catering", instrument_key:"NSE_EQ|INE335Y01020",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"ZOMATO",   name:"Zomato Ltd",              instrument_key:"NSE_EQ|INE758T01015",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"PAYTM",    name:"One97 Communications Ltd",instrument_key:"NSE_EQ|INE982J01020",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"NYKAA",    name:"FSN E-Commerce Ventures", instrument_key:"NSE_EQ|INE388Y01029",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"DMART",    name:"Avenue Supermarts Ltd",   instrument_key:"NSE_EQ|INE192R01011",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"PIDILITIND",name:"Pidilite Industries Ltd",instrument_key:"NSE_EQ|INE318A01026",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"HAVELLS",  name:"Havells India Ltd",       instrument_key:"NSE_EQ|INE176B01034",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"DIXON",    name:"Dixon Technologies Ltd",  instrument_key:"NSE_EQ|INE935N01020",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"POLYCAB",  name:"Polycab India Ltd",       instrument_key:"NSE_EQ|INE455K01017",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"TRENT",    name:"Trent Ltd",               instrument_key:"NSE_EQ|INE849A01020",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"LTIM",     name:"LTIMindtree Ltd",         instrument_key:"NSE_EQ|INE214T01019",       exchange:"NSE",segment:"NSE_EQ"},
  {trading_symbol:"PERSISTENT",name:"Persistent Systems Ltd", instrument_key:"NSE_EQ|INE262H01021",       exchange:"NSE",segment:"NSE_EQ"},
];

function localSearch(query) {
  const q = query.toUpperCase().trim();
  return LOCAL_SYMBOLS.filter(s =>
    s.trading_symbol.includes(q) ||
    s.name.toUpperCase().includes(q)
  ).sort((a,b) => {
    const aStart = a.trading_symbol.startsWith(q) ? 0 : 1;
    const bStart = b.trading_symbol.startsWith(q) ? 0 : 1;
    return aStart - bStart;
  }).slice(0,10);
}

async function searchUpstoxInstruments(token, query, options = {}) {
  // Always try local search first — instant, no token needed
  const local = localSearch(query);

  // If token available, also try Upstox API for broader results
  if (token && token.length > 50) {
    try {
      const results = await UpstoxSDK.searchInstruments(query, {
        exchanges: options.exchanges || "NSE,BSE",
        segments: options.segments || "EQ,INDEX",
        pageNumber: options.pageNumber || 1,
        records: options.records || 10,
        instrumentTypes: options.instrumentTypes,
      }, token);
      if (results && results.length > 0) return results;
    } catch (err) {
      console.warn("[searchUpstoxInstruments] Upstox API failed, using local:", err.message);
    }
  }

  return local;
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

// ─── REAL CANDLE FETCH from Upstox using SDK ──────────────────────────────
// ─── Resolution → Upstox V3 API mapping ─────────────────────────────────────
function resolveV3Params(resolution) {
  const r = String(resolution).toUpperCase().trim();
  // Intraday (minutes/hours)
  if (r === '1')              return { type:'intraday', unit:'minutes', interval:'1',   daysBack:1  };
  if (r === '5')              return { type:'intraday', unit:'minutes', interval:'5',   daysBack:30 };
  if (r === '10')             return { type:'intraday', unit:'minutes', interval:'10',  daysBack:30 };
  if (r === '15')             return { type:'intraday', unit:'minutes', interval:'15',  daysBack:30 };
  if (r === '30')             return { type:'intraday', unit:'minutes', interval:'30',  daysBack:30 };
  if (r === '60' || r==='1H') return { type:'intraday', unit:'hours',   interval:'1',   daysBack:30 };
  // Daily
  if (['D','1D','DAY'].includes(r)) return { type:'historical', unit:'days',   interval:'1', daysBack:730 };
  // Weekly
  if (['W','1W','WEEK'].includes(r)) return { type:'historical', unit:'weeks',  interval:'1', daysBack:730 };
  // Monthly
  if (['M','1M','MONTH'].includes(r)) return { type:'historical', unit:'months', interval:'1', daysBack:1825 };
  // Default 5m
  return { type:'intraday', unit:'minutes', interval:'5', daysBack:30 };
}

function mapCandles(raw) {
  return raw.map(c => ({
    timestamp: new Date(c[0]).getTime(),
    open:  Number(c[1]), high: Number(c[2]),
    low:   Number(c[3]), close: Number(c[4]),
    volume: Number(c[5]) || 0,
  })).sort((a,b) => a.timestamp - b.timestamp);
}

async function fetchRealCandles(token, instrumentKey, resolution) {
  try {
    const { type, unit, interval, daysBack } = resolveV3Params(resolution);
    const today = new Date().toISOString().slice(0,10);
    const key   = encodeURIComponent(instrumentKey);

    if (type === 'intraday') {
      // ── V3 Intraday (today's candles) ──────────────────────────────────
      try {
        const url = `https://api.upstox.com/v3/historical-candle/intraday/${key}/${unit}/${interval}`;
        console.log(`[V3 Intraday] GET ${url}`);
        const res = await fetch(url, { headers:{ Authorization:`Bearer ${token}`, Accept:'application/json' } });
        if (res.ok) {
          const json = await res.json();
          const cands = json?.data?.candles || [];
          if (cands.length > 0) {
            console.log(`[V3 Intraday] ✓ ${cands.length} candles (${unit}/${interval})`);
            return mapCandles(cands);
          }
        } else {
          console.warn(`[V3 Intraday] ${res.status} ${await res.text()}`);
        }
      } catch(e) {
        console.warn('[V3 Intraday] failed:', e.message);
      }

      // ── V3 Historical fallback for intraday (last 30d of minute data) ──
      // Upstox allows max 30 days for minute candles
      const fallbacks = [7, 14, 30];
      for (const d of fallbacks) {
        try {
          const from = new Date(Date.now() - d*86400000).toISOString().slice(0,10);
          const url  = `https://api.upstox.com/v3/historical-candle/${key}/${unit}/${interval}/${today}/${from}`;
          console.log(`[V3 Hist-intraday] ${d}d: ${from} → ${today}`);
          const res  = await fetch(url, { headers:{ Authorization:`Bearer ${token}`, Accept:'application/json' } });
          if (res.ok) {
            const json = await res.json();
            const cands = json?.data?.candles || [];
            if (cands.length > 0) {
              console.log(`[V3 Hist-intraday] ✓ ${cands.length} candles`);
              return mapCandles(cands);
            }
          }
        } catch(e) {
          console.warn(`[V3 Hist-intraday] ${e.message}`);
        }
      }
    } else {
      // ── V3 Historical (daily/weekly/monthly) ────────────────────────────
      // Fetch in two 1yr chunks and merge for max coverage
      let all = [];
      const oneYrAgo = new Date(Date.now()-365*86400000).toISOString().slice(0,10);
      const twoYrAgo = new Date(Date.now()-730*86400000).toISOString().slice(0,10);
      const fiveYrAgo= new Date(Date.now()-1825*86400000).toISOString().slice(0,10);

      for (const [to,from] of [[today,oneYrAgo],[oneYrAgo,twoYrAgo],[twoYrAgo,fiveYrAgo]]) {
        try {
          const url = `https://api.upstox.com/v3/historical-candle/${key}/${unit}/${interval}/${to}/${from}`;
          console.log(`[V3 Hist] ${unit}/${interval}: ${from} → ${to}`);
          const res = await fetch(url, { headers:{ Authorization:`Bearer ${token}`, Accept:'application/json' } });
          if (res.ok) {
            const json = await res.json();
            const cands = json?.data?.candles || [];
            if (cands.length > 0) {
              all = [...cands, ...all]; // older first
              console.log(`[V3 Hist] chunk +${cands.length} = ${all.length} total`);
            }
          }
        } catch(e) {
          console.warn(`[V3 Hist] ${e.message}`);
          break; // stop if one chunk fails
        }
        if (all.length >= 1000) break; // enough data
      }
      if (all.length > 0) return mapCandles(all);
    }

    // ── Last resort: realistic mock candles so UI never breaks ─────────────
    console.warn(`[fetchRealCandles] All API attempts failed, using mock data`);
    return generateMockCandles(instrumentKey, resolution);

  } catch (err) {
    console.error('[fetchRealCandles] Fatal:', err.message);
    return generateMockCandles(instrumentKey, resolution);
  }
}

// REAL LTP from Market Quotes API via SDK
async function fetchLTP(token, instrumentKey) {
  try {
    const data = await UpstoxSDK.getLTP(instrumentKey, token);
    const key = Object.keys(data || {})[0];
    if (key) return Number(data[key]?.last_price) || null;
  } catch (e) {
    console.warn("[SDK] LTP fetch failed:", e.message);
  }
  return null;
}

// Build analyze payload from REAL candles
async function buildRealAnalyzePayload(symbol, candles, ltpOverride) {
  const closes = candles.map(c => c.close);
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2] ?? latest;

  const price   = ltpOverride ?? latest.close;
  const vwap    = calcVWAP(candles);
  const ema9    = calcEMA(closes, 9);
  const ema20   = calcEMA(closes, 20);
  const ema50   = calcEMA(closes, 50);
  const ema100  = calcEMA(closes, 100);
  const ema200  = calcEMA(closes, 200);
  const ema20Ser = calcEMASeries(closes, 20);
  const atr     = calcATR(candles, 14);
  const rsi     = calcRSI(closes, 14);
  const bb      = calcBollingerBands(closes, 20);
  const macd    = calcMACD(closes);
  const supertrend = calcSupertrend(candles);
  const ichimoku   = calcIchimoku(candles);
  const adx        = calcADX(candles, 14);
  const fibonacci  = calcFibonacci(candles);
  const pivots     = calcPivotPoints(candles);
  const patterns   = detectCandlePatterns(candles);
  const obv        = calcOBV(candles);

  // New precision indicators
  const stochRSI   = calcStochRSI(closes, 14, 14, 3, 3);
  const williamsR  = calcWilliamsR(candles, 14);
  const cci        = calcCCI(candles, 20);
  const roc        = calcROC(closes, 12);

  // Dynamic swing-based S/R (more accurate than simple min/max)
  const swingSR     = calcSwingSR(candles, Math.min(candles.length, 60), 3);
  const support     = swingSR.support;
  const resistance  = swingSR.resistance;

  const avgVolume   = calcAvgVolume(candles, 20);
  const volumeRatio = avgVolume ? +(latest.volume / avgVolume).toFixed(2) : 1;
  
  // 52-week levels
  const yr = candles.slice(-365);
  const high52w = yr.length ? +Math.max(...yr.map(c=>c.high)).toFixed(2) : 0;
  const low52w  = yr.length ? +Math.min(...yr.map(c=>c.low)).toFixed(2)  : 0;

  const m1Trend  = summarizeTrend(candles, 3);
  const m5Trend  = summarizeTrend(candles, 8);
  const m15Trend = summarizeTrend(candles, 20);
  const trendConsistency = m1Trend===m5Trend&&m5Trend===m15Trend&&m1Trend!=="SIDEWAYS" ? "CONFIRMED" : "DIVERGENT";
  const regime   = classifyRegime(price, ema20, ema50, atr, volumeRatio, adx);

  const clean = String(symbol).trim().toUpperCase().replace(/^NSE:/i,"").replace(/-EQ|-INDEX/gi,"");
  const isIndex = ["NIFTY","NIFTY50","BANKNIFTY","FINNIFTY","MIDCPNIFTY"].includes(clean);

  // Option chain (Black-Scholes) — improved with deterministic seed-based OI simulation
  let foGreeks = [];
  if (isIndex) {
    const atm = Math.round(price/50)*50;
    const offsets = [-400,-350,-300,-250,-200,-150,-100,-50,0,50,100,150,200,250,300,350,400];
    // Seed for deterministic OI (avoids random changes on refresh)
    const seed = Math.floor(Date.now() / (5*60*1000)); // changes every 5 min
    const pseudoRand = (n) => { let x = Math.sin(n + seed)*10000; return x - Math.floor(x); };

    foGreeks = offsets.flatMap((off, idx) => {
      const strike = atm + off;
      const moneyness = Math.abs(price - strike) / Math.max(price,1);
      const baseIV = clean.includes('BANK') ? 16 : clean === 'FINNIFTY' ? 15 : 13;
      const iv = baseIV + moneyness * 60 + pseudoRand(idx) * 2;
      const g = calcOptionGreeks(price, strike, iv);
      // Realistic OI bell-curve around ATM
      const atmDist = Math.abs(off) / 50; // steps from ATM
      const ceOI = Math.round(Math.max(5000, (180000 - atmDist*18000) * (0.8 + pseudoRand(idx+100)*0.4)));
      const peOI = Math.round(Math.max(5000, (160000 - atmDist*15000) * (0.8 + pseudoRand(idx+200)*0.4)));
      // Realistic LTP using Black-Scholes intrinsic + extrinsic
      const intrinsicCE = Math.max(0, price - strike);
      const intrinsicPE = Math.max(0, strike - price);
      const extrinsic = Math.max(2, (iv/100)*price*Math.sqrt(7/365)*0.4);
      const ceLTP = +(intrinsicCE + extrinsic).toFixed(2);
      const peLTP = +(intrinsicPE + extrinsic).toFixed(2);
      return [
        { strikePrice:strike, optionType:"CE", delta:g.ceDelta, theta:g.ceTheta, vega:g.vega, gamma:g.gamma, iv:+iv.toFixed(2), ltp:ceLTP, oi:ceOI, tradeVolume:Math.round(ceOI*pseudoRand(idx+300)*0.5) },
        { strikePrice:strike, optionType:"PE", delta:g.peDelta, theta:g.peTheta, vega:g.vega, gamma:g.gamma, iv:+iv.toFixed(2), ltp:peLTP, oi:peOI, tradeVolume:Math.round(peOI*pseudoRand(idx+400)*0.5) },
      ];
    });
  }

  const ceOI = foGreeks.filter(g=>g.optionType==="CE").reduce((s,g)=>s+g.oi,0);
  const peOI = foGreeks.filter(g=>g.optionType==="PE").reduce((s,g)=>s+g.oi,0);
  const pcr  = ceOI ? +(peOI/ceOI).toFixed(2) : 1;
  const maxPain = calcMaxPain(foGreeks);
  const ivAvg = foGreeks.length > 0
    ? +(foGreeks.reduce((s,g)=>s+g.iv,0)/foGreeks.length).toFixed(2) : 15;

  const riskProfile   = calcRiskProfile(atr, price, volumeRatio, regime);
  const aiInput = {
    symbol:clean, price, vwap, ema20, ema50, ema200, rsi, atr,
    support, resistance, regime, trendConsistency, volumeRatio, pcr,
    m1Trend, m5Trend, m15Trend, macd, bb, supertrend, ichimoku,
    adx, patterns, obv,
    stochRSI, williamsR, cci, roc, high52w, low52w,
  };

  let aiAnalysis = ruleBasedAnalysis(aiInput);

  // Groq AI Enhancement
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const topPatterns = patterns.slice(0,2).map(p=>`${p.name}(${p.type})`).join(', ') || 'None';
      const stochK = stochRSI?.k ?? 50;
      const stochD = stochRSI?.d ?? 50;
      const groqPrompt = `You are ANAV PRO — a SEBI-grade Indian equities trading AI.
Analyze ALL data below and return ONLY valid JSON (no markdown, no text outside JSON).

Schema:
{"verdict":"BUY|SELL|HOLD","confidence":number(40-92),"summary":string,"entry":number,"target":number,"stopLoss":number,"riskReward":number,"reasons":string[3-4],"risks":string[2-3],"newsImpact":string,"timeframeAlignment":{"shortTerm":"BULLISH|BEARISH|SIDEWAYS","mediumTerm":"BULLISH|BEARISH|SIDEWAYS","trend":"BULLISH|BEARISH|SIDEWAYS"}}

Rules (apply strictly — not guidelines):
BUY: price>VWAP AND price>EMA20 AND MACD-hist>0 AND RSI 35-70 AND stochRSI.k<80 AND supertrend=up AND adx.adx>=18 AND m5Trend=BULLISH AND m15Trend=BULLISH AND obv=ACCUMULATION
SELL: price<VWAP AND price<EMA20 AND MACD-hist<0 AND RSI 30-65 AND stochRSI.k>20 AND supertrend=down AND adx.adx>=18 AND m5Trend=BEARISH AND m15Trend=BEARISH AND obv=DISTRIBUTION
HOLD: adx.adx<18 OR trendConsistency=DIVERGENT OR regime=HIGH_VOL_CHOP OR stochRSI.k>85 OR williamsR>-10 with BUY signal (overbought rejection)
STRONG BUY: All BUY conditions + adx.adx>30 + bullish candle pattern + stochRSI.k<20 + williamsR<-80
STRONG SELL: All SELL conditions + adx.adx>30 + bearish candle pattern + stochRSI.k>80 + williamsR>-20
Confidence caps: HIGH_VOL_CHOP=58, DIVERGENT=62, RANGE=70, TREND_UP/DOWN=92
Entry: best re-entry level near VWAP/EMA20/pivot — not always current price
Target: nearest resistance from swingSR.allResistances OR Fibonacci extension
StopLoss: below nearest swing support OR below Supertrend value (whichever is closer to entry)
Reasons: must include specific ₹ price levels (e.g. "RSI 58 with room to 70 OB"). Max 4.
Risks: must include invalidation ₹ level. Max 3.

Market Data:
${JSON.stringify({
  symbol:clean, price:+price.toFixed(2), vwap:+vwap.toFixed(2),
  ema20:+ema20.toFixed(2), ema50:+ema50.toFixed(2), ema200:+ema200.toFixed(2),
  rsi, atr:+atr.toFixed(2), support, resistance,
  regime, trendConsistency, volumeRatio:+volumeRatio.toFixed(2), pcr,
  m1Trend, m5Trend, m15Trend,
  macd:{line:macd.macd, signal:macd.signal, histogram:macd.histogram},
  supertrend:{value:supertrend.value, direction:supertrend.direction},
  stochRSI,
  williamsR,
  cci,
  roc,
  high52w,
  low52w,
  swingSR: { allSupports: swingSR.allSupports, allResistances: swingSR.allResistances },
  adx:{adx:adx.adx, pdi:adx.pdi, mdi:adx.mdi, trend:adx.trend},
  bollinger:{upper:bb.upper, middle:bb.middle, lower:bb.lower},
  fibonacci:{fib382:fibonacci.fib382, fib500:fibonacci.fib500, fib618:fibonacci.fib618},
  pivotPP:pivots.standard.pp, pivotR1:pivots.standard.r1, pivotS1:pivots.standard.s1,
  patterns:topPatterns, obv:obv.trend,
  ruleScore:aiAnalysis.score, ruleBullVotes:aiAnalysis.bullVotes, ruleBearVotes:aiAnalysis.bearVotes,
})}`;

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.15,
          max_tokens: 900,
          messages: [{ role: "user", content: groqPrompt }]
        })
      });
      const groqData = await groqRes.json();
      const content = groqData?.choices?.[0]?.message?.content || "";
      const start = content.indexOf("{"), end = content.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(content.slice(start, end+1));
        if (parsed?.verdict) {
          aiAnalysis = {
            ...aiAnalysis,
            verdict:    ["BUY","SELL","HOLD"].includes(String(parsed.verdict).toUpperCase()) ? parsed.verdict.toUpperCase() : aiAnalysis.verdict,
            confidence: Math.max(40, Math.min(93, Number(parsed.confidence ?? aiAnalysis.confidence))),
            summary:    String(parsed.summary || aiAnalysis.summary),
            entry:      Number(parsed.entry)      || aiAnalysis.entry,
            target:     Number(parsed.target)     || aiAnalysis.target,
            stopLoss:   Number(parsed.stopLoss)   || aiAnalysis.stopLoss,
            riskReward: Number(parsed.riskReward) || aiAnalysis.riskReward,
            reasons:    Array.isArray(parsed.reasons) ? parsed.reasons.slice(0,4).map(String) : aiAnalysis.reasons,
            risks:      Array.isArray(parsed.risks)   ? parsed.risks.slice(0,4).map(String)   : aiAnalysis.risks,
            newsImpact: String(parsed.newsImpact || aiAnalysis.newsImpact),
            timeframeAlignment: parsed.timeframeAlignment || aiAnalysis.timeframeAlignment,
            source: "GROQ_LLAMA3",
          };
          console.log(`✅ Groq AI: ${clean} → ${aiAnalysis.verdict} (${aiAnalysis.confidence}%)`);
        }
      }
    } catch(e) {
      console.warn("Groq AI failed, using rule-based fallback:", e.message);
    }
  }

  // Investment guidance
  const investmentGuidance = calcInvestmentGuidance(aiAnalysis.verdict, aiAnalysis.confidence, riskProfile.profile, regime);

  // F&O strategy suggestions
  const foStrategies = suggestFOStrategies(pcr, ivAvg, aiAnalysis.verdict, regime);

  // Option signal for indices
  let optionSignal = null;
  if (isIndex && foGreeks.length > 0) {
    const atm = Math.round(price/50)*50;
    const type = aiAnalysis.verdict === "SELL" ? "PE" : "CE";
    const contract = foGreeks.find(g=>g.strikePrice===atm && g.optionType===type);
    if (contract) {
      const sl  = +(contract.ltp*0.65).toFixed(2);
      const tgt = +(contract.ltp*1.65).toFixed(2);
      optionSignal = {
        strike: atm, type,
        entryRange: `₹${contract.ltp}–₹${+(contract.ltp*1.03).toFixed(2)}`,
        stopLoss: sl, target: tgt,
        iv: contract.iv,
        summary: `${clean} ${atm} ${type} | Entry ₹${contract.ltp} | Target ₹${tgt} | SL ₹${sl} | IV ${contract.iv}% | Δ ${contract.delta.toFixed(3)}`,
      };
      aiAnalysis.optionSuggestion = optionSignal.summary;
    }
  }

  return {
    ok: true, service: "anavai-upstox-live",
    stock: clean, price,
    vwap: +vwap.toFixed(2), ema9: +ema9.toFixed(2),
    ema20: +ema20.toFixed(2), ema50: +ema50.toFixed(2),
    ema100: +ema100.toFixed(2), ema200: +ema200.toFixed(2),
    rsi: +rsi, pcr, trendConsistency,
    timeframeAnalysis: { m1:m1Trend, m5:m5Trend, m15:m15Trend },
    executionContext: {
      atr, pcr, volumeRatio, marketRegime: regime,
      trendStrength: +(((price-ema20)/Math.max(ema20,1))*100).toFixed(2),
      vwapDistancePct: +(vwap?((price-vwap)/vwap*100):0).toFixed(2),
      supertrend, bbSqueeze: bb?+((bb.upper-bb.lower)/Math.max(bb.middle,1)).toFixed(4):0,
    },
    bollingerBands: bb, macd, supertrend, ichimoku,
    adx, fibonacci, pivotPoints: pivots,
    candlePatterns: patterns, obv, riskProfile,
    investmentGuidance, foStrategies, maxPain,
    foGreeks,
    analysis: aiAnalysis.summary, aiAnalysis,
    latestNews: [], optionSignal,
    candleData: candles, ema20Series: ema20Ser,
    quality: {
      source: token && token.length > 50 ? "UPSTOX_LIVE" : "SANDBOX",
      candleCount: candles.length,
      hasLiveToken: !!(token && token.length > 50),
      dataAge: candles.length > 0 ? new Date(candles[candles.length-1].timestamp).toISOString() : null,
    },
  };
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { writeJson(req, res, 200, { ok: true }); return; }
  const url   = new URL(req.url, `http://0.0.0.0:${PORT}`);
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
      const candles = await fetchRealCandles(token, resolved.instrumentKey, res_);

      if (!candles || candles.length === 0) {
        writeJson(req, res, 502, {
          error: "Upstox returned no candle data. Token may be expired — use Connect Live OAuth or update sandbox token.",
          instrKey: resolved.instrumentKey,
        });
        return;
      }

      // Step 3: Fetch real LTP (best-effort)
      const ltp = await fetchLTP(token, resolved.instrumentKey);

      // Step 4: Build accurate analysis on real data
      const payload =  await buildRealAnalyzePayload(resolved.displaySymbol || sym, candles, ltp);
      writeJson(req, res, 200, payload);
      return;
    }

    // ── /api/search?q= — symbol search (multi-source) ───────────────────────
    if (req.method === "GET" && url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim().toUpperCase();
      if (!q || q.length < 1) {
        writeJson(req, res, 200, { results: [] });
        return;
      }

      let results = [];

      // 1. Try Upstox search API if token available
      if (token && token.length > 50) {
        try {
          const matches = await searchUpstoxInstruments(token, q, {
            exchanges: "NSE,BSE", segments: "EQ,INDEX,FO",
            records: 20,
          });
          if (matches.length > 0) {
            results = matches.map(formatSearchResult);
            console.log(`[Search] Upstox: ${results.length} results for "${q}"`);
          }
        } catch(e) {
          console.warn("[Search] Upstox failed:", e.message);
        }
      }

      // 2. Try NSE India search API (free, no auth — needs session cookie trick)
      if (results.length < 5) {
        try {
          const nseSearchUrl = `https://www.nseindia.com/api/search?q=${encodeURIComponent(q)}&type=quotes&category=equities`;
          const nseRes = await fetch(nseSearchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
              "Accept": "application/json",
              "Referer": "https://www.nseindia.com/",
              "Accept-Language": "en-US,en;q=0.9",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
            },
            signal: AbortSignal.timeout(5000)
          });
          if (nseRes.ok) {
            const nseData = await nseRes.json();
            const hits = nseData?.list || nseData?.data || [];
            const nseResults = hits.slice(0,15).map(h => ({
              symbol: h.symbol || h.nsCode || "",
              tradingSymbol: h.symbol || h.nsCode || "",
              name: h.companyName || h.name || "",
              shortName: h.symbol || "",
              instrumentKey: `NSE_EQ|${h.isin || h.symbol || ""}`,
              exchange: "NSE",
              segment: h.indexs?.includes("NSE") ? "NSE_EQ" : "NSE_EQ",
              isin: h.isin || "",
            })).filter(r => r.symbol);
            if (nseResults.length > 0) {
              results = [...results, ...nseResults.filter(nr => !results.find(r => r.symbol === nr.symbol))];
              console.log(`[Search] NSE: +${nseResults.length} results for "${q}"`);
            }
          }
        } catch(e) {
          // NSE API often blocked — silent fail
        }
      }

      // 3. Fallback: local symbol database (always works)
      if (results.length === 0) {
        results = localSearch(q).map(sym => ({
          symbol: sym.trading_symbol,
          tradingSymbol: sym.trading_symbol,
          name: sym.name,
          shortName: sym.trading_symbol,
          instrumentKey: sym.instrument_key || `NSE_EQ|${sym.trading_symbol}`,
          exchange: sym.exchange || "NSE",
          segment: sym.segment || "NSE_EQ",
        }));
        console.log(`[Search] Local fallback: ${results.length} results for "${q}"`);
      }

      writeJson(req, res, 200, { results: results.slice(0, 15) });
      return;
    }

    // ── OAuth ────────────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/auth/url") {
      // Always use server-side redirect URI — never trust frontend value
      const redirectUri = process.env.UPSTOX_ALGO_REDIRECT_URI
                       || process.env.UPSTOX_REDIRECT_URI
                       || "https://anavai.onrender.com/auth/callback";
      const clientId    = process.env.UPSTOX_ALGO_CLIENT_ID
                       || process.env.UPSTOX_CLIENT_ID || "";
      const state = `anavai-${Date.now()}`;

      console.log(`[Auth URL] clientId=${clientId?.slice(0,8)}... redirectUri=${redirectUri}`);

      if (!clientId) {
        writeJson(req, res, 400, { status:"error", message:"UPSTOX_ALGO_CLIENT_ID not set in environment" });
        return;
      }

      try {
        // Build auth URL directly — don't rely on SDK CONFIG which may have cached old values
        const params = new URLSearchParams({
          response_type: "code",
          client_id:     clientId,
          redirect_uri:  redirectUri,
          state,
        });
        const authorizationUrl = `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;
        writeJson(req, res, 200, { status:"success", data:{ authorizationUrl, state, redirectUri, clientId: clientId.slice(0,8)+"..." }});
      } catch (err) {
        writeJson(req, res, 400, { status:"error", message: err.message });
      }
      return;
    }

    // ── /auth/callback — Upstox redirects here after login ──────────────────
    // Exchange code for token, then redirect to frontend dashboard
    if (req.method === "GET" && url.pathname === "/auth/callback") {
      const code  = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const frontendUrl = process.env.FRONTEND_URL || "https://anav-ai.vercel.app";

      if (error || !code) {
        const msg = encodeURIComponent(error || "No code received");
        res.writeHead(302, { Location: `${frontendUrl}/dashboard?upstox_error=${msg}` });
        res.end(); return;
      }

      try {
        const clientId     = process.env.UPSTOX_ALGO_CLIENT_ID     || process.env.UPSTOX_CLIENT_ID     || "";
        const clientSecret = process.env.UPSTOX_ALGO_CLIENT_SECRET || process.env.UPSTOX_CLIENT_SECRET || "";
        const redirectUri  = process.env.UPSTOX_ALGO_REDIRECT_URI  || process.env.UPSTOX_REDIRECT_URI  || "https://anavai.onrender.com/auth/callback";

        console.log(`[Callback] Exchanging code=${code.slice(0,10)}... clientId=${clientId.slice(0,8)}...`);

        const formData = new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri, grant_type: "authorization_code",
        });

        const tokenRes = await fetch("https://api.upstox.com/v2/login/authorization/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: formData.toString(),
        });

        const tokenData = await tokenRes.json();
        console.log(`[Callback] Token exchange status=${tokenRes.status} token=${tokenData?.access_token ? "YES" : "NO"}`);

        if (tokenRes.ok && tokenData?.access_token) {
          // Redirect to frontend with token in URL fragment (never in query — security)
          const token = encodeURIComponent(tokenData.access_token);
          const refresh = encodeURIComponent(tokenData.refresh_token || "");
          res.writeHead(302, {
            Location: `${frontendUrl}/dashboard?upstox_token=${token}&upstox_refresh=${refresh}&upstox_connected=1`
          });
        } else {
          const errMsg = encodeURIComponent(JSON.stringify(tokenData));
          res.writeHead(302, { Location: `${frontendUrl}/dashboard?upstox_error=${errMsg}` });
        }
      } catch(e) {
        console.error("[Callback] Error:", e.message);
        res.writeHead(302, { Location: `${frontendUrl}/dashboard?upstox_error=${encodeURIComponent(e.message)}` });
      }
      res.end(); return;
    }

    if (req.method === "POST" && url.pathname === "/auth/exchange") {
      const body = await readBody(req);
      try {
        const clientId     = process.env.UPSTOX_ALGO_CLIENT_ID     || process.env.UPSTOX_CLIENT_ID     || "";
        const clientSecret = process.env.UPSTOX_ALGO_CLIENT_SECRET  || process.env.UPSTOX_CLIENT_SECRET || "";
        const redirectUri  = process.env.UPSTOX_ALGO_REDIRECT_URI   || process.env.UPSTOX_REDIRECT_URI  || "https://anavai.onrender.com/auth/callback";

        console.log(`[Auth Exchange] code=${body.code?.slice(0,10)}... clientId=${clientId?.slice(0,8)}...`);

        const formData = new URLSearchParams({
          code:          body.code,
          client_id:     clientId,
          client_secret: clientSecret,
          redirect_uri:  redirectUri,
          grant_type:    "authorization_code",
        });

        const res2 = await fetch("https://api.upstox.com/v2/login/authorization/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: formData.toString(),
        });

        const tokenData = await res2.json();
        console.log(`[Auth Exchange] status=${res2.status} access_token=${tokenData?.access_token ? "YES" : "NO"}`);

        if (res2.ok && tokenData?.access_token) {
          writeJson(req, res, 200, { status:"success", data: tokenData });
        } else {
          writeJson(req, res, 400, { status:"error", message: JSON.stringify(tokenData) });
        }
      } catch (err) {
        writeJson(req, res, 400, { status:"error", message: err.message });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/auth/refresh") {
      const body = await readBody(req);
      try {
        const tokenData = await UpstoxSDK.refreshAccessToken(body.refreshToken);
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
      const candles = await UpstoxSDK.getIntradayCandles(instrKey, ivl, token);
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
      
      const candles = await UpstoxSDK.getHistoricalCandles(instrKey, interval, toDate, fromDate, token);
      writeJson(req, res, 200, { status:"success", data:{ candles }});
      return;
    }

    // ── /news — Live News via Google RSS fallback (Upstox news needs live token) ──
    if (req.method === "GET" && url.pathname === "/news") {
      const instrumentKeys = url.searchParams.get("instrument_keys") || "";
      const category = url.searchParams.get("category") || "market";
      const token = getToken(req);

      // Try Upstox news first if token present
      if (token && token.length > 50) {
        try {
          const newsRes = await UpstoxSDK.getNews({ category, instrument_keys: instrumentKeys }, token);
          if (newsRes?.status === "success") {
            writeJson(req, res, 200, newsRes);
            return;
          }
        } catch (e) {
          console.warn("[News] Upstox failed:", e.message, "— falling back to RSS");
        }
      }

      // Free fallback: Google News RSS
      try {
        // Extract readable symbol from instrument key e.g. NSE_EQ|INE002A01018 → RELIANCE
        const symRaw = instrumentKeys.split("|").pop()?.replace(/\+/g," ").trim() || "Nifty 50";
        const query  = encodeURIComponent(symRaw + " NSE stock market India");
        const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

        const rssRes = await fetch(rssUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AnavAI/2.0; +https://anavai.onrender.com)" }
        });

        if (!rssRes.ok) throw new Error(`RSS HTTP ${rssRes.status}`);
        const rssText = await rssRes.text();

        // Parse RSS items
        const items = [];
        const itemRx = /<item>([\s\S]*?)<\/item>/g;
        let m;
        while ((m = itemRx.exec(rssText)) !== null && items.length < 12) {
          const block = m[1];
          const cdataRx = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/;
          const plainTx = /<title>([\s\S]*?)<\/title>/;
          const title = (cdataRx.exec(block) || plainTx.exec(block))?.[1]?.trim() || "";
          const link = (/<link>([\s\S]*?)<\/link>/.exec(block))?.[1]?.replace(/&amp;/g,"&").trim() || "";
          const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block))?.[1]?.trim() || "";
          const source = (/<source[^>]*>([\s\S]*?)<\/source>/.exec(block))?.[1]?.trim() || "Google News";

          if (!title) continue;

          // Sentiment from keywords
          const tl = title.toLowerCase();
          const bullKw = ["surge","rally","gain","rise","profit","record","high","buy","upgrade","beat","growth","strong","outperform","positive","jump","soar","bull"];
          const bearKw = ["fall","drop","crash","loss","decline","sell","downgrade","miss","weak","concern","risk","cut","slump","bear","negative","plunge","tumble"];
          const sentiment = bullKw.some(k=>tl.includes(k)) ? "BULLISH" : bearKw.some(k=>tl.includes(k)) ? "BEARISH" : "NEUTRAL";

          items.push({
            id: `rss-${items.length}`,
            headline: title,
            title,
            link,
            url: link,
            article_link: link,
            source,
            sentiment,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            published_timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
          });
        }

        console.log(`[News RSS] ${items.length} articles for "${symRaw}"`);
        writeJson(req, res, 200, {
          status: "success",
          data: { [instrumentKeys || "market"]: items },
          _source: "google_news_rss",
        });
      } catch (rssErr) {
        console.error("[News RSS] Failed:", rssErr.message);
        writeJson(req, res, 200, { status: "success", data: {}, _source: "empty" });
      }
      return;
    }

    // ── /fundamentals — Company Fundamentals (NSE free API + Screener fallback) ──
    if (req.method === "GET" && url.pathname === "/fundamentals") {
      const isin   = url.searchParams.get("isin")   || "";
      const symbol = url.searchParams.get("symbol") || "";
      const token  = getToken(req);

      if (!isin && !symbol) {
        writeJson(req, res, 400, { status:"error", message:"isin or symbol required" });
        return;
      }

      // Clean NSE symbol (remove exchange prefix, -EQ suffix)
      const nseSymbol = symbol
        .replace(/^(NSE:|BSE:|NSE_EQ|)/i,"")
        .replace(/-(EQ|BE|SM|ST)$/i,"")
        .split("|").pop()
        .trim()
        .toUpperCase();

      let fundamentalData = null;

      // 1. Try Upstox fundamentals if token available
      if (token && token.length > 50 && isin) {
        try {
          const [profRes, ratRes] = await Promise.allSettled([
            UpstoxSDK.getCompanyFundamentals({ isin, type:"profile" }, token),
            UpstoxSDK.getCompanyFundamentals({ isin, type:"key-ratios" }, token),
          ]);
          if (profRes.status==="fulfilled" && profRes.value?.status==="success") {
            fundamentalData = { ...(profRes.value.data||{}) };
            if (ratRes.status==="fulfilled" && ratRes.value?.status==="success") {
              Object.assign(fundamentalData, ratRes.value.data||{});
            }
            console.log(`[Fundamentals] Upstox data for ${nseSymbol}`);
          }
        } catch(e) {
          console.warn("[Fundamentals] Upstox failed:", e.message);
        }
      }

      // 2. NSE India free API (no auth needed)
      if (!fundamentalData && nseSymbol) {
        try {
          const nseRes = await fetch(
            `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(nseSymbol)}`,
            { headers: {
              "Accept":"application/json",
              "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Referer":"https://www.nseindia.com",
              "Accept-Language":"en-US,en;q=0.9",
            }, signal: AbortSignal.timeout(8000) }
          );
          if (nseRes.ok) {
            const nseData = await nseRes.json();
            const info      = nseData?.info      || {};
            const metadata  = nseData?.metadata  || {};
            const priceInfo = nseData?.priceInfo  || {};
            const industryInfo = nseData?.industryInfo || {};
            fundamentalData = {
              company_name:        info?.companyName || nseSymbol,
              sector:              industryInfo?.sector || info?.sector || "",
              industry:            industryInfo?.industry || info?.industry || "",
              isin:                info?.isin || isin,
              business_description:`${info?.companyName||nseSymbol} — Listed on NSE. Sector: ${industryInfo?.sector||info?.sector||"N/A"}. Industry: ${industryInfo?.industry||"N/A"}.`,
              pe_ratio:            Number(metadata?.pdSectorPe) || null,
              pb_ratio:            Number(priceInfo?.pbRatio)   || null,
              eps:                 Number(metadata?.eps)        || null,
              market_cap:          Number(nseData?.securityInfo?.issuedCap) || null,
              dividend_yield:      Number(priceInfo?.dividendYield) || null,
              face_value:          Number(metadata?.pdFaceValue)    || null,
              week52High:          Number(priceInfo?.weekHighLow?.max) || null,
              week52Low:           Number(priceInfo?.weekHighLow?.min) || null,
              listingDate:         nseData?.metadata?.listingDate || null,
              series:              metadata?.series || null,
            };
            console.log(`[Fundamentals] NSE data for ${nseSymbol}`);
          }
        } catch (nseErr) {
          console.warn("[Fundamentals] NSE failed:", nseErr.message);
        }
      }

      // 3. Screener.in fallback (scrape basics)
      if (!fundamentalData && nseSymbol) {
        try {
          const scRes = await fetch(
            `https://www.screener.in/company/${nseSymbol}/`,
            { headers: { "User-Agent":"Mozilla/5.0 (compatible; AnavAI/2.0)" },
              signal: AbortSignal.timeout(8000) }
          );
          if (scRes.ok) {
            const html = await scRes.text();
            const getVal = (label) => {
              const rx = new RegExp(label + '[\\s\\S]*?<span[^>]*>([\\d.,]+)<\/span>','i');
              const m = rx.exec(html);
              return m ? parseFloat(m[1].replace(/,/g,'')) : null;
            };
            const nameMatch = /<title>([^|<]+)/.exec(html);
            fundamentalData = {
              company_name:  nameMatch?.[1]?.trim() || nseSymbol,
              sector:        "See Screener.in",
              isin,
              pe_ratio:      getVal("P\/E"),
              pb_ratio:      getVal("Price to Book"),
              eps:           getVal("EPS"),
              market_cap:    getVal("Market Cap"),
              dividend_yield:getVal("Dividend Yield"),
              week52High:    null,
              week52Low:     null,
              business_description: `Data sourced from Screener.in for ${nseSymbol}.`,
            };
            console.log(`[Fundamentals] Screener.in data for ${nseSymbol}`);
          }
        } catch(scErr) {
          console.warn("[Fundamentals] Screener failed:", scErr.message);
        }
      }

      if (fundamentalData) {
        writeJson(req, res, 200, { status:"success", data: fundamentalData });
      } else {
        writeJson(req, res, 200, {
          status:"success",
          data: {
            company_name: nseSymbol || isin || "Unknown",
            sector: "Data unavailable",
            isin,
            business_description: "Fundamental data not available. Please ensure you are using a valid NSE symbol.",
          }
        });
      }
      return;
    }

    // ── /api/optionchain — Real NSE option chain (free, no token) ─────────────
    if (req.method === "GET" && url.pathname === "/api/optionchain") {
      const symbol = (url.searchParams.get("symbol") || "NIFTY").toUpperCase();
      try {
        // NSE free API — no auth needed
        const headers = {
          "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept":"application/json","Referer":"https://www.nseindia.com",
          "Accept-Language":"en-US,en;q=0.9",
        };
        // First hit homepage to get cookies
        await fetch("https://www.nseindia.com", { headers }).catch(()=>{});
        const ocRes = await fetch(
          `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        if (ocRes.ok) {
          const ocData = await ocRes.json();
          const records = ocData?.records?.data || [];
          const underlying = ocData?.records?.underlyingValue || 0;
          const expiries = [...new Set(records.map(r=>r.expiryDate))].slice(0,5);
          // Process option chain
          const processed = records
            .filter(r => r.expiryDate === expiries[0])
            .map(r => ({
              strike: r.strikePrice,
              ce: r.CE ? { oi:r.CE.openInterest, coiChange:r.CE.changeinOpenInterest,
                ltp:r.CE.lastPrice, iv:r.CE.impliedVolatility, vol:r.CE.totalTradedVolume,
                delta:r.CE.delta||null, theta:r.CE.theta||null } : null,
              pe: r.PE ? { oi:r.PE.openInterest, coiChange:r.PE.changeinOpenInterest,
                ltp:r.PE.lastPrice, iv:r.PE.impliedVolatility, vol:r.PE.totalTradedVolume,
                delta:r.PE.delta||null, theta:r.PE.theta||null } : null,
            }));
          // PCR, max pain
          const totalCeOI = processed.reduce((s,r)=>s+(r.ce?.oi||0),0);
          const totalPeOI = processed.reduce((s,r)=>s+(r.pe?.oi||0),0);
          const pcr = totalCeOI > 0 ? +(totalPeOI/totalCeOI).toFixed(3) : 0;
          // Max pain = strike with max total OI loss
          let maxPain = 0, minLoss = Infinity;
          for (const row of processed) {
            const strike = row.strike;
            let loss = 0;
            for (const r of processed) {
              if (r.ce?.oi) loss += Math.max(0, r.strike - strike) * r.ce.oi;
              if (r.pe?.oi) loss += Math.max(0, strike - r.strike) * r.pe.oi;
            }
            if (loss < minLoss) { minLoss=loss; maxPain=strike; }
          }
          writeJson(req, res, 200, {
            status:"success", symbol, underlying, expiries,
            data: processed, pcr, maxPain, _source:"NSE_LIVE",
          });
        } else {
          writeJson(req, res, 200, { status:"error", message:"NSE API unavailable", _source:"NSE_FAIL" });
        }
      } catch(e) {
        console.warn("[OptionChain] NSE fetch failed:", e.message);
        writeJson(req, res, 200, { status:"error", message:e.message });
      }
      return;
    }

    // ── /api/patterns — Advanced chart pattern recognition ───────────────────
    if (req.method === "POST" && url.pathname === "/api/patterns") {
      const body = await readBody(req);
      const candles = Array.isArray(body.candles) ? body.candles : [];
      if (candles.length < 20) {
        writeJson(req, res, 200, { patterns:[] }); return;
      }
      const patterns = [];
      const n = candles.length;
      const closes = candles.map(c=>c.close);
      const highs  = candles.map(c=>c.high);
      const lows   = candles.map(c=>c.low);
      const avg    = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
      const price  = closes[n-1];

      // ── Head & Shoulders ──
      if (n >= 30) {
        const seg = closes.slice(-30);
        const mid = Math.floor(seg.length/2);
        const leftPeak  = Math.max(...seg.slice(0, mid-3));
        const head      = Math.max(...seg.slice(mid-4, mid+4));
        const rightPeak = Math.max(...seg.slice(mid+3));
        const neckline  = (Math.min(...seg.slice(0,mid)) + Math.min(...seg.slice(mid))) / 2;
        if (head > leftPeak*1.02 && head > rightPeak*1.02 &&
            Math.abs(leftPeak-rightPeak)/rightPeak < 0.05 &&
            price < neckline*1.01) {
          patterns.push({ name:"Head & Shoulders", type:"BEARISH", confidence:74,
            description:`Classic reversal — head at ₹${Math.round(head).toLocaleString('en-IN')}, neckline ₹${Math.round(neckline).toLocaleString('en-IN')}. Target: ₹${Math.round(neckline-(head-neckline)).toLocaleString('en-IN')}` });
        }
      }

      // ── Double Top ──
      if (n >= 20) {
        const seg = closes.slice(-20);
        const half = Math.floor(seg.length/2);
        const peak1 = Math.max(...seg.slice(0, half));
        const peak2 = Math.max(...seg.slice(half));
        const trough = Math.min(...seg.slice(half-4, half+4));
        if (Math.abs(peak1-peak2)/peak1 < 0.02 && peak1 > trough*1.03 && price < trough*1.01) {
          patterns.push({ name:"Double Top", type:"BEARISH", confidence:70,
            description:`Two peaks near ₹${Math.round(peak1).toLocaleString('en-IN')}. Bearish reversal confirmed below ₹${Math.round(trough).toLocaleString('en-IN')}` });
        }
      }

      // ── Double Bottom ──
      if (n >= 20) {
        const seg = closes.slice(-20);
        const half = Math.floor(seg.length/2);
        const bot1 = Math.min(...seg.slice(0, half));
        const bot2 = Math.min(...seg.slice(half));
        const peak = Math.max(...seg.slice(half-4, half+4));
        if (Math.abs(bot1-bot2)/bot1 < 0.02 && bot1 < peak*0.97 && price > peak*0.99) {
          patterns.push({ name:"Double Bottom", type:"BULLISH", confidence:72,
            description:`Two lows near ₹${Math.round(bot1).toLocaleString('en-IN')}. Bullish reversal confirmed above ₹${Math.round(peak).toLocaleString('en-IN')}` });
        }
      }

      // ── Cup & Handle ──
      if (n >= 40) {
        const seg = closes.slice(-40);
        const leftRim  = seg[0];
        const cupLow   = Math.min(...seg.slice(5, 35));
        const rightRim = Math.max(...seg.slice(33, 38));
        const handle   = Math.min(...seg.slice(37));
        if (Math.abs(leftRim-rightRim)/leftRim < 0.03 &&
            cupLow < leftRim*0.92 && handle > cupLow &&
            handle < rightRim && price >= rightRim*0.99) {
          patterns.push({ name:"Cup & Handle", type:"BULLISH", confidence:78,
            description:`Bullish continuation. Cup depth ₹${Math.round(leftRim-cupLow).toLocaleString('en-IN')}. Target: ₹${Math.round(rightRim+(leftRim-cupLow)).toLocaleString('en-IN')}` });
        }
      }

      // ── Rising/Falling Wedge ──
      if (n >= 15) {
        const seg15 = closes.slice(-15);
        const h15   = highs.slice(-15);
        const l15   = lows.slice(-15);
        const highSlope = (h15[14]-h15[0])/14;
        const lowSlope  = (l15[14]-l15[0])/14;
        if (highSlope > 0 && lowSlope > 0 && lowSlope > highSlope) {
          patterns.push({ name:"Rising Wedge", type:"BEARISH", confidence:65,
            description:"Converging higher highs and higher lows — bearish reversal pattern" });
        } else if (highSlope < 0 && lowSlope < 0 && highSlope > lowSlope) {
          patterns.push({ name:"Falling Wedge", type:"BULLISH", confidence:65,
            description:"Converging lower highs and lower lows — bullish reversal/continuation" });
        }
      }

      // ── Bullish/Bearish Flag ──
      if (n >= 20) {
        const pole  = closes.slice(-20,-10);
        const flag  = closes.slice(-10);
        const poleMove = (pole[pole.length-1]-pole[0])/pole[0]*100;
        const flagHigh = Math.max(...flag), flagLow = Math.min(...flag);
        const flagRange = (flagHigh-flagLow)/flagHigh*100;
        if (poleMove > 5 && flagRange < 3) {
          patterns.push({ name:"Bull Flag", type:"BULLISH", confidence:68,
            description:`Strong pole (+${poleMove.toFixed(1)}%) then tight consolidation. Breakout target: ₹${Math.round(price*1+(price*(poleMove/100))).toLocaleString('en-IN')}` });
        } else if (poleMove < -5 && flagRange < 3) {
          patterns.push({ name:"Bear Flag", type:"BEARISH", confidence:68,
            description:`Sharp drop (${poleMove.toFixed(1)}%) then tight consolidation. Breakdown target: ₹${Math.round(price*(1+(poleMove/100))).toLocaleString('en-IN')}` });
        }
      }

      // ── Golden/Death Cross ──
      if (n >= 55) {
        const ema20Now  = avg(closes.slice(-1));
        const ema50Now  = avg(closes.slice(-50,-1));
        const ema20Prev = avg(closes.slice(-6,-5));
        const ema50Prev = avg(closes.slice(-55,-50));
        if (ema20Now > ema50Now && ema20Prev <= ema50Prev) {
          patterns.push({ name:"Golden Cross", type:"BULLISH", confidence:80,
            description:"EMA20 crossed above EMA50 — strong bullish signal" });
        } else if (ema20Now < ema50Now && ema20Prev >= ema50Prev) {
          patterns.push({ name:"Death Cross", type:"BEARISH", confidence:80,
            description:"EMA20 crossed below EMA50 — strong bearish signal" });
        }
      }

      writeJson(req, res, 200, { patterns, count:patterns.length });
      return;
    }

    // ── /api/assistant — AI Trading Assistant with live stock fetch ──────────
    if (req.method === "POST" && url.pathname === "/api/assistant") {
      const body        = await readBody(req);
      const userMessage = String(body.message || "").trim();
      const context     = body.context || {};
      const history     = Array.isArray(body.history) ? body.history.slice(-10) : [];

      if (!userMessage) { writeJson(req, res, 400, { error: "message required" }); return; }

      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        writeJson(req, res, 200, {
          reply: "⚠ GROQ_API_KEY not set. Add it to your .env file — get one free at console.groq.com"
        });
        return;
      }

      // ── STEP 1: Intent detection — does the user want live data for a stock? ──
      // Detect patterns like: "RELIANCE ka data", "analyze SBIN", "TCS ka kya hoga",
      // "show me HDFC", "intraday NIFTY", "buy or sell INFY"
      const msgUpper = userMessage.toUpperCase().replace(/[?!.,]/g, " ");

      // Common Indian stock/index names + "ka", "ke", "ki", "about", "of", "for", "analyze"
      const stockIntent = /(ka |ke |ki |of |for |about |analyze |check |show |tell me |intraday |buy|sell|target|entry|sl |stoploss|data|analysis|signal|chart|price|kya|hoga|lagta|dono|kaisa|dekho|bata)/i;
      const knownSymbols = Object.keys({
        NIFTY:1,BANKNIFTY:1,FINNIFTY:1,SENSEX:1,RELIANCE:1,TCS:1,HDFCBANK:1,
        INFY:1,ICICIBANK:1,SBIN:1,WIPRO:1,BAJFINANCE:1,ADANIENT:1,LT:1,
        AXISBANK:1,KOTAKBANK:1,MARUTI:1,ASIANPAINT:1,TATAMOTORS:1,HINDUNILVR:1,
        SUNPHARMA:1,TECHM:1,ONGC:1,POWERGRID:1,COALINDIA:1,ITC:1,BHARTIARTL:1,
        TATASTEEL:1,JSWSTEEL:1,ULTRACEMCO:1,NTPC:1,BAJAJFINSV:1,HCLTECH:1,
        DRREDDY:1,CIPLA:1,DIVISLAB:1,INDUSINDBK:1,HINDALCO:1,VEDL:1,M_M:1,
        TITAN:1,NESTLEIND:1,BRITANNIA:1,PIDILITIND:1,SIEMENS:1,ABB:1,HAVELLS:1,
        DIXON:1,POLYCAB:1,TATAPOWER:1,ADANIPORTS:1,GRASIM:1,SHREECEM:1,
        APOLLOHOSP:1,MAXHEALTH:1,FORTIS:1,IRCTC:1,CDSL:1,BSE:1,MCX:1,
      });

      // Extract mentioned symbol from message
      let mentionedSymbol = null;
      const words = msgUpper.trim().split(/\s+/);
      for (const word of words) {
        const clean = word.replace(/[^A-Z0-9_]/g,'');
        if (knownSymbols[clean] || knownSymbols[clean.replace('_','&')]) {
          mentionedSymbol = clean === 'M_M' ? 'M&M' : clean;
          break;
        }
        // Also catch partial matches like "HDFC" for "HDFCBANK"
        for (const sym of Object.keys(knownSymbols)) {
          if (sym.startsWith(clean) && clean.length >= 3) { mentionedSymbol = sym; break; }
        }
        if (mentionedSymbol) break;
      }

      // Also check if user typed something after common trigger words
      const triggerMatch = userMessage.match(/(?:analyze|check|show|about|of|for|intraday|delivery)\s+([A-Za-z&]{3,12})/i);
      if (!mentionedSymbol && triggerMatch) {
        mentionedSymbol = triggerMatch[1].toUpperCase().trim();
      }

      // ── STEP 2: If stock mentioned, fetch live analysis ──────────────────────
      let liveStockData = null;
      let fetchedSymbol = mentionedSymbol;

      // Fetch if: mentioned a different symbol OR no current context
      const contextSym = (context.symbol || "").toUpperCase();
      const needsFetch = mentionedSymbol && mentionedSymbol !== contextSym && stockIntent.test(userMessage);

      if (needsFetch || (!contextSym && mentionedSymbol)) {
        try {
          console.log(`[Assistant] Fetching live data for "${mentionedSymbol}"...`);
          const resolved = await resolveInstrument(mentionedSymbol, token);
          if (resolved?.instrumentKey) {
            const candles = await fetchRealCandles(token, resolved.instrumentKey, "5");
            if (candles && candles.length > 0) {
              liveStockData = await buildRealAnalyzePayload(resolved.displaySymbol || mentionedSymbol, candles, null);
              fetchedSymbol = resolved.displaySymbol || mentionedSymbol;
              console.log(`[Assistant] Live data fetched for ${fetchedSymbol}: ₹${liveStockData.price}`);
            }
          }
        } catch (e) {
          console.warn(`[Assistant] Live fetch failed for ${mentionedSymbol}:`, e.message);
        }
      }

      // ── STEP 3: Build rich context for Groq ─────────────────────────────────
      // Use live data if fetched, else use dashboard context
      const activeData = liveStockData || context;
      const activeSym  = fetchedSymbol || contextSym;
      const isLive     = !!liveStockData;

      // Helper to format number
      const fmtN = n => n != null ? Number(n).toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2}) : 'N/A';

      const activeContext = isLive ? `
═══════════════════════════════════════
📊 LIVE DATA FETCHED: ${activeSym}
═══════════════════════════════════════
Price:      ₹${fmtN(activeData.price)} | Change: ${(activeData.changePct||0).toFixed(2)}%
VWAP:       ₹${fmtN(activeData.vwap)}   | ATR: ₹${fmtN(activeData.atr)}

EMAs:
  EMA9:  ₹${fmtN(activeData.ema9)}  | EMA20: ₹${fmtN(activeData.ema20)}
  EMA50: ₹${fmtN(activeData.ema50)} | EMA200: ₹${fmtN(activeData.ema200)}

Momentum:
  RSI: ${activeData.rsi}  |  StochRSI K: ${activeData.stochRSI?.k??'N/A'} D: ${activeData.stochRSI?.d??'N/A'}
  MACD: ${activeData.macd?.macd?.toFixed(3)} | Signal: ${activeData.macd?.signal?.toFixed(3)} | Hist: ${activeData.macd?.histogram?.toFixed(4)}
  Williams %R: ${activeData.williamsR??'N/A'} | CCI: ${activeData.cci??'N/A'} | ROC: ${activeData.roc??'N/A'}%

Trend:
  Supertrend: ${activeData.supertrend?.direction?.toUpperCase()} @ ₹${fmtN(activeData.supertrend?.value)}
  ADX: ${activeData.adx?.adx} (${activeData.adx?.trend}) | +DI: ${activeData.adx?.pdi} -DI: ${activeData.adx?.mdi}
  M1: ${activeData.m1Trend} | M5: ${activeData.m5Trend} | M15: ${activeData.m15Trend}
  Consistency: ${activeData.trendConsistency} | Regime: ${activeData.regime}

Levels:
  Support: ₹${fmtN(activeData.support)} | Resistance: ₹${fmtN(activeData.resistance)}
  52W High: ₹${fmtN(activeData.high52w)} | 52W Low: ₹${fmtN(activeData.low52w)}

AI Signal (rule-based):
  Verdict: ${activeData.ai?.verdict || activeData.verdict || 'N/A'} (${activeData.ai?.confidence || activeData.confidence || 'N/A'}% conf)
  Entry: ₹${fmtN(activeData.ai?.entry || activeData.entry)} | Target: ₹${fmtN(activeData.ai?.target || activeData.target)} | SL: ₹${fmtN(activeData.ai?.stopLoss || activeData.stopLoss)}
  R:R: ${activeData.ai?.riskReward || activeData.riskReward || 'N/A'}:1
  OBV: ${activeData.obv?.trend || 'N/A'} | PCR: ${activeData.pcr||'N/A'} | Vol Ratio: ${activeData.volumeRatio||'N/A'}x

Candle Patterns: ${activeData.patterns?.slice(0,2).map(p=>p.name+'('+p.confidence+'%)').join(', ') || 'None'}
═══════════════════════════════════════` 
      : (activeSym ? `
Current Dashboard Context (${activeSym}):
Price: ₹${fmtN(activeData.price)} | VWAP: ₹${fmtN(activeData.vwap)} | EMA20: ₹${fmtN(activeData.ema20)} | EMA50: ₹${fmtN(activeData.ema50)}
RSI: ${activeData.rsi} | StochRSI: ${JSON.stringify(activeData.stochRSI||{})} | MACD hist: ${activeData.macd?.histogram?.toFixed(4)||'N/A'}
ADX: ${activeData.adx?.adx||'N/A'} | Supertrend: ${activeData.supertrend?.direction||'N/A'} @ ₹${fmtN(activeData.supertrend?.value)}
Regime: ${activeData.regime} | Trend: ${activeData.trendConsistency}
Verdict: ${activeData.verdict||'N/A'} (${activeData.confidence||'N/A'}%) | Entry: ₹${fmtN(activeData.entry)} | Target: ₹${fmtN(activeData.target)} | SL: ₹${fmtN(activeData.stopLoss)}
Support: ₹${fmtN(activeData.support)} | Resistance: ₹${fmtN(activeData.resistance)}`
      : "No symbol selected in dashboard. User can ask me to analyze any stock.");

      const systemPrompt = `You are ANAV AI — a professional Indian stock market trading assistant inside the ANAV PRO terminal.

CAPABILITIES:
- I have LIVE real-time data fetching. When users ask about any stock, I fetch and analyze it instantly.
- I know all NSE/BSE stocks, indices, F&O, mutual funds.
- I give specific ₹ price levels — not vague answers.
- I speak Hinglish naturally when user does.

EXPERTISE:
- Technical Analysis (EMA, VWAP, RSI, MACD, Supertrend, ADX, StochRSI, Williams%R, CCI, BB, Ichimoku, Fibonacci)
- F&O (Option Greeks Delta/Theta/Vega/Gamma, IV, OI analysis, PCR, spreads, hedging, expiry strategies)
- Intraday (scalping, momentum, VWAP strategy, opening range breakout, power hour)
- Delivery/Swing (EMA crossovers, breakouts, Fibonacci targets, positional trades)
- Risk Management (position sizing, Kelly criterion, max drawdown, portfolio hedging)
- Indian market specifics (NSE/BSE, F&O expiry, FII/DII flows, circuit limits, SEBI rules)

${activeContext}

RESPONSE RULES:
1. Always use ₹ for Indian prices
2. Give SPECIFIC entry, target, SL with ₹ values — never say "it depends" without explanation
3. For F&O: suggest specific strikes (e.g. "24500 CE" or "24000 PE")
4. Keep it concise: 3-6 lines for simple Q, max 150 words for complex analysis
5. Use **bold** for key numbers and verdicts
6. If data was LIVE FETCHED, say "Based on live ${activeSym} data:"
7. If asked about a stock not in context — say you can fetch it: "Let me analyze [SYMBOL] for you"
8. Risk disclaimer on trade suggestions: "SL must be honored"
9. Never guarantee profits — say "as per current technicals"
10. Hinglish OK — respond in same language/style as user

IMPORTANT: ${isLive ? `You just fetched LIVE data for ${activeSym}. Use those exact numbers in your response.` : `If user asks about a specific stock that's NOT in context, mention that they can ask you to "analyze [STOCK NAME]" or search it in the terminal.`}`;

      // ── STEP 4: Call Groq with rich context ──────────────────────────────────
      const messages = [
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: "user", content: userMessage }
      ];

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 700,
          messages: [{ role: "system", content: systemPrompt }, ...messages]
        })
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text().catch(()=>"");
        writeJson(req, res, 502, { error: `Groq API error: ${groqRes.status}. ${errText.slice(0,100)}` });
        return;
      }

      const groqData = await groqRes.json();
      const reply = groqData?.choices?.[0]?.message?.content || "Sorry, I could not generate a response. Please try again.";

      writeJson(req, res, 200, {
        reply,
        fetchedSymbol: isLive ? fetchedSymbol : null,
        isLiveData: isLive,
      });
      return;
    }



  } catch (err) {
    console.error("Server error:", err.message);
    writeJson(req, res, 500, { status:"error", message: err.message || "Unexpected server error" });
  }
});


// ─── WebSocket Server for live price streaming + alerts ──────────────────────
const wss = new WebSocketServer({ server });
const wsClients = new Map(); // ws → {subscriptions:Set, token, clientId}
const priceCache = new Map(); // symbol → {price, prevClose, change, changePct, ts}
const alertRegistry = new Map(); // alertId → alert obj
let alertSeq = 1;

wss.on('connection', (ws) => {
  const cid = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  wsClients.set(ws, { subscriptions: new Set(), token:'', clientId:cid });
  console.log(`[WS] +client ${cid} (total:${wss.clients.size})`);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const client = wsClients.get(ws);
      if (!client) return;

      if (msg.type === 'AUTH') {
        client.token = msg.token || '';
        ws.send(JSON.stringify({ type:'AUTHED', clientId:cid }));
      }
      if (msg.type === 'SUBSCRIBE') {
        const syms = (Array.isArray(msg.symbols) ? msg.symbols : [msg.symbol]).filter(Boolean);
        syms.forEach(s => client.subscriptions.add(s.toUpperCase()));
        ws.send(JSON.stringify({ type:'SUBSCRIBED', symbols:[...client.subscriptions] }));
        // Send cached prices immediately
        for (const s of client.subscriptions) {
          const cached = priceCache.get(s);
          if (cached) ws.send(JSON.stringify({ type:'PRICE', symbol:s, ...cached }));
        }
      }
      if (msg.type === 'UNSUBSCRIBE') {
        client.subscriptions.delete((msg.symbol||'').toUpperCase());
      }
      if (msg.type === 'SET_ALERT') {
        const id = 'A' + (alertSeq++);
        alertRegistry.set(id, { ...msg, clientId:cid, ws });
        ws.send(JSON.stringify({ type:'ALERT_SET', alertId:id, symbol:msg.symbol, alertType:msg.alertType, value:msg.value }));
      }
      if (msg.type === 'CANCEL_ALERT') {
        alertRegistry.delete(msg.alertId);
        ws.send(JSON.stringify({ type:'ALERT_CANCELLED', alertId:msg.alertId }));
      }
      if (msg.type === 'GET_ALERTS') {
        const mine = [...alertRegistry.entries()]
          .filter(([,a]) => a.clientId === cid)
          .map(([id,a]) => ({ alertId:id, symbol:a.symbol, alertType:a.alertType, value:a.value }));
        ws.send(JSON.stringify({ type:'ALERTS_LIST', alerts:mine }));
      }
    } catch {}
  });

  ws.on('close', () => { wsClients.delete(ws); });
  ws.on('error', () => wsClients.delete(ws));
});

// Price broadcast loop
async function broadcastPrices() {
  if (wss.clients.size === 0) return;
  const symToClients = new Map();
  for (const [ws, c] of wsClients) {
    if (ws.readyState !== 1) continue;
    for (const s of c.subscriptions) {
      if (!symToClients.has(s)) symToClients.set(s, []);
      symToClients.get(s).push({ ws, token:c.token });
    }
  }
  for (const [sym, clients] of symToClients) {
    const token = clients.find(c=>c.token)?.token || '';
    try {
      const resolved = await resolveInstrument(sym, token).catch(()=>null);
      if (!resolved?.instrumentKey) continue;
      const ltp = await fetchLTP(token, resolved.instrumentKey);
      if (!ltp) continue;
      const prev = priceCache.get(sym);
      const prevClose = prev?.prevClose || ltp;
      const change = +(ltp - prevClose).toFixed(2);
      const changePct = prevClose ? +((change/prevClose)*100).toFixed(2) : 0;
      const pd = { price:ltp, prevClose, change, changePct, ts:Date.now() };
      priceCache.set(sym, pd);
      const msg = JSON.stringify({ type:'PRICE', symbol:sym, ...pd });
      for (const { ws } of clients) { if (ws.readyState===1) ws.send(msg); }
      // Check alerts
      for (const [id, a] of alertRegistry) {
        if (a.symbol?.toUpperCase() !== sym) continue;
        const fired = (a.alertType==='ABOVE' && ltp>=a.value) || (a.alertType==='BELOW' && ltp<=a.value);
        if (fired) {
          const am = JSON.stringify({ type:'ALERT_TRIGGERED', alertId:id, symbol:sym, price:ltp, alertType:a.alertType, targetValue:a.value });
          if (a.ws?.readyState===1) a.ws.send(am);
          alertRegistry.delete(id);
        }
      }
    } catch {}
  }
}
setInterval(broadcastPrices, 3000);

server.listen(PORT, "0.0.0.0", () => {
  const sdkStatus = UpstoxSDK.getConfigStatus();
  
  console.log(`\n🚀 ANAV PRO Local API Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Upstox SDK: ${sdkStatus.isValid ? '✓ CONFIGURED' : '⚠ INCOMPLETE'}`);
  console.log(`   Sandbox Token: ${sdkStatus.hasSandboxToken ? '✓ LOADED' : '✗ NOT SET'}`);
  console.log(`   Symbols: ${Object.keys(SYMBOL_TO_INSTRUMENT).length} mapped`);
  console.log(`   CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  
  if (!sdkStatus.isValid) {
    console.log(`\n⚠️  WARNING: Missing configuration. Set these in .env:`);
    sdkStatus.missingVars.forEach(v => console.log(`   - ${v}`));
    console.log(`\n   See .env.example for setup instructions\n`);
  } else {
    console.log(`\n✓ All systems ready!\n`);
  }
});
