package main

import (
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ── Upstox V3 WebSocket Market Feed ─────────────────────────────────────────
// Pure stdlib implementation — no external WS library needed
// Upstox sends Protobuf binary frames; we hand-decode the wire format

// LiveTick holds decoded market data from Upstox V3 feed
type LiveTick struct {
	InstrumentKey string  `json:"instrumentKey"`
	LTP           float64 `json:"ltp"`
	LTQ           float64 `json:"ltq"`
	CP            float64 `json:"cp"`   // previous close
	OI            float64 `json:"oi"`
	Volume        float64 `json:"volume"`
	BidPrice      float64 `json:"bidPrice"`
	AskPrice      float64 `json:"askPrice"`
	Open          float64 `json:"open"`
	High          float64 `json:"high"`
	Low           float64 `json:"low"`
	Delta         float64 `json:"delta"`
	Theta         float64 `json:"theta"`
	Gamma         float64 `json:"gamma"`
	Vega          float64 `json:"vega"`
	IV            float64 `json:"iv"`
	Timestamp     int64   `json:"ts"`
}

// UpstoxFeed manages the V3 WebSocket connection
type UpstoxFeed struct {
	mu          sync.RWMutex
	ticks       map[string]*LiveTick // instrumentKey → latest tick
	subscribers map[string]struct{}  // currently subscribed keys
	conn        io.ReadWriteCloser
	connected   bool
	token       string
	stopCh      chan struct{}
}

var upstoxFeed = &UpstoxFeed{
	ticks:       make(map[string]*LiveTick),
	subscribers: make(map[string]struct{}),
	stopCh:      make(chan struct{}),
}

// GetTick returns cached tick for a symbol
func (f *UpstoxFeed) GetTick(instrumentKey string) *LiveTick {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.ticks[instrumentKey]
}

// Subscribe adds instrument keys to the feed
func (f *UpstoxFeed) Subscribe(keys []string) {
	f.mu.Lock()
	for _, k := range keys {
		f.subscribers[k] = struct{}{}
	}
	f.mu.Unlock()
	if f.connected {
		f.sendSubscribe(keys)
	}
}

// StartUpstoxFeed connects to Upstox V3 feed and maintains connection
// Only call with a LIVE user token (not sandbox/expired token)
func StartUpstoxFeed(token string) {
	if token == "" || len(token) < 100 {
		log.Println("[Feed] Token too short or empty — V3 feed not started")
		return
	}

	upstoxFeed.mu.Lock()
	upstoxFeed.token = token
	upstoxFeed.mu.Unlock()

	go func() {
		backoff := 5 * time.Second
		failCount := 0

		for {
			err := connectFeed(token)
			if err != nil {
				failCount++
				if failCount >= 3 {
					// Stop retrying after 3 consecutive 401s — token is dead
					log.Printf("[Feed] Giving up after %d failures: %v", failCount, err)
					// Reset flag so new token can restart feed
					feedTokenMu.Lock()
					feedStarted = false
					feedTokenMu.Unlock()
					return
				}
				log.Printf("[Feed] Disconnected (#%d): %v — retry in %v", failCount, err, backoff)
			} else {
				failCount = 0 // reset on clean disconnect
				backoff = 5 * time.Second
			}
			select {
			case <-upstoxFeed.stopCh:
				return
			case <-time.After(backoff):
				backoff = min3(backoff*2, 60*time.Second) // exponential backoff
			}
		}
	}()
}

func min3(a, b time.Duration) time.Duration {
	if a < b { return a }
	return b
}

func connectFeed(token string) error {
	// Step 1: Get authorized redirect URI
	authURL := "https://api.upstox.com/v3/feed/market-data-feed/authorize"
	req, _ := http.NewRequest("GET", authURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "*/*")

	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // don't follow — we want the redirect URL
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("authorize: %w", err)
	}
	resp.Body.Close()

	wsURL := resp.Header.Get("Location")
	if wsURL == "" {
		// If no redirect, use direct URL
		wsURL = "wss://api.upstox.com/v3/feed/market-data-feed"
	}

	// Step 2: Open WebSocket
	conn, err := dialWSS(wsURL, token)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	upstoxFeed.mu.Lock()
	upstoxFeed.conn = conn
	upstoxFeed.connected = true

	// Re-subscribe existing symbols
	keys := make([]string, 0, len(upstoxFeed.subscribers))
	for k := range upstoxFeed.subscribers {
		keys = append(keys, k)
	}
	upstoxFeed.mu.Unlock()

	if len(keys) > 0 {
		upstoxFeed.sendSubscribe(keys)
	} else {
		// Subscribe default index keys
		defaults := []string{
			"NSE_INDEX|Nifty 50",
			"NSE_INDEX|Nifty Bank",
			"NSE_INDEX|India VIX",
		}
		upstoxFeed.sendSubscribe(defaults)
	}

	log.Printf("[Feed] ✅ Connected to Upstox V3 feed, subscribed %d keys", len(keys))

	// Read loop
	buf := make([]byte, 65536)
	for {
		n, err := conn.Read(buf)
		if err != nil {
			upstoxFeed.mu.Lock()
			upstoxFeed.connected = false
			upstoxFeed.conn = nil
			upstoxFeed.mu.Unlock()
			return fmt.Errorf("read: %w", err)
		}
		if n < 2 {
			continue
		}
		payload := wsFeedParseFrame(buf[:n])
		if len(payload) == 0 {
			continue
		}
		parseFeedMessage(payload)
	}
}

