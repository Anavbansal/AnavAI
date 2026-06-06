# ⚡ Quick Reference — Upstox SDK Integration

**TL;DR:** Your backend now uses a secure SDK wrapper for all Upstox API calls. All secrets go in `.env`. Everything is documented.

---

## 🚀 5-Minute Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your Upstox credentials
# Get from: https://developer.upstox.com/apps
UPSTOX_CLIENT_ID=your-id
UPSTOX_CLIENT_SECRET=your-secret
UPSTOX_REDIRECT_URI=http://localhost:5173/auth/callback

# 4. Start backend
npm run api
# Should show: ✓ Upstox SDK: ✓ CONFIGURED

# 5. Start frontend (in new terminal)
npm run dev
```

**Done!** Visit http://localhost:5173

---

## 📂 Important Files

| File | Purpose | Action |
|------|---------|--------|
| `.env` | Your secrets | **Create from .env.example** |
| `.env.example` | Template | Read first |
| `upstox-sdk-client.mjs` | SDK wrapper | Don't edit (unless adding methods) |
| `local-api-server.mjs` | Backend server | Uses SDK wrapper |
| `SECURITY.md` | Security guide | **Read before production** |
| `SDK-SETUP.md` | Detailed setup | Reference for setup |
| `INTEGRATION-SUMMARY.md` | What changed | FYI |

---

## 🔐 Security Rules

✅ **DO:**
- ✓ Keep `.env` local (never commit)
- ✓ Use HTTPS in production
- ✓ Rotate client secret monthly
- ✓ Use specific CORS origins
- ✓ Monitor API logs

❌ **DON'T:**
- ✗ Commit `.env` to Git
- ✗ Hardcode API keys
- ✗ Use CORS `*` in production
- ✗ Log tokens/secrets
- ✗ Share `.env` via email/chat

---

## 🔄 Common Commands

```bash
# Development
npm run dev          # Start frontend (port 5173)
npm run api          # Start backend (port 3002)

# Build
npm run build        # Build for production
npm run preview      # Preview production build

# Maintenance
npm install          # Install dependencies
npm install -g npm   # Update npm itself
npm audit fix        # Fix security issues

# Environment
cp .env.example .env # Create .env from template
cat .env             # View your env (be careful with secrets!)
```

---

## 🛠️ How to Use the SDK

### From `local-api-server.mjs`:

```javascript
// Fetch candles
const candles = await UpstoxSDK.getIntradayCandles(
  'NSE_EQ|INE002A01018',  // Instrument key
  '30minute',              // Interval
  token                    // Optional token override
);

// Get LTP
const ltp = await UpstoxSDK.getLTP('NSE_EQ|INE002A01018', token);

// Search symbols
const results = await UpstoxSDK.searchInstruments('TCS', {
  records: 20
}, token);

// OAuth flow
const url = UpstoxSDK.getAuthorizationUrl('http://localhost:5173/auth/callback');
const token = await UpstoxSDK.exchangeAuthCode(code, redirectUri);
const newToken = await UpstoxSDK.refreshAccessToken(refreshToken);
```

**That's it!** All errors handled, secrets protected, tokens managed.

---

## 📍 Environment Variables

### Frontend (Browser-Safe)
```env
VITE_API_BASE_URL=http://localhost:3002
VITE_ANALYZE_API_BASE_URL=http://localhost:3002
VITE_UPSTOX_REDIRECT_URI=http://localhost:5173/auth/callback
```

### Backend (Server-Only Secrets)
```env
UPSTOX_CLIENT_ID=your-id
UPSTOX_CLIENT_SECRET=your-secret
UPSTOX_REDIRECT_URI=http://localhost:5173/auth/callback
UPSTOX_SANDBOX_ACCESS_TOKEN=optional-token
```

### Deployment
```env
LOCAL_API_PORT=3002
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3002
```

---

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| "npm install fails" | Update Node.js to >= 18 |
| "SDK: Missing variables" | Copy `.env.example` to `.env`, fill it in |
| "CORS error" | Check `ALLOWED_ORIGIN` includes your frontend URL |
| "Token expired" | Set `UPSTOX_SANDBOX_ACCESS_TOKEN` in `.env` |
| "Port already in use" | Change `LOCAL_API_PORT` in `.env` |

---

## 📚 More Info

- **SDK Details:** `upstox-sdk-client.mjs` (280 lines, well-commented)
- **Setup Guide:** `SDK-SETUP.md` (350 lines, step-by-step)
- **Security:** `SECURITY.md` (360 lines, best practices)
- **What Changed:** `INTEGRATION-SUMMARY.md` (this is what you got)

---

## ✅ Pre-Production Checklist

Before going live, make sure:

- [ ] `.env` not in Git
- [ ] CORS origins are specific (not `*`)
- [ ] HTTPS enabled
- [ ] UPSTOX_CLIENT_SECRET is in secure vault (not plaintext)
- [ ] Logging doesn't expose secrets
- [ ] Rate limiting configured
- [ ] Error messages are user-friendly
- [ ] Team knows how to rotate credentials
- [ ] Monitoring/alerting is set up

---

## 🎯 One Last Thing

**Read this next:** `SDK-SETUP.md` (5-10 min read)

It has:
- Detailed setup steps
- Architecture diagram
- Usage examples
- Troubleshooting guide
- Deployment checklist

---

**Questions?** Check the docs or review `upstox-sdk-client.mjs` — it's well-commented!

Happy coding! 🚀
