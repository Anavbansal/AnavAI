# 🚀 Deployment Guide — AnavAI

## Architecture
- **Backend** → Render.com (Node.js — `local-api-server.mjs`)
- **Frontend** → Vercel (React/Vite — `src/`)

---

## 1. Backend — Render.com

### Steps:
1. Go to [render.com](https://render.com) → New → **Web Service**
2. Connect your GitHub repo → select branch `deploy/render-vercel`
3. Settings:
   - **Name**: `anavai-backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node local-api-server.mjs`
   - **Instance Type**: Free (or Starter for better performance)

4. Add **Environment Variables** (from `.env.example`):
   ```
   UPSTOX_CLIENT_ID=...
   UPSTOX_CLIENT_SECRET=...
   UPSTOX_REDIRECT_URI=https://anavai-backend.onrender.com/auth/callback
   GROQ_API_KEY=...
   FRONTEND_URL=https://your-app.vercel.app
   PORT=3002
   NODE_ENV=production
   ```

5. Deploy → Copy your Render URL: `https://anavai-backend.onrender.com`

---

## 2. Frontend — Vercel

### Steps:
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub → select branch `deploy/render-vercel`
3. Framework: **Vite**
4. Build settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. Add **Environment Variables**:
   ```
   VITE_API_BASE_URL=https://anavai-backend.onrender.com
   ```

6. Deploy → Copy your Vercel URL

---

## 3. Update Upstox App Settings

In Upstox Developer Console:
- **Redirect URI**: `https://anavai-backend.onrender.com/auth/callback`

---

## 4. Update Render FRONTEND_URL

Go to Render → Environment → Update:
```
FRONTEND_URL=https://your-actual-vercel-url.vercel.app
```

Then redeploy backend.

---

## Local Development
```bash
# Terminal 1 — Backend
npm run api

# Terminal 2 — Frontend  
npm run dev
```
