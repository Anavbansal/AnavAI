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
		var lastErr error

		// Try 1: V3 intraday (today's candles)
		path := fmt.Sprintf("/v3/historical-candle/intraday/%s/%s",
			url.PathEscape(instrumentKey), interval)
		if data, err := upstoxGet(path, token, nil); err == nil {
			if candles := parseCandles(data); len(candles) > 0 {
				return candles, nil
			}
		} else {
			lastErr = err
		}

		// Try 2: V2 historical last 10 days (works even when market closed)
		for _, days := range []int{1, 5, 10, 30} {
			fromDate := now.AddDate(0, 0, -days).Format("2006-01-02")
			path2 := fmt.Sprintf("/v2/historical-candle/%s/%s/%s/%s",
				url.PathEscape(instrumentKey), interval, toDate, fromDate)
			if data2, err2 := upstoxGet(path2, token, nil); err2 == nil {
				if candles := parseCandles(data2); len(candles) > 0 {
					return candles, nil
				}
			} else {
				lastErr = err2
			}
		}

		// Try 3: Use day candles as fallback
		fromDate := now.AddDate(0, 0, -60).Format("2006-01-02")
		path3 := fmt.Sprintf("/v2/historical-candle/%s/day/%s/%s",
			url.PathEscape(instrumentKey), toDate, fromDate)
		if data3, err3 := upstoxGet(path3, token, nil); err3 == nil {
			if candles := parseCandles(data3); len(candles) > 0 {
				return candles, nil
			}
		}

		return nil, fmt.Errorf("all intraday attempts failed for %s: %v", instrumentKey, lastErr)
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
	// Try common formats — Upstox uses ISIN-based keys
	// NSE_EQ|SYMBOL format works for most listed stocks
	return "NSE_EQ|" + symbol
}

// resolveWithSearch tries to find instrument key via Upstox search API
func resolveWithSearch(symbol, token string) string {
	// First check static map
	if k, ok := symbolKeyMap[symbol]; ok {
		return k
	}
	if token == "" {
		return "NSE_EQ|" + symbol
	}
	// Try Upstox search API
	data, err := upstoxGet("/v2/market-quote/ltp", token, map[string]string{
		"instrument_key": "NSE_EQ|" + symbol,
	})
	if err == nil {
		if d, ok := data["data"].(map[string]interface{}); ok && len(d) > 0 {
			return "NSE_EQ|" + symbol // Works!
		}
	}
	// Try BSE fallback
	return "NSE_EQ|" + symbol
}

