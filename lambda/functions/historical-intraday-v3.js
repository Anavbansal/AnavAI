import { json, resolveToken, upstoxFetch, withCors } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const { token, usingSandboxToken } = resolveToken(event);
  const query = event.queryStringParameters || {};
  const instrumentKey = query.instrumentKey;
  const unit = query.unit || "minutes";
  const interval = query.interval || "1";

  if (!instrumentKey) {
    return json(400, { status: "error", message: "instrumentKey is required." }, origin);
  }

  const payload = await upstoxFetch(
    `/v3/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/${encodeURIComponent(unit)}/${encodeURIComponent(interval)}`,
    { token }
  );

  return json(
    200,
    {
      status: "success",
      data: {
        usingSandboxToken,
        queryType: "intraday-v3",
        instrumentKey,
        unit,
        interval,
        candles: payload.data?.candles || []
      }
    },
    origin
  );
});
