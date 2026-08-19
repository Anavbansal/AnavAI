package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"time"
)

// ── Simple WebSocket implementation (no external deps) ────────────────────────
// Using Go's built-in net/http hijack for WebSocket handshake

type WSClient struct {
	conn   net.Conn
	send   chan []byte
	symbol string
	token  string
	id     string
}

type WSHub struct {
	mu      sync.RWMutex
	clients map[string]*WSClient
}

var hub = &WSHub{clients: make(map[string]*WSClient)}

func (h *WSHub) addClient(c *WSClient) {
	h.mu.Lock()
	h.clients[c.id] = c
	h.mu.Unlock()
}

func (h *WSHub) removeClient(id string) {
	h.mu.Lock()
	delete(h.clients, id)
	h.mu.Unlock()
}

func (h *WSHub) broadcast(symbol string, msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.clients {
		if c.symbol == symbol {
			select {
			case c.send <- msg:
			default:
			}
		}
	}
}

// WebSocket HTTP upgrade handler
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Standard WebSocket handshake
	if r.Header.Get("Upgrade") != "websocket" {
		writeJSON(w, 400, map[string]string{"error": "not a websocket upgrade"})
		return
	}

	key := r.Header.Get("Sec-Websocket-Key")
	if key == "" {
		writeJSON(w, 400, map[string]string{"error": "missing websocket key"})
		return
	}

	// Compute accept key
	acceptKey := wsAcceptKey(key)

	hj, ok := w.(http.Hijacker)
	if !ok {
		writeJSON(w, 500, map[string]string{"error": "hijack not supported"})
		return
	}

	conn, bufrw, err := hj.Hijack()
	if err != nil {
		log.Printf("[WS] Hijack error: %v", err)
		return
	}

	// Send handshake response
	response := fmt.Sprintf(
		"HTTP/1.1 101 Switching Protocols\r\n"+
			"Upgrade: websocket\r\n"+
			"Connection: Upgrade\r\n"+
			"Sec-WebSocket-Accept: %s\r\n\r\n",
		acceptKey,
	)
	bufrw.WriteString(response)
	bufrw.Flush()

	clientID := fmt.Sprintf("%d", time.Now().UnixNano())
	client := &WSClient{
		conn: conn,
		send: make(chan []byte, 64),
		id:   clientID,
	}
	hub.addClient(client)
	defer hub.removeClient(clientID)
	defer conn.Close()

	log.Printf("[WS] Client connected: %s", clientID)

	// Send connected message
	connMsg, _ := json.Marshal(map[string]string{"type": "AUTHED", "clientId": clientID})
	wsSendMessage(conn, connMsg)

	// Read loop
	buf := make([]byte, 4096)
	for {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		n, err := conn.Read(buf)
		if err != nil {
			break
		}
		// Parse WebSocket frame
		if n < 2 {
			continue
		}
		payload := wsParseFrame(buf[:n])
		if len(payload) == 0 {
			continue
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(payload, &msg); err != nil {
			continue
		}

		msgType, _ := msg["type"].(string)
		switch msgType {
		case "AUTH":
			if t, ok := msg["token"].(string); ok {
				client.token = t
			}
		case "SUBSCRIBE":
			if sym, ok := msg["symbol"].(string); ok {
				client.symbol = sym
			}
			// Send current cached price immediately
			cKey := "price:" + client.symbol
			if cached, ok := cache.Get(cKey); ok {
				if priceMsg, err := json.Marshal(cached); err == nil {
					wsSendMessage(conn, priceMsg)
				}
			}
		case "PING":
			pong, _ := json.Marshal(map[string]string{"type": "PONG"})
			wsSendMessage(conn, pong)
		}
	}
	log.Printf("[WS] Client disconnected: %s", clientID)
}

// ── Price broadcaster ─────────────────────────────────────────────────────────
func startPriceBroadcaster() {
	ticker := time.NewTicker(3 * time.Second)
	go func() {
		for range ticker.C {
			hub.mu.RLock()
			symbols := make(map[string]string) // symbol -> token
			for _, c := range hub.clients {
				if c.symbol != "" {
					symbols[c.symbol] = c.token
				}
			}
			hub.mu.RUnlock()

			for symbol, token := range symbols {
				instrKey := resolveInstrumentKey(symbol)
				ltp, err := fetchLTP(instrKey, token)
				if err != nil || ltp == 0 {
					continue
				}
				msg := map[string]interface{}{
					"type":   "PRICE",
					"symbol": symbol,
					"price":  ltp,
					"ts":     time.Now().UnixMilli(),
				}
				cache.Set("price:"+symbol, msg, 5*time.Second)
				msgBytes, _ := json.Marshal(msg)
				hub.broadcast(symbol, msgBytes)
			}
		}
	}()
}

// ── WebSocket frame helpers ────────────────────────────────────────────────────
func wsParseFrame(data []byte) []byte {
	if len(data) < 2 {
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
	}
	var maskKey [4]byte
	if masked {
		if len(data) < offset+4 {
			return nil
		}
		copy(maskKey[:], data[offset:offset+4])
		offset += 4
	}
	if len(data) < offset+payloadLen {
		payloadLen = len(data) - offset
	}
	payload := make([]byte, payloadLen)
	copy(payload, data[offset:offset+payloadLen])
	if masked {
		for i := range payload {
			payload[i] ^= maskKey[i%4]
		}
	}
	return payload
}

func wsSendMessage(conn net.Conn, msg []byte) {
	frame := make([]byte, 0, len(msg)+10)
	frame = append(frame, 0x81) // FIN + text frame
	if len(msg) < 126 {
		frame = append(frame, byte(len(msg)))
	} else if len(msg) < 65536 {
		frame = append(frame, 126, byte(len(msg)>>8), byte(len(msg)))
	} else {
		frame = append(frame, 127,
			0, 0, 0, 0,
			byte(len(msg)>>24), byte(len(msg)>>16),
			byte(len(msg)>>8), byte(len(msg)))
	}
	frame = append(frame, msg...)
	conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	conn.Write(frame)
}
