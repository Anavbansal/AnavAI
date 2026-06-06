# 🔒 Security Guide — ANAV AI

This document outlines security best practices for the ANAV AI application, especially regarding API credentials, environment variables, and sensitive data management.

---

## 📋 Table of Contents

1. [Environment Variables](#environment-variables)
2. [Credential Management](#credential-management)
3. [Backend Security](#backend-security)
4. [Frontend Security](#frontend-security)
5. [Deployment Security](#deployment-security)
6. [Incident Response](#incident-response)

---

## Environment Variables

### What is `.env`?

The `.env` file stores sensitive configuration like API keys, secrets, and environment-specific URLs. It is **never committed to version control**.

### Setup Instructions

1. **Copy the template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your credentials:**
   ```env
   UPSTOX_CLIENT_ID=your-actual-client-id
   UPSTOX_CLIENT_SECRET=your-actual-client-secret
   UPSTOX_SANDBOX_ACCESS_TOKEN=your-token-here
   ```

3. **Verify .gitignore:**
   ```bash
   cat .gitignore | grep ".env"
   # Output should include: .env
   ```

4. **Start the server:**
   ```bash
   npm run api
   ```

### Variable Categories

#### Frontend Variables (Browser-Exposed)
- `VITE_API_BASE_URL` — Backend API endpoint
- `VITE_ANALYZE_API_BASE_URL` — Analysis engine endpoint
- `VITE_UPSTOX_REDIRECT_URI` — OAuth callback URL
- `VITE_DEFAULT_WATCHLIST` — Default instrument list

**⚠️ These are visible in browser, treat them as public.**

#### Backend Variables (Server-Only, Secret)
- `UPSTOX_CLIENT_ID` — Upstox app client ID
- `UPSTOX_CLIENT_SECRET` — Upstox app secret (**KEEP PRIVATE**)
- `UPSTOX_SANDBOX_ACCESS_TOKEN` — Sandbox token
- `UPSTOX_REDIRECT_URI` — OAuth redirect URL
- `LOCAL_API_PORT` — Server port
- `FRONTEND_URL` — Frontend URL for CORS
- `ALLOWED_ORIGIN` — CORS allowed origins

**🔒 These must NEVER be exposed or logged.**

---

## Credential Management

### Getting Upstox Credentials

1. **Visit:** https://developer.upstox.com/apps
2. **Create or select an app**
3. **Copy credentials:**
   - Client ID → `UPSTOX_CLIENT_ID`
   - Client Secret → `UPSTOX_CLIENT_SECRET`
   - Redirect URI → Set to your callback URL
4. **Generate sandbox token (optional):**
   - Useful for testing without OAuth flow
   - Set as `UPSTOX_SANDBOX_ACCESS_TOKEN`

### Secret Rotation

#### Monthly (Recommended)
- Rotate `UPSTOX_CLIENT_SECRET`
- Update in `.env` locally
- No action needed in version control (it's not there!)

#### When Compromised
1. **Immediately revoke in Upstox Dashboard**
2. **Generate new credentials**
3. **Update `.env`**
4. **Restart the server**
5. **Monitor for suspicious activity**

### OAuth Token Lifecycle

The SDK automatically handles:
- ✓ Token expiration detection
- ✓ Automatic token refresh
- ✓ Secure token storage (in-memory during request)

**Note:** Never store tokens in localStorage or cookies without encryption.

---

## Backend Security

### SDK Client Integration

All API calls use the `upstox-sdk-client.mjs` wrapper, which provides:

✓ **Centralized credential management** — Single source of truth  
✓ **Error handling** — No secrets in error messages  
✓ **Token validation** — Ensures valid credentials before requests  
✓ **Type safety** — Structured API calls (if using TypeScript)  
✓ **Audit trail** — SDK logs API activity (without logging secrets)  

### API Endpoints Security

#### `/analyze` — POST
- Authenticates with `UPSTOX_SANDBOX_ACCESS_TOKEN` or OAuth bearer token
- Returns real market data from Upstox
- No sensitive data in responses

#### `/auth/url` — GET
- Generates OAuth authorization URL
- Safe to call from frontend

#### `/auth/exchange` — POST
- Exchanges authorization code for access token
- Uses `UPSTOX_CLIENT_SECRET` (server-side only)
- Returns new access token

#### `/api/search` — GET
- Public instrument search
- No authentication required

### Error Handling

**DO:**
```javascript
console.error('Failed to fetch candles:', err.message)  // ✓ Safe
```

**DON'T:**
```javascript
console.error('Failed:', err)  // ✗ May include token
console.log('Token:', token)    // ✗ Never log secrets
```

### CORS Configuration

```env
# Local Development
ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3002

# Production
ALLOWED_ORIGIN=https://anav-app.example.com

# ✗ NEVER use ALLOWED_ORIGIN=*
```

---

## Frontend Security

### DO's ✓

- ✓ Use HTTPS in production
- ✓ Store JWT tokens in httpOnly cookies (if using them)
- ✓ Validate OAuth state parameter
- ✓ Clear sensitive data on logout
- ✓ Use Content-Security-Policy headers
- ✓ Keep dependencies updated

### DON'Ts ✗

- ✗ Never hardcode API keys in React components
- ✗ Don't store `UPSTOX_CLIENT_SECRET` in frontend
- ✗ Never expose tokens in error messages to users
- ✗ Don't save tokens to localStorage without encryption
- ✗ Never log user data or tokens

### Example: Secure OAuth Flow

```javascript
// ✓ Safe: Token stored in httpOnly cookie by backend
const response = await fetch('/auth/exchange', {
  method: 'POST',
  credentials: 'include', // Include httpOnly cookies
  body: JSON.stringify({ code })
})

// ✗ Unsafe: Token in browser memory/localStorage
const token = localStorage.getItem('token') // Don't do this
```

---

## Deployment Security

### Environment-Specific Setup

#### Development
```env
VITE_API_BASE_URL=http://localhost:3002
UPSTOX_REDIRECT_URI=http://localhost:5173/auth/callback
```

#### Staging
```env
VITE_API_BASE_URL=https://staging-api.example.com
UPSTOX_REDIRECT_URI=https://staging.example.com/auth/callback
ALLOWED_ORIGIN=https://staging.example.com
```

#### Production
```env
VITE_API_BASE_URL=https://api.example.com
UPSTOX_REDIRECT_URI=https://example.com/auth/callback
ALLOWED_ORIGIN=https://example.com
# Use AWS Secrets Manager or similar for secrets
```

### Secret Management Solutions

#### Option 1: AWS Secrets Manager
```bash
# Store secret
aws secretsmanager create-secret \
  --name anav/upstox/client-secret \
  --secret-string "your-secret-here"

# Retrieve in Node.js
const AWS = require('aws-sdk');
const client = new AWS.SecretsManager();
const secret = await client.getSecretValue({
  SecretId: 'anav/upstox/client-secret'
}).promise();
```

#### Option 2: GitHub Secrets (for CI/CD)
```yaml
# .github/workflows/deploy.yml
env:
  UPSTOX_CLIENT_SECRET: ${{ secrets.UPSTOX_CLIENT_SECRET }}
```

#### Option 3: HashiCorp Vault
- Enterprise-grade secret management
- Automatic rotation support
- Audit logging

### TLS/HTTPS

**Development:**
- HTTP is acceptable for `localhost:3000`

**Staging/Production:**
- HTTPS REQUIRED
- Use Let's Encrypt (free) or Acme certificates
- Minimum TLS 1.2

```bash
# Check your HTTPS setup
curl -I https://your-domain.com
# Should show: HTTP/2 200 or HTTP/1.1 200
```

---

## Incident Response

### If Credentials Are Compromised

#### Immediate (0-5 minutes)
1. **Revoke credentials in Upstox Dashboard**
   - https://developer.upstox.com/apps
   - Delete or regenerate credentials

2. **Notify team members**
   - Slack: "⚠️ API credential leaked, regenerating now"

#### Short-term (5-30 minutes)
1. **Generate new credentials** in Upstox Dashboard
2. **Update `.env`** locally
3. **Restart the server**
4. **Update production secrets** (AWS Secrets Manager, etc.)
5. **Redeploy the application**

#### Follow-up (24 hours)
1. **Review API logs** for suspicious activity
   - Check unusual symbols, volumes, or patterns
   - Monitor failed authentication attempts

2. **Update team access controls**
   - Rotate team member credentials
   - Audit who has access to `.env`

3. **Post-incident review**
   - How was credential exposed?
   - How to prevent next time?
   - Update documentation

### If Access Token Is Compromised

Access tokens are **short-lived** (typically 24 hours) and should be:
- Automatically refreshed by the SDK
- Never logged or stored insecurely
- Used only for API calls, not stored persistently

**Action:**
1. Revoke token in Upstox Dashboard (if possible)
2. System automatically refreshes token on next API call
3. Monitor for unusual API activity

---

## Checklist

Before deploying to production:

- [ ] `.env` is in `.gitignore` and never committed
- [ ] `UPSTOX_CLIENT_SECRET` is stored in secure vault, not in code
- [ ] HTTPS is enabled on all URLs
- [ ] CORS `ALLOWED_ORIGIN` is specific, not `*`
- [ ] Error messages don't expose secrets
- [ ] Secrets are rotated monthly
- [ ] Access logs are monitored
- [ ] Team knows incident response procedure
- [ ] Dependencies are updated (`npm audit fix`)
- [ ] Security headers are configured (HSTS, CSP, etc.)

---

## Additional Resources

- **Upstox API Docs:** https://developer.upstox.com/api-documentation
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **Node.js Security:** https://nodejs.org/en/docs/guides/security/
- **GitHub Security:** https://docs.github.com/en/code-security

---

## Questions?

Contact the security team or file an issue for questions about this guide.

**Last Updated:** May 23, 2026  
**Version:** 1.0
