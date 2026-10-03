package broker

// Angel One auth route — called from main.go
// POST /auth/angelone/login → auto-generates TOTP → logs in → returns status

import (
	"encoding/json"
	"net/http"
)

// HandleAngelOneLogin is the HTTP handler for /auth/angelone/login
func HandleAngelOneLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}

	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Content-Type", "application/json")

	// Try to login / refresh
	if AngelOne.IsAuthenticated() {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"message": "Already authenticated",
			"broker":  "angelone",
		})
		return
	}

	if err := AngelOne.Login(); err != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "error",
			"message": err.Error(),
			"hint":    "Set ANGELONE_API_KEY, ANGELONE_CLIENT_ID, ANGELONE_PIN, ANGELONE_TOTP_SECRET in Render env vars",
		})
		return
	}

	// Start auto-refresh for daily token renewal
	AngelOne.StartAutoRefresh()
	Register(AngelOne)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Angel One connected successfully",
		"broker":  "angelone",
		"feedToken": AngelOne.GetFeedToken(),
	})
}

// HandleAngelOneStatus returns connection status
func HandleAngelOneStatus(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "success",
		"authenticated": AngelOne.IsAuthenticated(),
		"broker":        "angelone",
	})
}
