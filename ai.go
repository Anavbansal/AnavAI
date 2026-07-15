package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type GroqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type GroqRequest struct {
	Model       string        `json:"model"`
	Messages    []GroqMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
}

type GroqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func callGroq(systemPrompt, userMessage string) (string, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY not set")
	}

	payload := GroqRequest{
		Model:       "llama-3.3-70b-versatile",
		MaxTokens:   1024,
		Temperature: 0.3,
		Messages: []GroqMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user",   Content: userMessage},
		},
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var gr GroqResponse
	respBody, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(respBody, &gr); err != nil {
		return "", fmt.Errorf("parse error: %s", string(respBody[:min(200, len(respBody))]))
	}
	if len(gr.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}
	return gr.Choices[0].Message.Content, nil
}

type AssistantRequest struct {
	Messages []GroqMessage `json:"messages"`
	Symbol   string        `json:"symbol"`
	Data     interface{}   `json:"data"`
}

func handleAssistant(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	body, _ := io.ReadAll(r.Body)
	var req AssistantRequest
	json.Unmarshal(body, &req)

	if len(req.Messages) == 0 {
		writeJSON(w, 400, map[string]string{"error": "no messages"})
		return
	}

	// Get last user message
	lastMsg := req.Messages[len(req.Messages)-1].Content

	// Check if it mentions a stock symbol — fetch live data
	stockContext := ""
	symbols := []string{"NIFTY","BANKNIFTY","RELIANCE","TCS","HDFCBANK","INFY","SBIN",
		"WIPRO","TATAMOTORS","TATASTEEL","ZOMATO","ADANIENT","HAL","RVNL",
		"IRFC","NTPC","ICICIBANK","BAJFINANCE","AXISBANK","LT"}

	upperMsg := strings.ToUpper(lastMsg)
	for _, sym := range symbols {
		if strings.Contains(upperMsg, sym) {
			// Fetch data for this symbol
			instrKey := resolveInstrumentKey(sym)
			token := getToken(r)
			candles, err := fetchHistoricalCandles(instrKey, "5", token)
			if err == nil && len(candles) > 0 {
				analysis := buildAnalysis(sym, candles, token)
				dataJSON, _ := json.Marshal(map[string]interface{}{
					"symbol":    sym,
					"price":     analysis.Price,
					"rsi":       analysis.RSI,
					"vwap":      analysis.VWAP,
					"ema20":     analysis.EMA20,
					"supertrend": analysis.Supertrend,
					"verdict":   analysis.AI.Verdict,
					"confidence":analysis.AI.Confidence,
					"entry":     analysis.AI.Entry,
					"target":    analysis.AI.Target,
					"stopLoss":  analysis.AI.StopLoss,
				})
				stockContext = fmt.Sprintf("\n\nLIVE DATA for %s:\n%s", sym, string(dataJSON))
			}
			break
		}
	}

	systemPrompt := `You are ANAV AI — a smart Indian stock market assistant for AnavAI terminal.
You help with technical analysis, intraday trading, delivery trades, F&O, and investment decisions.
Answer in Hinglish (Hindi + English mix) — friendly, concise, practical.
Use ₹ for prices. Give specific actionable advice with entry/target/SL when asked.
Never give generic advice — be specific to the stock and data provided.` + stockContext

	// Build conversation history
	var msgs []GroqMessage
	msgs = append(msgs, GroqMessage{Role: "system", Content: systemPrompt})
	// Last 10 messages for context
	start := 0
	if len(req.Messages) > 10 {
		start = len(req.Messages) - 10
	}
	msgs = append(msgs, req.Messages[start:]...)

	reply, err := callGroq(systemPrompt, lastMsg)
	if err != nil {
		// Fallback response
		reply = fmt.Sprintf("Sorry, AI response generate nahi ho saka: %v\n\nMere paas %d indicators hain analysis ke liye. Please thodi der baad try karein.", err, 15)
	}

	writeJSON(w, 200, map[string]interface{}{
		"status": "success",
		"data":   map[string]string{"reply": reply},
	})
}
