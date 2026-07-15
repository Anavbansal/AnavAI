package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// ── Cache ─────────────────────────────────────────────────────────────────────
type cacheEntry struct {
	data interface{}
	ts   time.Time
	ttl  time.Duration
}

type Cache struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
}

var cache = &Cache{entries: make(map[string]*cacheEntry)}

func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entries[key]
	if !ok || time.Since(e.ts) > e.ttl { return nil, false }
	return e.data, true
}

func (c *Cache) Set(key string, data interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.entries) > 200 {
		// Evict oldest
		var oldest string
		var oldestTs time.Time
		for k, v := range c.entries {
			if oldest == "" || v.ts.Before(oldestTs) {
				oldest = k; oldestTs = v.ts
			}
		}
		delete(c.entries, oldest)
	}
	c.entries[key] = &cacheEntry{data: data, ts: time.Now(), ttl: ttl}
}

// ── CORS middleware ───────────────────────────────────────────────────────────
func withCORS(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" { origin = "*" }
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Vary", "Origin")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		h(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func getToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
}

// ── /api/analyze ─────────────────────────────────────────────────────────────
func handleAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { writeJSON(w, 405, map[string]string{"error": "method not allowed"}); return }

	body, _ := io.ReadAll(r.Body)
	var req AnalyzeRequest
	json.Unmarshal(body, &req)

	symbol := strings.ToUpper(req.Symbol)
	if symbol == "" { symbol = "NIFTY" }
	resolution := req.Resolution
	if resolution == "" { resolution = "5" }
	token := getToken(r)

	// Cache key
	cacheKey := fmt.Sprintf("analyze:%s:%s", symbol, resolution)
	if cached, ok := cache.Get(cacheKey); ok {
		writeJSON(w, 200, map[string]interface{}{"status": "success", "data": cached})
		return
	}

	// Resolve instrument key
	instrKey := req.InstrumentKey
	if instrKey == "" { instrKey = resolveInstrumentKey(symbol) }

	// Fetch candles
	candles, err := fetchHistoricalCandles(instrKey, resolution, token)
	if err != nil {
		log.Printf("[analyze] candle fetch error: %v", err)
		writeJSON(w, 200, map[string]interface{}{
			"status": "error", "message": "Failed to fetch candles: " + err.Error(),
		})
		return
	}
	if len(candles) == 0 {
		writeJSON(w, 200, map[string]interface{}{"status": "error", "message": "No candles returned"})
		return
	}

	// Build response
	resp := buildAnalysis(symbol, candles, token)
	resp.Quality = map[string]interface{}{
		"source":       "UPSTOX_LIVE",
		"candleCount":  len(candles),
		"hasLiveToken": token != os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN"),
	}

	// Cache 30 seconds for intraday, 5 min for daily
	ttl := 30 * time.Second
	if resolution == "D" || resolution == "W" { ttl = 5 * time.Minute }
	cache.Set(cacheKey, resp, ttl)

	writeJSON(w, 200, map[string]interface{}{"status": "success", "data": resp})
}

func buildAnalysis(symbol string, candles []Candle, token string) *AnalyzeResponse {
	last := candles[len(candles)-1]
	closes := make([]float64, len(candles))
	for i, c := range candles { closes[i] = c.Close }

	avgVol := 0.0
	n := 20
	if len(candles) < n { n = len(candles) }
	for _, c := range candles[len(candles)-n:] { avgVol += c.Volume }
	avgVol /= float64(n)

	volRatio := 1.0
	if avgVol > 0 { volRatio = round2(last.Volume / avgVol) }

	vwap := calcVWAP(candles)
	ema9 := calcEMA(closes, 9)
	ema20 := calcEMA(closes, 20)
	ema50 := calcEMA(closes, 50)
	ema200 := calcEMA(closes, 200)
	rsi := calcRSI(closes, 14)
	atr := calcATR(candles, 14)
	bb := calcBollingerBands(closes, 20, 2)
	macd := calcMACD(closes)
	supertrend := calcSupertrend(candles, 7, 3)
	adx := calcADX(candles, 14)
	fib := calcFibonacci(candles)
	pivots := calcPivotPoints(last.High, last.Low, last.Close)
	obv := calcOBV(candles)
	vwapBands := calcVWAPBands(candles)
	orb := calcORB(candles)
	pd := calcPDHPDL(candles)
	gap := calcGapAnalysis(candles, pd)
	volComp := calcVolumeComparison(candles)
	circuit := calcCircuitLimits(last.Close)
	high52, low52 := calc52W(candles)
	ai := calcAIVerdict(last.Close, vwap, ema20, ema50, rsi, macd, supertrend, adx, volRatio, atr)

	// Change from previous candle
	change, changePct := 0.0, 0.0
	if len(candles) > 1 {
		prev := candles[len(candles)-2].Close
		change = round2(last.Close - prev)
		if prev > 0 { changePct = round2(change / prev * 100) }
	}

	return &AnalyzeResponse{
		Symbol:        symbol,
		Price:         last.Close,
		Change:        change,
		ChangePct:     changePct,
		Open:          last.Open,
		High:          last.High,
		Low:           last.Low,
		Volume:        last.Volume,
		VWAP:          vwap,
		EMA9:          ema9,
		EMA20:         ema20,
		EMA50:         ema50,
		EMA200:        ema200,
		RSI:           rsi,
		ATR:           atr,
		VolumeRatio:   volRatio,
		High52W:       high52,
		Low52W:        low52,
		Candles:       candles,
		BollingerBands: bb,
		MACD:          macd,
		Supertrend:    supertrend,
		ADX:           adx,
		Fibonacci:     fib,
		PivotPoints:   pivots,
		OBV:           obv,
		VWAPBands:     vwapBands,
		ORB:           orb,
		PDHDPL:        pd,
		GapAnalysis:   gap,
		VolComparison: volComp,
		CircuitLimits: circuit,
		AI:            ai,
	}
}

