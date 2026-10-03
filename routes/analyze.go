package routes

// Analyze route — broker-agnostic
// Works with Upstox OR Angel One
// Frontend sends: {symbol, instrumentKey, resolution, mode, broker?}

import (
	"anavai/broker"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

type AnalyzeRequest struct {
	Symbol       string `json:"symbol"`
	InstrumentKey string `json:"instrumentKey"`
	Resolution   string `json:"resolution"`
	Mode         string `json:"mode"`
	Broker       string `json:"broker"` // "upstox" | "angelone" | "" (auto)
}

// HandleAnalyze is the unified analyze endpoint
// It detects broker from request, fetches candles, runs indicators
func HandleAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, r, 405, errResp("method not allowed"))
		return
	}

	body, _ := io.ReadAll(r.Body)
	var req AnalyzeRequest
	json.Unmarshal(body, &req)

	symbol := strings.ToUpper(req.Symbol)
	if symbol == "" {
		symbol = "NIFTY"
	}
	resolution := req.Resolution
	if resolution == "" {
		resolution = "5"
	}

	// Get token from Authorization header
	token := getToken(r)

	// Store token for V3 feed activation
	go setFeedToken(token, req.Broker)

	// Resolve instrument key based on broker
	instrKey := req.InstrumentKey
	if instrKey == "" {
		instrKey = resolveKey(symbol, req.Broker)
	}

	// Fetch candles — try live feed cache first, then REST
	candles, source, err := fetchCandles(instrKey, symbol, resolution, token, req.Broker)
	if err != nil || len(candles) == 0 {
		log.Printf("[analyze] candle fetch failed for %s: %v", symbol, err)
		writeJSON(w, r, 200, errResp("No candle data returned from server"))
		return
	}

	// Build analysis (indicators + AI verdict)
	resp := buildAnalysisResponse(symbol, instrKey, candles, token, source)
	writeJSON(w, r, 200, map[string]interface{}{"status": "success", "data": resp})
}

func resolveKey(symbol, brokerName string) string {
	if b, err := broker.Get(brokerName); err == nil {
		return b.ResolveInstrumentKey(symbol)
	}
	// Default to Upstox format
	if k, ok := upstoxSymbolMap[symbol]; ok {
		return k
	}
	return "NSE_EQ|" + symbol
}

func fetchCandles(instrKey, symbol, resolution, token, brokerName string) ([]broker.Candle, string, error) {
	// 1. Check live feed cache (Upstox V3)
	// Live feed check — subscription happens after candles fetched
	_ = upstoxFeedGet // will be used when integrated

	// 2. Try preferred broker
	b, err := broker.GetAuthenticated(brokerName)
	if err == nil {
		candles, err := b.GetCandles(instrKey, resolution, token)
		if err == nil && len(candles) > 0 {
			return candles, b.Name(), nil
		}
		log.Printf("[analyze] %s candles failed: %v", b.Name(), err)
	}

	// 3. Fallback to any authenticated broker
	for _, name := range broker.All() {
		if name == brokerName {
			continue
		}
		if b2, err := broker.Get(name); err == nil && b2.IsAuthenticated() {
			candles, err := b2.GetCandles(instrKey, resolution, token)
			if err == nil && len(candles) > 0 {
				return candles, b2.Name() + "(fallback)", nil
			}
		}
	}

	return nil, "", fmt.Errorf("all brokers failed for %s", symbol)
}

func getToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
}

func writeJSON(w http.ResponseWriter, r *http.Request, status int, data interface{}) {
	origin := r.Header.Get("Origin")
	if origin == "" { origin = "*" }
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func errResp(msg string) map[string]interface{} {
	return map[string]interface{}{"status": "error", "message": msg}
}

// These will be implemented by main package — stubs for compilation
var (
	upstoxSymbolMap = map[string]string{}
	upstoxFeedGet   = func(key string) interface{} { return nil }
	setFeedToken    = func(token, broker string) {}
	buildAnalysisResponse = func(symbol, instrKey string, candles []broker.Candle, token, source string) interface{} { return nil }
)
