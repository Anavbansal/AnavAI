package broker

// Angel One Smart API implementation
// Docs: https://smartapi.angelbroking.com/docs
// Base: https://apiconnect.angelbroking.com
// WebSocket: wss://smartapisocket.angelone.in/smart-stream
//
// Setup: smartapi.angelbroking.com → Create App → get API Key
// Enable TOTP: Angel One app → Profile → Settings → Enable TOTP → save secret
//
// Env vars needed:
//   ANGELONE_API_KEY     — from SmartAPI dashboard
//   ANGELONE_CLIENT_ID  — your Angel One account ID (e.g. A123456)
//   ANGELONE_PIN        — your 4-digit MPIN
//   ANGELONE_TOTP_SECRET — base32 TOTP secret (shown once when enabling TOTP)

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	angelBaseURL = "https://apiconnect.angelbroking.com"
	angelWSSURL  = "wss://smartapisocket.angelone.in/smart-stream"
)

// AngelOneBroker implements the Broker interface for Angel One SmartAPI
type AngelOneBroker struct {
	mu           sync.RWMutex
	jwtToken     string // REST API auth
	refreshToken string // for daily token renewal
	feedToken    string // WebSocket auth
	tokenExpiry  time.Time
}

var AngelOne = &AngelOneBroker{}

func (a *AngelOneBroker) Name() string { return "angelone" }

func (a *AngelOneBroker) IsAuthenticated() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.jwtToken != "" && time.Now().Before(a.tokenExpiry)
}

func (a *AngelOneBroker) GetToken() string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.jwtToken
}

// Login authenticates with Angel One using Client ID + PIN + TOTP
// TOTP is auto-generated from ANGELONE_TOTP_SECRET env var
func (a *AngelOneBroker) Login() error {
	clientID := os.Getenv("ANGELONE_CLIENT_ID")
	pin := os.Getenv("ANGELONE_PIN")
	totpSecret := os.Getenv("ANGELONE_TOTP_SECRET")
	apiKey := os.Getenv("ANGELONE_API_KEY")

	if clientID == "" || pin == "" || totpSecret == "" || apiKey == "" {
		return fmt.Errorf("Angel One env vars not set (ANGELONE_CLIENT_ID, ANGELONE_PIN, ANGELONE_TOTP_SECRET, ANGELONE_API_KEY)")
	}

	// Auto-generate TOTP (6-digit, 30s window, SHA1 — Angel One standard)
	totp, err := generateTOTP(totpSecret)
	if err != nil {
		return fmt.Errorf("TOTP generation failed: %w", err)
	}

	payload := map[string]string{
		"clientcode": clientID,
		"password":   pin,
		"totp":       totp,
	}

	resp, err := a.post("/rest/auth/angelbroking/user/v1/loginByPassword", payload, "")
	if err != nil {
		return fmt.Errorf("login request failed: %w", err)
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("login failed: %v", resp["message"])
	}

	a.mu.Lock()
	a.jwtToken, _ = data["jwtToken"].(string)
	a.refreshToken, _ = data["refreshToken"].(string)
	a.feedToken, _ = data["feedToken"].(string)
	// Angel One tokens expire at midnight IST
	now := time.Now()
	midnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.Local)
	a.tokenExpiry = midnight
	a.mu.Unlock()

	return nil
}

// RefreshToken renews JWT without TOTP — uses refreshToken
// Call this at midnight or when 401 received
func (a *AngelOneBroker) RefreshToken() error {
	a.mu.RLock()
	refreshTok := a.refreshToken
	a.mu.RUnlock()

	if refreshTok == "" {
		return a.Login() // full login if no refresh token
	}

	payload := map[string]string{"refreshToken": refreshTok}
	resp, err := a.post("/rest/auth/angelbroking/jwt/v1/generateTokens", payload, "")
	if err != nil {
		return err
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		return a.Login() // fall back to full login
	}

	a.mu.Lock()
	if tok, ok := data["jwtToken"].(string); ok && tok != "" {
		a.jwtToken = tok
	}
	if feed, ok := data["feedToken"].(string); ok && feed != "" {
		a.feedToken = feed
	}
	midnight := time.Now().Add(24 * time.Hour)
	a.tokenExpiry = midnight
	a.mu.Unlock()

	return nil
}

