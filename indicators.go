package main

import (
	"fmt"
	"math"
)

// ── EMA ──────────────────────────────────────────────────────────────────────
func calcEMA(closes []float64, period int) float64 {
	if len(closes) < period {
		return closes[len(closes)-1]
	}
	k := 2.0 / float64(period+1)
	// Seed with SMA
	sum := 0.0
	for _, v := range closes[:period] {
		sum += v
	}
	ema := sum / float64(period)
	for _, v := range closes[period:] {
		ema = v*k + ema*(1-k)
	}
	return round2(ema)
}

func calcEMASeries(closes []float64, period int) []float64 {
	result := make([]float64, len(closes))
	if len(closes) < period {
		return result
	}
	k := 2.0 / float64(period+1)
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += closes[i]
	}
	ema := sum / float64(period)
	for i := 0; i < period-1; i++ {
		result[i] = 0
	}
	result[period-1] = ema
	for i := period; i < len(closes); i++ {
		ema = closes[i]*k + ema*(1-k)
		result[i] = round2(ema)
	}
	return result
}

// ── RSI (Wilder) ─────────────────────────────────────────────────────────────
func calcRSI(closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return 50
	}
	var gains, losses float64
	for i := 1; i <= period; i++ {
		ch := closes[i] - closes[i-1]
		if ch > 0 {
			gains += ch
		} else {
			losses -= ch
		}
	}
	avgGain := gains / float64(period)
	avgLoss := losses / float64(period)
	for i := period + 1; i < len(closes); i++ {
		ch := closes[i] - closes[i-1]
		if ch > 0 {
			avgGain = (avgGain*float64(period-1) + ch) / float64(period)
			avgLoss = (avgLoss * float64(period-1)) / float64(period)
		} else {
			avgGain = (avgGain * float64(period-1)) / float64(period)
			avgLoss = (avgLoss*float64(period-1) - ch) / float64(period)
		}
	}
	if avgLoss == 0 {
		return 100
	}
	rs := avgGain / avgLoss
	return round2(100 - 100/(1+rs))
}

// ── ATR (Wilder) ─────────────────────────────────────────────────────────────
func calcATR(candles []Candle, period int) float64 {
	if len(candles) < 2 {
		return 0
	}
	trs := make([]float64, len(candles)-1)
	for i := 1; i < len(candles); i++ {
		hl := candles[i].High - candles[i].Low
		hpc := math.Abs(candles[i].High - candles[i-1].Close)
		lpc := math.Abs(candles[i].Low - candles[i-1].Close)
		trs[i-1] = math.Max(hl, math.Max(hpc, lpc))
	}
	if len(trs) < period {
		sum := 0.0
		for _, v := range trs {
			sum += v
		}
		return round2(sum / float64(len(trs)))
	}
	sum := 0.0
	for _, v := range trs[:period] {
		sum += v
	}
	atr := sum / float64(period)
	for _, v := range trs[period:] {
		atr = (atr*float64(period-1) + v) / float64(period)
	}
	return round2(atr)
}

// ── VWAP ─────────────────────────────────────────────────────────────────────
func calcVWAP(candles []Candle) float64 {
	if len(candles) == 0 {
		return 0
	}
	var num, den float64
	src := candles
	if len(candles) > 20 {
		src = candles[len(candles)-20:]
	}
	for _, c := range src {
		tp := (c.High + c.Low + c.Close) / 3
		vol := math.Max(c.Volume, 1)
		num += tp * vol
		den += vol
	}
	if den == 0 {
		return 0
	}
	return round2(num / den)
}

// ── VWAP Bands ───────────────────────────────────────────────────────────────
type VWAPBands struct {
	VWAP   float64 `json:"vwap"`
	Upper1 float64 `json:"upper1"`
	Lower1 float64 `json:"lower1"`
	Upper2 float64 `json:"upper2"`
	Lower2 float64 `json:"lower2"`
}

