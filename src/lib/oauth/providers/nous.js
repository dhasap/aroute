import { NOUS_CONFIG } from "../constants/oauth.js";

// Nous Portal device-code flow (RFC 8628) — same protocol as hermes' `hermes auth add nous`:
//   POST {portal}/api/oauth/device/code  (client_id + scope)
//   POST {portal}/api/oauth/token         (grant_type=urn:ietf:params:oauth:grant-type:device_code)
// No PKCE, no client_secret (public client). Pending states come back either as
// HTTP 400 with {error} (RFC) or 200-with-error (kimi-style quirk) — both handled.
const nous = {
  config: NOUS_CONFIG,
  flowType: "device_code",
  requestDeviceCode: async (config) => {
    const response = await fetch(config.deviceCodeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        ...(config.scope ? { scope: config.scope } : {}),
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Device code request failed: ${error}`);
    }
    const data = await response.json();
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      verification_uri_complete:
        data.verification_uri_complete ||
        (data.verification_uri && data.user_code
          ? `${data.verification_uri}?user_code=${data.user_code}`
          : data.verification_uri),
      expires_in: data.expires_in,
      interval: data.interval || 5,
    };
  },
  pollToken: async (config, deviceCode) => {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: config.clientId,
        device_code: deviceCode,
      }),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: "invalid_response", error_description: "non-json token response" };
    }
    // Not-yet-approved states are not failures — the caller keeps polling.
    if (data.error === "authorization_pending" || data.error === "slow_down") {
      return { ok: true, data };
    }
    return { ok: response.ok || !!data.access_token || !!data.error, data };
  },
  mapTokens: (tokens) => ({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    providerSpecificData: {
      authMethod: "device_code",
      ...(tokens.scope ? { scope: tokens.scope } : {}),
      // Portal hands the invoke host with the token (anonymous/free tier gets
      // welcome-api instead of the paid inference host).
      ...(tokens.inference_base_url
        ? { inferenceBaseUrl: tokens.inference_base_url }
        : {}),
    },
  }),
};

export default nous;