// GetCandles fetches historical OHLCV data
// resolution: "1" "5" "15" "30" "60" "D" "W"
func (a *AngelOneBroker) GetCandles(instrumentKey, resolution, token string) ([]Candle, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}

	symbolToken, exchange := parseAngelKey(instrumentKey)

	// Map resolution to Angel One interval
	intervalMap := map[string]string{
		"1": "ONE_MINUTE", "3": "THREE_MINUTE", "5": "FIVE_MINUTE",
		"10": "TEN_MINUTE", "15": "FIFTEEN_MINUTE", "30": "THIRTY_MINUTE",
		"60": "ONE_HOUR", "D": "ONE_DAY", "W": "ONE_DAY",
	}
	interval, ok := intervalMap[resolution]
	if !ok {
		interval = "FIVE_MINUTE"
	}

	now := time.Now()
	toDate := now.Format("2006-01-02 15:04")
	fromDate := now.AddDate(0, 0, -30).Format("2006-01-02 15:04")
	if resolution == "D" {
		fromDate = now.AddDate(-2, 0, 0).Format("2006-01-02 15:04")
	}

	payload := map[string]string{
		"exchange":    exchange,
		"symboltoken": symbolToken,
		"interval":    interval,
		"fromdate":    fromDate,
		"todate":      toDate,
	}

	resp, err := a.post("/rest/secure/angelbroking/historical/v1/getCandleData", payload, "")
	if err != nil {
		return nil, err
	}

	rawData, ok := resp["data"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("no candle data in response")
	}

	var candles []Candle
	for _, item := range rawData {
		arr, ok := item.([]interface{})
		if !ok || len(arr) < 6 {
			continue
		}
		// Angel One format: [timestamp, open, high, low, close, volume]
		ts := int64(0)
		if tsStr, ok := arr[0].(string); ok {
			t, err := time.Parse("2006-01-02T15:04:05-07:00", tsStr)
			if err == nil {
				ts = t.UnixMilli()
			}
		}
		toF := func(v interface{}) float64 {
			if f, ok := v.(float64); ok {
				return f
			}
			return 0
		}
		candles = append(candles, Candle{
			Timestamp: ts,
			Open:  toF(arr[1]),
			High:  toF(arr[2]),
			Low:   toF(arr[3]),
			Close: toF(arr[4]),
			Volume: toF(arr[5]),
		})
	}
	return candles, nil
}

// GetQuote returns real-time quote with circuit limits and 52W
func (a *AngelOneBroker) GetQuote(instrumentKey, token string) (*Quote, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}

	symbolToken, exchange := parseAngelKey(instrumentKey)

	payload := map[string]interface{}{
		"mode": "FULL",
		"exchangeTokens": map[string]interface{}{
			exchange: []string{symbolToken},
		},
	}

	resp, err := a.post("/rest/secure/angelbroking/market/v1/quote/", payload, "")
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("no quote data")
	}

	fetched, ok := data["fetched"].([]interface{})
	if !ok || len(fetched) == 0 {
		return nil, fmt.Errorf("quote not found")
	}

	m, ok := fetched[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid quote format")
	}

	toF := func(key string) float64 {
		if v, ok := m[key].(float64); ok {
			return v
		}
		return 0
	}

	return &Quote{
		Symbol:       instrumentKey,
		LTP:          toF("ltp"),
		Open:         toF("open"),
		High:         toF("high"),
		Low:          toF("low"),
		Close:        toF("close"),
		Volume:       toF("tradeVolume"),
		UpperCircuit: toF("upperCircuitLimit"),
		LowerCircuit: toF("lowerCircuitLimit"),
		Week52High:   toF("52WeekHighPrice"),
		Week52Low:    toF("52WeekLowPrice"),
		LastUpdated:  time.Now(),
	}, nil
}