func (f *UpstoxFeed) sendSubscribe(keys []string) {
	f.mu.RLock()
	conn := f.conn
	f.mu.RUnlock()
	if conn == nil {
		return
	}
	// Cap at 500 keys per request (stay well under 2000 limit)
	if len(keys) > 500 {
		keys = keys[:500]
	}
	msg := map[string]interface{}{
		"guid":   fmt.Sprintf("anavai-%d", time.Now().UnixMilli()),
		"method": "sub",
		"data": map[string]interface{}{
			"mode":           "full",
			"instrumentKeys": keys,
		},
	}
	data, _ := json.Marshal(msg)
	// Send as binary frame
	frame := wsBuildFrame(data)
	conn.Write(frame)
	log.Printf("[Feed] Subscribed %d keys", len(keys))
}

// ── Protobuf wire-format decoder (hand-rolled, no deps) ──────────────────────
// Upstox V3 proto3 schema: FeedResponse{ Type type; map<string,Feed> feeds }
// Feed is oneof LTPC/FullFeed; FullFeed.MarketFullFeed has ltpc,oi,ohlc,greeks

func parseFeedMessage(data []byte) {
	// Try JSON first (Upstox sometimes sends JSON for control messages)
	if len(data) > 0 && data[0] == '{' {
		return // control message, ignore
	}

	// Parse Protobuf FeedResponse
	feeds := decodeProtoFeeds(data)
	if len(feeds) == 0 {
		return
	}

	upstoxFeed.mu.Lock()
	for key, tick := range feeds {
		upstoxFeed.ticks[key] = tick
		tick.Timestamp = time.Now().UnixMilli()
	}
	upstoxFeed.mu.Unlock()

	// Broadcast to frontend WebSocket clients
	for key, tick := range feeds {
		tickJSON, _ := json.Marshal(map[string]interface{}{
			"type":      "PRICE",
			"symbol":    extractSymbol(key),
			"instrKey":  key,
			"price":     tick.LTP,
			"change":    tick.LTP - tick.CP,
			"changePct": pct(tick.LTP, tick.CP),
			"oi":        tick.OI,
			"volume":    tick.Volume,
			"delta":     tick.Delta,
			"iv":        tick.IV,
			"ts":        tick.Timestamp,
		})
		hub.broadcast(extractSymbol(key), tickJSON)
		// Also cache for REST polling fallback
		cache.Set("price:"+key, tick, 10*time.Second)
	}
}

