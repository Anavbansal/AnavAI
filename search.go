package main

import (
	"anavai/broker"
	"compress/gzip"
	"encoding/csv"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// ── NSE Instruments Master (downloaded on startup, refreshed daily) ───────────
// Provides full coverage of all listed NSE stocks including new IPOs

var (
	nseInstruments   []SearchResult
	nseMu            sync.RWMutex
	nseLastRefreshed time.Time
)

// initNSEInstruments downloads NSE+BSE instruments from Upstox public CSV
// Called at startup in a goroutine; refreshes daily.
func initNSEInstruments() {
	for {
		if err := loadNSEInstruments(); err != nil {
			log.Printf("[nse] instruments load failed: %v — retrying in 30m", err)
			time.Sleep(30 * time.Minute)
		} else {
			time.Sleep(24 * time.Hour)
		}
	}
}

func loadNSEInstruments() error {
	// Upstox public instruments CSV (no auth required)
	urls := []struct{ url, exch string }{
		{"https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz", "NSE"},
	}
	var all []SearchResult
	for _, u := range urls {
		results, err := fetchUpstoxInstrumentsGz(u.url, u.exch)
		if err != nil {
			log.Printf("[nse] %s fetch err: %v", u.exch, err)
			continue
		}
		all = append(all, results...)
	}

	if len(all) == 0 {
		// Fallback: try NSE CSV directly
		results, err := fetchNSECsv()
		if err != nil {
			return err
		}
		all = results
	}

	nseMu.Lock()
	nseInstruments = all
	nseLastRefreshed = time.Now()
	nseMu.Unlock()
	log.Printf("[nse] loaded %d instruments", len(all))
	return nil
}

func fetchUpstoxInstrumentsGz(rawURL, exch string) ([]SearchResult, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var reader io.Reader = resp.Body
	if strings.HasSuffix(rawURL, ".gz") {
		gz, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, err
		}
		defer gz.Close()
		reader = gz
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, err
	}

	var results []SearchResult
	for _, m := range items {
		toS := func(k string) string {
			if v, ok := m[k].(string); ok { return v }
			return ""
		}
		sym := toS("trading_symbol")
		if sym == "" { continue }
		seg := toS("instrument_type")
		if seg == "" { seg = "EQ" }
		seg = strings.ReplaceAll(seg, "NSE_", "")
		seg = strings.ReplaceAll(seg, "BSE_", "")
		results = append(results, SearchResult{
			Symbol:        sym,
			Name:          toS("name"),
			Exchange:      exch,
			Segment:       seg,
			InstrumentKey: toS("instrument_key"),
			ISIN:          toS("isin"),
			Source:        "nse_master",
		})
	}
	return results, nil
}