// GetLTP returns last traded price only (faster than GetQuote)
func (a *AngelOneBroker) GetLTP(instrumentKey, token string) (float64, error) {
	q, err := a.GetQuote(instrumentKey, token)
	if err != nil {
		return 0, err
	}
	return q.LTP, nil
}

// GetOptionChain returns option chain with real Greeks
func (a *AngelOneBroker) GetOptionChain(symbol, expiry, token string) ([]OptionStrike, float64, float64, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, 0, 0, err
	}

	// Angel One option chain endpoint
	payload := map[string]interface{}{
		"name":        symbol,
		"expirydate":  expiry,
	}

	resp, err := a.post("/rest/secure/angelbroking/derivatives/v1/getCombinedOptionData", payload, "")
	if err != nil {
		return nil, 0, 0, err
	}

	rawData, ok := resp["data"].([]interface{})
	if !ok {
		return nil, 0, 0, fmt.Errorf("no option chain data")
	}

	var strikes []OptionStrike
	var totalCEOI, totalPEOI float64

	for _, item := range rawData {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		toF := func(key string) float64 {
			if v, ok := m[key].(float64); ok {
				return v
			}
			return 0
		}

		strike := OptionStrike{StrikePrice: toF("strikePrice")}

		// CE data
		strike.CE = &OptionLeg{
			LTP: toF("CE_LTP"), OI: toF("CE_OI"), Volume: toF("CE_Volume"),
			IV: toF("CE_IV"), Delta: toF("CE_Delta"), Theta: toF("CE_Theta"),
			Gamma: toF("CE_Gamma"), Vega: toF("CE_Vega"),
		}
		// PE data
		strike.PE = &OptionLeg{
			LTP: toF("PE_LTP"), OI: toF("PE_OI"), Volume: toF("PE_Volume"),
			IV: toF("PE_IV"), Delta: toF("PE_Delta"), Theta: toF("PE_Theta"),
			Gamma: toF("PE_Gamma"), Vega: toF("PE_Vega"),
		}

		totalCEOI += strike.CE.OI
		totalPEOI += strike.PE.OI
		strikes = append(strikes, strike)
	}

	pcr := 0.0
	if totalCEOI > 0 {
		pcr = totalPEOI / totalCEOI
	}

	return strikes, pcr, 0, nil
}

// GetExpiries returns available option expiry dates
func (a *AngelOneBroker) GetExpiries(instrumentKey, token string) ([]string, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}
	// Angel One: expiries come from instrument master JSON
	// https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json
	// For now return placeholder — implement with scrip master
	return []string{}, nil
}

// GetHoldings returns actual portfolio holdings with P&L
func (a *AngelOneBroker) GetHoldings(token string) ([]Holding, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}

	resp, err := a.get("/rest/secure/angelbroking/portfolio/v1/getAllHolding")
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("no holdings data")
	}

	holdingsRaw, ok := data["holdings"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("holdings array not found")
	}

	var holdings []Holding
	for _, item := range holdingsRaw {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		toF := func(key string) float64 {
			if v, ok := m[key].(float64); ok {
				return v
			}
			return 0
		}
		toS := func(key string) string {
			if v, ok := m[key].(string); ok {
				return v
			}
			return ""
		}
		qty := int(toF("quantity"))
		avg := toF("averageprice")
		ltp := toF("ltp")
		invested := float64(qty) * avg
		current := float64(qty) * ltp
		pnl := current - invested
		pnlPct := 0.0
		if invested > 0 {
			pnlPct = pnl / invested * 100
		}

		holdings = append(holdings, Holding{
			Symbol:        toS("tradingsymbol"),
			ISIN:          toS("isin"),
			Quantity:      qty,
			AvgBuyPrice:   avg,
			LTP:           ltp,
			CurrentValue:  current,
			InvestedValue: invested,
			PnL:           pnl,
			PnLPct:        pnlPct,
			Exchange:      toS("exchange"),
			Product:       toS("product"),
		})
	}
	return holdings, nil
}

