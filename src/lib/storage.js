const ACCESS_TOKEN_KEY = "anavai.upstox.accessToken";
const SESSION_MODE_KEY = "anavai.upstox.sessionMode";

export function getStoredAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function setStoredAccessToken(token) {
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getStoredSessionMode() {
  return window.localStorage.getItem(SESSION_MODE_KEY) || "sandbox";
}

export function setStoredSessionMode(mode) {
  window.localStorage.setItem(SESSION_MODE_KEY, mode);
}
