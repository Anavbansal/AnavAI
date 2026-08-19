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

// StochRSI result
type StochRSIResult struct {
	K float64 `json:"k"`
	D float64 `json:"d"`
}

// AIResult extended
type AIResult struct {
	Verdict          string  `json:"verdict"`
	Confidence       int     `json:"confidence"`
	Score            int     `json:"score"`
	Entry            float64 `json:"entry"`
	Target           float64 `json:"target"`
	StopLoss         float64 `json:"stopLoss"`
	RiskReward       float64 `json:"riskReward"`
	Summary          string  `json:"summary"`
	Reasons          []string `json:"reasons"`
	Risks            []string `json:"risks"`
	OptionSuggestion string  `json:"optionSuggestion"`
	TimeframeAlignment string `json:"timeframeAlignment"`
}

// AnalyzeResponse is what we return
type AnalyzeResponse struct {
	// Price data
	Symbol        string   `json:"symbol"`
	Price         float64  `json:"price"`
	Change        float64  `json:"change"`
	ChangePct     float64  `json:"changePct"`
	Open          float64  `json:"open"`
	High          float64  `json:"high"`
	Low           float64  `json:"low"`
	Volume        float64  `json:"volume"`
	// Indicators
	VWAP          float64  `json:"vwap"`
	EMA9          float64  `json:"ema9"`
	EMA20         float64  `json:"ema20"`
	EMA50         float64  `json:"ema50"`
	EMA200        float64  `json:"ema200"`
	RSI           float64  `json:"rsi"`
	ATR           float64  `json:"atr"`
	VolumeRatio   float64  `json:"volumeRatio"`
	High52W       float64  `json:"high52w"`
	Low52W        float64  `json:"low52w"`
	PCR           float64  `json:"pcr"`
	Support       float64  `json:"support"`
	Resistance    float64  `json:"resistance"`
	// Trend
	M1Trend       string   `json:"m1Trend"`
	M5Trend       string   `json:"m5Trend"`
	M15Trend      string   `json:"m15Trend"`
	Regime        string   `json:"regime"`
	TrendConsistency string `json:"trendConsistency"`
	// Complex indicators
	StochRSI      *StochRSIResult   `json:"stochRSI"`
	BollingerBands *BollingerBands  `json:"bollingerBands"`
	MACD          *MACDResult       `json:"macd"`
	Supertrend    *SupertrendResult `json:"supertrend"`
	ADX           *ADXResult        `json:"adx"`
	Fibonacci     *FibResult        `json:"fibonacci"`
	PivotPoints   *PivotResult      `json:"pivotPoints"`
	OBV           *OBVResult        `json:"obv"`
	VWAPBands     *VWAPBands        `json:"vwapBands"`
	ORB           *ORBResult        `json:"orb"`
	PDHDPL        *PDHDPL           `json:"pdhdpl"`
	GapAnalysis   *GapAnalysis      `json:"gapAnalysis"`
	VolComparison *VolComparison    `json:"volComparison"`
	CircuitLimits *CircuitLimits    `json:"circuitLimits"`
	// Data
	Candles       []Candle          `json:"candles"`
	AI            *AIResult         `json:"ai"`
	Quality       map[string]interface{} `json:"quality"`
	// Extra fields used by frontend components
	WilliamsR     float64  `json:"williamsR"`
	CCI           float64  `json:"cci"`
	ROC           float64  `json:"roc"`
	// Fundamentals (when available)
	PERatio       float64  `json:"pe_ratio"`
	CompanyName   string   `json:"company_name"`
	Sector        string   `json:"sector"`
	Industry      string   `json:"industry"`
	ISIN          string   `json:"isin"`
	BusinessDesc  string   `json:"business_description"`
	ListingDate   string   `json:"listingDate"`
	Week52High    float64  `json:"week52High"`
	Week52Low     float64  `json:"week52Low"`
	Series        string   `json:"series"`
	// Risk profile
	RiskProfile   map[string]interface{} `json:"riskProfile"`
}

// APIResponse is generic wrapper
type APIResponse struct {
	Status  string      `json:"status"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}