// ResolveInstrumentKey converts symbol to Angel One token format
// Angel One uses numeric symboltoken, not ISIN-based keys like Upstox
// Format: "NSE:3045" or just "3045" for NSE
func (a *AngelOneBroker) ResolveInstrumentKey(symbol string) string {
	if tok, ok := angelSymbolMap[symbol]; ok {
		return tok
	}
	return "NSE:" + symbol
}

// resolvedAngelCache caches dynamically found Angel One tokens
var resolvedAngelCache sync.Map // symbol -> "NSE:XXXX"

// SearchSymbol finds Angel One symboltoken for any NSE symbol via search API
func (a *AngelOneBroker) SearchSymbol(symbol string) string {
	// 1. Static map
	if tok, ok := angelSymbolMap[symbol]; ok {
		return tok
	}
	// 2. Dynamic cache
	if v, ok := resolvedAngelCache.Load(symbol); ok {
		return v.(string)
	}
	if err := a.ensureAuth(); err != nil {
		return "NSE:" + symbol
	}
	// 3. Angel One searchscrip API
	resp, err := a.post("/rest/secure/angelbroking/order/v1/searchScrip", map[string]interface{}{
		"exchange":   "NSE",
		"searchscrip": symbol,
	}, "")
	if err != nil {
		return "NSE:" + symbol
	}
	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			m, ok := item.(map[string]interface{})
			if !ok { continue }
			tradingSymbol, _ := m["tradingsymbol"].(string)
			symbolToken, _ := m["symboltoken"].(string)
			exch, _ := m["exch_seg"].(string)
			// Exact NSE match
			if strings.EqualFold(tradingSymbol, symbol) && strings.HasPrefix(exch, "NSE") && symbolToken != "" {
				key := exch + ":" + symbolToken
				resolvedAngelCache.Store(symbol, key)
				return key
			}
		}
		// Fallback: first result
		if len(data) > 0 {
			if m, ok := data[0].(map[string]interface{}); ok {
				symbolToken, _ := m["symboltoken"].(string)
				exch, _ := m["exch_seg"].(string)
				if symbolToken != "" && exch != "" {
					key := exch + ":" + symbolToken
					resolvedAngelCache.Store(symbol, key)
					return key
				}
			}
		}
	}
	return "NSE:" + symbol
}

// GetLTPBySymbol fetches live price for any symbol using dynamic token resolution
func (a *AngelOneBroker) GetLTPBySymbol(symbol string) (float64, string, error) {
	instrKey := a.SearchSymbol(symbol)
	ltp, err := a.GetLTP(instrKey, "")
	return ltp, instrKey, err
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

func (a *AngelOneBroker) commonHeaders(token string) map[string]string {
	if token == "" {
		a.mu.RLock()
		token = a.jwtToken
		a.mu.RUnlock()
	}
	return map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
		"Accept":        "application/json",
		"X-PrivateKey":  os.Getenv("ANGELONE_API_KEY"),
		"X-UserType":    "USER",
		"X-SourceID":    "WEB",
		"X-ClientLocalIP": "127.0.0.1",
		"X-ClientPublicIP": "127.0.0.1",
		"X-MACAddress":  "AA:BB:CC:DD:EE:FF",
	}
}

func (a *AngelOneBroker) post(path string, payload interface{}, token string) (map[string]interface{}, error) {
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", angelBaseURL+path, bytes.NewReader(body))
	for k, v := range a.commonHeaders(token) {
		req.Header.Set(k, v)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &result)

	if msg, ok := result["message"].(string); ok && result["status"] == false {
		return nil, fmt.Errorf("Angel One API: %s", msg)
	}
	return result, nil
}

func (a *AngelOneBroker) get(path string) (map[string]interface{}, error) {
	req, _ := http.NewRequest("GET", angelBaseURL+path, nil)
	for k, v := range a.commonHeaders("") {
		req.Header.Set(k, v)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &result)
	return result, nil
}

func (a *AngelOneBroker) ensureAuth() error {
	if a.IsAuthenticated() {
		return nil
	}
	return a.Login()
}