// decodeProtoFeeds decodes Upstox V3 Protobuf FeedResponse
// Proto3 wire types: 0=varint, 1=64bit, 2=len-delimited, 5=32bit
func decodeProtoFeeds(data []byte) map[string]*LiveTick {
	results := make(map[string]*LiveTick)
	pos := 0

	for pos < len(data) {
		if pos >= len(data) {
			break
		}
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7

		switch wireType {
		case 0: // varint
			_, n := decodeVarint(data[pos:])
			pos += n
		case 1: // 64-bit
			pos += 8
		case 2: // length-delimited
			l, n := decodeVarint(data[pos:])
			pos += n
			if pos+int(l) > len(data) {
				return results
			}
			payload := data[pos : pos+int(l)]
			pos += int(l)

			// Field 2 = feeds (map<string,Feed>)
			if fieldNum == 2 {
				key, feed := decodeMapEntry(payload)
				if key != "" && feed != nil {
					results[key] = feed
				}
			}
		case 5: // 32-bit
			pos += 4
		default:
			return results // unknown wire type, stop
		}
	}
	return results
}

// decodeMapEntry decodes a map<string,Feed> entry (key=field1, value=field2)
func decodeMapEntry(data []byte) (string, *LiveTick) {
	var key string
	var tick *LiveTick
	pos := 0

	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7

		switch wireType {
		case 2:
			l, n := decodeVarint(data[pos:])
			pos += n
			if pos+int(l) > len(data) {
				return key, tick
			}
			payload := data[pos : pos+int(l)]
			pos += int(l)

			if fieldNum == 1 {
				key = string(payload)
			} else if fieldNum == 2 {
				// Feed message
				tick = decodeFeed(payload)
			}
		case 0:
			_, n := decodeVarint(data[pos:])
			pos += n
		case 1:
			pos += 8
		case 5:
			pos += 4
		default:
			return key, tick
		}
	}
	return key, tick
}

// decodeFeed decodes a Feed oneof (field3=LTPC, field4=FullFeed)
func decodeFeed(data []byte) *LiveTick {
	tick := &LiveTick{}
	pos := 0

	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7

		if wireType == 2 {
			l, n := decodeVarint(data[pos:])
			pos += n
			if pos+int(l) > len(data) {
				break
			}
			payload := data[pos : pos+int(l)]
			pos += int(l)

			switch fieldNum {
			case 1: // LTPC
				decodeLTPC(payload, tick)
			case 2: // FullFeed — contains MarketFullFeed or IndexFullFeed
				decodeFullFeed(payload, tick)
			}
		} else {
			pos = skipField(data, pos, wireType)
		}
	}
	return tick
}

func decodeLTPC(data []byte, tick *LiveTick) {
	pos := 0
	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7
		if wireType == 1 && pos+8 <= len(data) {
			bits := binary.LittleEndian.Uint64(data[pos : pos+8])
			v := math.Float64frombits(bits)
			switch fieldNum {
			case 1:
				tick.LTP = v
			case 3:
				tick.CP = v
			}
			pos += 8
		} else if wireType == 2 {
			l, n := decodeVarint(data[pos:])
			pos += n + int(l)
		} else {
			_, n := decodeVarint(data[pos:])
			pos += n
		}
	}
}

func decodeFullFeed(data []byte, tick *LiveTick) {
	pos := 0
	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7

		if wireType == 2 {
			l, n := decodeVarint(data[pos:])
			pos += n
			if pos+int(l) > len(data) {
				break
			}
			payload := data[pos : pos+int(l)]
			pos += int(l)
			switch fieldNum {
			case 1: // MarketFullFeed
				decodeMarketFullFeed(payload, tick)
			case 2: // IndexFullFeed
				decodeIndexFullFeed(payload, tick)
			}
		} else if wireType == 1 {
			pos += 8
		} else {
			_, n2 := decodeVarint(data[pos:])
			pos += n2
		}
	}
}

func decodeMarketFullFeed(data []byte, tick *LiveTick) {
	pos := 0
	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7

		if wireType == 2 {
			l, n := decodeVarint(data[pos:])
			pos += n
			if pos+int(l) > len(data) {
				break
			}
			payload := data[pos : pos+int(l)]
			pos += int(l)
			switch fieldNum {
			case 1: // LTPC
				decodeLTPC(payload, tick)
			case 3: // OptionGreeks
				decodeGreeks(payload, tick)
			case 4: // MarketOHLC
				decodeOHLC(payload, tick)
			case 6: // OI
				if len(payload) >= 8 {
					tick.OI = math.Float64frombits(binary.LittleEndian.Uint64(payload[:8]))
				}
			}
		} else if wireType == 1 && pos+8 <= len(data) {
			bits := binary.LittleEndian.Uint64(data[pos : pos+8])
			v := math.Float64frombits(bits)
			switch fieldNum {
			case 5: // atp
				_ = v
			case 7: // volume
				tick.Volume = v
			}
			pos += 8
		} else {
			pos = skipField(data, pos, wireType)
		}
	}
}

