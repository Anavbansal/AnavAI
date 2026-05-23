import { exchangeAuthCodeForToken, json, withCors } from "./shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const code = event.queryStringParameters?.code || body.code;

  if (!code) {
    return json(400, { status: "error", message: "Missing authorization code" }, origin);
  }

  // Exchange the code for a fresh token
  const tokenData = await exchangeAuthCodeForToken(code);

  return json(200, {
    status: "success",
    data: tokenData
  }, origin);
});