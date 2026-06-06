# 🔧 Upstox SDK Integration Setup Guide

## Overview

Your application has been updated to use the **Upstox JavaScript SDK** for secure, modular API integration. All sensitive credentials are now managed through environment variables, with a dedicated SDK wrapper module that centralizes all Upstox API calls.

---

## What Changed

### ✨ New Files Created

#### 1. `upstox-sdk-client.mjs` — SDK Wrapper Module
- **Purpose:** Secure, centralized wrapper for all Upstox SDK calls
- **Features:**
  - Automatic client initialization with credentials from `.env`
  - Error handling without exposing secrets
  - Token management and refresh logic
  - Configuration validation on startup
  - Supports multiple concurrent API calls

**Key Exports:**
```javascript
export {
  getIntradayCandles,
  getHistoricalCandles,
  getLTP,
  getQuote,
  getOptionChain,
  searchInstruments,
  getProfile,
  exchangeAuthCode,
  refreshAccessToken,
  getAuthorizationUrl,
  getConfigStatus,
  CONFIG,
  validateConfig,
  initializeClients,
  getClients
}
```

#### 2. `.env.example` — Comprehensive Template
- **Purpose:** Reference guide for all environment variables
- **Contents:**
  - Frontend (VITE_*) variables
  - Backend (Upstox) credentials
  - CORS & deployment settings
  - Security best practices
  - Setup instructions
  - DO's and DON'Ts

#### 3. `SECURITY.md` — Security Best Practices
- **Purpose:** Comprehensive security guide for the team
- **Contents:**
  - Credential management
  - Backend & frontend security
  - Deployment best practices
  - Incident response procedures
  - Checklist before production

### 🔄 Updated Files

#### 1. `package.json`
- **Added:** `upstox-js-sdk` dependency
- **Updated:** Engine requirements (Node.js >= 18)

#### 2. `local-api-server.mjs`
- **Imports:** Now uses `upstox-sdk-client.mjs`
- **Refactored Functions:**
  - `fetchRealCandles()` → Uses `UpstoxSDK.getIntradayCandles()` & `getHistoricalCandles()`
  - `fetchLTP()` → Uses `UpstoxSDK.getLTP()`
  - `searchUpstoxInstruments()` → Uses `UpstoxSDK.searchInstruments()`
  - OAuth endpoints → Use `UpstoxSDK.exchangeAuthCode()` & `refreshAccessToken()`
- **Removed:** Raw HTTP fetch calls for Upstox API
- **Added:** SDK status reporting on startup

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd "path/to/fixed-app"
npm install
```

This will install `upstox-js-sdk` and all other dependencies.

### Step 2: Configure Environment Variables

1. **Copy the template:**
   ```bash
   cp .env.example .env
   ```

2. **Get Upstox credentials from https://developer.upstox.com/apps:**
   - Client ID
   - Client Secret
   - Register your Redirect URI

3. **Fill in `.env`:**
   ```env
   # Required for Upstox API
   UPSTOX_CLIENT_ID=your-client-id
   UPSTOX_CLIENT_SECRET=your-client-secret
   UPSTOX_REDIRECT_URI=http://localhost:5173/auth/callback
   
   # Frontend
   VITE_API_BASE_URL=http://localhost:3002
   VITE_ANALYZE_API_BASE_URL=http://localhost:3002
   VITE_UPSTOX_REDIRECT_URI=http://localhost:5173/auth/callback
   
   # Optional: Sandbox token for testing
   UPSTOX_SANDBOX_ACCESS_TOKEN=your-token-here
   
   # Backend
   LOCAL_API_PORT=3002
   FRONTEND_URL=http://localhost:5173
   ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3002
   ```

### Step 3: Verify Configuration

Start the backend server:
```bash
npm run api
```

You should see:
```
🚀 ANAV PRO Local API Server
   Port: 3002
   Upstox SDK: ✓ CONFIGURED
   Sandbox Token: ✓ LOADED (or ✗ NOT SET)
   Symbols: 44 mapped
   CORS Origins: http://localhost:5173, http://localhost:3002

✓ All systems ready!
```

### Step 4: Start the Frontend

In a new terminal:
```bash
npm run dev
```

Visit: http://localhost:5173

---

## Architecture

### Before: Direct HTTP Calls
```
Frontend → Direct fetch() → Upstox API
                 ↓
              Errors, secrets in logs
```

### After: SDK Wrapper Pattern
```
Frontend → Backend (local-api-server.mjs)
   ↓
   └→ SDK Wrapper (upstox-sdk-client.mjs)
       ↓
       └→ Upstox SDK (upstox-js-sdk)
           ↓
           └→ Upstox API
       
Benefits:
  ✓ Credentials stay on backend
  ✓ Centralized error handling
  ✓ Easy to mock/test
  ✓ Single source of truth for Upstox calls