func decodeIndexFullFeed(data []byte, tick *LiveTick) {
	pos := 0
	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7
		if wireType == 2 {
			l, n := decodeVarint(data[pos:])
			pos += n
			if pos+int(l) > len(data) {
				break
			}
			payload := data[pos : pos+int(l)]
			pos += int(l)
			switch fieldNum {
			case 1:
				decodeLTPC(payload, tick)
			case 2:
				decodeOHLC(payload, tick)
			}
		} else {
			pos = skipField(data, pos, wireType)
		}
	}
}

func decodeGreeks(data []byte, tick *LiveTick) {
	pos := 0
	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7
		if wireType == 1 && pos+8 <= len(data) {
			bits := binary.LittleEndian.Uint64(data[pos : pos+8])
			v := math.Float64frombits(bits)
			switch fieldNum {
			case 1:
				tick.Delta = v
			case 2:
				tick.Theta = v
			case 3:
				tick.Gamma = v
			case 4:
				tick.Vega = v
			}
			pos += 8
		} else if wireType == 2 {
			l, n := decodeVarint(data[pos:])
			pos += n
			if pos+int(l) <= len(data) {
				// IV is field 5, length-delimited double in some versions
				if fieldNum == 5 && int(l) == 8 {
					bits := binary.LittleEndian.Uint64(data[pos : pos+8])
					tick.IV = math.Float64frombits(bits)
				}
			}
			pos += int(l)
		} else {
			pos = skipField(data, pos, wireType)
		}
	}
}

func decodeOHLC(data []byte, tick *LiveTick) {
	pos := 0
	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7
		if wireType == 2 {
			l, n2 := decodeVarint(data[pos:])
			pos += n2
			if pos+int(l) > len(data) {
				break
			}
			sub := data[pos : pos+int(l)]
			pos += int(l)
			// Sub-message has interval(str) + ohlc doubles
			decodeOHLCSub(sub, int(fieldNum), tick)
		} else {
			pos = skipField(data, pos, wireType)
		}
	}
}

func decodeOHLCSub(data []byte, parentField int, tick *LiveTick) {
	pos := 0
	ohlc := [4]float64{}
	fi := 0
	for pos < len(data) {
		tag, n := decodeVarint(data[pos:])
		if n == 0 {
			break
		}
		pos += n
		fieldNum := tag >> 3
		wireType := tag & 0x7
		if wireType == 1 && pos+8 <= len(data) {
			bits := binary.LittleEndian.Uint64(data[pos : pos+8])
			v := math.Float64frombits(bits)
			// fields 2,3,4,5 = open,high,low,close in most Upstox protos
			if fieldNum >= 2 && fieldNum <= 5 && fi < 4 {
				ohlc[fi] = v
				fi++
			}
			pos += 8
		} else if wireType == 2 {
			l, n2 := decodeVarint(data[pos:])
			pos += n2 + int(l)
		} else {
			_, n2 := decodeVarint(data[pos:])
			pos += n2
		}
	}
	// Use day OHLC (parentField==1 is typically '1d')
	if parentField == 1 && ohlc[0] > 0 {
		tick.Open = ohlc[0]
		tick.High = ohlc[1]
		tick.Low = ohlc[2]
	}
}

// ── Protobuf helpers ──────────────────────────────────────────────────────────
func decodeVarint(data []byte) (uint64, int) {
	var x uint64
	for i, b := range data {
		if i >= 10 {
			return 0, 0
		}
		x |= uint64(b&0x7f) << (7 * uint(i))
		if b < 0x80 {
			return x, i + 1
		}
	}
	return 0, 0
}

