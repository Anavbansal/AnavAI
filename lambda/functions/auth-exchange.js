import { json, parseJson, withCors } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const body = await parseJson(event);
  const code = body.code;
  const redirectUri = body.redirectUri || process.env.UPSTOX_REDIRECT_URI;

  if (!code || !redirectUri) {
    return json(400, { status: "error", message: "Both code and redirectUri are required." }, origin);
  }

  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return json(400, { status: "error", message: "Missing Upstox client credentials in Lambda env." }, origin);
  }

  const form = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return json(
      response.status,
      {
        status: "error",
        message: payload.errors?.[0]?.message || payload.message || "Failed to exchange authorization code."
      },
      origin
    );
  }

  return json(200, { status: "success", data: payload }, origin);
});