// ── TOTP Generator (RFC 6238 / SHA1) ─────────────────────────────────────────
// Angel One uses standard TOTP: 6 digits, 30s window, SHA1
func generateTOTP(secret string) (string, error) {
	// Clean base32 secret
	secret = strings.ToUpper(strings.ReplaceAll(secret, " ", ""))
	// Pad if needed
	for len(secret)%8 != 0 {
		secret += "="
	}
	key, err := base32.StdEncoding.DecodeString(secret)
	if err != nil {
		return "", fmt.Errorf("invalid TOTP secret: %w", err)
	}

	// Time counter (30-second window)
	counter := uint64(time.Now().Unix() / 30)
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, counter)

	// HMAC-SHA1
	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	h := mac.Sum(nil)

	// Dynamic truncation
	offset := h[len(h)-1] & 0x0f
	code := binary.BigEndian.Uint32(h[offset:offset+4]) & 0x7fffffff
	otp := fmt.Sprintf("%06d", code%1000000)
	return otp, nil
}

// parseAngelKey splits "NSE:3045" → ("3045", "NSE")
func parseAngelKey(key string) (symbolToken, exchange string) {
	parts := strings.SplitN(key, ":", 2)
	if len(parts) == 2 {
		return parts[1], parts[0]
	}
	// Default to NSE
	return key, "NSE"
}

// ── Symbol Token Map (Angel One uses numeric tokens) ─────────────────────────
// Format: symbol → "EXCHANGE:symboltoken"
// Full list: https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json
var angelSymbolMap = map[string]string{
	// Indices
	"NIFTY":      "NSE:26000",
	"BANKNIFTY":  "NSE:26009",
	"FINNIFTY":   "NSE:26037",
	"SENSEX":     "BSE:1",
	// Nifty 50
	"RELIANCE":   "NSE:2885",
	"TCS":        "NSE:11536",
	"HDFCBANK":   "NSE:1333",
	"INFY":       "NSE:1594",
	"ICICIBANK":  "NSE:4963",
	"SBIN":       "NSE:3045",
	"WIPRO":      "NSE:3787",
	"BAJFINANCE": "NSE:317",
	"ADANIENT":   "NSE:25",
	"LT":         "NSE:11483",
	"AXISBANK":   "NSE:5900",
	"TATAMOTORS": "NSE:3456",
	"TATASTEEL":  "NSE:3499",
	"NTPC":       "NSE:11630",
	"RVNL":       "NSE:19242",
	"IRFC":       "NSE:14977",
	"TATAPOWER":  "NSE:3426",
	"NATIONALUM": "NSE:13",
	"SUZLON":     "NSE:3147",
	"CANBK":      "NSE:10180",
	"CESC":       "NSE:549",
	"ZOMATO":     "NSE:5097",
	"HAL":        "NSE:2303",
	"HSCL":       "NSE:1522",
	"HDFCLIFE":   "NSE:467",
	"SBILIFE":    "NSE:21808",
	"LTIM":       "NSE:17818",
	"COALINDIA":  "NSE:1113",
	"POWERGRID":  "NSE:14977",
	"SUNPHARMA":  "NSE:3351",
	"TECHM":      "NSE:13538",
	"DLF":        "NSE:14732",
	"PFC":        "NSE:14299",
	"RECLTD":     "NSE:3287",
	"IRCTC":      "NSE:13611",
}

// GetFeedToken returns WebSocket authentication token
func (a *AngelOneBroker) GetFeedToken() string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.feedToken
}

// StartAutoRefresh refreshes token daily at midnight
func (a *AngelOneBroker) StartAutoRefresh() {
	go func() {
		for {
			now := time.Now()
			// Next midnight
			midnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 1, 0, 0, time.Local)
			time.Sleep(time.Until(midnight))
			if err := a.RefreshToken(); err != nil {
				_ = a.Login()
			}
		}
	}()
}

// Ensure math import used
var _ = math.Round

// ── Order Management ──────────────────────────────────────────────────────────

