import { json, withCors, resolveToken, getBearerToken, upstoxFetch } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const query = event.queryStringParameters || {};
  const category = query.category || "instrument_keys";
  const instrumentKeys = query.instrument_keys || "";
  
  if (category === "instrument_keys" && !instrumentKeys) {
    return json(400, { status: "error", message: "instrument_keys parameter is required when category is instrument_keys." }, origin);
  }

  const headerToken = getBearerToken(event);
  const { token } = headerToken ? { token: headerToken, usingSandboxToken: false } : resolveToken(event);

  let path = `/v2/news?category=${encodeURIComponent(category)}`;
  if (instrumentKeys) {
    path += `&instrument_keys=${encodeURIComponent(instrumentKeys)}`;
  }

  try {
    const payload = await upstoxFetch(path, { token });
    return json(200, { status: "success", data: payload.data || payload }, origin);
  } catch (error) {
    return json(
      error.statusCode || 500,
      { status: "error", message: error.message || "Failed to fetch news" },
      origin
    );
  }
});