// Symbol → Instrument key map
var symbolKeyMap = map[string]string{
	"ABB":	"NSE_EQ|INE117A01022",
	"ABBOTINDIA":	"NSE_EQ|INE358A01014",
	"ABCAPITAL":	"NSE_EQ|INE674K01013",
	"ACCLTD":	"NSE_EQ|INE012A01025",
	"ADANIENT":	"NSE_EQ|INE423A01024",
	"ADANIPORTS":	"NSE_EQ|INE742F01042",
	"ALKEM":	"NSE_EQ|INE540L01014",
	"AMBUJACEM":	"NSE_EQ|INE079A01024",
	"ANGELONE":	"NSE_EQ|INE732I01013",
	"APOLLOHOSP":	"NSE_EQ|INE437A01024",
	"APOLLOTYRE":	"NSE_EQ|INE438A01022",
	"ASHOKLEY":	"NSE_EQ|INE208A01029",
	"ASIANPAINT":	"NSE_EQ|INE021A01026",
	"AUBANK":	"NSE_EQ|INE949L01017",
	"AUROPHARMA":	"NSE_EQ|INE406A01037",
	"AXISBANK":	"NSE_EQ|INE238A01034",
	"BAJAJ-AUTO":	"NSE_EQ|INE917I01010",
	"BAJAJFINSV":	"NSE_EQ|INE918I01026",
	"BAJFINANCE":	"NSE_EQ|INE296A01024",
	"BALKRISIND":	"NSE_EQ|INE787D01026",
	"BANDHANBNK":	"NSE_EQ|INE545U01014",
	"BANKBARODA":	"NSE_EQ|INE028A01039",
	"BANKEX":	"BSE_INDEX|BANKEX",
	"BANKNIFTY":	"NSE_INDEX|Nifty Bank",
	"BDL":	"NSE_EQ|INE171Z01018",
	"BEL":	"NSE_EQ|INE263A01024",
	"BHARATFORG":	"NSE_EQ|INE465A01025",
	"BHARTIARTL":	"NSE_EQ|INE397D01024",
	"BIOCON":	"NSE_EQ|INE376G01013",
	"BPCL":	"NSE_EQ|INE029A01011",
	"BRITANNIA":	"NSE_EQ|INE216A01030",
	"BSE":	"NSE_EQ|INE118H01025",
	"CANBK":	"NSE_EQ|INE476A01014",
	"CDSL":	"NSE_EQ|INE736A01011",
	"CESC":	"NSE_EQ|INE486A01021",
	"CHOLAFIN":	"NSE_EQ|INE121A01024",
	"CIPLA":	"NSE_EQ|INE059A01026",
	"COALINDIA":	"NSE_EQ|INE522F01014",
	"COCHINSHIP":	"NSE_EQ|INE704P01017",
	"COFORGE":	"NSE_EQ|INE591G01017",
	"CUMMINSIND":	"NSE_EQ|INE298A01020",
	"DEEPAKNTR":	"NSE_EQ|INE288B01029",
	"DIVISLAB":	"NSE_EQ|INE361B01024",
	"DIXON":	"NSE_EQ|INE935N01020",
	"DLF":	"NSE_EQ|INE271C01023",
	"DMART":	"NSE_EQ|INE192R01011",
	"DRREDDY":	"NSE_EQ|INE089A01031",
	"EICHERMOT":	"NSE_EQ|INE066A01021",
	"FEDERALBNK":	"NSE_EQ|INE171A01029",
	"FINNIFTY":	"NSE_INDEX|Nifty Fin Service",
	"FORTIS":	"NSE_EQ|INE401H01019",
	"GAIL":	"NSE_EQ|INE129A01019",
	"GODREJPROP":	"NSE_EQ|INE484J01027",
	"GRASIM":	"NSE_EQ|INE047A01021",
	"GRSE":	"NSE_EQ|INE382Z01011",
	"GUJGASLTD":	"NSE_EQ|INE844O01030",
	"HAL":	"NSE_EQ|INE066F01012",
	"HAVELLS":	"NSE_EQ|INE176B01034",
	"HCLTECH":	"NSE_EQ|INE860A01027",
	"HDFCBANK":	"NSE_EQ|INE040A01034",
	"HDFCLIFE":	"NSE_EQ|INE795G01014",
	"HEROMOTOCO":	"NSE_EQ|INE158A01026",
	"HINDALCO":	"NSE_EQ|INE038A01020",
	"HINDUNILVR":	"NSE_EQ|INE030A01027",
	"HSCL":	"NSE_EQ|INE019C01026",
	"HUDCO":	"NSE_EQ|INE031A01017",
	"ICICIBANK":	"NSE_EQ|INE090A01021",
	"IDFCFIRSTB":	"NSE_EQ|INE092T01019",
	"IGL":	"NSE_EQ|INE203G01027",
	"INDHOTEL":	"NSE_EQ|INE053A01029",
	"INDIGO":	"NSE_EQ|INE646L01027",
	"INDUSINDBK":	"NSE_EQ|INE095A01012",
	"INFY":	"NSE_EQ|INE009A01021",
	"IOC":	"NSE_EQ|INE242A01010",
	"IRCTC":	"NSE_EQ|INE335Y01020",
	"IRFC":	"NSE_EQ|INE053F01010",
	"ITC":	"NSE_EQ|INE154A01025",
	"JSWSTEEL":	"NSE_EQ|INE019A01038",
	"JUBLFOOD":	"NSE_EQ|INE797F01020",
	"JUBLINGREA":	"NSE_EQ|INE485A01015",
	"KALPATPOWR":	"NSE_EQ|INE220B01014",
	"KEC":	"NSE_EQ|INE389H01022",
	"KOTAKBANK":	"NSE_EQ|INE237A01028",
	"KPITTECH":	"NSE_EQ|INE836A01035",
	"LALPATHLAB":	"NSE_EQ|INE600L01024",
	"LICHSGFIN":	"NSE_EQ|INE115A01026",
	"LICI":	"NSE_EQ|INE0J1Y01017",
	"LT":	"NSE_EQ|INE018A01030",
	"LTIM":	"NSE_EQ|INE214T01019",
	"LUPIN":	"NSE_EQ|INE326A01037",
	"MANYAVAR":	"NSE_EQ|INE825V01022",
	"MARUTI":	"NSE_EQ|INE585B01010",
	"MAXHEALTH":	"NSE_EQ|INE027H01010",
	"MAZDOCK":	"NSE_EQ|INE249M01031",
	"MCX":	"NSE_EQ|INE745G01035",
	"MGL":	"NSE_EQ|INE558L01010",
	"MIDCPNIFTY":	"NSE_INDEX|NIFTY MID SELECT",
	"MM":	"NSE_EQ|INE101A01026",
	"MOTHERSON":	"NSE_EQ|INE775A01035",
	"MPHASIS":	"NSE_EQ|INE356A01018",
	"MRF":	"NSE_EQ|INE883A01011",
	"MUTHOOTFIN":	"NSE_EQ|INE414G01012",
	"NATIONALUM":	"NSE_EQ|INE139A01034",
	"NAUKRI":	"NSE_EQ|INE663F01024",
	"NESTLEIND":	"NSE_EQ|INE239A01024",
	"NHPC":	"NSE_EQ|INE848E01016",
	"NIFTY":	"NSE_INDEX|Nifty 50",
	"NTPC":	"NSE_EQ|INE733E01010",
	"NYKAA":	"NSE_EQ|INE388Y01029",
	"OBEROIRLTY":	"NSE_EQ|INE093I01010",
	"ONGC":	"NSE_EQ|INE213A01029",
	"PAGEIND":	"NSE_EQ|INE761H01022",
	"PAYTM":	"NSE_EQ|INE982J01020",
	"PERSISTENT":	"NSE_EQ|INE262H01021",
	"PETRONET":	"NSE_EQ|INE347G01014",
	"PFC":	"NSE_EQ|INE134E01011",
	"PHOENIXLTD":	"NSE_EQ|INE484J01027",
	"PIIND":	"NSE_EQ|INE603J01030",
	"PNB":	"NSE_EQ|INE160A01022",
	"POLYCAB":	"NSE_EQ|INE455K01017",
	"POWERGRID":	"NSE_EQ|INE752E01010",
	"PRESTIGE":	"NSE_EQ|INE811K01011",
	"RAILTEL":	"NSE_EQ|INE503X01023",
	"RECLTD":	"NSE_EQ|INE020B01018",
	"RELIANCE":	"NSE_EQ|INE002A01018",
	"RITES":	"NSE_EQ|INE320J01015",
	"RVNL":	"NSE_EQ|INE415G01027",
	"SBICARD":	"NSE_EQ|INE018E01016",
	"SBILIFE":	"NSE_EQ|INE123W01016",
	"SBIN":	"NSE_EQ|INE062A01020",
	"SENSEX":	"BSE_INDEX|SENSEX",
	"SHREECEM":	"NSE_EQ|INE070A01015",
	"SHRIRAMFIN":	"NSE_EQ|INE721A01013",
	"SIEMENS":	"NSE_EQ|INE003A01024",
	"SJVN":	"NSE_EQ|INE002L01015",
	"SOBHA":	"NSE_EQ|INE671H01015",
	"SOLARINDS":	"NSE_EQ|INE343H01029",
	"SUNPHARMA":	"NSE_EQ|INE044A01036",
	"SUZLON":	"NSE_EQ|INE040H01021",
	"TATACHEM":	"NSE_EQ|INE092A01019",
	"TATACOMM":	"NSE_EQ|INE151B01027",
	"TATACONSUM":	"NSE_EQ|INE192A01025",
	"TATAELXSI":	"NSE_EQ|INE670A01012",
	"TATAMOTORS":	"NSE_EQ|INE155A01022",
	"TATAPOWER":	"NSE_EQ|INE245A01021",
	"TATASTEEL":	"NSE_EQ|INE081A01020",
	"TCS":	"NSE_EQ|INE467B01029",
	"TECHM":	"NSE_EQ|INE669C01036",
	"THERMAX":	"NSE_EQ|INE152C01011",
	"TIINDIA":	"NSE_EQ|INE289B01019",
	"TITAGARH":	"NSE_EQ|INE615A01017",
	"TITAN":	"NSE_EQ|INE280A01028",
	"TORNTPHARM":	"NSE_EQ|INE685A01028",
	"TRENT":	"NSE_EQ|INE849A01020",
	"TVSMOTOR":	"NSE_EQ|INE494B01023",
	"ULTRACEMCO":	"NSE_EQ|INE481G01011",
	"UNIONBANK":	"NSE_EQ|INE692A01016",
	"VEDL":	"NSE_EQ|INE205A01025",
	"VOLTAS":	"NSE_EQ|INE226A01021",
	"VPRPL":	"NSE_EQ|INE0AE001013",
	"WIPRO":	"NSE_EQ|INE075A01022",
	"XCHANGING":	"NSE_EQ|INE692G01013",
	"YESBANK":	"NSE_EQ|INE528G01035",
	"ZOMATO":	"NSE_EQ|INE758T01015",
}


