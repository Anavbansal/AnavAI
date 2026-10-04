# AnavAI — Architecture Guide

## Stack
```
Frontend  → React + Vite → Vercel (https://anav-ai.vercel.app)
Backend   → Go (stdlib)  → Render (https://anavai.onrender.com)
Data      → Upstox V2/V3 + Angel One SmartAPI (optional)
AI        → Groq (llama-3.3-70b)
```

---

## Backend Structure (Go)

```
/
├── main.go              → HTTP server, CORS, all routes registered
├── types.go             → All struct definitions (Candle, AnalyzeResponse etc.)
├── indicators.go        → 20+ technical indicators (EMA, RSI, ATR Wilder, VWAP...)
├── upstox.go            → Upstox V2/V3 REST API (candles, LTP, option chain)
├── upstox_feed.go       → Upstox V3 WebSocket Market Feed (Protobuf decoder)
├── ai.go                → Groq LLM integration (llama-3.3-70b)
├── news.go              → Google News RSS fetching
├── websocket.go         → Frontend WebSocket server (/ws endpoint)
├── wsutil.go            → WebSocket SHA1 accept key helper
│
├── broker/              → Multi-broker abstraction layer
│   ├── broker.go        → Broker interface (all brokers must implement)
│   ├── factory.go       → Broker registry + auto-selection
│   ├── angelone.go      → Angel One SmartAPI implementation
│   └── angelone_route.go → HTTP handlers for Angel One auth
│
└── routes/              → Route handlers (broker-agnostic)
    └── analyze.go       → Unified analyze (works with any broker)
```

### Adding a New Broker (Future):
1. Create `broker/newbroker.go` implementing `broker.Broker` interface
2. Add symbol map
3. Register in `main.go`: `broker.Register(&NewBroker{})`
4. Done — all routes automatically use it

---

## Frontend Structure (React)

```
src/
├── pages/
│   ├── Dashboard.jsx    → Main 10-tab layout
│   ├── Login.jsx        → Initial page
│   └── AuthCallback.jsx → OAuth callback handler
│
├── components/
│   ├── analysis/        → Analysis tabs
│   │   ├── (Intraday, Delivery, FOGreeks in root for now)
│   ├── broker/
│   │   └── BrokerSelector.jsx  → Upstox/Angel One switcher UI
│   ├── ipo/
│   │   └── IPOTracker.jsx      → IPO calendar + tracking
│   ├── common/          → Shared UI components
│   │
│   ├── AIAssistant.jsx  → Groq chat bot
│   ├── CandleChart.jsx  → Canvas chart (zoom/pan/draw)
│   ├── Intraday.jsx     → Intraday signals + ORB + VWAP bands
│   ├── Delivery.jsx     → Swing analysis + Fibonacci
│   ├── FOGreeks.jsx     → Option chain + IV Rank + Spread calc
│   ├── PersonalFinance.jsx → Personal portfolio tracker
│   ├── MutualFunds.jsx  → MF search + NAV chart
│   └── PricePanel.jsx   → Overview stats
│
├── hooks/
│   ├── useAnalysis.js   → Main data fetching hook
│   └── useLivePrice.js  → WebSocket live price hook
│
├── services/
│   ├── marketData.js    → analyzeSymbol(), transformPayload()
│   └── aiAnalysis.js    → AI-specific calls
│
├── store/
│   └── brokerStore.js   → Active broker state (localStorage)
│
├── types/
│   └── index.js         → All data shapes documented
│
├── utils/
│   ├── indicators.js    → Frontend indicator calculations (fallback)
│   └── instrumentSearch.js → Symbol search helpers
│
├── data/
│   └── symbols.js       → 3286 NSE stocks with instrument keys
│
└── config.js            → API_BASE_URL, env vars
```

---

## API Routes (Go Server)