// PlaceOrder places a new order on Angel One
// Docs: https://smartapi.angelbroking.com/docs#placeOrder
func (a *AngelOneBroker) PlaceOrder(req PlaceOrderReq) (*OrderResp, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}

	variety := req.Variety
	if variety == "" {
		if req.OrderType == OrderSL || req.OrderType == OrderSLM {
			variety = "STOPLOSS"
		} else {
			variety = "NORMAL"
		}
	}

	payload := map[string]interface{}{
		"variety":         variety,
		"tradingsymbol":   req.Symbol,
		"symboltoken":     req.SymbolToken,
		"transactiontype": string(req.TransactionType),
		"exchange":        req.Exchange,
		"ordertype":       string(req.OrderType),
		"producttype":     string(req.Product),
		"duration":        func() string { if req.Validity == "" { return "DAY" }; return req.Validity }(),
		"price":           fmt.Sprintf("%.2f", req.Price),
		"triggerprice":    fmt.Sprintf("%.2f", req.TriggerPrice),
		"quantity":        fmt.Sprintf("%d", req.Quantity),
		"squareoff":       fmt.Sprintf("%.2f", req.SquareOff),
		"stoploss":        fmt.Sprintf("%.2f", req.StopLoss),
		"trailingStopLoss": fmt.Sprintf("%.2f", req.TrailingStopLoss),
	}
	if req.Tag != "" {
		payload["ordertag"] = req.Tag
	}

	resp, err := a.post("/rest/secure/angelbroking/order/v1/placeOrder", payload, "")
	if err != nil {
		return nil, err
	}
	data, _ := resp["data"].(map[string]interface{})
	orderID := ""
	if data != nil {
		orderID, _ = data["orderid"].(string)
	}
	if resp["status"] == false {
		msg, _ := resp["message"].(string)
		return nil, fmt.Errorf("angel one order failed: %s", msg)
	}
	return &OrderResp{OrderID: orderID, Status: "success", Message: "Order placed"}, nil
}

// ModifyOrder modifies a pending order
func (a *AngelOneBroker) ModifyOrder(orderID string, req PlaceOrderReq) (*OrderResp, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}

	variety := req.Variety
	if variety == "" { variety = "NORMAL" }

	payload := map[string]interface{}{
		"variety":      variety,
		"orderid":      orderID,
		"ordertype":    string(req.OrderType),
		"producttype":  string(req.Product),
		"duration":     func() string { if req.Validity == "" { return "DAY" }; return req.Validity }(),
		"price":        fmt.Sprintf("%.2f", req.Price),
		"triggerprice": fmt.Sprintf("%.2f", req.TriggerPrice),
		"quantity":     fmt.Sprintf("%d", req.Quantity),
	}

	resp, err := a.post("/rest/secure/angelbroking/order/v1/modifyOrder", payload, "")
	if err != nil {
		return nil, err
	}
	data, _ := resp["data"].(map[string]interface{})
	newOrderID := orderID
	if data != nil {
		if id, ok := data["orderid"].(string); ok && id != "" {
			newOrderID = id
		}
	}
	return &OrderResp{OrderID: newOrderID, Status: "success", Message: "Order modified"}, nil
}

// CancelOrder cancels a pending order
func (a *AngelOneBroker) CancelOrder(orderID, variety string) (*OrderResp, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}
	if variety == "" { variety = "NORMAL" }

	payload := map[string]interface{}{
		"variety": variety,
		"orderid": orderID,
	}

	resp, err := a.post("/rest/secure/angelbroking/order/v1/cancelOrder", payload, "")
	if err != nil {
		return nil, err
	}
	data, _ := resp["data"].(map[string]interface{})
	newID := orderID
	if data != nil {
		if id, ok := data["orderid"].(string); ok && id != "" {
			newID = id
		}
	}
	return &OrderResp{OrderID: newID, Status: "success", Message: "Order cancelled"}, nil
}