// ── /auth/url ─────────────────────────────────────────────────────────────────
func handleAuthURL(w http.ResponseWriter, r *http.Request) {
	clientID := os.Getenv("UPSTOX_ALGO_CLIENT_ID")
	if clientID == "" { clientID = os.Getenv("UPSTOX_CLIENT_ID") }
	redirectURI := os.Getenv("UPSTOX_ALGO_REDIRECT_URI")
	if redirectURI == "" { redirectURI = os.Getenv("UPSTOX_REDIRECT_URI") }

	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", clientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("state", fmt.Sprintf("anavai-%d", time.Now().UnixMilli()))
	authURL := "https://api.upstox.com/v2/login/authorization/dialog?" + params.Encode()

	writeJSON(w, 200, map[string]interface{}{
		"status": "success",
		"data":   map[string]string{"authorizationUrl": authURL},
	})
}

// ── /auth/callback ────────────────────────────────────────────────────────────
func handleAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	errParam := r.URL.Query().Get("error")
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" { frontendURL = "https://anav-ai.vercel.app" }

	if errParam != "" || code == "" {
		http.Redirect(w, r, frontendURL+"/dashboard?upstox_error="+url.QueryEscape(errParam), 302)
		return
	}

	clientID := os.Getenv("UPSTOX_ALGO_CLIENT_ID")
	if clientID == "" { clientID = os.Getenv("UPSTOX_CLIENT_ID") }
	clientSecret := os.Getenv("UPSTOX_ALGO_CLIENT_SECRET")
	if clientSecret == "" { clientSecret = os.Getenv("UPSTOX_CLIENT_SECRET") }
	redirectURI := os.Getenv("UPSTOX_ALGO_REDIRECT_URI")
	if redirectURI == "" { redirectURI = os.Getenv("UPSTOX_REDIRECT_URI") }

	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("redirect_uri", redirectURI)
	form.Set("grant_type", "authorization_code")

	resp, err := http.PostForm("https://api.upstox.com/v2/login/authorization/token", form)
	if err != nil {
		http.Redirect(w, r, frontendURL+"/dashboard?upstox_error="+url.QueryEscape(err.Error()), 302)
		return
	}
	defer resp.Body.Close()

	var tokenData map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&tokenData)

	if token, ok := tokenData["access_token"].(string); ok {
		http.Redirect(w, r, frontendURL+"/dashboard?upstox_token="+url.QueryEscape(token)+"&upstox_connected=1", 302)
	} else {
		errMsg, _ := json.Marshal(tokenData)
		http.Redirect(w, r, frontendURL+"/dashboard?upstox_error="+url.QueryEscape(string(errMsg)), 302)
	}
}

// ── /api/search ───────────────────────────────────────────────────────────────
func handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("q")))
	if q == "" { writeJSON(w, 200, map[string]interface{}{"results": []interface{}{}}); return }

	type Result struct {
		Symbol     string `json:"symbol"`
		Name       string `json:"shortName"`
		Exchange   string `json:"exchange"`
		InstrKey   string `json:"instrumentKey"`
	}

	var results []Result
	for sym, key := range symbolKeyMap {
		if strings.HasPrefix(sym, q) || strings.Contains(sym, q) {
			results = append(results, Result{Symbol: sym, Name: sym, Exchange: "NSE", InstrKey: key})
			if len(results) >= 15 { break }
		}
	}
	writeJSON(w, 200, map[string]interface{}{"results": results})
}

