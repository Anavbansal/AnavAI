package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

var upstoxBaseURL = "https://api.upstox.com"

func getUpstoxHeaders(token string) http.Header {
	h := http.Header{}
	h.Set("Accept", "application/json")
	h.Set("Api-Version", "2.0")
	if token != "" {
		h.Set("Authorization", "Bearer "+token)
	}
	return h
}

func upstoxGet(path, token string, params map[string]string) (map[string]interface{}, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	u, _ := url.Parse(upstoxBaseURL + path)
	if params != nil {
		q := u.Query()
		for k, v := range params {
			q.Set(k, v)
		}
		u.RawQuery = q.Encode()
	}
	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil { return nil, err }
	req.Header = getUpstoxHeaders(token)

	resp, err := client.Do(req)
	if err != nil { return nil, err }
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil { return nil, err }

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse error: %s", string(body[:min(200,len(body))]))
	}
	return result, nil
}

func fetchHistoricalCandles(instrumentKey, resolution, token string) ([]Candle, error) {
	// Try sandbox token if no user token
	if token == "" {
		token = os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
	}

	// Resolution mapping
	intervalMap := map[string]string{
		"1": "1minute", "5": "5minute", "10": "10minute",
		"15": "15minute", "30": "30minute", "60": "60minute",
		"D": "day", "W": "week", "M": "month",
	}
	interval, ok := intervalMap[resolution]
	if !ok { interval = "5minute" }

	now := time.Now()
	toDate := now.Format("2006-01-02")
	fromDate := now.AddDate(0, 0, -30).Format("2006-01-02")
	if resolution == "D" { fromDate = now.AddDate(-1, 0, 0).Format("2006-01-02") }
	if resolution == "W" { fromDate = now.AddDate(-2, 0, 0).Format("2006-01-02") }
	if resolution == "M" { fromDate = now.AddDate(-5, 0, 0).Format("2006-01-02") }

	path := fmt.Sprintf("/v2/historical-candle/%s/%s/%s/%s",
		url.PathEscape(instrumentKey), interval, toDate, fromDate)

	data, err := upstoxGet(path, token, nil)
	if err != nil { return nil, err }

	candlesRaw, ok := data["data"].(map[string]interface{})
	if !ok { return nil, fmt.Errorf("no data field") }
	candleArr, ok := candlesRaw["candles"].([]interface{})
	if !ok { return nil, fmt.Errorf("no candles array") }

	var candles []Candle
	for _, c := range candleArr {
		arr, ok := c.([]interface{})
		if !ok || len(arr) < 6 { continue }
		ts := int64(0)
		if tsStr, ok := arr[0].(string); ok {
			// Parse ISO timestamp
			t, err := time.Parse(time.RFC3339, tsStr)
			if err == nil { ts = t.UnixMilli() }
		}
		toF := func(v interface{}) float64 {
			switch x := v.(type) {
			case float64: return x
			case string:
				f, _ := strconv.ParseFloat(x, 64)
				return f
			}
			return 0
		}
		candles = append(candles, Candle{
			Timestamp: ts,
			Open:      toF(arr[1]),
			High:      toF(arr[2]),
			Low:       toF(arr[3]),
			Close:     toF(arr[4]),
			Volume:    toF(arr[5]),
		})
	}
	// Upstox returns newest first — reverse
	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}
	return candles, nil
}

func fetchLTP(instrumentKey, token string) (float64, error) {
	if token == "" {
		token = os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
	}
	data, err := upstoxGet("/v2/market-quote/ltp", token, map[string]string{
		"instrument_key": instrumentKey,
	})
	if err != nil { return 0, err }
	d, ok := data["data"].(map[string]interface{})
	if !ok { return 0, fmt.Errorf("no data") }
	for _, v := range d {
		if m, ok := v.(map[string]interface{}); ok {
			if ltp, ok := m["last_price"].(float64); ok {
				return round2(ltp), nil
			}
		}
	}
	return 0, fmt.Errorf("ltp not found")
}

// Instrument key resolution
var symbolKeyMap = map[string]string{
	"NIFTY":      "NSE_INDEX|Nifty 50",
	"BANKNIFTY":  "NSE_INDEX|Nifty Bank",
	"FINNIFTY":   "NSE_INDEX|Nifty Fin Service",
	"MIDCPNIFTY": "NSE_INDEX|NIFTY MID SELECT",
	"SENSEX":     "BSE_INDEX|SENSEX",
	"RELIANCE":   "NSE_EQ|INE002A01018",
	"TCS":        "NSE_EQ|INE467B01029",
	"HDFCBANK":   "NSE_EQ|INE040A01034",
	"INFY":       "NSE_EQ|INE009A01021",
	"ICICIBANK":  "NSE_EQ|INE090A01021",
	"SBIN":       "NSE_EQ|INE062A01020",
	"WIPRO":      "NSE_EQ|INE075A01022",
	"BAJFINANCE": "NSE_EQ|INE296A01024",
	"ADANIENT":   "NSE_EQ|INE423A01024",
	"LT":         "NSE_EQ|INE018A01030",
	"AXISBANK":   "NSE_EQ|INE238A01034",
	"TATAMOTORS": "NSE_EQ|INE155A01022",
	"TATASTEEL":  "NSE_EQ|INE081A01020",
	"NTPC":       "NSE_EQ|INE733E01010",
	"RVNL":       "NSE_EQ|INE415G01027",
	"IRFC":       "NSE_EQ|INE053F01010",
	"ZOMATO":     "NSE_EQ|INE758T01015",
	"HAL":        "NSE_EQ|INE066F01012",
	"CESC":       "NSE_EQ|INE486A01021",
	"TATAPOWER":  "NSE_EQ|INE245A01021",
	"NATIONALUM": "NSE_EQ|INE139A01034",
	"SUZLON":     "NSE_EQ|INE040H01021",
	"CANBK":      "NSE_EQ|INE476A01014",
}

func resolveInstrumentKey(symbol string) string {
	if k, ok := symbolKeyMap[symbol]; ok { return k }
	// Default to NSE EQ format
	return "NSE_EQ|" + symbol
}

func min(a, b int) int {
	if a < b { return a }
	return b
}
