package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

var upstoxBaseURL = "https://api.upstox.com"

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
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Api-Version", "2.0")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse error (status %d): %s", resp.StatusCode, string(body[:minInt(300, len(body))]))
	}

	// Check Upstox error response
	if status, ok := result["status"].(string); ok && status == "error" {
		if errs, ok := result["errors"].([]interface{}); ok && len(errs) > 0 {
			if errMap, ok := errs[0].(map[string]interface{}); ok {
				return nil, fmt.Errorf("upstox error: %v", errMap["message"])
			}
		}
		return nil, fmt.Errorf("upstox error: %v", result)
	}

	return result, nil
}

func getToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		t := strings.TrimPrefix(auth, "Bearer ")
		if len(t) > 50 {
			return t
		}
	}
	return os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
}

func fetchHistoricalCandles(instrumentKey, resolution, token string) ([]Candle, error) {
	if token == "" {
		token = os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
	}

	now := time.Now()
	toDate := now.Format("2006-01-02")

	// ── Intraday (minute-level) — use V3 intraday API ──────────────────────
	intraday := map[string]string{
		"1": "1minute", "5": "5minute", "10": "10minute",
		"15": "15minute", "30": "30minute", "60": "60minute",
	}

	if interval, ok := intraday[resolution]; ok {
		// V3 intraday endpoint
		path := fmt.Sprintf("/v3/historical-candle/intraday/%s/%s",
			url.PathEscape(instrumentKey), interval)
		data, err := upstoxGet(path, token, nil)
		if err == nil {
			candles := parseCandles(data)
			if len(candles) > 0 {
				return candles, nil
			}
		}
		// Fallback: V2 historical with recent dates
		fromDate := now.AddDate(0, 0, -5).Format("2006-01-02")
		path2 := fmt.Sprintf("/v2/historical-candle/%s/%s/%s/%s",
			url.PathEscape(instrumentKey), interval, toDate, fromDate)
		data2, err2 := upstoxGet(path2, token, nil)
		if err2 != nil {
			return nil, fmt.Errorf("intraday fetch failed: v3=%v, v2=%v", err, err2)
		}
		return parseCandles(data2), nil
	}

	// ── Daily / Weekly / Monthly — V2 historical ────────────────────────────
	intervalMap := map[string]string{
		"D": "day", "W": "week", "M": "month",
	}
	interval := intervalMap[resolution]
	if interval == "" {
		interval = "day"
	}

	fromDate := now.AddDate(-1, 0, 0).Format("2006-01-02")
	if resolution == "W" {
		fromDate = now.AddDate(-2, 0, 0).Format("2006-01-02")
	}
	if resolution == "M" {
		fromDate = now.AddDate(-5, 0, 0).Format("2006-01-02")
	}

	path := fmt.Sprintf("/v2/historical-candle/%s/%s/%s/%s",
		url.PathEscape(instrumentKey), interval, toDate, fromDate)
	data, err := upstoxGet(path, token, nil)
	if err != nil {
		return nil, err
	}
	return parseCandles(data), nil
}