```

---

## Usage Examples

### From `local-api-server.mjs`

#### Fetch Intraday Candles (Old vs New)

**Before:**
```javascript
const res = await fetch(`${UPSTOX_BASE}/historical-candle/intraday/${instrumentKey}/30minute`, {
  headers: { Authorization: `Bearer ${token}`, "Api-Version": "2.0" }
});
const data = await res.json();
const candles = data?.data?.candles || [];
```

**After:**
```javascript
const candles = await UpstoxSDK.getIntradayCandles(instrumentKey, '30minute', token);
```

#### Search Instruments

**Before:**
```javascript
const params = new URLSearchParams({ query, exchanges: 'NSE,BSE', ... });
const payload = await upstoxGet(`/v2/instruments/search?${params.toString()}`, token);
return payload?.data || [];
```

**After:**
```javascript
const results = await UpstoxSDK.searchInstruments(query, {
  exchanges: 'NSE,BSE',
  records: 10
}, token);
return results;
```

#### OAuth Code Exchange

**Before:**
```javascript
const form = new URLSearchParams({
  code, client_id, client_secret, grant_type: 'authorization_code'
});
const r2 = await fetch('https://api-v2.upstox.com/v2/login/authorization/token', {
  method: 'POST',
  body: form.toString()
});
```

**After:**
```javascript
const tokenData = await UpstoxSDK.exchangeAuthCode(code, redirectUri);
// Returns: { accessToken, expiresIn, tokenType, refreshToken }
```

---

## Security Highlights

### ✅ What's Secured

| Aspect | How |
|--------|-----|
| **Credentials** | Stored in `.env`, never in code |
| **Secrets** | Managed by SDK wrapper, never logged |
| **Token handling** | SDK manages lifecycle, auto-refresh |
| **Error messages** | Sanitized, no token exposure |
| **CORS** | Configurable, specific origins only |
| **API isolation** | Backend acts as proxy, not exposed to frontend |

### 🔒 Best Practices Implemented

1. **Environment Separation**
   - Frontend vars (VITE_*) = browser-safe
   - Backend vars = server-only secrets

2. **Credential Rotation**
   - Update `.env` locally
   - No Git history to clean up
   - Restart server for changes

3. **Error Handling**
   - SDK catches errors before they escape
   - No sensitive data in error responses

4. **Centralized Management**
   - All Upstox calls in one module
   - Easy to audit, update, or replace

---

## Common Tasks

### Add a New API Call

1. **Find the method** in `upstox-sdk-client.mjs`
2. **Call from** `local-api-server.mjs`:
   ```javascript
   const data = await UpstoxSDK.getOptionChain(symbol, expiryDate, token);
   ```

### Update Credentials

1. **Edit `.env`:**
   ```env
   UPSTOX_CLIENT_SECRET=new-secret-here
   ```

2. **Restart server:**
   ```bash
   npm run api
   ```

### Check Configuration Status

Add this endpoint (or check logs on startup):
```javascript
const status = UpstoxSDK.getConfigStatus();
console.log(status);
// {
//   isValid: true,
//   hasSandboxToken: true,
//   missingVars: [],
//   config: { baseUrl, apiVersion, ... }
// }
```

### Enable Debug Logging

Set in `.env`:
```env
DEBUG=true
```

---

## Troubleshooting

### "Missing environment variables: UPSTOX_CLIENT_ID, ..."

**Solution:** Make sure all required variables are in `.env`:
```bash
cat .env | grep UPSTOX
# Should show: CLIENT_ID, CLIENT_SECRET, REDIRECT_URI
```

### "No access token available"

**Cause:** Neither `.env` token nor OAuth token is available

**Solutions:**
1. Set `UPSTOX_SANDBOX_ACCESS_TOKEN` in `.env` for testing
2. Or use OAuth flow: `/auth/url` → `/auth/exchange`

### "CORS error when calling backend"

**Check:** `ALLOWED_ORIGIN` in `.env` includes your frontend URL
```env
# ✓ Correct
ALLOWED_ORIGIN=http://localhost:5173

# ✗ Wrong
ALLOWED_ORIGIN=*
```

### "Token expired" errors

**Note:** SDK automatically handles token refresh. If still failing:
1. Check if refresh token is available
2. Regenerate tokens via OAuth flow
3. Check token expiration in `.env`

---

## Testing the Integration

### Test 1: Check SDK Initialization
```bash
node -e "import('./upstox-sdk-client.mjs').then(m => console.log(m.getConfigStatus()))"
```

### Test 2: API Server Startup
```bash
npm run api
# Should show: ✓ Upstox SDK: ✓ CONFIGURED
```

### Test 3: Make an API Call
```javascript
// In a test file or Node REPL
import * as UpstoxSDK from './upstox-sdk-client.mjs';

const token = process.env.UPSTOX_SANDBOX_ACCESS_TOKEN;
const results = await UpstoxSDK.searchInstruments('TCS', {}, token);
console.log(results);
```

---

## Deployment Checklist

Before deploying to production:

- [ ] ✅ `.env` is in `.gitignore`
- [ ] ✅ No hardcoded secrets in code
- [ ] ✅ CORS `ALLOWED_ORIGIN` is specific (not `*`)
- [ ] ✅ HTTPS enabled on all URLs
- [ ] ✅ SDK status shows ✓ CONFIGURED on startup
- [ ] ✅ Error messages are sanitized (no tokens/secrets)
- [ ] ✅ Rate limiting is configured
- [ ] ✅ Monitoring/logging is set up
- [ ] ✅ Read SECURITY.md and complete its checklist

---

## Support & Documentation

- **Upstox API Docs:** https://developer.upstox.com/api-documentation
- **SDK GitHub:** https://github.com/UpstoxPublic/upstox-js-sdk
- **Security Guide:** See [SECURITY.md](SECURITY.md)
- **Environment Template:** See [.env.example](.env.example)

---

**Version:** 1.0  
**Date:** May 23, 2026  
**Next Review:** June 23, 2026