// GetOrderBook returns today's order history
func (a *AngelOneBroker) GetOrderBook() ([]Order, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}
	resp, err := a.get("/rest/secure/angelbroking/order/v1/getOrderBook")
	if err != nil {
		return nil, err
	}

	rawData, _ := resp["data"].([]interface{})
	var orders []Order
	for _, item := range rawData {
		m, ok := item.(map[string]interface{})
		if !ok { continue }
		toS := func(k string) string { v, _ := m[k].(string); return v }
		toF := func(k string) float64 {
			switch v := m[k].(type) {
			case float64: return v
			case string:
				var f float64; fmt.Sscanf(v, "%f", &f); return f
			}
			return 0
		}
		toI := func(k string) int {
			switch v := m[k].(type) {
			case float64: return int(v)
			case string:
				var i int; fmt.Sscanf(v, "%d", &i); return i
			}
			return 0
		}

		status := OrderStatus(strings.ToLower(toS("orderstatus")))
		if status == "open pending" { status = StatusOpen }

		orders = append(orders, Order{
			OrderID:         toS("orderid"),
			Symbol:          toS("tradingsymbol"),
			Exchange:        toS("exchange"),
			TransactionType: TransactionType(toS("transactiontype")),
			OrderType:       OrderType(toS("ordertype")),
			Product:         ProductType(toS("producttype")),
			Quantity:        toI("quantity"),
			FilledQty:       toI("filledshares"),
			Price:           toF("price"),
			TriggerPrice:    toF("triggerprice"),
			AvgPrice:        toF("averageprice"),
			Status:          status,
			StatusMessage:   toS("text"),
		})
	}
	return orders, nil
}

// GetPositions returns intraday/F&O open positions
func (a *AngelOneBroker) GetPositions() ([]Position, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}
	resp, err := a.get("/rest/secure/angelbroking/order/v1/getPosition")
	if err != nil {
		return nil, err
	}

	rawData, _ := resp["data"].([]interface{})
	var positions []Position
	for _, item := range rawData {
		m, ok := item.(map[string]interface{})
		if !ok { continue }
		toS := func(k string) string { v, _ := m[k].(string); return v }
		toF := func(k string) float64 {
			switch v := m[k].(type) {
			case float64: return v
			case string:
				var f float64; fmt.Sscanf(v, "%f", &f); return f
			}
			return 0
		}
		toI := func(k string) int {
			switch v := m[k].(type) {
			case float64: return int(v)
			case string:
				var i int; fmt.Sscanf(v, "%d", &i); return i
			}
			return 0
		}

		netQty := toI("netqty")
		txnType := TxnBuy
		if netQty < 0 { txnType = TxnSell }
		if netQty < 0 { netQty = -netQty }

		positions = append(positions, Position{
			Symbol:          toS("tradingsymbol"),
			Exchange:        toS("exchange"),
			Product:         ProductType(toS("producttype")),
			TransactionType: txnType,
			Quantity:        netQty,
			BuyQty:          toI("buyqty"),
			SellQty:         toI("sellqty"),
			BuyPrice:        toF("buyavgprice"),
			SellPrice:       toF("sellavgprice"),
			LTP:             toF("ltp"),
			PnL:             toF("pnl"),
			RealizedPnL:     toF("realisedpnl"),
			UnrealizedPnL:   toF("unrealisedpnl"),
		})
	}
	return positions, nil
}

// GetFunds returns account cash & margin info
func (a *AngelOneBroker) GetFunds() (*Funds, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}
	resp, err := a.get("/rest/secure/angelbroking/user/v1/getRMS")
	if err != nil {
		return nil, err
	}

	data, _ := resp["data"].(map[string]interface{})
	toF := func(k string) float64 {
		if data == nil { return 0 }
		switch v := data[k].(type) {
		case float64: return v
		case string:
			var f float64; fmt.Sscanf(v, "%f", &f); return f
		}
		return 0
	}

	available := toF("availablecash")
	used := toF("utilisedamount")
	return &Funds{
		AvailableCash:   available,
		UsedMargin:      used,
		AvailableMargin: toF("net"),
		TotalBalance:    available + used,
	}, nil
}

// ── GTT (Good Till Triggered) — Auto Buy/Sell ─────────────────────────────────

