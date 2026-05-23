import { getSandboxToken, json, withCors } from "../shared/upstox.js";

export const handler = withCors(async (_event, origin) => {
  return json(
    200,
    {
      status: "success",
      data: {
        sandboxConfigured: Boolean(getSandboxToken()),
        frontendUrl: process.env.FRONTEND_URL || "",
        redirectUri: process.env.UPSTOX_REDIRECT_URI || ""
      }
    },
    origin
  );
});
