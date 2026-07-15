package main

// Candle represents OHLCV data
type Candle struct {
	Timestamp int64   `json:"timestamp"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
}

// AnalyzeRequest is what frontend sends
type AnalyzeRequest struct {
	Symbol       string `json:"symbol"`
	InstrumentKey string `json:"instrumentKey"`
	Resolution   string `json:"resolution"`
	Mode         string `json:"mode"`
}

// AnalyzeResponse is what we return
type AnalyzeResponse struct {
	Symbol        string          `json:"symbol"`
	Price         float64         `json:"price"`
	Change        float64         `json:"change"`
	ChangePct     float64         `json:"changePct"`
	Open          float64         `json:"open"`
	High          float64         `json:"high"`
	Low           float64         `json:"low"`
	Volume        float64         `json:"volume"`
	VWAP          float64         `json:"vwap"`
	EMA9          float64         `json:"ema9"`
	EMA20         float64         `json:"ema20"`
	EMA50         float64         `json:"ema50"`
	EMA200        float64         `json:"ema200"`
	RSI           float64         `json:"rsi"`
	ATR           float64         `json:"atr"`
	VolumeRatio   float64         `json:"volumeRatio"`
	High52W       float64         `json:"high52w"`
	Low52W        float64         `json:"low52w"`
	Candles       []Candle        `json:"candles"`
	BollingerBands *BollingerBands `json:"bollingerBands"`
	MACD          *MACDResult     `json:"macd"`
	Supertrend    *SupertrendResult `json:"supertrend"`
	ADX           *ADXResult      `json:"adx"`
	Fibonacci     *FibResult      `json:"fibonacci"`
	PivotPoints   *PivotResult    `json:"pivotPoints"`
	OBV           *OBVResult      `json:"obv"`
	VWAPBands     *VWAPBands      `json:"vwapBands"`
	ORB           *ORBResult      `json:"orb"`
	PDHDPL        *PDHDPL         `json:"pdhdpl"`
	GapAnalysis   *GapAnalysis    `json:"gapAnalysis"`
	VolComparison *VolComparison  `json:"volComparison"`
	CircuitLimits *CircuitLimits  `json:"circuitLimits"`
	AI            *AIResult       `json:"ai"`
	Quality       map[string]interface{} `json:"quality"`
}

// APIResponse is generic wrapper
type APIResponse struct {
	Status  string      `json:"status"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}