// PlaceGTT places a GTT rule — triggers an order automatically at given price
func (a *AngelOneBroker) PlaceGTT(req GTTReq) (*OrderResp, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}

	// GTT payload — SINGLE trigger or OCO (target + stoploss)
	triggerType := req.TriggerType
	if triggerType == "" { triggerType = "SINGLE" }

	var triggerList []map[string]interface{}
	if triggerType == "OCO" {
		// OCO: two triggers — target (sell) + stoploss (sell)
		triggerList = []map[string]interface{}{
			{
				"triggerPrice": fmt.Sprintf("%.2f", req.StopLossPrice),
				"price":        fmt.Sprintf("%.2f", req.StopLossPrice*0.99),
				"qty":          fmt.Sprintf("%d", req.Quantity),
				"action":       "SELL",
				"ordertype":    "LIMIT",
			},
			{
				"triggerPrice": fmt.Sprintf("%.2f", req.TargetPrice),
				"price":        fmt.Sprintf("%.2f", req.TargetPrice*1.01),
				"qty":          fmt.Sprintf("%d", req.Quantity),
				"action":       "SELL",
				"ordertype":    "LIMIT",
			},
		}
	} else {
		triggerList = []map[string]interface{}{
			{
				"triggerPrice": fmt.Sprintf("%.2f", req.TriggerPrice),
				"price":        fmt.Sprintf("%.2f", req.Price),
				"qty":          fmt.Sprintf("%d", req.Quantity),
				"action":       string(req.TransactionType),
				"ordertype":    "LIMIT",
			},
		}
	}

	payload := map[string]interface{}{
		"tradingsymbol": req.Symbol,
		"symboltoken":   req.SymbolToken,
		"exchange":      req.Exchange,
		"producttype":   "CNC",
		"triggerprice":  fmt.Sprintf("%.2f", req.TriggerPrice),
		"qty":           fmt.Sprintf("%d", req.Quantity),
		"disclosedqty":  "0",
		"ltp":           fmt.Sprintf("%.2f", req.LTP),
		"triggerList":   triggerList,
		"type":          triggerType,
	}

	resp, err := a.post("/rest/secure/angelbroking/gtt/v1/createRule", payload, "")
	if err != nil {
		return nil, err
	}
	if resp["status"] == false {
		msg, _ := resp["message"].(string)
		return nil, fmt.Errorf("GTT failed: %s", msg)
	}
	data, _ := resp["data"].(map[string]interface{})
	id := ""
	if data != nil {
		if v, ok := data["id"].(float64); ok {
			id = fmt.Sprintf("%.0f", v)
		}
	}
	return &OrderResp{OrderID: id, Status: "success", Message: "GTT rule created"}, nil
}

// CancelGTT deletes a GTT rule by task ID
func (a *AngelOneBroker) CancelGTT(taskID string) (*OrderResp, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}
	payload := map[string]interface{}{"id": taskID}
	resp, err := a.post("/rest/secure/angelbroking/gtt/v1/deleteRule", payload, "")
	if err != nil {
		return nil, err
	}
	if resp["status"] == false {
		msg, _ := resp["message"].(string)
		return nil, fmt.Errorf("GTT cancel failed: %s", msg)
	}
	return &OrderResp{OrderID: taskID, Status: "success", Message: "GTT cancelled"}, nil
}

// GetGTTList returns all active GTT rules
func (a *AngelOneBroker) GetGTTList() ([]map[string]interface{}, error) {
	if err := a.ensureAuth(); err != nil {
		return nil, err
	}
	payload := map[string]interface{}{
		"status": []string{"FORALL"},
		"page":   1,
		"count":  100,
	}
	resp, err := a.post("/rest/secure/angelbroking/gtt/v1/ruleList", payload, "")
	if err != nil {
		return nil, err
	}
	rawData, _ := resp["data"].([]interface{})
	var list []map[string]interface{}
	for _, item := range rawData {
		if m, ok := item.(map[string]interface{}); ok {
			list = append(list, m)
		}
	}
	return list, nil
}
