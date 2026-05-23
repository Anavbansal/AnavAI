export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
export const UPSTOX_REDIRECT_URI =
  import.meta.env.VITE_UPSTOX_REDIRECT_URI || `${window.location.origin}/auth/callback`;
export const DEFAULT_WATCHLIST = (
  import.meta.env.VITE_DEFAULT_WATCHLIST ||
  "NSE_EQ|INE848E01016,NSE_EQ|INE669E01016,NSE_INDEX|Nifty 50"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