func parseCandles(data map[string]interface{}) []Candle {
	// Try data.candles path
	d, ok := data["data"]
	if !ok {
		return nil
	}

	var candleArr []interface{}

	switch v := d.(type) {
	case map[string]interface{}:
		if arr, ok := v["candles"].([]interface{}); ok {
			candleArr = arr
		}
	case []interface{}:
		candleArr = v
	}

	if len(candleArr) == 0 {
		return nil
	}

	var candles []Candle
	for _, c := range candleArr {
		arr, ok := c.([]interface{})
		if !ok || len(arr) < 6 {
			continue
		}
		ts := int64(0)
		if tsStr, ok := arr[0].(string); ok {
			// Try RFC3339 first, then date-only
			for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05+0530", "2006-01-02"} {
				t, err := time.Parse(layout, tsStr)
				if err == nil {
					ts = t.UnixMilli()
					break
				}
			}
		}
		toF := func(v interface{}) float64 {
			switch x := v.(type) {
			case float64:
				return x
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

	// Upstox returns newest first — reverse to oldest first
	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}
	return candles
}

func fetchLTP(instrumentKey, token string) (float64, error) {
	if token == "" {
		token = os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
	}
	data, err := upstoxGet("/v2/market-quote/ltp", token, map[string]string{
		"instrument_key": instrumentKey,
	})
	if err != nil {
		return 0, err
	}
	d, ok := data["data"].(map[string]interface{})
	if !ok {
		return 0, fmt.Errorf("no data in LTP response")
	}
	for _, v := range d {
		if m, ok := v.(map[string]interface{}); ok {
			if ltp, ok := m["last_price"].(float64); ok {
				return round2(ltp), nil
			}
		}
	}
	return 0, fmt.Errorf("last_price not found")
}

func resolveInstrumentKey(symbol string) string {
	if k, ok := symbolKeyMap[symbol]; ok {
		return k
	}
	// Try NSE EQ format
	return "NSE_EQ|" + symbol
}

// Symbol → Instrument key map
var symbolKeyMap = map[string]string{
	// Indices
	"NIFTY":       "NSE_INDEX|Nifty 50",
	"BANKNIFTY":   "NSE_INDEX|Nifty Bank",
	"FINNIFTY":    "NSE_INDEX|Nifty Fin Service",
	"MIDCPNIFTY":  "NSE_INDEX|NIFTY MID SELECT",
	"SENSEX":      "BSE_INDEX|SENSEX",
	"BANKEX":      "BSE_INDEX|BANKEX",
	// Nifty 50
	"RELIANCE":    "NSE_EQ|INE002A01018",
	"TCS":         "NSE_EQ|INE467B01029",
	"HDFCBANK":    "NSE_EQ|INE040A01034",
	"INFY":        "NSE_EQ|INE009A01021",
	"ICICIBANK":   "NSE_EQ|INE090A01021",
	"HINDUNILVR":  "NSE_EQ|INE030A01027",
	"ITC":         "NSE_EQ|INE154A01025",
	"SBIN":        "NSE_EQ|INE062A01020",
	"BHARTIARTL":  "NSE_EQ|INE397D01024",
	"KOTAKBANK":   "NSE_EQ|INE237A01028",
	"LT":          "NSE_EQ|INE018A01030",
	"HCLTECH":     "NSE_EQ|INE860A01027",
	"BAJFINANCE":  "NSE_EQ|INE296A01024",
	"ASIANPAINT":  "NSE_EQ|INE021A01026",
	"MARUTI":      "NSE_EQ|INE585B01010",
	"ADANIENT":    "NSE_EQ|INE423A01024",
	"AXISBANK":    "NSE_EQ|INE238A01034",
	"WIPRO":       "NSE_EQ|INE075A01022",
	"ULTRACEMCO":  "NSE_EQ|INE481G01011",
	"TITAN":       "NSE_EQ|INE280A01028",
	"BAJAJFINSV":  "NSE_EQ|INE918I01026",
	"NESTLEIND":   "NSE_EQ|INE239A01024",
	"SUNPHARMA":   "NSE_EQ|INE044A01036",
	"TECHM":       "NSE_EQ|INE669C01036",
	"ONGC":        "NSE_EQ|INE213A01029",
	"TATAMOTORS":  "NSE_EQ|INE155A01022",
	"NTPC":        "NSE_EQ|INE733E01010",
	"POWERGRID":   "NSE_EQ|INE752E01010",
	"INDUSINDBK":  "NSE_EQ|INE095A01012",
	"COALINDIA":   "NSE_EQ|INE522F01014",
	"TATASTEEL":   "NSE_EQ|INE081A01020",
	"GRASIM":      "NSE_EQ|INE047A01021",
	"ADANIPORTS":  "NSE_EQ|INE742F01042",
	"DRREDDY":     "NSE_EQ|INE089A01031",
	"DIVISLAB":    "NSE_EQ|INE361B01024",
	"CIPLA":       "NSE_EQ|INE059A01026",
	"APOLLOHOSP":  "NSE_EQ|INE437A01024",
	"JSWSTEEL":    "NSE_EQ|INE019A01038",
	"EICHERMOT":   "NSE_EQ|INE066A01021",
	"BPCL":        "NSE_EQ|INE029A01011",
	"BRITANNIA":   "NSE_EQ|INE216A01030",
	"HEROMOTOCO":  "NSE_EQ|INE158A01026",
	"HINDALCO":    "NSE_EQ|INE038A01020",
	"MM":          "NSE_EQ|INE101A01026",
	"TRENT":       "NSE_EQ|INE849A01020",
	"BEL":         "NSE_EQ|INE263A01024",
	// Popular stocks
	"ZOMATO":      "NSE_EQ|INE758T01015",
	"HAL":         "NSE_EQ|INE066F01012",
	"IRFC":        "NSE_EQ|INE053F01010",
	"TATAPOWER":   "NSE_EQ|INE245A01021",
	"NATIONALUM":  "NSE_EQ|INE139A01034",
	"SUZLON":      "NSE_EQ|INE040H01021",
	"CANBK":       "NSE_EQ|INE476A01014",
	"CESC":        "NSE_EQ|INE486A01021",
	"YESBANK":     "NSE_EQ|INE528G01035",
	"PAYTM":       "NSE_EQ|INE982J01020",
	"NYKAA":       "NSE_EQ|INE388Y01029",
	"DMART":       "NSE_EQ|INE192R01011",
	"IRCTC":       "NSE_EQ|INE335Y01020",
	"MAZDOCK":     "NSE_EQ|INE249M01031",
	"DLF":         "NSE_EQ|INE271C01023",
	"PFC":         "NSE_EQ|INE134E01011",
	"RECLTD":      "NSE_EQ|INE020B01018",
	"IOC":         "NSE_EQ|INE242A01010",
	"NHPC":        "NSE_EQ|INE848E01016",
	"SJVN":        "NSE_EQ|INE002L01015",
	"GAIL":        "NSE_EQ|INE129A01019",
	"HDFCLIFE":    "NSE_EQ|INE795G01014",
	"SBICARD":     "NSE_EQ|INE018E01016",
	"SBILIFE":     "NSE_EQ|INE123W01016",
	"LICI":        "NSE_EQ|INE0J1Y01017",
	"LTIM":        "NSE_EQ|INE214T01019",
	"PERSISTENT":  "NSE_EQ|INE262H01021",
	"MPHASIS":     "NSE_EQ|INE356A01018",
	"COFORGE":     "NSE_EQ|INE591G01017",
	"KPITTECH":    "NSE_EQ|INE836A01035",
	"DIXON":       "NSE_EQ|INE935N01020",
	"POLYCAB":     "NSE_EQ|INE455K01017",
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