func skipField(data []byte, pos int, wireType uint64) int {
	switch wireType {
	case 0:
		_, n := decodeVarint(data[pos:])
		return pos + n
	case 1:
		return pos + 8
	case 2:
		l, n := decodeVarint(data[pos:])
		return pos + n + int(l)
	case 5:
		return pos + 4
	}
	return len(data)
}

// ── WebSocket helpers for Upstox feed connection ─────────────────────────────
func dialWSS(wsURL, token string) (io.ReadWriteCloser, error) {
	u, err := url.Parse(wsURL)
	if err != nil {
		return nil, err
	}

	host := u.Host
	if !strings.Contains(host, ":") {
		host += ":443"
	}

	tlsCfg := &tls.Config{ServerName: strings.Split(host, ":")[0]}
	conn, err := tls.Dial("tcp", host, tlsCfg)
	if err != nil {
		return nil, err
	}

	path := u.RequestURI()
	if path == "" {
		path = "/"
	}

	key := wsAcceptKey(fmt.Sprintf("AnavAI-%d", time.Now().UnixNano()))
	handshake := fmt.Sprintf(
		"GET %s HTTP/1.1\r\n"+
			"Host: %s\r\n"+
			"Upgrade: websocket\r\n"+
			"Connection: Upgrade\r\n"+
			"Sec-WebSocket-Key: %s\r\n"+
			"Sec-WebSocket-Version: 13\r\n"+
			"Authorization: Bearer %s\r\n"+
			"Origin: https://api.upstox.com\r\n"+
			"\r\n",
		path, u.Host, key, token,
	)

	conn.Write([]byte(handshake))

	// Read HTTP response
	respBuf := make([]byte, 4096)
	n, err := conn.Read(respBuf)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("handshake read: %w", err)
	}
	resp := string(respBuf[:n])
	if !strings.Contains(resp, "101") {
		conn.Close()
		return nil, fmt.Errorf("upgrade failed: %s", resp[:min2(200, len(resp))])
	}

	return conn, nil
}

func wsFeedParseFrame(data []byte) []byte {
	if len(data) < 2 {
		return nil
	}
	opcode := data[0] & 0x0f
	if opcode == 0x9 { // ping
		return nil
	}
	masked := (data[1] & 0x80) != 0
	payloadLen := int(data[1] & 0x7f)
	offset := 2
	if payloadLen == 126 {
		if len(data) < 4 {
			return nil
		}
		payloadLen = int(data[2])<<8 | int(data[3])
		offset = 4
	} else if payloadLen == 127 {
		if len(data) < 10 {
			return nil
		}
		payloadLen = int(binary.BigEndian.Uint64(data[2:10]))
		offset = 10
	}
	var maskKey [4]byte
	if masked {
		if len(data) < offset+4 {
			return nil
		}
		copy(maskKey[:], data[offset:offset+4])
		offset += 4
	}
	end := offset + payloadLen
	if end > len(data) {
		end = len(data)
	}
	payload := make([]byte, end-offset)
	copy(payload, data[offset:end])
	if masked {
		for i := range payload {
			payload[i] ^= maskKey[i%4]
		}
	}
	return payload
}

func wsBuildFrame(data []byte) []byte {
	frame := make([]byte, 0, len(data)+10)
	frame = append(frame, 0x82) // FIN + binary frame
	if len(data) < 126 {
		frame = append(frame, byte(len(data)))
	} else if len(data) < 65536 {
		frame = append(frame, 126, byte(len(data)>>8), byte(len(data)))
	} else {
		frame = append(frame, 127, 0, 0, 0, 0,
			byte(len(data)>>24), byte(len(data)>>16),
			byte(len(data)>>8), byte(len(data)))
	}
	frame = append(frame, data...)
	return frame
}

// ── Helpers ───────────────────────────────────────────────────────────────────
func extractSymbol(instrumentKey string) string {
	parts := strings.Split(instrumentKey, "|")
	if len(parts) > 1 {
		return parts[1]
	}
	return instrumentKey
}

func pct(price, prev float64) float64 {
	if prev == 0 {
		return 0
	}
	return round2((price - prev) / prev * 100)
}

func min2(a, b int) int {
	if a < b {
		return a
	}
	return b
}