func fetchNSECsv() ([]SearchResult, error) {
	// NSE equity bhavcopy master — all EQ segment stocks
	csvURL := "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
	client := &http.Client{Timeout: 20 * time.Second}
	req, _ := http.NewRequest("GET", csvURL, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.nseindia.com/")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	r := csv.NewReader(resp.Body)
	rows, err := r.ReadAll()
	if err != nil {
		return nil, err
	}

	var results []SearchResult
	for i, row := range rows {
		if i == 0 || len(row) < 3 { continue } // skip header
		sym := strings.TrimSpace(row[0])
		name := strings.TrimSpace(row[1])
		isin := ""
		if len(row) > 2 { isin = strings.TrimSpace(row[2]) }
		if sym == "" { continue }
		results = append(results, SearchResult{
			Symbol:        sym,
			Name:          name,
			Exchange:      "NSE",
			Segment:       "EQ",
			InstrumentKey: "NSE_EQ|" + isin,
			ISIN:          isin,
			Source:        "nse_master",
		})
	}
	return results, nil
}

// searchNSEMaster searches the in-memory NSE instrument list
func searchNSEMaster(q, _ string) []SearchResult {
	nseMu.RLock()
	instruments := nseInstruments
	nseMu.RUnlock()

	if len(instruments) == 0 {
		return nil
	}

	q2 := strings.ToUpper(strings.TrimSpace(q))
	type scored struct {
		r     SearchResult
		score int
	}
	var matches []scored

	for _, item := range instruments {
		s := strings.ToUpper(item.Symbol)
		n := strings.ToUpper(item.Name)
		var score int
		if s == q2 { score = 200 } else if strings.HasPrefix(s, q2) { score = 150 } else if strings.HasPrefix(n, q2) { score = 120 } else if strings.Contains(s, q2) { score = 80 } else if strings.Contains(n, q2) { score = 50 } else { continue }
		matches = append(matches, scored{item, score})
	}

	// Simple sort by score descending
	for i := 0; i < len(matches); i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[j].score > matches[i].score {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}

	var results []SearchResult
	for i, m := range matches {
		if i >= 15 { break }
		results = append(results, m.r)
	}
	return results
}

// ── Live Search — 3 sources in parallel ──────────────────────────────────────
// 1. Upstox /v2/market-quote/search  — live NSE/BSE all listed stocks
// 2. Angel One searchScrip           — if Angel One connected
// 3. Local symbolKeyMap fallback      — always works

type SearchResult struct {
	Symbol       string `json:"symbol"`
	Name         string `json:"shortName"`
	Exchange     string `json:"exchange"`
	Segment      string `json:"segment"`
	InstrumentKey string `json:"instrumentKey"`
	ISIN         string `json:"isin,omitempty"`
	LotSize      int    `json:"lotSize,omitempty"`
	Source       string `json:"source"`
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, 200, map[string]interface{}{"results": []interface{}{}})
		return
	}

	token := getToken(r)
	cKey  := "search:" + strings.ToUpper(q)

	if cached, ok := cache.Get(cKey); ok {
		writeJSON(w, 200, cached)
		return
	}

	// Run all searches in parallel
	type searchFn func(string, string) []SearchResult
	searches := []searchFn{
		searchUpstox,
		searchAngelOne,
		searchNSEMaster, // full NSE instrument list (downloaded at startup)
		searchLocal,     // hardcoded fallback — always works
	}

	resultCh := make(chan []SearchResult, len(searches))
	for _, fn := range searches {
		go func(f searchFn) { resultCh <- f(q, token) }(fn)
	}

	// Collect results, deduplicate
	seen := make(map[string]bool)
	var merged []SearchResult
	for i := 0; i < len(searches); i++ {
		results := <-resultCh
		for _, r := range results {
			sym := strings.ToUpper(r.Symbol)
			if !seen[sym] {
				seen[sym] = true
				merged = append(merged, r)
			}
		}
	}

	// Sort: exact match first, then prefix, then contains
	q2 := strings.ToUpper(q)
	sort3 := func(a SearchResult) int {
		s := strings.ToUpper(a.Symbol)
		n := strings.ToUpper(a.Name)
		if s == q2 { return 0 }
		if strings.HasPrefix(s, q2) { return 1 }
		if strings.HasPrefix(n, q2) { return 2 }
		if strings.Contains(s, q2) { return 3 }
		return 4
	}
	for i := 0; i < len(merged); i++ {
		for j := i + 1; j < len(merged); j++ {
			if sort3(merged[j]) < sort3(merged[i]) {
				merged[i], merged[j] = merged[j], merged[i]
			}
		}
	}
	if len(merged) > 20 {
		merged = merged[:20]
	}

	if merged == nil { merged = []SearchResult{} }
	resp := map[string]interface{}{"results": merged}
	cache.Set(cKey, resp, 5*time.Minute)
	writeJSON(w, 200, resp)
}

// ── Upstox Live Search ────────────────────────────────────────────────────────
// Uses Upstox instruments master JSON — all NSE/BSE listed stocks
// Downloaded daily from: https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz

func searchUpstox(q, token string) []SearchResult {
	if token == "" {
		token = os.Getenv("UPSTOX_SANDBOX_ACCESS_TOKEN")
	}
	if token == "" {
		return nil
	}

	// Try Upstox search API
	params := url.Values{}
	params.Set("query", q)
	params.Set("exchange", "NSE,BSE,NSE_FO")
	params.Set("limit", "15")

	apiURL := "https://api.upstox.com/v2/market-quote/search?" + params.Encode()
	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Api-Version", "2.0")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[search] Upstox error: %v", err)
		return nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil
	}

	rawData, ok := data["data"].([]interface{})
	if !ok {
		return nil
	}

	var results []SearchResult
	for _, item := range rawData {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		toS := func(key string) string {
			if v, ok := m[key].(string); ok {
				return v
			}
			return ""
		}

		sym  := toS("trading_symbol")
		name := toS("name")
		if sym == "" {
			sym = toS("symbol")
		}
		if name == "" {
			name = toS("company_name")
		}
		if sym == "" {
			continue
		}

		instrKey := toS("instrument_key")
		exch     := toS("exchange")
		seg      := toS("segment")

		// Clean segment for display
		seg = strings.ReplaceAll(seg, "NSE_", "")
		seg = strings.ReplaceAll(seg, "BSE_", "")
		if seg == "" {
			seg = "EQ"
		}

		results = append(results, SearchResult{
			Symbol:        sym,
			Name:          name,
			Exchange:      exch,
			Segment:       seg,
			InstrumentKey: instrKey,
			ISIN:          toS("isin"),
			Source:        "upstox",
		})
	}
	return results
}

