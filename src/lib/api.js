import { API_BASE_URL, UPSTOX_REDIRECT_URI } from "../config";

function buildHeaders(token) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function request(path, { method = "GET", token = "", body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

export function getSessionInfo() {
  return request("/session");
}

export function getLoginUrl(mode = "live") {
  return request(`/auth/url?mode=${mode}&redirect_uri=${encodeURIComponent(UPSTOX_REDIRECT_URI)}`);
}

export function exchangeCodeForToken({ code, redirectUri }) {
  return request("/auth/exchange", {
    method: "POST",
    body: {
      code,
      redirectUri
    }
  });
}

export function getIntradayCandles(token, params) {
  const search = new URLSearchParams(params);
  return request(`/historical/intraday-v3?${search.toString()}`, { token });
}

export function getHistoricalCandles(token, params) {
  const search = new URLSearchParams(params);
  return request(`/historical/v3?${search.toString()}`, { token });
}

export function getHistoricalOverview(token, params) {
  const search = new URLSearchParams(params);
  return request(`/historical/overview?${search.toString()}`, { token });
}

export function getMarketNews(token, params) {
  const search = new URLSearchParams(params);
  return request(`/news?${search.toString()}`, { token });
}

export function getCompanyFundamentals(token, params) {
  const search = new URLSearchParams(params);
  return request(`/fundamentals?${search.toString()}`, { token });
}

export function getRealAiAnalysis(input) {
  return request("/ai/analyze", {
    method: "POST",
    body: { input }
  });
}
