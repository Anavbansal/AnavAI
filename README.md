# AnavAI — Indian Stock Market Terminal

Personal trading terminal with live Upstox data, 30+ indicators, AI analysis.

## Stack
- **Frontend**: React + Vite → Vercel
- **Backend**: Go (stdlib only) → Render
- **Data**: Upstox V2 API
- **AI**: Groq (llama-3.3-70b)

## Structure
```
/              → Go backend (main.go, indicators.go, upstox.go, ai.go, news.go)
/src           → React frontend
/src/components → All UI components
/src/data      → 3286 NSE stock symbols
```

## Deploy

### Backend (Render)
- Runtime: Go
- Build: `go build -ldflags="-s -w" -o anavai-server .`
- Start: `./anavai-server`
- Env vars: UPSTOX_ALGO_CLIENT_ID, UPSTOX_ALGO_CLIENT_SECRET, UPSTOX_ALGO_REDIRECT_URI, UPSTOX_SANDBOX_ACCESS_TOKEN, GROQ_API_KEY, FRONTEND_URL

### Frontend (Vercel)
- Framework: Vite
- Build: `npm run build`
- Env: VITE_API_BASE_URL=https://your-render-url.onrender.com

## Performance vs Node.js
| | Node.js | Go |
|---|---|---|
| Cold start | 30-50s | <100ms |
| Memory | 150MB+ | ~10MB |
| Binary | node_modules 200MB | 5.5MB |
| Throughput | ~500 req/s | ~10,000 req/s |
