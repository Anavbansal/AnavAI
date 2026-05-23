import { json, resolveToken, upstoxFetch, withCors } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const { token, usingSandboxToken } = resolveToken(event);
  const query = event.queryStringParameters || {};
  const instrumentKey = query.instrumentKey;
  const unit = query.unit || "minutes";
  const interval = query.interval || "1";
  const toDate = query.toDate;
  const fromDate = query.fromDate;

  if (!instrumentKey || !toDate) {
    return json(400, { status: "error", message: "instrumentKey and toDate are required." }, origin);
  }

  const suffix = fromDate ? `/${encodeURIComponent(fromDate)}` : "";
  const payload = await upstoxFetch(
    `/v3/historical-candle/${encodeURIComponent(instrumentKey)}/${encodeURIComponent(unit)}/${encodeURIComponent(interval)}/${encodeURIComponent(toDate)}${suffix}`,
    { token }
  );

  return json(
    200,
    {
      status: "success",
      data: {
        usingSandboxToken,
        queryType: "historical-v3",
        instrumentKey,
        unit,
        interval,
        toDate,
        fromDate: fromDate || null,
        candles: payload.data?.candles || []
      }
    },
    origin
  );
});
