package main

// Order Management HTTP handlers
// Routes: /api/order/*, /api/positions, /api/funds, /api/gtt/*

import (
	"anavai/broker"
	"encoding/json"
	"net/http"
	"strings"
)

// handlePlaceOrder — POST /api/order/place
func handlePlaceOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "Angel One not connected. Login first."})
		return
	}

	var req broker.PlaceOrderReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request: " + err.Error()})
		return
	}

	// Resolve symbolToken if missing (look up from instrument key)
	if req.SymbolToken == "" && req.InstrumentKey != "" {
		_, token := parseAngelKey(req.InstrumentKey)
		req.SymbolToken = token
	}

	resp, err := b.PlaceOrder(req)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, resp)
}

// handleModifyOrder — PUT /api/order/modify
func handleModifyOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PUT" && r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}

	var payload struct {
		OrderID string               `json:"orderId"`
		broker.PlaceOrderReq
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}

	resp, err := b.ModifyOrder(payload.OrderID, payload.PlaceOrderReq)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, resp)
}

// handleCancelOrder — DELETE /api/order/cancel
func handleCancelOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" && r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}

	var payload struct {
		OrderID string `json:"orderId"`
		Variety string `json:"variety"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}

	resp, err := b.CancelOrder(payload.OrderID, payload.Variety)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, resp)
}

// handleGetOrders — GET /api/orders
func handleGetOrders(w http.ResponseWriter, r *http.Request) {
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}
	orders, err := b.GetOrderBook()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if orders == nil { orders = []broker.Order{} }
	writeJSON(w, 200, map[string]interface{}{"orders": orders})
}

// handleGetPositions — GET /api/positions
func handleGetPositions(w http.ResponseWriter, r *http.Request) {
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}
	positions, err := b.GetPositions()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if positions == nil { positions = []broker.Position{} }
	writeJSON(w, 200, map[string]interface{}{"positions": positions})
}

// handleGetFunds — GET /api/funds
func handleGetFunds(w http.ResponseWriter, r *http.Request) {
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}
	funds, err := b.GetFunds()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, funds)
}

// handlePlaceGTT — POST /api/gtt/place
func handlePlaceGTT(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}

	var req broker.GTTReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}

	resp, err := b.PlaceGTT(req)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, resp)
}

// handleCancelGTT — POST /api/gtt/cancel
func handleCancelGTT(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "DELETE" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}

	var payload struct {
		TaskID string `json:"taskId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}

	resp, err := b.CancelGTT(payload.TaskID)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, resp)
}

// handleGetGTTs — GET /api/gtt/list
func handleGetGTTs(w http.ResponseWriter, r *http.Request) {
	b := broker.AngelOne
	if !b.IsAuthenticated() {
		writeJSON(w, 401, map[string]string{"error": "not connected"})
		return
	}
	list, err := b.GetGTTList()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if list == nil { list = []map[string]interface{}{} }
	writeJSON(w, 200, map[string]interface{}{"gtts": list})
}

// parseAngelKey parses "NSE:12345" → symbol token
func parseAngelKey(key string) (symbol, token string) {
	parts := strings.SplitN(key, ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return key, ""
}
