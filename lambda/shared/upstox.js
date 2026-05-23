const LIVE_BASE_URL = "https://api-v2.upstox.com";
const SANDBOX_BASE_URL = "https://api-v2.upstox.com"; // same endpoint, token determines access level

export function json(statusCode, body, origin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

export function getAllowedOrigin() {
  return process.env.ALLOWED_ORIGIN || process.env.FRONTEND_URL || "*";
}

export function getSandboxToken() {
  return process.env.UPSTOX_SANDBOX_ACCESS_TOKEN || "";
}

export function getBearerToken(event) {
  const header = event.headers?.Authorization || event.headers?.authorization || "";

  if (header.startsWith("Bearer ")) {
    return header.replace("Bearer ", "").trim();
  }

  return "";
}

export async function parseJson(event) {
  if (!event.body) {
    return {};
  }

  return JSON.parse(event.body);
}

export async function upstoxFetch(path, { method = "GET", token, body, contentType = "application/json" } = {}) {
  // Since you are using a Sandbox token, you MUST use the Sandbox API base URL.
  // Change this to LIVE_BASE_URL when you transition to a Live app token.
  const baseUrl = SANDBOX_BASE_URL;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": contentType } : {})
    },
    body
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload.errors?.[0]?.message ||
      payload.message ||
      `Upstox request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.errorCode = payload.errors?.[0]?.errorCode;
    throw error;
  }

  return payload;
}

export async function exchangeAuthCodeForToken(code) {
  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Upstox OAuth environment variables (Client ID, Secret, or Redirect URI).");
  }

  const body = new URLSearchParams({
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch(`${LIVE_BASE_URL}/v2/login/authorization/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: body.toString()
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.errors?.[0]?.message || `Token exchange failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return payload; // Returns { access_token: "...", ... }
}

export function resolveToken(event) {
  // Prefer the sandbox token from environment variable (set in .env)
  const envToken = process.env.UPSTOX_SANDBOX_ACCESS_TOKEN;
  if (envToken) {
    return {
      token: envToken,
      usingSandboxToken: true
    };
  }

  // Fallback: use the hardcoded sandbox token
  const hardcodedToken = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIzQ0JSQjgiLCJqdGkiOiI2YTEwMjkyNzdlMzJiODY0ZWViZDJmNjAiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaWF0IjoxNzc5NDQ0MDA3LCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3ODE5OTI4MDB9.cu2QR4pqx4fJMvhpoNeYWFDo_Xxma1iIc7HpPAyaJ6U";

  return {
    token: hardcodedToken,
    usingSandboxToken: true
  };
}

export function withCors(handler) {
  return async (event) => {
    const origin = getAllowedOrigin();

    if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
      return json(200, { ok: true }, origin);
    }

    try {
      return await handler(event, origin);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return json(
        statusCode,
        {
          status: "error",
          message: error.message || "Unexpected server error",
          errorCode: error.errorCode
        },
        origin
      );
    }
  };
}