// ── Local Fallback Search ─────────────────────────────────────────────────────
// Uses symbolKeyMap — always available, instant

func searchLocal(q, _ string) []SearchResult {
	q2 := strings.ToUpper(q)
	var results []SearchResult

	for sym, key := range symbolKeyMap {
		if !strings.Contains(strings.ToUpper(sym), q2) {
			continue
		}
		parts := strings.SplitN(key, "|", 2)
		exch := "NSE"
		if len(parts) == 2 {
			exch = strings.Split(parts[0], "_")[0]
		}
		seg := "EQ"
		if strings.Contains(key, "INDEX") {
			seg = "INDEX"
		} else if strings.Contains(key, "_FO") || strings.Contains(key, "_FNO") {
			seg = "FO"
		}
		results = append(results, SearchResult{
			Symbol:        sym,
			Name:          sym,
			Exchange:      exch,
			Segment:       seg,
			InstrumentKey: key,
			Source:        "local",
		})
		if len(results) >= 10 {
			break
		}
	}
	return results
}


// ── Angel One Live Search ─────────────────────────────────────────────────────
// Uses Angel One /searchScrip API
// Returns all NSE/BSE/MCX listed instruments
// Works when Angel One credentials are set in env vars

func searchAngelOne(q, _ string) []SearchResult {
	if !broker.AngelOne.IsAuthenticated() {
		return nil
	}

	apiURL := "https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/searchScrip" +
		"?exchange=NSE&searchscrip=" + url.QueryEscape(q)

	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+broker.AngelOne.GetToken())
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-PrivateKey", os.Getenv("ANGELONE_API_KEY"))
	req.Header.Set("X-UserType", "USER")
	req.Header.Set("X-SourceID", "WEB")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil
	}

	rawData, ok := data["data"].([]interface{})
	if !ok {
		return nil
	}

	var results []SearchResult
	for _, item := range rawData {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		toS := func(key string) string {
			if v, ok := m[key].(string); ok { return v }
			return ""
		}

		sym     := toS("tradingsymbol")
		name    := toS("name")
		exch    := toS("exch_seg")
		token   := toS("symboltoken")
		instType := toS("instrumenttype")
		if sym == "" { continue }

		// Normalize exchange
		exchange := "NSE"
		seg := "EQ"
		if strings.HasPrefix(exch, "BSE") { exchange = "BSE" }
		if strings.HasPrefix(exch, "MCX") { exchange = "MCX"; seg = "COMM" }
		if instType == "OPTIDX" || instType == "OPTSTK" { seg = "FO" }
		if instType == "FUTIDX" || instType == "FUTSTK" { seg = "FO" }
		if instType == "AMXIDX" || strings.Contains(sym, "NIFTY") { seg = "INDEX" }

		// Angel One instrument key format: "NSE:symboltoken"
		instrKey := exchange + ":" + token

		results = append(results, SearchResult{
			Symbol:        sym,
			Name:          name,
			Exchange:      exchange,
			Segment:       seg,
			InstrumentKey: instrKey,
			Source:        "angelone",
		})
		if len(results) >= 10 { break }
	}
	return results
}

// ── Upstox Instruments Master (optional enhancement) ─────────────────────────
// Upstox publishes full instrument list daily:
// NSE: https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz
// BSE: https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz
// NSE FO: https://assets.upstox.com/market-quote/instruments/exchange/NSE_FO.json.gz
//
// Each entry: {instrument_key, exchange_token, trading_symbol, name, expiry,
//              strike_price, tick_size, lot_size, instrument_type, isin}
//
// Download daily at 8 AM IST, store in memory for instant search
// This gives ALL 6000+ listed stocks including recent IPOs
//
// TODO: Implement refreshInstrumentMaster() called in main() startup
// For now, /v2/market-quote/search API is used (live, no pre-download needed)