// fetchFullQuote — real-time OHLC + LTP + volume + circuit limits
func fetchFullQuote(instrumentKey, token string) (map[string]interface{}, error) {
	data, err := upstoxGet("/v2/market-quote/quotes", token, map[string]string{
		"instrument_key": instrumentKey,
	})
	if err != nil { return nil, err }
	d, ok := data["data"].(map[string]interface{})
	if !ok { return nil, fmt.Errorf("no data") }
	for _, v := range d {
		if m, ok := v.(map[string]interface{}); ok {
			return m, nil
		}
	}
	return nil, fmt.Errorf("quote not found")
}

// fetchOHLC — real-time OHLC for a symbol
func fetchOHLC(instrumentKey, interval, token string) (map[string]interface{}, error) {
	if interval == "" { interval = "1d" }
	data, err := upstoxGet("/v2/market-quote/ohlc", token, map[string]string{
		"instrument_key": instrumentKey,
		"interval":       interval,
	})
	if err != nil { return nil, err }
	d, ok := data["data"].(map[string]interface{})
	if !ok { return nil, fmt.Errorf("no data") }
	for _, v := range d {
		if m, ok := v.(map[string]interface{}); ok {
			return m, nil
		}
	}
	return nil, fmt.Errorf("ohlc not found")
}

// fetchHoldings — actual portfolio from Upstox
func fetchHoldings(token string) ([]interface{}, error) {
	data, err := upstoxGet("/v2/portfolio/long-term-holdings", token, nil)
	if err != nil { return nil, err }
	d, ok := data["data"].([]interface{})
	if !ok { return nil, fmt.Errorf("no holdings data") }
	return d, nil
}

// refreshToken — auto refresh when token expires
func refreshToken(refreshTok string) (string, error) {
	clientID := os.Getenv("UPSTOX_ALGO_CLIENT_ID")
	if clientID == "" { clientID = os.Getenv("UPSTOX_CLIENT_ID") }
	clientSecret := os.Getenv("UPSTOX_ALGO_CLIENT_SECRET")
	if clientSecret == "" { clientSecret = os.Getenv("UPSTOX_CLIENT_SECRET") }

	form := url.Values{}
	form.Set("refresh_token", refreshTok)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("grant_type", "refresh_token")

	resp, err := http.PostForm("https://api.upstox.com/v2/login/token/refresh",
		form)
	if err != nil { return "", err }
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if token, ok := result["access_token"].(string); ok {
		return token, nil
	}
	return "", fmt.Errorf("refresh failed: %v", result)
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
