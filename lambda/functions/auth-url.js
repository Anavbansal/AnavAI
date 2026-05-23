import { json, withCors } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const query = event.queryStringParameters || {};
  const redirectUri = query.redirect_uri || process.env.UPSTOX_REDIRECT_URI;

  if (!redirectUri) {
    return json(400, { status: "error", message: "Missing redirect URI configuration." }, origin);
  }

  const clientId = process.env.UPSTOX_CLIENT_ID;

  if (!clientId) {
    return json(400, { status: "error", message: "Missing UPSTOX_CLIENT_ID in Lambda env." }, origin);
  }

  const state = `anavai-${Date.now()}`;
  const authorizationUrl =
    "https://api.upstox.com/v2/login/authorization/dialog" +
    `?response_type=code&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return json(
    200,
    {
      status: "success",
      data: {
        authorizationUrl,
        state
      }
    },
    origin
  );
});