func calcVWAPBands(candles []Candle) *VWAPBands {
	src := candles
	if len(src) > 30 {
		src = src[len(src)-30:]
	}
	if len(src) < 2 {
		return nil
	}
	var cumTPV, cumVol float64
	tps := make([]float64, len(src))
	vols := make([]float64, len(src))
	for i, c := range src {
		tp := (c.High + c.Low + c.Close) / 3
		v := math.Max(c.Volume, 1)
		cumTPV += tp * v
		cumVol += v
		tps[i] = tp
		vols[i] = v
	}
	vwap := cumTPV / cumVol
	var variance float64
	for i := range src {
		variance += vols[i] * math.Pow(tps[i]-vwap, 2)
	}
	sd := math.Sqrt(variance / cumVol)
	return &VWAPBands{
		VWAP:   round2(vwap),
		Upper1: round2(vwap + sd),
		Lower1: round2(vwap - sd),
		Upper2: round2(vwap + 2*sd),
		Lower2: round2(vwap - 2*sd),
	}
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────
type BollingerBands struct {
	Upper  float64 `json:"upper"`
	Middle float64 `json:"middle"`
	Lower  float64 `json:"lower"`
	Width  float64 `json:"width"`
	StdDev float64 `json:"stdDev"`
}

func calcBollingerBands(closes []float64, period int, mult float64) *BollingerBands {
	if len(closes) < period {
		return nil
	}
	sl := closes[len(closes)-period:]
	sum := 0.0
	for _, v := range sl {
		sum += v
	}
	mid := sum / float64(period)
	variance := 0.0
	for _, v := range sl {
		variance += math.Pow(v-mid, 2)
	}
	sd := math.Sqrt(variance / float64(period))
	upper := mid + mult*sd
	lower := mid - mult*sd
	return &BollingerBands{
		Upper:  round2(upper),
		Middle: round2(mid),
		Lower:  round2(lower),
		Width:  round2((upper - lower) / mid * 100),
		StdDev: round2(sd),
	}
}

// ── MACD ──────────────────────────────────────────────────────────────────────
type MACDResult struct {
	Line      float64 `json:"line"`
	Signal    float64 `json:"signal"`
	Histogram float64 `json:"histogram"`
}

func calcMACD(closes []float64) *MACDResult {
	if len(closes) < 26 {
		return nil
	}
	ema12 := calcEMA(closes, 12)
	ema26 := calcEMA(closes, 26)
	line := ema12 - ema26

	// Signal = EMA9 of MACD line (approximate with last values)
	macdSeries := make([]float64, len(closes))
	e12s := calcEMASeries(closes, 12)
	e26s := calcEMASeries(closes, 26)
	for i := range closes {
		if e12s[i] != 0 && e26s[i] != 0 {
			macdSeries[i] = e12s[i] - e26s[i]
		}
	}
	// Filter non-zero
	var valid []float64
	for _, v := range macdSeries {
		if v != 0 {
			valid = append(valid, v)
		}
	}
	signal := 0.0
	if len(valid) >= 9 {
		signal = calcEMA(valid, 9)
	}
	return &MACDResult{
		Line:      round2(line),
		Signal:    round2(signal),
		Histogram: round2(line - signal),
	}
}

// ── Supertrend ────────────────────────────────────────────────────────────────
type SupertrendResult struct {
	Value     float64 `json:"value"`
	Direction string  `json:"direction"`
}

func calcSupertrend(candles []Candle, period int, mult float64) *SupertrendResult {
	if len(candles) < period+1 {
		return &SupertrendResult{Direction: "up", Value: 0}
	}
	atr := calcATR(candles, period)
	last := candles[len(candles)-1]
	mid := (last.High + last.Low) / 2
	upper := mid + mult*atr
	lower := mid - mult*atr

	prevClose := candles[len(candles)-2].Close
	direction := "up"
	value := lower
	if prevClose < lower {
		direction = "down"
		value = upper
	}
	if last.Close > upper {
		direction = "up"
		value = lower
	} else if last.Close < lower {
		direction = "down"
		value = upper
	}
	return &SupertrendResult{Value: round2(value), Direction: direction}
}

// ── ADX ───────────────────────────────────────────────────────────────────────
type ADXResult struct {
	ADX   float64 `json:"adx"`
	PDI   float64 `json:"pdi"`
	MDI   float64 `json:"mdi"`
	Trend string  `json:"trend"`
}

func calcADX(candles []Candle, period int) *ADXResult {
	if len(candles) < period*2 {
		return &ADXResult{ADX: 0, PDI: 0, MDI: 0, Trend: "RANGING"}
	}
	var pdm, mdm, tr []float64
	for i := 1; i < len(candles); i++ {
		upMove := candles[i].High - candles[i-1].High
		downMove := candles[i-1].Low - candles[i].Low
		pdm = append(pdm, math.Max(upMove, 0))
		if upMove > downMove {
			mdm = append(mdm, 0)
		} else {
			mdm = append(mdm, math.Max(downMove, 0))
		}
		hl := candles[i].High - candles[i].Low
		hpc := math.Abs(candles[i].High - candles[i-1].Close)
		lpc := math.Abs(candles[i].Low - candles[i-1].Close)
		tr = append(tr, math.Max(hl, math.Max(hpc, lpc)))
	}
	// Wilder smooth
	wilderSmooth := func(data []float64, p int) []float64 {
		if len(data) < p {
			return data
		}
		result := make([]float64, len(data))
		sum := 0.0
		for i := 0; i < p; i++ {
			sum += data[i]
		}
		result[p-1] = sum
		for i := p; i < len(data); i++ {
			result[i] = result[i-1] - result[i-1]/float64(p) + data[i]
		}
		return result
	}
	smoothTR := wilderSmooth(tr, period)
	smoothPDM := wilderSmooth(pdm, period)
	smoothMDM := wilderSmooth(mdm, period)

	n := len(smoothTR) - 1
	sTR := smoothTR[n]
	if sTR == 0 {
		return &ADXResult{ADX: 0, PDI: 0, MDI: 0, Trend: "RANGING"}
	}
	pdi := 100 * smoothPDM[n] / sTR
	mdi := 100 * smoothMDM[n] / sTR
	dx := 100 * math.Abs(pdi-mdi) / (pdi + mdi)

	// Approximate ADX
	adx := dx * 0.8 // simplified
	trend := "RANGING"
	if adx > 25 {
		if pdi > mdi {
			trend = "BULLISH"
		} else {
			trend = "BEARISH"
		}
	}
	return &ADXResult{ADX: round2(adx), PDI: round2(pdi), MDI: round2(mdi), Trend: trend}
}

// ── Fibonacci ─────────────────────────────────────────────────────────────────
type FibResult struct {
	Fib0    float64 `json:"fib0"`
	Fib236  float64 `json:"fib236"`
	Fib382  float64 `json:"fib382"`
	Fib500  float64 `json:"fib500"`
	Fib618  float64 `json:"fib618"`
	Fib786  float64 `json:"fib786"`
	Fib1000 float64 `json:"fib1000"`
	Fib1272 float64 `json:"fib1272"`
	Fib1618 float64 `json:"fib1618"`
}

func calcFibonacci(candles []Candle) *FibResult {
	if len(candles) < 10 {
		return nil
	}
	src := candles
	if len(src) > 50 {
		src = src[len(src)-50:]
	}
	high := src[0].High
	low := src[0].Low
	for _, c := range src {
		if c.High > high {
			high = c.High
		}
		if c.Low < low {
			low = c.Low
		}
	}
	rng := high - low
	return &FibResult{
		Fib0:    round2(high),
		Fib236:  round2(high - rng*0.236),
		Fib382:  round2(high - rng*0.382),
		Fib500:  round2(high - rng*0.500),
		Fib618:  round2(high - rng*0.618),
		Fib786:  round2(high - rng*0.786),
		Fib1000: round2(low),
		Fib1272: round2(low + rng*0.272),
		Fib1618: round2(low + rng*0.618),
	}
}

// ── Pivot Points ──────────────────────────────────────────────────────────────
type PivotResult struct {
	PP float64 `json:"pp"`
	R1 float64 `json:"r1"`
	R2 float64 `json:"r2"`
	R3 float64 `json:"r3"`
	S1 float64 `json:"s1"`
	S2 float64 `json:"s2"`
	S3 float64 `json:"s3"`
}

func calcPivotPoints(high, low, close float64) *PivotResult {
	pp := (high + low + close) / 3
	return &PivotResult{
		PP: round2(pp),
		R1: round2(2*pp - low),
		R2: round2(pp + (high - low)),
		R3: round2(high + 2*(pp-low)),
		S1: round2(2*pp - high),
		S2: round2(pp - (high - low)),
		S3: round2(low - 2*(high-pp)),
	}
}

// ── OBV ───────────────────────────────────────────────────────────────────────
type OBVResult struct {
	Value float64 `json:"value"`
	Trend string  `json:"trend"`
}

func calcOBV(candles []Candle) *OBVResult {
	if len(candles) < 2 {
		return &OBVResult{Trend: "NEUTRAL"}
	}
	obv := 0.0
	for i := 1; i < len(candles); i++ {
		if candles[i].Close > candles[i-1].Close {
			obv += candles[i].Volume
		} else if candles[i].Close < candles[i-1].Close {
			obv -= candles[i].Volume
		}
	}
	trend := "NEUTRAL"
	if obv > 0 {
		trend = "ACCUMULATION"
	} else {
		trend = "DISTRIBUTION"
	}
	return &OBVResult{Value: round2(obv), Trend: trend}
}

// ── ORB ───────────────────────────────────────────────────────────────────────
type ORBRange struct {
	High  float64 `json:"high"`
	Low   float64 `json:"low"`
	Range float64 `json:"range"`
}

type ORBResult struct {
	ORB15  *ORBRange `json:"orb15"`
	ORB30  *ORBRange `json:"orb30"`
	Signal string    `json:"signal"`
}

func calcORB(candles []Candle) *ORBResult {
	if len(candles) < 3 {
		return nil
	}
	// Use first N candles as ORB (assume intraday 1m or 5m)
	orb15Count := 15
	orb30Count := 30
	if len(candles) < orb15Count {
		orb15Count = len(candles) / 3
	}

	calcRange := func(cc []Candle) *ORBRange {
		if len(cc) == 0 {
			return nil
		}
		h, l := cc[0].High, cc[0].Low
		for _, c := range cc {
			if c.High > h { h = c.High }
			if c.Low < l { l = c.Low }
		}
		return &ORBRange{High: round2(h), Low: round2(l), Range: round2(h - l)}
	}

	orb15 := calcRange(candles[:orb15Count])
	orb30 := (*ORBRange)(nil)
	if len(candles) >= orb30Count {
		orb30 = calcRange(candles[:orb30Count])
	}

	lastClose := candles[len(candles)-1].Close
	signal := "INSIDE"
	if orb15 != nil {
		if lastClose > orb15.High {
			signal = "BULLISH_BREAKOUT"
		} else if lastClose < orb15.Low {
			signal = "BEARISH_BREAKDOWN"
		}
	}

	return &ORBResult{ORB15: orb15, ORB30: orb30, Signal: signal}
}

// ── Circuit Limits ────────────────────────────────────────────────────────────
type CircuitLimits struct {
	Upper5  float64 `json:"upper5"`
	Lower5  float64 `json:"lower5"`
	Upper10 float64 `json:"upper10"`
	Lower10 float64 `json:"lower10"`
	Upper20 float64 `json:"upper20"`
	Lower20 float64 `json:"lower20"`
}

func calcCircuitLimits(price float64) *CircuitLimits {
	return &CircuitLimits{
		Upper5:  round2(price * 1.05),
		Lower5:  round2(price * 0.95),
		Upper10: round2(price * 1.10),
		Lower10: round2(price * 0.90),
		Upper20: round2(price * 1.20),
		Lower20: round2(price * 0.80),
	}
}

// ── Volume comparison ─────────────────────────────────────────────────────────
type VolComparison struct {
	Ratio  float64 `json:"ratio"`
	Signal string  `json:"signal"`
}

func calcVolumeComparison(candles []Candle) *VolComparison {
	if len(candles) < 5 {
		return nil
	}
	recent := candles[len(candles)-1].Volume
	var sum float64
	n := math.Min(float64(len(candles)-1), 20)
	for _, c := range candles[len(candles)-int(n)-1 : len(candles)-1] {
		sum += c.Volume
	}
	avg := sum / n
	if avg == 0 {
		return nil
	}
	ratio := round2(recent / avg)
	signal := "NORMAL"
	if ratio > 2 {
		signal = "VERY_HIGH"
	} else if ratio > 1.4 {
		signal = "HIGH"
	} else if ratio < 0.6 {
		signal = "LOW"
	}
	return &VolComparison{Ratio: ratio, Signal: signal}
}

// ── PDH/PDL ───────────────────────────────────────────────────────────────────
type PDHDPL struct {
	PDH float64 `json:"pdh"`
	PDL float64 `json:"pdl"`
	PDC float64 `json:"pdc"`
}

func calcPDHPDL(candles []Candle) *PDHDPL {
	if len(candles) < 4 {
		return nil
	}
	prev := candles[:len(candles)/3]
	h, l := prev[0].High, prev[0].Low
	for _, c := range prev {
		if c.High > h { h = c.High }
		if c.Low < l { l = c.Low }
	}
	return &PDHDPL{
		PDH: round2(h),
		PDL: round2(l),
		PDC: round2(prev[len(prev)-1].Close),
	}
}

// ── Gap Analysis ──────────────────────────────────────────────────────────────
type GapAnalysis struct {
	GapPct float64 `json:"gapPct"`
	Type   string  `json:"type"`
}

func calcGapAnalysis(candles []Candle, pd *PDHDPL) *GapAnalysis {
	if pd == nil || len(candles) == 0 {
		return nil
	}
	todayOpen := candles[len(candles)/3].Open
	gap := todayOpen - pd.PDC
	gapPct := 0.0
	if pd.PDC > 0 {
		gapPct = round2(gap / pd.PDC * 100)
	}
	gapType := "FLAT"
	switch {
	case gapPct > 1:
		gapType = "GAP_UP_STRONG"
	case gapPct > 0.3:
		gapType = "GAP_UP"
	case gapPct < -1:
		gapType = "GAP_DOWN_STRONG"
	case gapPct < -0.3:
		gapType = "GAP_DOWN"
	}
	return &GapAnalysis{GapPct: gapPct, Type: gapType}
}

// ── 52W High/Low ─────────────────────────────────────────────────────────────
func calc52W(candles []Candle) (float64, float64) {
	src := candles
	if len(src) > 365 {
		src = src[len(src)-365:]
	}
	h, l := src[0].High, src[0].Low
	for _, c := range src {
		if c.High > h { h = c.High }
		if c.Low < l { l = c.Low }
	}
	return round2(h), round2(l)
}


// ── StochRSI ──────────────────────────────────────────────────────────────────
func calcStochRSI(closes []float64, rsiPeriod, stochPeriod, kSmooth, dSmooth int) *StochRSIResult {
	if len(closes) < rsiPeriod+stochPeriod+kSmooth+dSmooth {
		return &StochRSIResult{K: 50, D: 50}
	}
	// Build RSI series
	rsiSeries := make([]float64, len(closes))
	for i := rsiPeriod; i < len(closes); i++ {
		rsiSeries[i] = calcRSI(closes[:i+1], rsiPeriod)
	}
	// Stochastic of RSI
	stochSeries := make([]float64, len(rsiSeries))
	for i := rsiPeriod + stochPeriod; i < len(rsiSeries); i++ {
		window := rsiSeries[i-stochPeriod+1 : i+1]
		lo, hi := window[0], window[0]
		for _, v := range window { if v < lo { lo = v }; if v > hi { hi = v } }
		if hi-lo > 0 { stochSeries[i] = (rsiSeries[i]-lo)/(hi-lo)*100 }
	}
	// K = SMA(stoch, kSmooth)
	kSeries := make([]float64, len(stochSeries))
	for i := kSmooth - 1; i < len(stochSeries); i++ {
		sum := 0.0
		for _, v := range stochSeries[i-kSmooth+1 : i+1] { sum += v }
		kSeries[i] = sum / float64(kSmooth)
	}
	// D = SMA(K, dSmooth)
	dSeries := make([]float64, len(kSeries))
	for i := dSmooth - 1; i < len(kSeries); i++ {
		sum := 0.0
		for _, v := range kSeries[i-dSmooth+1 : i+1] { sum += v }
		dSeries[i] = sum / float64(dSmooth)
	}
	return &StochRSIResult{
		K: round2(kSeries[len(kSeries)-1]),
		D: round2(dSeries[len(dSeries)-1]),
	}
}

// ── Support & Resistance ──────────────────────────────────────────────────────
func calcSupportResistance(candles []Candle) (support, resistance float64) {
	if len(candles) < 5 { return 0, 0 }
	src := candles
	if len(src) > 50 { src = src[len(src)-50:] }
	// Find swing highs and lows
	var highs, lows []float64
	for i := 2; i < len(src)-2; i++ {
		if src[i].High > src[i-1].High && src[i].High > src[i-2].High &&
			src[i].High > src[i+1].High && src[i].High > src[i+2].High {
			highs = append(highs, src[i].High)
		}
		if src[i].Low < src[i-1].Low && src[i].Low < src[i-2].Low &&
			src[i].Low < src[i+1].Low && src[i].Low < src[i+2].Low {
			lows = append(lows, src[i].Low)
		}
	}
	price := src[len(src)-1].Close
	support, resistance = src[len(src)-1].Low, src[len(src)-1].High
	for _, h := range highs { if h > price && (resistance == src[len(src)-1].High || h < resistance) { resistance = h } }
	for _, l := range lows  { if l < price && (support == src[len(src)-1].Low || l > support)        { support = l    } }
	return round2(support), round2(resistance)
}

// ── Trend detection ────────────────────────────────────────────────────────────
func detectTrend(price, ema float64) string {
	if price > ema*1.002 { return "BULLISH" }
	if price < ema*0.998 { return "BEARISH" }
	return "NEUTRAL"
}


// ── Williams %R ───────────────────────────────────────────────────────────────
func calcWilliamsR(candles []Candle, period int) float64 {
	if len(candles) < period { return -50 }
	src := candles[len(candles)-period:]
	high := src[0].High
	low  := src[0].Low
	for _, c := range src {
		if c.High > high { high = c.High }
		if c.Low < low   { low  = c.Low  }
	}
	close := candles[len(candles)-1].Close
	if high == low { return -50 }
	return round2((high - close) / (high - low) * -100)
}

// ── CCI (Commodity Channel Index) ────────────────────────────────────────────
func calcCCI(candles []Candle, period int) float64 {
	if len(candles) < period { return 0 }
	src := candles[len(candles)-period:]
	tps := make([]float64, period)
	sum := 0.0
	for i, c := range src {
		tp := (c.High + c.Low + c.Close) / 3
		tps[i] = tp
		sum += tp
	}
	mean := sum / float64(period)
	mad  := 0.0
	for _, tp := range tps { mad += math.Abs(tp - mean) }
	mad /= float64(period)
	if mad == 0 { return 0 }
	return round2((tps[period-1] - mean) / (0.015 * mad))
}

// ── ROC (Rate of Change) ──────────────────────────────────────────────────────
func calcROC(closes []float64, period int) float64 {
	if len(closes) <= period { return 0 }
	prev := closes[len(closes)-1-period]
	if prev == 0 { return 0 }
	return round2((closes[len(closes)-1] - prev) / prev * 100)
}

// ── AI Scoring ────────────────────────────────────────────────────────────────

func calcAIVerdict(price, vwap, ema20, ema50 float64, rsi float64,
	macd *MACDResult, supertrend *SupertrendResult, adx *ADXResult,
	volRatio float64, atr float64) *AIResult {

	score := 0
	max := 0

	add := func(pass bool, weight int) {
		max += weight
		if pass { score += weight }
	}

	add(price > vwap, 3)
	add(price > ema20, 3)
	add(supertrend != nil && supertrend.Direction == "up", 3)
	add(rsi > 40 && rsi < 72, 2)
	add(macd != nil && macd.Histogram > 0, 2)
	add(volRatio > 1.0, 2)
	add(adx != nil && adx.ADX > 18, 2)
	add(price > ema50, 1)
	add(ema20 > ema50, 1)
	add(rsi > 50, 1)

	pct := 0
	if max > 0 { pct = score * 100 / max }

	verdict := "HOLD"
	if pct >= 65 { verdict = "BUY" }
	if pct <= 35 { verdict = "SELL" }

	// Entry/Target/SL
	entry := price
	sl := price - 2*atr
	target := price + 3*atr
	if verdict == "SELL" {
		sl = price + 2*atr
		target = price - 3*atr
	}
	rr := 0.0
	if math.Abs(entry-sl) > 0 {
		rr = round2(math.Abs(target-entry) / math.Abs(entry-sl))
	}

	// Build reasons list
	reasons := []string{}
	risks := []string{}
	if price > vwap { reasons = append(reasons, "Price above VWAP — bullish bias") } else { risks = append(risks, "Price below VWAP — bearish bias") }
	if price > ema20 { reasons = append(reasons, "Above EMA20 — short-term trend up") } else { risks = append(risks, "Below EMA20 — short-term weak") }
	if supertrend != nil && supertrend.Direction == "up" { reasons = append(reasons, "Supertrend BULLISH") } else { risks = append(risks, "Supertrend BEARISH") }
	if macd != nil && macd.Histogram > 0 { reasons = append(reasons, "MACD histogram positive") } else { risks = append(risks, "MACD histogram negative") }
	if rsi < 30 { reasons = append(reasons, "RSI oversold — reversal possible") } else if rsi > 70 { risks = append(risks, "RSI overbought — correction risk") }

	// Trend alignment
	trendAlign := "NEUTRAL"
	bullCount := 0
	if price > vwap { bullCount++ }
	if price > ema20 { bullCount++ }
	if supertrend != nil && supertrend.Direction == "up" { bullCount++ }
	if macd != nil && macd.Histogram > 0 { bullCount++ }
	if bullCount >= 3 { trendAlign = "CONFIRMED_BULL" } else if bullCount <= 1 { trendAlign = "CONFIRMED_BEAR" }

	// Regime
	regime := "RANGING"
	if adx != nil && adx.ADX > 25 { regime = adx.Trend }

	// Option suggestion
	optSugg := ""
	if verdict == "BUY" && rsi < 65 { optSugg = "Buy ATM Call or Bull Call Spread" }
	if verdict == "SELL" && rsi > 35 { optSugg = "Buy ATM Put or Bear Put Spread" }
	if verdict == "HOLD" { optSugg = "Wait for breakout; consider Iron Condor if IV high" }

	_ = regime // used in AnalyzeResponse

	return &AIResult{
		Verdict:           verdict,
		Confidence:        pct,
		Score:             score,
		Entry:             round2(entry),
		Target:            round2(target),
		StopLoss:          round2(sl),
		RiskReward:        rr,
		Reasons:           reasons,
		Risks:             risks,
		Summary:           fmt.Sprintf("%s signal with %d%% confidence. Entry ₹%.2f, Target ₹%.2f, SL ₹%.2f", verdict, pct, entry, target, sl),
		OptionSuggestion:  optSugg,
		TimeframeAlignment: trendAlign,
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}
