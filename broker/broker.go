package broker

// Broker defines the interface that ALL brokers must implement.
// Add a new broker → implement this interface → register in factory.go
// Frontend never knows which broker is active — same API response always.

import "time"

// Candle is OHLCV data — normalized across all brokers
type Candle struct {
	Timestamp int64   `json:"timestamp"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
}

// Quote is real-time market data
type Quote struct {
	Symbol       string  `json:"symbol"`
	LTP          float64 `json:"ltp"`
	Open         float64 `json:"open"`
	High         float64 `json:"high"`
	Low          float64 `json:"low"`
	Close        float64 `json:"close"`
	Volume       float64 `json:"volume"`
	UpperCircuit float64 `json:"upperCircuit"`
	LowerCircuit float64 `json:"lowerCircuit"`
	Week52High   float64 `json:"week52High"`
	Week52Low    float64 `json:"week52Low"`
	LastUpdated  time.Time `json:"lastUpdated"`
}

// Holding is a portfolio position
type Holding struct {
	Symbol        string  `json:"symbol"`
	ISIN          string  `json:"isin"`
	Quantity      int     `json:"quantity"`
	AvgBuyPrice   float64 `json:"avgBuyPrice"`
	LTP           float64 `json:"ltp"`
	CurrentValue  float64 `json:"currentValue"`
	InvestedValue float64 `json:"investedValue"`
	PnL           float64 `json:"pnl"`
	PnLPct        float64 `json:"pnlPct"`
	Exchange      string  `json:"exchange"`
	Product       string  `json:"product"` // CNC / MIS
}

// OptionStrike for option chain
type OptionStrike struct {
	StrikePrice float64   `json:"strikePrice"`
	CE          *OptionLeg `json:"CE,omitempty"`
	PE          *OptionLeg `json:"PE,omitempty"`
}

type OptionLeg struct {
	LTP      float64 `json:"ltp"`
	OI       float64 `json:"oi"`
	OIChange float64 `json:"oiChange"`
	Volume   float64 `json:"volume"`
	IV       float64 `json:"iv"`
	Delta    float64 `json:"delta"`
	Theta    float64 `json:"theta"`
	Gamma    float64 `json:"gamma"`
	Vega     float64 `json:"vega"`
	Bid      float64 `json:"bid"`
	Ask      float64 `json:"ask"`
}

// Broker interface — every broker must implement all methods
type Broker interface {
	// Name returns broker identifier: "upstox" | "angelone"
	Name() string

	// Auth
	IsAuthenticated() bool
	GetToken() string

	// Market Data
	GetCandles(instrumentKey, resolution, token string) ([]Candle, error)
	GetQuote(instrumentKey, token string) (*Quote, error)
	GetLTP(instrumentKey, token string) (float64, error)

	// Option Chain
	GetOptionChain(symbol, expiry, token string) ([]OptionStrike, float64, float64, error)
	GetExpiries(instrumentKey, token string) ([]string, error)

	// Portfolio
	GetHoldings(token string) ([]Holding, error)

	// Instrument resolution
	ResolveInstrumentKey(symbol string) string
}
