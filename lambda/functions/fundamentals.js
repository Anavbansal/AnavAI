import { json, withCors, resolveToken, getBearerToken, upstoxFetch } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const query = event.queryStringParameters || {};
  const isin = query.isin;
  // types include: profile, key-ratios, share-holdings, balance-sheet, etc.
  const type = query.type || "profile";
  
  if (!isin) {
    return json(400, { status: "error", message: "isin parameter is required." }, origin);
  }

  const headerToken = getBearerToken(event);
  const { token } = headerToken ? { token: headerToken, usingSandboxToken: false } : resolveToken(event);

  let path = `/v2/fundamentals/${encodeURIComponent(isin)}/${encodeURIComponent(type)}`;

  try {
    const payload = await upstoxFetch(path, { token });
    return json(200, { status: "success", data: payload.data || payload }, origin);
  } catch (error) {
    return json(
      error.statusCode || 500,
      { status: "error", message: error.message || "Failed to fetch fundamentals" },
      origin
    );
  }
});