// ── /session ──────────────────────────────────────────────────────────────────
func handleSession(w http.ResponseWriter, r *http.Request) {
	token := getToken(r)
	writeJSON(w, 200, map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"authenticated": token != "",
			"hasToken":      token != "",
		},
	})
}

// ── /api/optionchain ──────────────────────────────────────────────────────────
func handleOptionChain(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(r.URL.Query().Get("symbol"))
	if symbol == "" { symbol = "NIFTY" }
	cKey := "oc:" + symbol
	if cached, ok := cache.Get(cKey); ok {
		writeJSON(w, 200, cached); return
	}

	// Try NSE India API
	client := &http.Client{Timeout: 10 * time.Second}
	headers := map[string]string{
		"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		"Accept":          "application/json",
		"Referer":         "https://www.nseindia.com",
		"Accept-Language": "en-US,en;q=0.9",
	}

	// Get session cookies
	cookies := ""
	homeReq, _ := http.NewRequest("GET", "https://www.nseindia.com/", nil)
	for k, v := range headers { homeReq.Header.Set(k, v) }
	if homeResp, err := client.Do(homeReq); err == nil {
		for _, c := range homeResp.Cookies() {
			if cookies != "" { cookies += "; " }
			cookies += c.Name + "=" + c.Value
		}
		homeResp.Body.Close()
	}

	isIndex := symbol == "NIFTY" || symbol == "BANKNIFTY" || symbol == "FINNIFTY"
	ocURL := "https://www.nseindia.com/api/option-chain-equities?symbol=" + symbol
	if isIndex { ocURL = "https://www.nseindia.com/api/option-chain-indices?symbol=" + symbol }

	ocReq, _ := http.NewRequest("GET", ocURL, nil)
	for k, v := range headers { ocReq.Header.Set(k, v) }
	if cookies != "" { ocReq.Header.Set("Cookie", cookies) }

	ocResp, err := client.Do(ocReq)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"status": "error", "message": err.Error()})
		return
	}
	defer ocResp.Body.Close()

	var ocData map[string]interface{}
	json.NewDecoder(ocResp.Body).Decode(&ocData)

	result := map[string]interface{}{"status": "success", "symbol": symbol, "data": ocData}
	cache.Set(cKey, result, 30*time.Second)
	writeJSON(w, 200, result)
}

// ── /news ─────────────────────────────────────────────────────────────────────
func handleNews(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("instrument_keys")
	if symbol == "" { symbol = "NIFTY" }
	cKey := "news:" + symbol
	if cached, ok := cache.Get(cKey); ok {
		writeJSON(w, 200, cached); return
	}
	// Return empty news (RSS would be fetched here)
	result := map[string]interface{}{
		"status": "success",
		"data":   []interface{}{},
	}
	cache.Set(cKey, result, 2*time.Minute)
	writeJSON(w, 200, result)
}

// ── /fundamentals ─────────────────────────────────────────────────────────────
func handleFundamentals(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(r.URL.Query().Get("symbol"))
	cKey := "fund:" + symbol
	if cached, ok := cache.Get(cKey); ok {
		writeJSON(w, 200, cached); return
	}
	result := map[string]interface{}{
		"status": "success",
		"data":   map[string]interface{}{"symbol": symbol},
	}
	cache.Set(cKey, result, 10*time.Minute)
	writeJSON(w, 200, result)
}

// ── Main ──────────────────────────────────────────────────────────────────────
func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "3002" }

	mux := http.NewServeMux()

	routes := map[string]http.HandlerFunc{
		"/api/analyze":      handleAnalyze,
		"/analyze":          handleAnalyze,
		"/auth/url":         handleAuthURL,
		"/auth/callback":    handleAuthCallback,
		"/api/search":       handleSearch,
		"/api/optionchain":  handleOptionChain,
		"/session":          handleSession,
		"/news":             handleNews,
		"/fundamentals":     handleFundamentals,
		"/health":           func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok", "service": "AnavAI Go Server"}) },
	}

	for path, handler := range routes {
		mux.HandleFunc(path, withCORS(handler))
	}

	log.Printf("🚀 AnavAI Go Server starting on port %s", port)
	log.Printf("   Routes: %d", len(routes))
	log.Printf("   Cache: in-memory LRU")
	log.Printf("   Upstox: %s", func() string {
		if os.Getenv("UPSTOX_ALGO_CLIENT_ID") != "" { return "✓ ALGO APP" }
		if os.Getenv("UPSTOX_CLIENT_ID") != "" { return "✓ SANDBOX" }
		return "✗ NOT SET"
	}())

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
