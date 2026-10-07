package broker

// Broker defines the interface that ALL brokers must implement.
// Add a new broker → implement this interface → register in factory.go
// Frontend never knows which broker is active — same API response always.

import "time"

// ── Order Types ───────────────────────────────────────────────────────────────

// OrderType — MARKET | LIMIT | SL | SL-M
type OrderType string

const (
	OrderMarket  OrderType = "MARKET"
	OrderLimit   OrderType = "LIMIT"
	OrderSL      OrderType = "SL"       // Stop-Loss Limit
	OrderSLM     OrderType = "SL-M"    // Stop-Loss Market
)

// ProductType — CNC (delivery) | MIS (intraday) | NRML (F&O overnight)
type ProductType string

const (
	ProductCNC  ProductType = "CNC"
	ProductMIS  ProductType = "MIS"
	ProductNRML ProductType = "NRML"
)

// TransactionType — BUY | SELL
type TransactionType string

const (
	TxnBuy  TransactionType = "BUY"
	TxnSell TransactionType = "SELL"
)

// OrderStatus
type OrderStatus string

const (
	StatusOpen      OrderStatus = "open"
	StatusExecuted  OrderStatus = "complete"
	StatusCancelled OrderStatus = "cancelled"
	StatusRejected  OrderStatus = "rejected"
	StatusPending   OrderStatus = "pending"
)

// PlaceOrderReq — unified order request
type PlaceOrderReq struct {
	Symbol          string          `json:"symbol"`
	SymbolToken     string          `json:"symbolToken"`    // Angel One token
	InstrumentKey   string          `json:"instrumentKey"`  // Upstox key
	Exchange        string          `json:"exchange"`       // NSE | BSE | NFO | MCX
	Quantity        int             `json:"quantity"`
	Price           float64         `json:"price"`          // for LIMIT/SL
	TriggerPrice    float64         `json:"triggerPrice"`   // for SL/SL-M
	OrderType       OrderType       `json:"orderType"`
	TransactionType TransactionType `json:"transactionType"`
	Product         ProductType     `json:"product"`
	Variety         string          `json:"variety"`        // NORMAL | STOPLOSS | AMO | ROBO
	// Advanced
	SquareOff       float64 `json:"squareOff"`       // for bracket orders
	StopLoss        float64 `json:"stopLoss"`        // for bracket orders
	TrailingStopLoss float64 `json:"trailingStopLoss"`
	Validity        string  `json:"validity"`        // DAY | IOC
	Tag             string  `json:"tag"`             // user label
}

// OrderResp — normalized order response
type OrderResp struct {
	OrderID  string `json:"orderId"`
	Status   string `json:"status"`
	Message  string `json:"message"`
}

// Order — a placed order in the order book
type Order struct {
	OrderID         string          `json:"orderId"`
	Symbol          string          `json:"symbol"`
	Exchange        string          `json:"exchange"`
	TransactionType TransactionType `json:"transactionType"`
	OrderType       OrderType       `json:"orderType"`
	Product         ProductType     `json:"product"`
	Quantity        int             `json:"quantity"`
	FilledQty       int             `json:"filledQty"`
	Price           float64         `json:"price"`
	TriggerPrice    float64         `json:"triggerPrice"`
	AvgPrice        float64         `json:"avgPrice"`
	Status          OrderStatus     `json:"status"`
	StatusMessage   string          `json:"statusMessage"`
	PlacedAt        time.Time       `json:"placedAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}

// Position — intraday/F&O open position
type Position struct {
	Symbol          string          `json:"symbol"`
	Exchange        string          `json:"exchange"`
	Product         ProductType     `json:"product"`
	TransactionType TransactionType `json:"transactionType"`
	Quantity        int             `json:"quantity"`
	BuyQty          int             `json:"buyQty"`
	SellQty         int             `json:"sellQty"`
	BuyPrice        float64         `json:"buyPrice"`
	SellPrice       float64         `json:"sellPrice"`
	LTP             float64         `json:"ltp"`
	PnL             float64         `json:"pnl"`
	RealizedPnL     float64         `json:"realizedPnl"`
	UnrealizedPnL   float64         `json:"unrealizedPnl"`
}

// Funds — account margin & balance
type Funds struct {
	AvailableCash    float64 `json:"availableCash"`
	UsedMargin       float64 `json:"usedMargin"`
	AvailableMargin  float64 `json:"availableMargin"`
	TotalBalance     float64 `json:"totalBalance"`
}

// GTTReq — Good Till Triggered order
type GTTReq struct {
	Symbol        string          `json:"symbol"`
	SymbolToken   string          `json:"symbolToken"`
	Exchange      string          `json:"exchange"`
	TriggerType   string          `json:"triggerType"` // SINGLE | OCO
	LTP           float64         `json:"ltp"`
	// Single trigger
	TriggerPrice  float64         `json:"triggerPrice"`
	Price         float64         `json:"price"`
	Quantity      int             `json:"quantity"`
	TransactionType TransactionType `json:"transactionType"`
	// OCO (target + stoploss)
	TargetPrice   float64         `json:"targetPrice"`
	StopLossPrice float64         `json:"stopLossPrice"`
}

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

	// Order management
	PlaceOrder(req PlaceOrderReq) (*OrderResp, error)
	ModifyOrder(orderID string, req PlaceOrderReq) (*OrderResp, error)
	CancelOrder(orderID, variety string) (*OrderResp, error)
	GetOrderBook() ([]Order, error)
	GetPositions() ([]Position, error)
	GetFunds() (*Funds, error)

	// GTT (Good Till Triggered) — auto buy/sell at price target
	PlaceGTT(req GTTReq) (*OrderResp, error)
	CancelGTT(taskID string) (*OrderResp, error)
	GetGTTList() ([]map[string]interface{}, error)

	// Instrument resolution
	ResolveInstrumentKey(symbol string) string
}