### Market Data
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/analyze` | Main analysis (candles + indicators + AI) |
| POST | `/ai/analyze` | Same (alias used by api.js) |
| GET | `/api/search?q=` | Symbol search |
| GET | `/api/quote?instrument_key=` | Real-time quote |
| GET | `/api/optionchain?symbol=&expiry=` | Option chain (Upstox) |
| GET | `/api/option/expiries?symbol=` | Available expiries |
| GET | `/news?instrument_keys=` | News RSS |
| GET | `/fundamentals?symbol=` | Company fundamentals |

### Auth — Upstox
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/auth/url` | Get OAuth URL |
| GET | `/auth/callback` | OAuth redirect handler |
| POST | `/auth/exchange` | Exchange code for token |
| POST | `/auth/refresh` | Refresh token |

### Auth — Angel One
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/angelone/login` | Auto-login (TOTP server-side) |
| GET | `/auth/angelone/status` | Check connection status |

### Historical
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/historical/intraday-v3` | Intraday candles |
| GET | `/historical/v3` | Historical candles |
| GET | `/historical/overview` | Overview data |

### Portfolio + System
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/holdings` | Portfolio holdings |
| GET | `/session` | Session check |
| GET | `/health` | Server health (Uptime Robot) |
| WS | `/ws` | WebSocket live prices |

---

## Environment Variables (Render)

### Required — Upstox
```
UPSTOX_ALGO_CLIENT_ID       = 49c22c87-...
UPSTOX_ALGO_CLIENT_SECRET   = w6pkaukt8e
UPSTOX_ALGO_REDIRECT_URI    = https://anavai.onrender.com/auth/callback
UPSTOX_SANDBOX_ACCESS_TOKEN = eyJ... (fallback, expires daily)
UPSTOX_REDIRECT_URI         = https://anavai.onrender.com/auth/callback (alternate)
```

### Required — Server
```
GROQ_API_KEY  = gsk_...
FRONTEND_URL  = https://anav-ai.vercel.app
PORT          = 10000
```

### Optional — Angel One (add when ready)
```
ANGELONE_API_KEY     = from smartapi.angelbroking.com
ANGELONE_CLIENT_ID   = Axxxxxxx (your Angel One ID)
ANGELONE_PIN         = xxxx (4-digit MPIN)
ANGELONE_TOTP_SECRET = XXXXX (base32, shown once when enabling TOTP)
```

---

## Data Flow

```
User searches NATIONALUM
       ↓
SearchBar → analyzeSymbol({symbol, instrumentKey})
       ↓
POST /analyze (Authorization: Bearer <token>, X-Broker: upstox|angelone)
       ↓
Go server:
  1. Detect broker from X-Broker header
  2. Check Upstox V3 feed cache (sub-ms if subscribed)
  3. Fetch candles from broker REST API
  4. Run 20+ indicators (EMA, RSI, ATR, VWAP, BB, MACD...)
  5. Fetch real circuit limits + 52W from Full Quote API
  6. Calculate AI verdict (rule-based scoring)
  7. Subscribe symbol to V3 feed for future ticks
       ↓
Response: {status:'success', data:{candles, price, indicators, ai, quality}}
       ↓
transformPayload() → normalizes across broker formats
       ↓
Dashboard renders: Chart + PricePanel + Intraday/Delivery/F&O tabs
       ↓
useLivePrice() WebSocket → price updates every 50ms from V3 feed
```

---

## Adding Features (Checklist)

### New Indicator:
1. `indicators.go` → add `calcNewIndicator()` function
2. `types.go` → add field to `AnalyzeResponse`
3. `main.go` `buildAnalysis()` → call new function + set field
4. Component → read `data.newIndicator`

### New Tab:
1. `src/components/NewTab.jsx` → create component
2. `src/pages/Dashboard.jsx` → add to `TABS`, lazy import, Suspense wrap
3. Add to NO_REFETCH if static

### New Broker:
1. `broker/newbroker.go` → implement `Broker` interface
2. `broker/factory.go` → no changes needed
3. `main.go` → `broker.Register(&NewBroker{})`
4. `src/store/brokerStore.js` → add broker config
5. `src/components/broker/BrokerSelector.jsx` → add UI entry

---

## Performance Notes
- Initial bundle: ~47KB (rest lazy-loaded per tab)
- Upstox V3 WebSocket: prices update in ~50ms
- Go in-memory LRU cache: 200 entries, TTL-based
- Render deployment: Node runtime + bash build.sh installs Go 1.22
- Uptime Robot pings /health every 5 min (prevents cold start)
